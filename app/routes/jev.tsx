import { ChevronRight, Loader2, Play } from 'lucide-react';
import {
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type ReactNode,
} from 'react';
import { data, useFetcher } from 'react-router';
import { z } from 'zod';
import { PageHeader } from '~/components/PageHeader';
import { askJev } from '~/lib/jev/ask.server';
import {
    findJevExample,
    JEV_EXAMPLES,
    stateText,
    type JevAnswer,
    type JevExample,
    type JevQuestion,
    type JevResult,
} from '~/lib/jev/examples';
import type { Route } from './+types/jev';

const bodySchema = z.object({
    exampleId: z.string().min(1),
    state: z.string().min(1, 'Give Jev something to read').max(20_000),
});

export async function action({ request }: Route.ActionArgs) {
    const body = bodySchema.safeParse(
        Object.fromEntries(await request.formData()),
    );
    if (!body.success) {
        return data<JevResult>(
            { ok: false, error: body.error.issues[0]?.message ?? 'Bad input' },
            { status: 400 },
        );
    }
    const example = findJevExample(body.data.exampleId);
    if (!example) {
        return data<JevResult>(
            { ok: false, error: 'Unknown example' },
            { status: 400 },
        );
    }

    let state: string | Record<string, unknown> = body.data.state;
    if (typeof example.state !== 'string') {
        try {
            state = JSON.parse(body.data.state);
        } catch {
            return data<JevResult>(
                { ok: false, error: 'This example needs valid JSON' },
                { status: 400 },
            );
        }
    }

    try {
        return data<JevResult>(await askJev(example, state));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return data<JevResult>(
            { ok: false, error: message.slice(0, 300) },
            { status: 502 },
        );
    }
}

export default function Jev() {
    const fetcher = useFetcher<typeof action>();
    const [exampleId, setExampleId] = useState(JEV_EXAMPLES[0].id);
    const [state, setState] = useState(stateText(JEV_EXAMPLES[0].state));
    // The text the current answers are about, to notice edits.
    const [askedState, setAskedState] = useState<string | null>(null);
    const example = findJevExample(exampleId) ?? JEV_EXAMPLES[0];
    const asking = fetcher.state !== 'idle';
    const result = fetcher.data;

    function ask(id: string, text: string) {
        setAskedState(text);
        fetcher.submit({ exampleId: id, state: text }, { method: 'post' });
    }

    // Open on an answered example, so the first thing people see is Jev
    // answering, not an empty form.
    const askedOnce = useRef(false);
    useEffect(() => {
        if (askedOnce.current) return;
        askedOnce.current = true;
        ask(JEV_EXAMPLES[0].id, stateText(JEV_EXAMPLES[0].state));
    }, []);

    function handleExample(event: ChangeEvent<HTMLSelectElement>) {
        const next = findJevExample(event.target.value);
        if (!next) return;
        const text = stateText(next.state);
        setExampleId(next.id);
        setState(text);
        ask(next.id, text);
    }

    // Answers belong to the example that asked; hide them after switching.
    const answers =
        result?.ok && result.exampleId === example.id ? result : null;
    const edited = answers !== null && askedState !== state;
    const questions = Object.entries(example.questions);
    const isJson = typeof example.state !== 'string';

    return (
        <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
            <title>Jev · Agent Browser and Jev Demo</title>
            <PageHeader
                back
                title="Jev"
                description="Jev reads some text and answers a question about it. Instead of writing a paragraph, it gives a clear answer and says how sure it is."
            />

            <label htmlFor="example" className="sr-only">
                Pick an example
            </label>
            <select
                id="example"
                value={exampleId}
                onChange={handleExample}
                className="border-border bg-card focus:ring-ring h-12 w-full rounded-lg border px-3 text-base outline-none focus:ring-2"
            >
                {JEV_EXAMPLES.map((option, i) => (
                    <option key={option.id} value={option.id}>
                        {i + 1}. {option.title}
                    </option>
                ))}
            </select>

            <div className="mt-8 space-y-8">
                <Step label="Jev reads">
                    <textarea
                        id="state"
                        aria-label="The text Jev reads"
                        value={state}
                        onChange={(event) => setState(event.target.value)}
                        rows={isJson ? 10 : 3}
                        spellCheck={false}
                        className={`border-border bg-card focus:ring-ring w-full resize-y rounded-lg border p-4 outline-none focus:ring-2 ${
                            isJson ? 'font-mono text-sm' : 'text-lg'
                        }`}
                    />
                    <p className="text-muted-foreground mt-1 text-sm">
                        Change the text and ask again to see the answer move.
                    </p>
                </Step>

                <Step
                    label={
                        questions.length === 1
                            ? 'Jev is asked'
                            : `Jev is asked ${questions.length} questions`
                    }
                >
                    <ul className="space-y-1">
                        {questions.map(([name, question]) => (
                            <li key={name} className="text-lg">
                                {plainQuestion(question)}
                            </li>
                        ))}
                    </ul>
                </Step>

                <div>
                    <button
                        type="button"
                        onClick={() => ask(example.id, state)}
                        disabled={asking}
                        className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 sm:w-auto"
                    >
                        {asking ? (
                            <Loader2
                                aria-hidden
                                className="size-4 animate-spin"
                            />
                        ) : (
                            <Play aria-hidden className="size-4" />
                        )}
                        {edited ? 'Ask again' : 'Ask Jev'}
                    </button>
                </div>

                <Step label="Jev answers">
                    <div aria-live="polite">
                        {asking && !answers ? (
                            <p className="text-muted-foreground flex items-center gap-2">
                                <Loader2
                                    aria-hidden
                                    className="size-4 animate-spin"
                                />
                                Thinking…
                            </p>
                        ) : result && !result.ok ? (
                            <p className="text-destructive">{result.error}</p>
                        ) : answers ? (
                            <div
                                className={`space-y-5 transition-opacity ${
                                    edited || asking ? 'opacity-50' : ''
                                }`}
                            >
                                {questions.map(
                                    ([name, question]) =>
                                        answers.answers[name] && (
                                            <PlainAnswer
                                                key={name}
                                                question={question}
                                                answer={answers.answers[name]}
                                                showQuestion={
                                                    questions.length > 1
                                                }
                                            />
                                        ),
                                )}
                                {edited && !asking && (
                                    <p className="text-muted-foreground text-sm">
                                        The text changed. Ask again to update
                                        the answer.
                                    </p>
                                )}
                            </div>
                        ) : null}
                    </div>
                </Step>
            </div>

            {answers && (
                <div className="border-border mt-10 space-y-3 border-t pt-6">
                    <Details summary="See the numbers">
                        <p className="text-muted-foreground text-sm">
                            Jev scores every possible answer. The longest bar is
                            its answer. Took {answers.ms} ms and{' '}
                            {(
                                answers.usage.input_tokens +
                                answers.usage.output_tokens
                            ).toLocaleString('en-US')}{' '}
                            tokens.
                        </p>
                        {questions.map(
                            ([name, question]) =>
                                answers.answers[name] && (
                                    <Meters
                                        key={name}
                                        name={name}
                                        question={question}
                                        answer={answers.answers[name]}
                                    />
                                ),
                        )}
                    </Details>
                    <Details summary="See the code">
                        <p className="text-muted-foreground text-sm">
                            The request, as a developer would write it with
                            TypeSafe's SDK, and what came back.
                        </p>
                        <Pre>{requestCode(example, state)}</Pre>
                        <Pre>
                            {JSON.stringify(
                                {
                                    model: answers.model,
                                    answers: answers.answers,
                                    usage: answers.usage,
                                },
                                null,
                                2,
                            )}
                        </Pre>
                    </Details>
                </div>
            )}
        </main>
    );
}

