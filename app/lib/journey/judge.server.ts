import { choice, noul, TypeSafeClient } from '@typesafe-ai/sdk';
import { stripRefUrls, type Candidate } from './candidates';
import type { PageState } from './browser.server';

const NONE = 'none';

/** The accessibility tree is long on busy pages; keep the state compact. */
const MAX_TREE_CHARS = 6000;

let client: TypeSafeClient | undefined;

function getClient() {
    const apiKey = process.env.JEV_API_KEY;
    if (!apiKey) {
        throw new Error('JEV_API_KEY is not set, so journeys cannot run');
    }
    client ??= new TypeSafeClient({ apiKey });
    return client;
}

export type StepJudgment = {
    /** Noul probability that the current screen fulfills the goal. */
    arrived: number;
    next: Candidate | null;
    confidence: number;
    usage: { input_tokens: number; output_tokens: number };
};

/**
 * One Jev request per step with two questions over the same state (they run
 * in parallel on TypeSafe's side): has the journey arrived, and if not, which
 * element should be clicked next.
 */
export async function judgeStep({
    goal,
    page,
    candidates,
    history,
}: {
    goal: string;
    page: PageState;
    candidates: Candidate[];
    history: string[];
}): Promise<StepJudgment> {
    const criteria: Record<string, string> = {};
    candidates.forEach((candidate, i) => {
        criteria[`el_${i}`] =
            `${candidate.role} "${candidate.name}"${linkPath(candidate.href)}`;
    });
    criteria[NONE] =
        'None of these elements is likely to lead closer to the screen the goal describes';

    const response = await getClient().systemOne({
        state: {
            goal,
            page: {
                url: page.url,
                title: page.title,
                text: page.text,
                elements: stripRefUrls(page.tree).slice(0, MAX_TREE_CHARS),
            },
            history,
        },
        questions: {
            arrived: noul(
                'A person is using the website in `page` to accomplish `goal`. Can they accomplish or answer `goal` from this screen?',
                {
                    true: 'This screen is the destination: it shows the page, form, setting, or content that `goal` is looking for',
                    false: 'The destination is somewhere else: this screen only links toward it, mentions it in passing, or is about something else',
                },
            ),
            next: choice(
                'A person is on `page` trying to reach the screen described by `goal`. `history` lists what they already clicked. Which element should they click next to get closest to that screen?',
                criteria,
            ),
        },
    });

    const { arrived, next } = response.answers;
    const index =
        next.choice === NONE ? -1 : Number(next.choice.replace('el_', ''));

    return {
        arrived: arrived.noul,
        next: candidates[index] ?? null,
        confidence: next.confidence,
        usage: response.usage,
    };
}

/** " -> /path" for a same-site link, so Jev sees where it leads. */
function linkPath(href: string | undefined) {
    if (!href) return '';
    try {
        const url = new URL(href);
        return ` -> ${url.hostname}${url.pathname}`;
    } catch {
        return '';
    }
}

/**
 * On the destination screen, which passage answers the goal. Returns the
 * passage index, or null when Jev thinks none of them does.
 */
export async function pickEvidence(
    goal: string,
    passages: string[],
): Promise<number | null> {
    if (passages.length === 0) return null;
    const criteria: Record<string, string> = {};
    passages.forEach((passage, i) => {
        criteria[`p_${i}`] = passage;
    });
    criteria[NONE] = 'None of these passages answers the goal';

    const response = await getClient().systemOne({
        state: { goal },
        questions: {
            evidence: choice(
                'Which passage on the page best answers `goal`, the one a person would point to as the answer?',
                criteria,
            ),
        },
    });
    const { choice: picked } = response.answers.evidence;
    return picked === NONE ? null : Number(picked.replace('p_', ''));
}
