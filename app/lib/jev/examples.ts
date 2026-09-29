/**
 * Ready-made Jev requests for the /jev playground. Client-safe: the page
 * shows them, and the server builds the real SDK questions from them, so
 * a visitor only ever edits the state.
 */

export type JevQuestion =
    | {
          type: 'noul';
          instructions: string;
          criteria?: { true: string; false: string };
      }
    | {
          type: 'choice';
          instructions: string;
          /** Label to description; null leaves the label undescribed. */
          options: Record<string, string | null>;
      }
    | {
          type: 'score';
          instructions: string;
          /** Rubric levels from score 0 upward. */
          levels: string[];
      };

export type JevExample = {
    id: string;
    title: string;
    /** One line on what the example shows. */
    blurb: string;
    /** Plain text, or an object shown and edited as JSON. */
    state: string | Record<string, unknown>;
    questions: Record<string, JevQuestion>;
};

export const JEV_EXAMPLES: JevExample[] = [
    {
        id: 'ticket-category',
        title: 'Sort a support ticket',
        blurb: 'choice: pick one label from a fixed set.',
        state: 'I was charged twice for my subscription this month. Can you refund one of them?',
        questions: {
            category: {
                type: 'choice',
                instructions: 'What is this support ticket about?',
                options: {
                    billing: 'Payments, invoices, refunds, or pricing',
                    technical: 'Bugs, errors, or something not working',
                    account: 'Logging in, passwords, or profile settings',
                    other: null,
                },
            },
        },
    },
    {
        id: 'spam',
        title: 'Is this email spam?',
        blurb: 'noul: a yes/no question answered as a probability.',
        state: "Congratulations! You've been selected for a $500 gift card. Click the link below within 24 hours to claim your reward.",
        questions: {
            spam: {
                type: 'noul',
                instructions: 'Is this email spam or a scam?',
            },
        },
    },
    {
        id: 'review-sentiment',
        title: 'Rate a product review',
        blurb: 'score: place the text on a rubric, with an expected score.',
        state: "The headphones sound great and the battery lasts forever, but they started hurting my ears after an hour, so I don't wear them much.",
        questions: {
            sentiment: {
                type: 'score',
                instructions: 'How does the reviewer feel about the product?',
                levels: [
                    'Very negative',
                    'Negative',
                    'Mixed',
                    'Positive',
                    'Very positive',
                ],
            },
        },
    },
    {
        id: 'urgency',
        title: 'How urgent is this?',
        blurb: 'score: a rubric with its own wording for each level.',
        state: "Our checkout page has been down for 20 minutes and customers can't pay.",
        questions: {
            urgency: {
                type: 'score',
                instructions: 'How urgently does this need a response?',
                levels: [
                    'Can wait: a question or idea',
                    'Soon: something is annoying but works',
                    'Today: something important is broken',
                    'Right now: the business is losing money or data',
                ],
            },
        },
    },
    {
        id: 'language',
        title: 'Which language is this?',
        blurb: 'choice: undescribed labels are fine when they speak for themselves.',
        state: '¿Dónde está la estación de tren más cercana?',
        questions: {
            language: {
                type: 'choice',
                instructions: 'Which language is this text written in?',
                options: {
                    english: null,
                    spanish: null,
                    french: null,
                    german: null,
                    japanese: null,
                },
            },
        },
    },
    {
        id: 'vegetarian',
        title: 'Does this recipe fit the diet?',
        blurb: 'noul over JSON state. Try swapping chicken stock for vegetable stock.',
        state: {
            diet: 'vegetarian',
            recipe: {
                name: 'Tomato basil soup',
                ingredients: [
                    'tomatoes',
                    'onion',
                    'garlic',
                    'olive oil',
                    'chicken stock',
                    'basil',
                ],
            },
        },
        questions: {
            fits: {
                type: 'noul',
                instructions: 'Can someone on `diet` eat `recipe` as written?',
                criteria: {
                    true: 'Every ingredient fits the diet',
                    false: 'At least one ingredient breaks the diet',
                },
            },
        },
    },
    {
        id: 'route-team',
        title: 'Who should handle this?',
        blurb: 'choice: route a message to the right team.',
        state: 'Before we sign, can you send over your SOC 2 report and your data processing agreement?',
        questions: {
            team: {
                type: 'choice',
                instructions: 'Which team should answer this message?',
                options: {
                    sales: 'Pricing, demos, and plans',
                    support: 'Help using the product',
                    engineering: 'Bugs and technical integrations',
                    security_legal: 'Compliance, contracts, security reviews',
                },
            },
        },
    },
    {
        id: 'code-bug',
        title: 'Does this code handle the edge case?',
        blurb: 'noul: judgment about code, no execution needed.',
        state: 'function average(numbers) {\n  return numbers.reduce((sum, n) => sum + n) / numbers.length;\n}',
        questions: {
            handlesEmpty: {
                type: 'noul',
                instructions:
                    'Does this function return a sensible result when `numbers` is an empty array?',
            },
        },
    },
    {
        id: 'full-triage',
        title: 'Three questions, one request',
        blurb: 'Several typed questions over the same state, answered together.',
        state: "This is the third time I've asked. My order #4821 still hasn't shipped and nobody replies. I want my money back.",
        questions: {
            category: {
                type: 'choice',
                instructions: 'What is this message about?',
                options: {
                    shipping: 'Where an order is or when it ships',
                    refund: 'Getting money back',
                    product: 'Questions about a product',
                    other: null,
                },
            },
            frustration: {
                type: 'score',
                instructions: 'How frustrated is the customer?',
                levels: ['Calm', 'Mildly annoyed', 'Frustrated', 'Furious'],
            },
            needsHuman: {
                type: 'noul',
                instructions:
                    'Should a person reply instead of an automated answer?',
            },
        },
    },
    {
        id: 'web-navigation',
        title: 'What the browser demo asks',
        blurb: 'The same two questions the agent-browser demo asks on every screen.',
        state: {
            goal: "Find the page that shows GitHub's pricing plans",
            page: {
                url: 'https://github.com/',
                title: 'GitHub · Build and ship software on a single, collaborative platform',
                text: 'The future of building happens together. Tools and trends evolve, but collaboration endures.',
            },
        },
        questions: {
            arrived: {
                type: 'noul',
                instructions:
                    'A person is using the website in `page` to accomplish `goal`. Can they accomplish or answer `goal` from this screen?',
                criteria: {
                    true: 'This screen is the destination',
                    false: 'The destination is somewhere else: this screen only links toward it',
                },
            },
            next: {
                type: 'choice',
                instructions:
                    'A person is on `page` trying to reach the screen described by `goal`. Which element should they click next?',
                options: {
                    el_0: 'link "Product"',
                    el_1: 'link "Solutions"',
                    el_2: 'link "Open Source"',
                    el_3: 'link "Pricing" -> github.com/pricing',
                    el_4: 'button "Sign in"',
                    none: 'None of these elements is likely to lead closer',
                },
            },
        },
    },
];

export function findJevExample(id: string) {
    return JEV_EXAMPLES.find((example) => example.id === id);
}

/** The state as the textarea shows it. */
export function stateText(state: JevExample['state']) {
    return typeof state === 'string' ? state : JSON.stringify(state, null, 2);
}

/** One answer, as the SDK returns it (JSON-safe). */
export type JevAnswer =
    | { type: 'noul'; noul: number }
    | {
          type: 'choice';
          choice: string;
          confidence: number;
          probabilities: Record<string, number>;
      }
    | {
          type: 'score';
          score: number;
          confidence: number;
          probabilities: Record<string, number>;
          legend: Record<string, unknown>;
      };

export type JevResult =
    | {
          ok: true;
          exampleId: string;
          model: string;
          answers: Record<string, JevAnswer>;
          usage: { input_tokens: number; output_tokens: number };
          ms: number;
      }
    | { ok: false; error: string };