function Step({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                {label}
            </h2>
            {children}
        </section>
    );
}

function Details({
    summary,
    children,
}: {
    summary: string;
    children: ReactNode;
}) {
    return (
        <details className="group">
            <summary className="hover:text-foreground text-muted-foreground flex cursor-pointer list-none items-center gap-1.5 font-medium [&::-webkit-details-marker]:hidden">
                <ChevronRight
                    aria-hidden
                    className="size-4 transition-transform group-open:rotate-90"
                />
                {summary}
            </summary>
            <div className="mt-4 space-y-6 pl-5">{children}</div>
        </details>
    );
}

/** The answer in words: yes or no, a label, or a place on the scale. */
function PlainAnswer({
    question,
    answer,
    showQuestion,
}: {
    question: JevQuestion;
    answer: JevAnswer;
    showQuestion: boolean;
}) {
    const { text, sure } = plainAnswer(question, answer);
    return (
        <div>
            {showQuestion && (
                <p className="text-muted-foreground text-sm">
                    {plainQuestion(question)}
                </p>
            )}
            <p className="text-3xl font-semibold tracking-tight">{text}</p>
            <p className="text-muted-foreground">{sure}</p>
        </div>
    );
}

function plainAnswer(
    question: JevQuestion,
    answer: JevAnswer,
): { text: string; sure: string } {
    if (answer.type === 'noul') {
        const yes = answer.noul >= 0.5;
        return {
            text: yes ? 'Yes' : 'No',
            sure: `${percent(yes ? answer.noul : 1 - answer.noul)} sure`,
        };
    }
    if (answer.type === 'choice') {
        const description =
            question.type === 'choice' ? question.options[answer.choice] : null;
        const showDescription =
            question.type === 'choice' && question.showDescription;
        return {
            text:
                showDescription && description
                    ? plainElement(description)
                    : capitalize(answer.choice.replace(/_/g, ' ')),
            sure: `${percent(answer.probabilities[answer.choice] ?? answer.confidence)} sure`,
        };
    }
    const levels = question.type === 'score' ? question.levels : [];
    const nearest = Math.round(answer.score);
    return {
        text: levels[nearest] ?? answer.score.toFixed(1),
        sure: `${answer.score.toFixed(1)} on a scale from 0 (${levels[0]}) to ${levels.length - 1} (${levels.at(-1)})`,
    };
}

