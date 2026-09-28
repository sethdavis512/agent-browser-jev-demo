import { describe, expect, it } from 'vitest';
import {
    candidateKey,
    isBotChallenge,
    isSameSite,
    MAX_CANDIDATES,
    parseRefUrls,
    refOrder,
    pickCandidates,
    siteOf,
    startUrlProblem,
    stepOutcome,
    stripRefUrls,
} from './candidates';

const URL_A = 'https://github.com/';

describe('pickCandidates', () => {
    it('keeps clickable roles with names and drops the rest', () => {
        const picked = pickCandidates(
            URL_A,
            [
                { ref: 'e1', role: 'link', name: 'Pricing' },
                { ref: 'e2', role: 'heading', name: 'Welcome' },
                { ref: 'e3', role: 'button', name: '  ' },
                { ref: 'e4', role: 'textbox', name: 'Email' },
                { ref: 'e5', role: 'menuitem', name: 'Settings' },
            ],
            new Set(),
        );
        expect(picked.map((c) => c.ref)).toEqual(['e1', 'e5']);
    });

    it('dedupes by role and name and skips clicked elements', () => {
        const clicked = new Set([
            candidateKey(URL_A, {
                ref: 'e9',
                role: 'button',
                name: 'Platform',
            }),
        ]);
        const picked = pickCandidates(
            URL_A,
            [
                { ref: 'e1', role: 'link', name: 'Sign up' },
                { ref: 'e2', role: 'link', name: 'Sign   up' },
                { ref: 'e3', role: 'button', name: 'Platform' },
            ],
            clicked,
        );
        expect(picked.map((c) => c.ref)).toEqual(['e1']);
    });

    it('drops links that only jump within the current page', () => {
        const picked = pickCandidates(
            'https://docs.example.com/guide#intro',
            [
                {
                    ref: 'e1',
                    role: 'link',
                    name: 'Setup',
                    href: 'https://docs.example.com/guide#setup',
                },
                {
                    ref: 'e2',
                    role: 'link',
                    name: 'Next',
                    href: 'https://docs.example.com/next',
                },
            ],
            new Set(),
        );
        expect(picked.map((c) => c.ref)).toEqual(['e2']);
    });

    it('caps the list for the Choice question', () => {
        const refs = Array.from({ length: 300 }, (_, i) => ({
            ref: `e${i}`,
            role: 'link',
            name: `Link ${i}`,
        }));
        expect(pickCandidates(URL_A, refs, new Set())).toHaveLength(
            MAX_CANDIDATES,
        );
    });
});

describe('siteOf / isSameSite', () => {
    it('folds subdomains into the registrable domain', () => {
        expect(siteOf('docs.github.com')).toBe('github.com');
        expect(siteOf('github.com')).toBe('github.com');
        expect(siteOf('www.bbc.co.uk')).toBe('bbc.co.uk');
    });

    it('treats subdomains as the same site and other hosts as leaving', () => {
        expect(isSameSite('https://docs.github.com/en', URL_A)).toBe(true);
        expect(isSameSite('https://example.com', URL_A)).toBe(false);
        expect(isSameSite('not a url', URL_A)).toBe(false);
    });
});

describe('startUrlProblem', () => {
    it('accepts public http(s) URLs', () => {
        expect(startUrlProblem('https://github.com')).toBeNull();
        expect(startUrlProblem('http://example.org/path')).toBeNull();
    });

    it('rejects other schemes, credentials, and private hosts', () => {
        expect(startUrlProblem('github.com')).not.toBeNull();
        expect(startUrlProblem('file:///etc/passwd')).not.toBeNull();
        expect(startUrlProblem('https://user:pw@github.com')).not.toBeNull();
        expect(startUrlProblem('http://localhost:5173')).not.toBeNull();
        expect(startUrlProblem('http://192.168.1.10')).not.toBeNull();
        expect(startUrlProblem('http://10.0.0.1')).not.toBeNull();
        expect(startUrlProblem('http://[::1]/')).not.toBeNull();
        expect(startUrlProblem('http://intranet')).not.toBeNull();
    });
});

