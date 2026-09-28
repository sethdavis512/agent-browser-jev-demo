/**
 * Goal-focused page text. Long pages (pricing tables, docs) hide the answer
 * deep in the text, so instead of sending Jev the first few thousand
 * characters, send the top of the page plus the passages that best match
 * the goal. Pure, so it runs anywhere and is unit-tested.
 */

/** Words that say nothing about what the page must contain. */
const STOPWORDS = new Set(
    `a an and are as at be by can do does for from get go how i if in into is it
    its me my of on or our page pages screen shows show site that the their them
    there this to up want we what when where which who why will with you your
    find see look looking locate explains explain describe describes about
    product manager user customer someone person made make makes using use`
        .split(/\s+/)
        .filter(Boolean),
);

export type Term = {
    term: string;
    weight: number;
    /**
     * Whole-word RegExp source (case-insensitive) that also accepts plural
     * and past-tense endings: "charge" matches "charges" and "charged" but
     * not "chargebacks". A string so it can be sent into the page as JSON.
     */
    pattern: string;
};

/** Lowercase, drop a plural "s" on longer words so "cards" matches "card". */
function stem(word: string) {
    return word.length > 4 && word.endsWith('s') && !word.endsWith('ss')
        ? word.slice(0, -1)
        : word;
}

function termPattern(term: string) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `(?<![\\p{L}\\p{N}])${escaped}(?:s|es|d|ed)?(?![\\p{L}\\p{N}])`;
}

function matcher(term: Term, flags = 'iu') {
    return new RegExp(term.pattern, flags);
}

/**
 * The goal's content words, weighted by rarity on this page: a word that
 * appears everywhere ("stripe" on stripe.com) says little about where the
 * answer is, while a rare one ("international") says a lot.
 */
export function goalTerms(goal: string, pageText: string): Term[] {
    const words = new Set(
        goal
            .toLowerCase()
            .split(/[^a-z0-9%$€£]+/)
            .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
            .map(stem),
    );
    return [...words].map((word) => {
        const term = { term: word, weight: 0, pattern: termPattern(word) };
        const count = pageText.match(matcher(term, 'giu'))?.length ?? 0;
        return { ...term, weight: 1 / Math.log(2 + count) };
    });
}

export function scorePassage(passage: string, terms: Term[]) {
    return terms.reduce(
        (score, term) =>
            matcher(term).test(passage) ? score + term.weight : score,
        0,
    );
}

/** Sentence-ish passages of roughly `size` characters, in page order. */
export function splitPassages(text: string, size = 400): string[] {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const passages: string[] = [];
    let current = '';
    for (const sentence of sentences) {
        if (current && current.length + sentence.length > size) {
            passages.push(current);
            current = '';
        }
        current = current ? `${current} ${sentence}` : sentence;
        // A single run-on "sentence" (tables, lists) gets cut to size.
        while (current.length > size * 2) {
            passages.push(current.slice(0, size));
            current = current.slice(size);
        }
    }
    if (current) passages.push(current);
    return passages;
}

/**
 * The first `head` characters, then the best-matching passages (kept in page
 * order, joined with an ellipsis) until `budget` characters are used. Short
 * pages come back unchanged.
 */
export function focusText(
    text: string,
    terms: Term[],
    { budget = 4000, head = 1000 }: { budget?: number; head?: number } = {},
): string {
    if (text.length <= budget) return text;

    const top = text.slice(0, head);
    const rest = splitPassages(text.slice(head));
    const ranked = rest
        .map((passage, index) => ({
            passage,
            index,
            score: scorePassage(passage, terms),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index);

    const picked: typeof ranked = [];
    let used = top.length;
    for (const entry of ranked) {
        if (used + entry.passage.length + 3 > budget) continue;
        picked.push(entry);
        used += entry.passage.length + 3;
    }

    return [
        top,
        ...picked.sort((a, b) => a.index - b.index).map((e) => e.passage),
    ].join(' … ');
}
