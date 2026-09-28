import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { parseRefUrls, refOrder, type Candidate } from './candidates';
import type { Term } from './focus';
import { VIEWPORT, type Box } from './shared';

const run = promisify(execFile);

const BIN =
    process.env.AGENT_BROWSER_BIN ??
    resolve(process.cwd(), 'node_modules/.bin/agent-browser');

/**
 * Debian's chromium, installed into the Docker image. Containers run as
 * root, where Chrome refuses to start without --no-sandbox. Locally
 * agent-browser finds Chrome on its own.
 */
const SYSTEM_CHROMIUM = '/usr/bin/chromium';

/** Per-command ceiling so a hung page can't stall a run forever. */
const COMMAND_TIMEOUT_MS = 45_000;

export type { Box };

export type PageState = {
    url: string;
    title: string;
    /** Readable text of the main content (capped at 60k characters). */
    text: string;
    /** `agent-browser snapshot -i -c -u`: the interactive accessibility tree. */
    tree: string;
    refs: Candidate[];
};

type CliResponse<T> = { success: boolean; data?: T; error?: string | null };

const READ_PAGE = `(() => {
    const root = document.querySelector('main, article, [role=main]') ?? document.body;
    const text = (root?.innerText ?? '').replace(/\\s+/g, ' ').trim().slice(0, 60000);
    return JSON.stringify({ url: location.href, title: document.title, text });
})()`;

/**
 * True once the page is fully loaded, or once it looks done to a person:
 * the DOM is parsed, every image in the viewport has loaded, and no network
 * response has finished for 500 ms. Long-lived requests (analytics beacons,
 * sockets) never finish, so they don't hold it up. Past the browser's
 * resource-timing buffer (250 entries by default) new responses go
 * unrecorded; the viewport-image check still holds the wait on those pages.
 */
const PAGE_READY = `(() => {
    if (document.readyState === 'complete') return true;
    if (document.readyState === 'loading') return false;
    const inView = (img) => {
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    };
    if (![...document.images].filter(inView).every((img) => img.complete)) return false;
    const ends = performance.getEntriesByType('resource').map((e) => e.responseEnd);
    return performance.now() - Math.max(0, ...ends) > 500;
})()`;

const INSTANT_SCROLL = `(() => {
    for (const el of [document.documentElement, document.body]) {
        el?.style.setProperty('scroll-behavior', 'auto', 'important');
    }
})()`;

/** Most evidence candidates offered to Jev on the destination screen. */
const MAX_EVIDENCE_CANDIDATES = 30;

/**
 * Collects small visible blocks of text that mention the goal's terms, keeps
 * the best-scoring ones, and tags each with `data-demo-evidence` so a follow-up
 * call can scroll to the one Jev picks. Runs in the page; the terms are
 * spliced in as JSON.
 */
const COLLECT_EVIDENCE = (terms: Term[]) => `(() => {
    const terms = ${JSON.stringify(terms)};
    const patterns = terms.map((t) => ({ re: new RegExp(t.pattern, 'iu'), weight: t.weight }));
    const score = (text) =>
        patterns.reduce((sum, p) => p.re.test(text) ? sum + p.weight : sum, 0);
    // SVG elements have no innerText.
    const textOf = (el) => el.innerText ?? el.textContent ?? '';
    document.querySelectorAll('[data-demo-evidence]').forEach((el) => el.removeAttribute('data-demo-evidence'));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    const found = [];
    while (walker.nextNode()) {
        const value = walker.currentNode.nodeValue.toLowerCase();
        if (!terms.some((t) => value.includes(t.term))) continue;
        let el = walker.currentNode.parentElement;
        while (el?.parentElement && el.parentElement !== document.body &&
            textOf(el.parentElement).length <= 280) {
            el = el.parentElement;
        }
        if (!el || seen.has(el)) continue;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1 || rect.height > 600) continue;
        const text = textOf(el).replace(/\\s+/g, ' ').trim();
        const s = score(text);
        if (s > 0) found.push({ el, text: text.slice(0, 300), s });
    }
    found.sort((a, b) => b.s - a.s);
    return JSON.stringify(found.slice(0, ${MAX_EVIDENCE_CANDIDATES}).map((f, i) => {
        f.el.setAttribute('data-demo-evidence', String(i));
        return f.text;
    }));
})()`;

const REVEAL_EVIDENCE = (index: number) => `(() => {
    const el = document.querySelector('[data-demo-evidence="${index}"]');
    if (!el) return 'null';
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.x, y: r.y, width: r.width, height: r.height });
})()`;

function launchArgs(): string[] {
    if (process.env.AGENT_BROWSER_EXECUTABLE_PATH) return [];
    if (!existsSync(SYSTEM_CHROMIUM)) return [];
    return ['--executable-path', SYSTEM_CHROMIUM, '--args', '--no-sandbox'];
}

/** One high-level browser action, for the activity panel. */
export type BrowserAction = {
    title: string;
    /** The agent-browser command that does the main work. */
    command: string;
    detail: string[];
    /** CLI invocations the action took (waits, evals, and the command). */
    calls: number;
    ms: number;
};