/** The question in everyday words, without the backticked state keys. */
function plainQuestion(question: JevQuestion) {
    return question.plain ?? question.instructions.replace(/`/g, '');
}

/** 'link "Pricing" -> github.com/pricing' reads as 'The "Pricing" link'. */
function plainElement(description: string) {
    const match = description.match(/^(\w+) "(.+?)"/);
    return match ? `The "${match[2]}" ${match[1]}` : description;
}

function capitalize(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

const TYPE_NOTES: Record<JevQuestion['type'], string> = {
    noul: 'noul: a yes or no question, answered as the chance of yes',
    choice: 'choice: pick one option from a list',
    score: 'score: place the answer on a scale',
};

/** Every option's share of the probability, as bars. */
function Meters({
    name,
    question,
    answer,
}: {
    name: string;
    question: JevQuestion;
    answer: JevAnswer;
}) {
    let rows: { label: string; hint?: string | null; value: number }[];
    let picked: string;
    if (answer.type === 'noul') {
        rows = [
            { label: 'yes', value: answer.noul },
            { label: 'no', value: 1 - answer.noul },
        ];
        picked = answer.noul >= 0.5 ? 'yes' : 'no';
    } else if (answer.type === 'choice') {
        const options = question.type === 'choice' ? question.options : {};
        rows = Object.entries(answer.probabilities)
            .sort(([, a], [, b]) => b - a)
            .map(([label, value]) => ({
                label,
                hint: options[label],
                value,
            }));
        picked = answer.choice;
    } else {
        const levels = question.type === 'score' ? question.levels : [];
        rows = levels.map((level, i) => ({
            label: String(i),
            hint: level,
            value: answer.probabilities[String(i)] ?? 0,
        }));
        picked = String(Math.round(answer.score));
    }

    return (
        <div className="space-y-2">
            <p className="text-sm">
                <code className="font-mono text-xs">{name}</code>{' '}
                <span className="text-muted-foreground">
                    {TYPE_NOTES[question.type]}
                </span>
            </p>
            <ul className="space-y-1.5">
                {rows.map((row) => (
                    <li key={row.label} className="space-y-1 text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 truncate">
                                <code
                                    className={`font-mono text-xs ${row.label === picked ? 'font-semibold' : ''}`}
                                >
                                    {row.label}
                                </code>
                                {row.hint && (
                                    <span className="text-muted-foreground">
                                        {' '}
                                        {row.hint}
                                    </span>
                                )}
                            </span>
                            <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                                {percent(row.value)}
                            </span>
                        </div>
                        <div
                            className="bg-muted h-2 overflow-hidden rounded-full"
                            aria-hidden
                        >
                            <div
                                className={`h-full rounded-full ${row.label === picked ? 'bg-jev' : 'bg-jev/35'}`}
                                style={{
                                    width: `${Math.max(0, Math.min(1, row.value)) * 100}%`,
                                }}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Pre({ children }: { children: string }) {
    return (
        <pre className="bg-muted max-h-96 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed">
            {children}
        </pre>
    );
}

function percent(value: number) {
    return `${Math.round(value * 100)}%`;
}

/** The SDK call this example makes, as a developer would write it. */
function requestCode(example: JevExample, state: string) {
    let stateValue = JSON.stringify(state);
    if (typeof example.state !== 'string') {
        try {
            stateValue = JSON.stringify(JSON.parse(state), null, 2);
        } catch {
            stateValue = state;
        }
    }
    const questions = Object.entries(example.questions)
        .map(([name, q]) => {
            const text = JSON.stringify(q.instructions);
            if (q.type === 'noul') {
                return q.criteria
                    ? `    ${name}: noul(${text}, ${JSON.stringify(q.criteria)}),`
                    : `    ${name}: noul(${text}),`;
            }
            if (q.type === 'choice') {
                return `    ${name}: choice(${text}, ${JSON.stringify(q.options, null, 2).replace(/\n/g, '\n    ')}),`;
            }
            return `    ${name}: score(${text}, ${JSON.stringify(q.levels, null, 2).replace(/\n/g, '\n    ')}),`;
        })
        .join('\n');
    const types = [
        ...new Set(Object.values(example.questions).map((q) => q.type)),
    ].join(', ');
    return `import { ${types}, TypeSafeClient } from '@typesafe-ai/sdk';

const client = new TypeSafeClient({ apiKey: process.env.JEV_API_KEY });

const { answers } = await client.systemOne({
  state: ${stateValue.replace(/\n/g, '\n  ')},
  questions: {
${questions}
  },
});`;
}