const TREE = `- link "Skip" [ref=e1, url=https://a.com/x#main]
- heading "Title" [level=1, ref=e9]
- button "Menu" [expanded=false, ref=e3]
- link "Docs" [ref=e4, url=https://a.com/docs?x=1]`;

describe('parseRefUrls / stripRefUrls', () => {
    it('reads link targets out of the snapshot tree', () => {
        expect(Object.fromEntries(parseRefUrls(TREE))).toEqual({
            e1: 'https://a.com/x#main',
            e4: 'https://a.com/docs?x=1',
        });
    });

    it('removes url attributes and keeps the rest', () => {
        expect(stripRefUrls(TREE)).toBe(`- link "Skip" [ref=e1]
- heading "Title" [level=1, ref=e9]
- button "Menu" [expanded=false, ref=e3]
- link "Docs" [ref=e4]`);
    });
});

describe('stepOutcome', () => {
    const base = {
        hasNext: true,
        index: 0,
        maxSteps: 5,
        arrivalThreshold: 0.8,
    };

    it('stops as found at the arrival threshold', () => {
        expect(stepOutcome({ ...base, arrived: 0.85 })).toBe('FOUND');
    });

    it('keeps going below the threshold while there is a next click', () => {
        expect(stepOutcome({ ...base, arrived: 0.6 })).toBeNull();
    });

    it('settles on a likely destination when nothing is left to click', () => {
        expect(stepOutcome({ ...base, arrived: 0.62, hasNext: false })).toBe(
            'FOUND',
        );
        expect(stepOutcome({ ...base, arrived: 0.3, hasNext: false })).toBe(
            'STUCK',
        );
    });

    it('runs out of steps on the last allowed screen', () => {
        expect(stepOutcome({ ...base, arrived: 0.2, index: 4 })).toBe(
            'OUT_OF_STEPS',
        );
    });
});

describe('bot challenges', () => {
    const site = {
        title: 'Walmart | Save Money',
        text: 'Shop deals',
        tree: '- link "Grocery" [ref=e1]',
    };

    it('recognizes challenge walls in the title, text, or tree', () => {
        expect(isBotChallenge(site)).toBe(false);
        expect(
            isBotChallenge({
                ...site,
                tree: '- button "Press & Hold Human Challenge" [ref=e9]',
            }),
        ).toBe(true);
        expect(
            isBotChallenge({
                ...site,
                text: 'Robot or human? Activate and hold',
            }),
        ).toBe(true);
        expect(isBotChallenge({ ...site, title: 'Just a moment...' })).toBe(
            true,
        );
        expect(
            isBotChallenge({ ...site, text: 'Please complete the reCAPTCHA' }),
        ).toBe(true);
        // Imperva's block page on heb.com is bare JSON.
        expect(
            isBotChallenge({
                title: '',
                text: '{ "incidentId" : "967", "errorCode" : "15", "description" : "This page could not load. It looks like an ad blocker, antivirus software, VPN, or firewall may be causing an issue." }',
                tree: '',
            }),
        ).toBe(true);
    });

    it('never offers challenge elements as clicks', () => {
        const picked = pickCandidates(
            'https://www.walmart.com/',
            [
                {
                    ref: 'e1',
                    role: 'button',
                    name: 'Press & Hold Human Challenge',
                },
                { ref: 'e2', role: 'link', name: 'Grocery' },
            ],
            new Set(),
        );
        expect(picked.map((c) => c.ref)).toEqual(['e2']);
    });
});

describe('refOrder', () => {
    it('ranks refs by where they appear in the tree', () => {
        const order = refOrder(TREE);
        const sorted = ['e9', 'e4', 'e3', 'e1'].sort(
            (a, b) => order.get(a)! - order.get(b)!,
        );
        expect(sorted).toEqual(['e1', 'e9', 'e3', 'e4']);
    });
});