/**
 * Thin wrapper over the agent-browser CLI. Each session gets its own daemon
 * and browser, so concurrent journeys never share tabs. `onAction` hears
 * about every high-level action with its timing.
 */
export function createBrowser(
    session: string,
    { onAction }: { onAction?: (action: BrowserAction) => void } = {},
) {
    const base = [
        '--session',
        session,
        // Pages can advertise WebMCP tools that the CLI announces in its
        // output. Journeys never use them, and they are page-controlled text.
        '--no-webmcp',
        // A run that dies before close() would otherwise leave the browser
        // daemon running for the default hour.
        '--idle-timeout',
        '5m',
        ...launchArgs(),
    ];
    let calls = 0;

    async function cli(args: string[], input?: string) {
        calls++;
        const child = run(BIN, [...base, ...args], {
            maxBuffer: 20 * 1024 * 1024,
            timeout: COMMAND_TIMEOUT_MS,
        });
        if (input !== undefined) child.child.stdin?.end(input);
        const { stdout } = await child;
        return stdout;
    }

    /** Runs one action and reports it, including when it fails. */
    async function traced<T>(
        title: string,
        command: string,
        fn: () => Promise<T>,
        describe: (result: T) => string[] = () => [],
    ): Promise<T> {
        const started = performance.now();
        const callsBefore = calls;
        const report = (detail: string[]) =>
            onAction?.({
                title,
                command: `agent-browser ${command}`,
                detail,
                calls: calls - callsBefore,
                ms: Math.round(performance.now() - started),
            });
        try {
            const result = await fn();
            report(describe(result));
            return result;
        } catch (error) {
            report([
                `Failed: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`,
            ]);
            throw error;
        }
    }

    /**
     * Wait until `condition` holds in the page, or `ms` pass. The deadline
     * lives in the expression itself: agent-browser's timeout comes from an
     * env var, and changing it between commands restarts the browser.
     */
    async function waitFor(condition: string, ms: number) {
        const deadline = Date.now() + ms;
        await cli([
            'wait',
            '--fn',
            `(${condition}) || Date.now() > ${deadline}`,
        ]).catch(() => {});
    }

    async function json<T>(args: string[], input?: string): Promise<T> {
        const stdout = await cli(['--json', ...args], input);
        const response = JSON.parse(stdout) as CliResponse<T>;
        if (!response.success || response.data === undefined) {
            throw new Error(
                `agent-browser ${args[0]} failed: ${response.error ?? stdout.slice(0, 300)}`,
            );
        }
        return response.data;
    }

    /**
     * Let the page finish loading before it is read or captured. After a
     * click, first wait for the URL to change when a navigation is expected
     * (a link), or briefly when it might be (a button that submits); menus
     * and tabs don't navigate, so that wait just times out. Then wait until
     * the page looks done (see PAGE_READY) rather than for the full `load`
     * event, which also waits on below-the-fold images and slow third-party
     * scripts. Finally give menus and transitions a short beat.
     */
    async function settle(
        after: { fromUrl: string; expectNavigation: boolean } | null = null,
    ) {
        if (after) {
            await waitFor(
                `location.href !== ${JSON.stringify(after.fromUrl)}`,
                after.expectNavigation ? 8000 : 1500,
            );
        }
        await waitFor(PAGE_READY, 10_000);
        await cli(['wait', '300']);
    }

    /**
     * A link with target=_blank opens a new tab, and agent-browser switches
     * to it. Close the tabs left behind so a long run doesn't pile them up.
     */
    async function closeInactiveTabs() {
        const { tabs } = await json<{
            tabs: { tabId: string; active: boolean }[];
        }>(['tab', 'list']).catch(() => ({ tabs: [] }));
        for (const tab of tabs) {
            if (!tab.active) {
                await cli(['tab', 'close', tab.tabId]).catch(() => {});
            }
        }
    }

    async function readPage(): Promise<PageState> {
        const snapshot = await json<{
            snapshot: string;
            refs: Record<string, { role: string; name: string }>;
        }>(['snapshot', '-i', '-c', '-u']);
        const urls = parseRefUrls(snapshot.snapshot);
        const order = refOrder(snapshot.snapshot);
        const { result } = await json<{ result: string }>(
            ['eval', '--stdin'],
            READ_PAGE,
        );
        const page = JSON.parse(result) as Pick<
            PageState,
            'url' | 'title' | 'text'
        >;
        return {
            ...page,
            tree: snapshot.snapshot,
            refs: Object.entries(snapshot.refs)
                .map(([ref, value]) => ({
                    ref,
                    role: value.role,
                    name: value.name,
                    href: urls.get(ref),
                }))
                .sort(
                    (a, b) =>
                        (order.get(a.ref) ?? Number.MAX_SAFE_INTEGER) -
                        (order.get(b.ref) ?? Number.MAX_SAFE_INTEGER),
                ),
        };
    }

    /**
     * Viewport-relative box after bringing the element to the middle of the
     * screen, or null when it can't be shown (hidden, zero-size, or inside a
     * container that won't scroll it into the viewport).
     */
    async function measureBox(ref: string): Promise<Box | null> {
        // Sites with `scroll-behavior: smooth` would still be animating when
        // the screenshot is taken.
        await cli(['eval', '--stdin'], INSTANT_SCROLL).catch(() => {});
        await cli(['scrollintoview', `@${ref}`]).catch(() => {});
        const measure = () =>
            json<Box>(['get', 'box', `@${ref}`]).catch(() => null);

        let box = await measure();
        if (!box || box.width < 1 || box.height < 1) return null;

        const offset = Math.round(box.y + box.height / 2 - VIEWPORT.height / 2);
        if (Math.abs(offset) > 80) {
            await cli(
                ['eval', '--stdin'],
                `window.scrollBy({ top: ${offset}, behavior: 'instant' })`,
            ).catch(() => {});
            box = await measure();
            if (!box) return null;
        }

        const onScreen =
            box.y >= 0 &&
            box.x >= 0 &&
            box.y + box.height <= VIEWPORT.height &&
            box.x + box.width <= VIEWPORT.width;
        if (!onScreen) return null;
        return { x: box.x, y: box.y, width: box.width, height: box.height };
    }

    return {
        open(url: string) {
            return traced(
                'Open the start page',
                `open ${url}`,
                async () => {
                    await cli([
                        'set',
                        'viewport',
                        String(VIEWPORT.width),
                        String(VIEWPORT.height),
                    ]);
                    await cli(['open', url]);
                    await settle();
                },
                () => [
                    `Viewport ${VIEWPORT.width}×${VIEWPORT.height}, waited for the page to settle`,
                ],
            );
        },

        read() {
            return traced(
                'Read the page',
                'snapshot -i -c -u',
                readPage,
                (page) => [
                    `${page.refs.length} elements in the accessibility tree`,
                    `${page.text.length.toLocaleString('en-US')} characters of page text`,
                ],
            );
        },

        box(ref: string) {
            return traced(
                'Scroll the target into view',
                `scrollintoview @${ref}`,
                () => measureBox(ref),
                (box) => [
                    box
                        ? 'Measured its box for the highlight'
                        : 'Could not show it on screen, so no highlight',
                ],
            );
        },

        /**
         * Passages on the page that mention the goal's terms, best first,
         * for Jev to choose the evidence from. Empty on failure: evidence is
         * a nice-to-have and must not end the run.
         */
        evidenceCandidates(terms: Term[]) {
            return traced(
                'Find passages that mention the goal',
                'eval --stdin',
                async (): Promise<string[]> => {
                    if (terms.length === 0) return [];
                    try {
                        const { result } = await json<{ result: string }>(
                            ['eval', '--stdin'],
                            COLLECT_EVIDENCE(terms),
                        );
                        return JSON.parse(result) as string[];
                    } catch {
                        return [];
                    }
                },
                (passages) => [
                    `Searched for ${terms
                        .slice(0, 5)
                        .map((t) => `"${t.term}"`)
                        .join(', ')}`,
                    `${passages.length} candidate passages`,
                ],
            );
        },

        /** Scroll candidate `index` (from evidenceCandidates) into view. */
        revealEvidence(index: number) {
            return traced(
                'Scroll the answer into view',
                'eval --stdin',
                async () => {
                    await cli(['eval', '--stdin'], INSTANT_SCROLL).catch(
                        () => {},
                    );
                    const found = await json<{ result: string }>(
                        ['eval', '--stdin'],
                        REVEAL_EVIDENCE(index),
                    ).catch(() => null);
                    return found
                        ? (JSON.parse(found.result) as Box | null)
                        : null;
                },
            );
        },

        screenshot(path: string) {
            return traced('Take a screenshot', 'screenshot', async () => {
                await cli(['screenshot', path]);
                return path;
            });
        },

        /**
         * Click an element, then settle. `isLink` (an element with an href)
         * means a navigation is expected, so the wait for it is longer.
         * `label` names the element in the activity panel.
         */
        click(ref: string, { isLink = false, label = '' } = {}) {
            return traced(
                'Click',
                `click @${ref}`,
                async () => {
                    const { url: fromUrl } = await json<{ url: string }>([
                        'get',
                        'url',
                    ]);
                    await cli(['click', `@${ref}`]);
                    await settle({ fromUrl, expectNavigation: isLink });
                    await closeInactiveTabs();
                },
                () =>
                    [
                        label,
                        isLink
                            ? 'Waited for the next page to load'
                            : 'Waited for the page to react',
                    ].filter(Boolean),
            );
        },

        async url() {
            const { url } = await json<{ url: string }>(['get', 'url']);
            return url;
        },

        back() {
            return traced(
                'Go back',
                'back',
                async () => {
                    await cli(['back']);
                    await settle();
                },
                () => ['The click left the site'],
            );
        },

        close() {
            return traced('Close the browser', 'close', async () => {
                await cli(['close']).catch(() => {});
            });
        },
    };
}

export type Browser = ReturnType<typeof createBrowser>;
