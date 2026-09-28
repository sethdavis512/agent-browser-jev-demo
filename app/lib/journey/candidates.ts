/**
 * Pure helpers for the journey loop: which snapshot refs are worth offering
 * to Jev, and whether a URL still belongs to the site the journey started on.
 * No I/O, so they are unit tested directly.
 */

export type Candidate = {
    ref: string;
    role: string;
    name: string;
    /** Link target, when the snapshot reported one. */
    href?: string;
};

/** ARIA roles a user can click to move through a site. */
const CLICKABLE_ROLES = new Set([
    'link',
    'button',
    'tab',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'treeitem',
    'switch',
    'combobox',
]);

/**
 * Bot-protection challenges and block pages (Walmart/PerimeterX
 * press-and-hold, Cloudflare, reCAPTCHA, hCaptcha, Akamai, Imperva/Incapsula
 * as on heb.com). Journeys never interact with these: a page
 * showing one ends the run, and elements naming one are never offered to Jev.
 */
const CHALLENGE_PATTERN =
    /robot or human|press (?:&|and) hold|human challenge|captcha|verify (?:that )?you(?: are|'re) (?:a )?human|are you a robot|unusual traffic|checking (?:if the site connection is secure|your browser)|just a moment\.\.\.|access denied|pardon our interruption|px-captcha|cf-challenge|incapsula|"incidentid"|ad blocker, antivirus software, vpn, or firewall/i;

export function isChallengeText(value: string) {
    return CHALLENGE_PATTERN.test(value);
}

/**
 * Whether the page is a bot-protection wall rather than the site. Checks the
 * title, the start of the visible text, and the accessibility tree (where
 * challenge buttons such as "Press & Hold Human Challenge" show up).
 */
export function isBotChallenge(page: {
    title: string;
    text: string;
    tree: string;
}) {
    return (
        isChallengeText(page.title) ||
        isChallengeText(page.text.slice(0, 2000)) ||
        isChallengeText(page.tree)
    );
}

/** Jev's Choice accepts 255 options; leave room for "none". */
export const MAX_CANDIDATES = 200;

/** Identifies an element across snapshots of the same page. */
export function candidateKey(url: string, candidate: Candidate) {
    return `${url}|${candidate.role}|${candidate.name}`;
}

/**
 * Link targets from `agent-browser snapshot -u` output, keyed by ref. The
 * JSON refs map has no URLs; the tree text carries them as
 * `[ref=e12, url=https://...]`.
 */
export function parseRefUrls(tree: string): Map<string, string> {
    const urls = new Map<string, string>();
    for (const [, attrs] of tree.matchAll(/\[([^\]]*\bref=e\d+[^\]]*)\]/g)) {
        const ref = attrs.match(/\bref=(e\d+)/)?.[1];
        const url = attrs.match(/\burl=(\S+?)(?:,\s*\w+=|$)/)?.[1];
        if (ref && url) urls.set(ref, url);
    }
    return urls;
}

/**
 * Each ref's position in the snapshot tree, which follows page order. The
 * JSON refs map is keyed as strings (e1, e10, e100, e2, ...), so its order
 * says nothing about the page.
 */
export function refOrder(tree: string): Map<string, number> {
    const order = new Map<string, number>();
    for (const match of tree.matchAll(/\bref=(e\d+)/g)) {
        if (!order.has(match[1])) order.set(match[1], match.index);
    }
    return order;
}

/** The snapshot tree without `url=` attributes, which bloat the judge's state. */
export function stripRefUrls(tree: string): string {
    return tree.replace(/,\s*url=\S+?(?=,\s*\w+=|\])/g, '');
}

function withoutHash(url: string) {
    const at = url.indexOf('#');
    return at === -1 ? url : url.slice(0, at);
}

/**
 * Clickable refs with a readable name, first occurrence of each role + name,
 * minus in-page anchor links and anything already clicked on this page,
 * capped at MAX_CANDIDATES.
 */
export function pickCandidates(
    url: string,
    refs: Candidate[],
    clicked: ReadonlySet<string>,
): Candidate[] {
    const here = withoutHash(url);
    const seen = new Set<string>();
    const candidates: Candidate[] = [];
    for (const ref of refs) {
        const name = ref.name.replace(/\s+/g, ' ').trim();
        if (!name || !CLICKABLE_ROLES.has(ref.role)) continue;
        if (isChallengeText(name)) continue;
        if (ref.href && withoutHash(ref.href) === here) continue;
        const candidate = { ...ref, name: name.slice(0, 140) };
        const key = candidateKey(url, candidate);
        if (seen.has(key) || clicked.has(key)) continue;
        seen.add(key);
        candidates.push(candidate);
        if (candidates.length === MAX_CANDIDATES) break;
    }
    return candidates;
}

/** Second-level labels that act as a public suffix under a country TLD. */
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']);

/**
 * The registrable part of a hostname ("docs.github.com" -> "github.com",
 * "www.bbc.co.uk" -> "bbc.co.uk"). An approximation of eTLD+1 that is good
 * enough to keep a journey on one site without shipping the suffix list.
 */
export function siteOf(hostname: string): string {
    const labels = hostname.toLowerCase().replace(/\.$/, '').split('.');
    if (labels.length <= 2) return labels.join('.');
    const keep =
        labels.at(-1)!.length === 2 && SECOND_LEVEL.has(labels.at(-2)!) ? 3 : 2;
    return labels.slice(-keep).join('.');
}

export function isSameSite(url: string, startUrl: string): boolean {
    try {
        return (
            siteOf(new URL(url).hostname) === siteOf(new URL(startUrl).hostname)
        );
    } catch {
        return false;
    }
}

const PRIVATE_HOST =
    /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[.*\])$/i;

/**
 * Why a start URL can't be browsed, or null when it can. Only public
 * http(s) hosts are allowed, so a journey can't reach the server's network.
 */
export function startUrlProblem(value: string): string | null {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return 'Enter a full URL, like https://github.com';
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return 'Only http and https URLs are supported';
    }
    if (url.username || url.password) {
        return 'URLs with credentials are not supported';
    }
    if (PRIVATE_HOST.test(url.hostname) || !url.hostname.includes('.')) {
        return 'Only public websites can be browsed';
    }
    return null;
}

/**
 * Whether the loop stops on this screen, and how. A screen at or above the
 * arrival threshold is the destination. When Jev sees nothing worth clicking,
 * a screen that is more likely than not the destination still counts as
 * found (there is nowhere better to go); otherwise the journey is stuck.
 */
export function stepOutcome({
    arrived,
    hasNext,
    index,
    maxSteps,
    arrivalThreshold,
}: {
    arrived: number;
    hasNext: boolean;
    index: number;
    maxSteps: number;
    arrivalThreshold: number;
}): 'FOUND' | 'STUCK' | 'OUT_OF_STEPS' | null {
    if (arrived >= arrivalThreshold) return 'FOUND';
    if (!hasNext) return arrived >= 0.5 ? 'FOUND' : 'STUCK';
    if (index + 1 >= maxSteps) return 'OUT_OF_STEPS';
    return null;
}
