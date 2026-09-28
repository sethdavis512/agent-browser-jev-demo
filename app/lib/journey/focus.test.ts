import { describe, expect, it } from 'vitest';
import { focusText, goalTerms, scorePassage, splitPassages } from './focus';

const GOAL =
    'As a product manager, find what Stripe charges for payments made with international cards';

describe('goalTerms', () => {
    it('keeps content words, stems plurals, and drops filler', () => {
        const terms = goalTerms(GOAL, '').map((t) => t.term);
        expect(terms).toEqual(
            expect.arrayContaining([
                'stripe',
                'charge',
                'payment',
                'international',
                'card',
            ]),
        );
        expect(terms).not.toContain('product');
        expect(terms).not.toContain('manager');
        expect(terms).not.toContain('find');
    });

    it('weights words that are rare on the page above common ones', () => {
        const page = 'Stripe Stripe Stripe Stripe international';
        const terms = goalTerms(GOAL, page);
        const weight = (term: string) =>
            terms.find((t) => t.term === term)!.weight;
        expect(weight('international')).toBeGreaterThan(weight('stripe'));
    });
});

describe('splitPassages', () => {
    it('groups sentences into passages near the target size', () => {
        const text = 'One two three. '.repeat(100).trim();
        const passages = splitPassages(text, 100);
        expect(passages.length).toBeGreaterThan(5);
        expect(passages.every((p) => p.length <= 200)).toBe(true);
        expect(passages.join(' ')).toBe(text);
    });

    it('cuts run-on text without sentence breaks', () => {
        const passages = splitPassages('x'.repeat(1000), 100);
        expect(passages.every((p) => p.length <= 200)).toBe(true);
    });
});

describe('focusText', () => {
    const filler = 'Grow your revenue with our platform. '.repeat(200);
    const answer =
        '2.9% + 30¢ per successful transaction for domestic cards + 1.5% for international cards.';
    const page = `Pricing built for businesses of all sizes. ${filler}${answer} ${filler}`;
    const terms = goalTerms(GOAL, page);

    it('returns short pages unchanged', () => {
        expect(focusText('Short page.', terms)).toBe('Short page.');
    });

    it('surfaces a deep passage that matches the goal within the budget', () => {
        const focused = focusText(page, terms, { budget: 2000, head: 200 });
        expect(page.indexOf(answer)).toBeGreaterThan(2000);
        expect(focused.length).toBeLessThanOrEqual(2000);
        expect(focused).toContain('1.5% for international cards');
        expect(focused.startsWith('Pricing built for businesses')).toBe(true);
    });

    it('scores passages by the goal words they contain', () => {
        expect(scorePassage(answer, terms)).toBeGreaterThan(
            scorePassage('Grow your revenue with our platform.', terms),
        );
    });
});

describe('whole-word matching', () => {
    const terms = goalTerms('find what Stripe charges for cards', '');

    it('accepts plural and past-tense forms', () => {
        expect(scorePassage('We charged the card.', terms)).toBeGreaterThan(0);
        expect(scorePassage('Charges apply to cards', terms)).toBeGreaterThan(
            scorePassage('Charges apply', terms),
        );
    });

    it('does not match a term inside a longer word', () => {
        expect(scorePassage('Respond to chargebacks.', terms)).toBe(0);
        expect(scorePassage('Discard it.', terms)).toBe(0);
    });
});
