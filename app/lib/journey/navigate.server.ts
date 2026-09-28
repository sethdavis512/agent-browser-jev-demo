import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBrowser, type Box, type Browser } from './browser.server';
import {
    candidateKey,
    isBotChallenge,
    isSameSite,
    pickCandidates,
    stepOutcome,
    type Candidate,
} from './candidates';
import { focusText, goalTerms, type Term } from './focus';
import { judgeStep, pickEvidence } from './judge.server';

export type NavigateInput = {
    startUrl: string;
    goal: string;
    maxSteps: number;
    /** Noul probability at or above which a screen counts as the destination. */
    arrivalThreshold: number;
    /** agent-browser session name; unique per run. */
    session: string;
};

export type CapturedStep = {
    index: number;
    url: string;
    title: string;
    /** Local PNG, deleted once the run ends; upload or read it inside onStep. */
    screenshotPath: string;
    /** The `snapshot -i -c` accessibility tree the judge saw. */
    snapshot: string;
    /** Probability this screen is the destination. */
    arrived: number;
    /** The element clicked from this screen, or null on the last screen. */
    action: (Candidate & { box: Box | null; confidence: number }) | null;
    /** On a FOUND screen: the passage that answers the goal, scrolled into view. */
    evidence: { box: Box; text: string } | null;
};

export type NavigateOutcome = {
    /** BLOCKED: the site put up a bot-protection challenge. */
    status: 'FOUND' | 'STUCK' | 'OUT_OF_STEPS' | 'BLOCKED';
    finalUrl: string;
    tokens: { input: number; output: number };
};

/**
 * Walks a site toward a goal. Each step reads the page, asks Jev whether it
 * has arrived and what to click next, screenshots the screen (the element
 * about to be clicked is recorded with its box so the UI can highlight it),
 * then clicks. A click that leaves the start URL's site is undone. On the
 * destination, the passage that best matches the goal is scrolled into view
 * before the last screenshot and recorded as evidence.
 */
export async function navigate(
    input: NavigateInput,
    onStep: (step: CapturedStep) => Promise<void>,
): Promise<NavigateOutcome> {
    const browser = createBrowser(input.session);
    const dir = await mkdtemp(join(tmpdir(), 'journey-'));
    const clicked = new Set<string>();
    const history: string[] = [];
    const tokens = { input: 0, output: 0 };

    try {
        await browser.open(input.startUrl);

        for (let index = 0; ; index++) {
            const page = await browser.read();

            // Never interact with a bot check: record the wall and stop.
            if (isBotChallenge(page)) {
                const screenshotPath = await browser.screenshot(
                    join(dir, `step-${index}.png`),
                );
                await onStep({
                    index,
                    url: page.url,
                    title: page.title,
                    screenshotPath,
                    snapshot: page.tree,
                    arrived: 0,
                    action: null,
                    evidence: null,
                });
                return { status: 'BLOCKED', finalUrl: page.url, tokens };
            }

            const terms = goalTerms(input.goal, page.text);
            const candidates = pickCandidates(page.url, page.refs, clicked);
            const judgment = await judgeStep({
                goal: input.goal,
                page: { ...page, text: focusText(page.text, terms) },
                candidates,
                history,
            });
            tokens.input += judgment.usage.input_tokens;
            tokens.output += judgment.usage.output_tokens;

            const status = stepOutcome({
                arrived: judgment.arrived,
                hasNext: judgment.next !== null,
                index,
                maxSteps: input.maxSteps,
                arrivalThreshold: input.arrivalThreshold,
            });
            const target = status ? null : judgment.next;
            const box = target ? await browser.box(target.ref) : null;
            const evidence =
                status === 'FOUND'
                    ? await findEvidence(browser, input.goal, terms)
                    : null;
            const screenshotPath = await browser.screenshot(
                join(dir, `step-${index}.png`),
            );

            await onStep({
                index,
                url: page.url,
                title: page.title,
                screenshotPath,
                snapshot: page.tree,
                arrived: judgment.arrived,
                action: target
                    ? { ...target, box, confidence: judgment.confidence }
                    : null,
                evidence,
            });

            if (status || !target) {
                return {
                    status: status ?? 'STUCK',
                    finalUrl: page.url,
                    tokens,
                };
            }

            clicked.add(candidateKey(page.url, target));
            const label = `${target.role} "${target.name}" on "${page.title}"`;
            try {
                await browser.click(target.ref, {
                    isLink: Boolean(target.href),
                });
            } catch {
                history.push(`Tried to click ${label}, but it failed`);
                continue;
            }

            const landed = await browser.url();
            if (isSameSite(landed, input.startUrl)) {
                history.push(`Clicked ${label}`);
            } else {
                await browser.back();
                history.push(
                    `Clicked ${label}, which left the site, so went back`,
                );
            }
        }
    } finally {
        await browser.close();
        await rm(dir, { recursive: true, force: true });
    }
}

/**
 * Keyword matching shortlists passages; Jev picks the one that answers the
 * goal; the browser scrolls it into view for the final screenshot.
 */
async function findEvidence(
    browser: Browser,
    goal: string,
    terms: Term[],
): Promise<{ box: Box; text: string } | null> {
    const passages = await browser.evidenceCandidates(terms);
    const index = await pickEvidence(goal, passages).catch(() => null);
    if (index === null || !passages[index]) return null;
    const box = await browser.revealEvidence(index);
    return box ? { box, text: passages[index] } : null;
}
