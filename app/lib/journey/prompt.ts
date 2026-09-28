import { startUrlProblem } from './candidates';

/** The first web address in the text: a full URL or a bare domain. */
const ADDRESS =
    /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?/i;

export type ParsedPrompt =
    { ok: true; startUrl: string; goal: string } | { ok: false; error: string };

/**
 * Splits one line of text into where to start and what to look for:
 * "stripe.com: find the fee for international cards" starts at
 * https://stripe.com with the whole sentence as the goal. A full URL in the
 * sentence is shortened to its hostname in the goal, so the goal reads like
 * something a person would say.
 */
export function parsePrompt(input: string): ParsedPrompt {
    const text = input.replace(/\s+/g, ' ').trim();
    const match = text.match(ADDRESS);
    if (!match) {
        return {
            ok: false,
            error: 'Include a site to start on, like stripe.com',
        };
    }

    const address = match[0].replace(/[.,;:!?)\]'"]+$/, '');
    const startUrl = /^https?:\/\//i.test(address)
        ? address
        : `https://${address}`;
    const problem = startUrlProblem(startUrl);
    if (problem) return { ok: false, error: problem };

    const rest = text.replace(address, '').replace(/[^\p{L}\p{N}]+/gu, ' ');
    if (rest.trim().length < 5) {
        return {
            ok: false,
            error: 'Say what to look for, like "stripe.com: find the fee for international cards"',
        };
    }

    const goal = text.replace(address, new URL(startUrl).hostname);
    return { ok: true, startUrl, goal: goal.slice(0, 500) };
}
