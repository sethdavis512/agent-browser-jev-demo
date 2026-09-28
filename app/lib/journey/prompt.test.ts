import { describe, expect, it } from 'vitest';
import { parsePrompt } from './prompt';

describe('parsePrompt', () => {
    it('starts on a bare domain and keeps the sentence as the goal', () => {
        expect(
            parsePrompt('stripe.com: find the fee for international cards'),
        ).toEqual({
            ok: true,
            startUrl: 'https://stripe.com',
            goal: 'stripe.com: find the fee for international cards',
        });
    });

    it('finds the site anywhere in the sentence', () => {
        const parsed = parsePrompt(
            'Find the pricing plans on github.com, please.',
        );
        expect(parsed).toMatchObject({
            ok: true,
            startUrl: 'https://github.com',
        });
    });

    it('keeps a full URL for the start and its hostname in the goal', () => {
        expect(
            parsePrompt('https://docs.github.com/en find how to make a token'),
        ).toEqual({
            ok: true,
            startUrl: 'https://docs.github.com/en',
            goal: 'docs.github.com find how to make a token',
        });
    });

    it('asks for a site when there is none', () => {
        expect(parsePrompt('find the pricing page')).toMatchObject({
            ok: false,
        });
    });

    it('asks for a goal when there is only a site', () => {
        expect(parsePrompt('stripe.com')).toMatchObject({ ok: false });
    });

    it('refuses private hosts', () => {
        expect(
            parsePrompt('http://192.168.1.10 find the admin page'),
        ).toMatchObject({ ok: false });
    });
});
