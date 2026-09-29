import { Loader2, Play } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
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

const TYPE_LABELS: Record<JevQuestion['type'], string> = {
    noul: 'noul · yes or no',
    choice: 'choice · pick one',
    score: 'score · rate on a scale',
};

export default function Jev() {
    const fetcher = useFetcher<typeof action>();
    const [exampleId, setExampleId] = useState(JEV_EXAMPLES[0].id);
    const [state, setState] = useState(stateText(JEV_EXAMPLES[0].state));
    const example = findJevExample(exampleId) ?? JEV_EXAMPLES[0];
    const asking = fetcher.state !== 'idle';
    const result = fetcher.data;

    function ask(id: string, text: string) {
        fetcher.submit({ exampleId: id, state: text }, { method: 'post' });
    }

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

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
            <title>Jev · Agent Browser and Jev Demo</title>
            <PageHeader
                back
                title="Jev"
                description={
                    <>
                        Jev (TypeSafe's System One model) reads some state, text
                        or JSON, and answers typed questions: yes or no as a
                        probability, one label from a set, or a place on a
                        scale. The answers are numbers your code can use, not
                        prose to parse. Pick an example, then edit the text and
                        ask again.
                    </>
                }
            />

            <div className="grid grid-cols-[1fr_auto] gap-2">
                <label htmlFor="example" className="sr-only">
                    Example
                </label>
                <select
                    id="example"
                    value={exampleId}
                    onChange={handleExample}
                    className="border-border bg-card focus:ring-ring h-12 min-w-0 rounded-lg border px-3 text-base outline-none focus:ring-2"
                >
                    {JEV_EXAMPLES.map((option, i) => (
                        <option key={option.id} value={option.id}>
                            {i + 1}. {option.title}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => ask(example.id, state)}
                    disabled={asking}
                    className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex h-12 items-center gap-2 rounded-lg px-4 font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                    {asking ? (
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                    ) : (
                        <Play aria-hidden className="size-4" />
                    )}
                    Ask Jev
                </button>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
                {example.blurb}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
                <section className="border-border bg-card space-y-5 rounded-lg border p-4 sm:p-5">
                    <div className="space-y-2">
                        <label
                            htmlFor="state"
                            className="flex items-baseline justify-between gap-2"
                        >
                            <span className="font-medium">State</span>
                            <span className="text-muted-foreground text-xs">
                                {typeof example.state === 'string'
                                    ? 'Text'
                                    : 'JSON'}{' '}
                                · edit it and ask again
                            </span>
                        </label>
                        <textarea
                            id="state"
                            value={state}
                            onChange={(event) => setState(event.target.value)}
                            rows={typeof example.state === 'string' ? 5 : 12}
                            spellCheck={false}
                            className={`border-border bg-background focus:ring-ring w-full rounded-md border p-3 text-sm outline-none focus:ring-2 ${
                                typeof example.state === 'string'
                                    ? ''
                                    : 'font-mono'
                            }`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h2 className="font-medium">
                            {Object.keys(example.questions).length === 1
                                ? 'Question'
                                : `${Object.keys(example.questions).length} questions, one request`}
                        </h2>
                        {Object.entries(example.questions).map(
                            ([name, question]) => (
                                <QuestionCard
                                    key={name}
                                    name={name}
                                    question={question}
                                />
                            ),
                        )}
                    </div>
                </section>

                <section
                    aria-live="polite"
                    className="border-border bg-card space-y-5 rounded-lg border p-4 sm:p-5"
                >
                    <div className="flex items-baseline justify-between gap-2">
                        <h2 className="font-medium">Jev's answers</h2>
                        {answers && (
                            <span className="text-muted-foreground font-mono text-xs tabular-nums">
                                {answers.ms} ms ·{' '}
                                {(
                                    answers.usage.input_tokens +
                                    answers.usage.output_tokens
                                ).toLocaleString('en-US')}{' '}
                                tokens
                            </span>
                        )}
                    </div>

                    {asking ? (
                        <p className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Loader2
                                aria-hidden
                                className="size-4 animate-spin"
                            />
                            Asking Jev…
                        </p>
                    ) : result && !result.ok ? (
                        <p className="text-destructive text-sm">
                            {result.error}
                        </p>
                    ) : answers ? (
                        <div className="space-y-6">
                            {Object.entries(example.questions).map(
                                ([name, question]) =>
                                    answers.answers[name] && (
                                        <AnswerView
                                            key={name}
                                            name={name}
                                            question={question}
                                            answer={answers.answers[name]}
                                        />
                                    ),
                            )}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            Press{' '}
                            <strong className="font-medium">Ask Jev</strong> or
                            pick an example to see the answers.
                        </p>
                    )}

                    <details className="group">
                        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
                            The request in code
                        </summary>
                        <Pre>{requestCode(example, state)}</Pre>
                    </details>
                    {answers && (
                        <details>
                            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
                                The raw response
                            </summary>
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
                        </details>
                    )}
                </section>
            </div>
        </main>
    );
}

function QuestionCard({
    name,
    question,
}: {
    name: string;
    question: JevQuestion;
}) {
    return (
        <div className="border-border space-y-2 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-xs">{name}</code>
                <span className="text-muted-foreground text-xs">
                    {TYPE_LABELS[question.type]}
                </span>
            </div>
            <p>{question.instructions}</p>
            {question.type === 'choice' && (
                <ul className="text-muted-foreground space-y-0.5 text-xs">
                    {Object.entries(question.options).map(([label, text]) => (
                        <li key={label}>
                            <code className="text-foreground font-mono">
                                {label}
                            </code>
                            {text ? `: ${text}` : ''}
                        </li>
                    ))}
                </ul>
            )}
            {question.type === 'score' && (
                <ol className="text-muted-foreground space-y-0.5 text-xs">
                    {question.levels.map((level, i) => (
                        <li key={level}>
                            <code className="text-foreground font-mono">
                                {i}
                            </code>
                            : {level}
                        </li>
                    ))}
                </ol>
            )}
            {question.type === 'noul' && question.criteria && (
                <ul className="text-muted-foreground space-y-0.5 text-xs">
                    <li>
                        <code className="text-foreground font-mono">yes</code>:{' '}
                        {question.criteria.true}
                    </li>
                    <li>
                        <code className="text-foreground font-mono">no</code>:{' '}
                        {question.criteria.false}
                    </li>
                </ul>
            )}
        </div>
    );
}

function AnswerView({
    name,
    question,
    answer,
}: {
    name: string;
    question: JevQuestion;
    answer: JevAnswer;
}) {
    return (
        <div className="space-y-2">
            <p className="text-sm">
                <code className="font-mono text-xs">{name}</code>{' '}
                <span className="text-muted-foreground">
                    {question.instructions}
                </span>
            </p>
            {answer.type === 'noul' && <NoulAnswer p={answer.noul} />}
            {answer.type === 'choice' && question.type === 'choice' && (
                <ChoiceAnswer answer={answer} options={question.options} />
            )}
            {answer.type === 'score' && question.type === 'score' && (
                <ScoreAnswer answer={answer} levels={question.levels} />
            )}
        </div>
    );
}

function NoulAnswer({ p }: { p: number }) {
    return (
        <div className="space-y-1.5">
            <p className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">
                    {percent(p)}
                </span>
                <span className="text-muted-foreground text-sm">
                    likely yes, so{' '}
                    <strong className="text-foreground font-medium">
                        {p >= 0.5 ? 'yes' : 'no'}
                    </strong>
                </span>
            </p>
            <Bar value={p} strong />
        </div>
    );
}

function ChoiceAnswer({
    answer,
    options,
}: {
    answer: Extract<JevAnswer, { type: 'choice' }>;
    options: Record<string, string | null>;
}) {
    const ranked = Object.entries(answer.probabilities).sort(
        ([, a], [, b]) => b - a,
    );
    return (
        <div className="space-y-2">
            <p className="flex flex-wrap items-baseline gap-x-2">
                <code className="font-mono text-xl font-semibold">
                    {answer.choice}
                </code>
                <span className="text-muted-foreground text-sm">
                    {percent(answer.confidence)} confident
                </span>
            </p>
            <ul className="space-y-1.5">
                {ranked.map(([label, p]) => (
                    <Row
                        key={label}
                        label={label}
                        hint={options[label]}
                        value={p}
                        strong={label === answer.choice}
                    />
                ))}
            </ul>
        </div>
    );
}

function ScoreAnswer({
    answer,
    levels,
}: {
    answer: Extract<JevAnswer, { type: 'score' }>;
    levels: string[];
}) {
    const nearest = Math.round(answer.score);
    return (
        <div className="space-y-2">
            <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-semibold tabular-nums">
                    {answer.score.toFixed(1)}
                </span>
                <span className="text-muted-foreground text-sm">
                    on a 0–{levels.length - 1} scale, closest to “
                    {levels[nearest]}”
                </span>
            </p>
            <ul className="space-y-1.5">
                {levels.map((level, i) => (
                    <Row
                        key={level}
                        label={String(i)}
                        hint={level}
                        value={answer.probabilities[String(i)] ?? 0}
                        strong={i === nearest}
                    />
                ))}
            </ul>
        </div>
    );
}

function Row({
    label,
    hint,
    value,
    strong,
}: {
    label: string;
    hint?: string | null;
    value: number;
    strong: boolean;
}) {
    return (
        <li className="space-y-1 text-sm">
            <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                    <code
                        className={`font-mono text-xs ${strong ? 'font-semibold' : ''}`}
                    >
                        {label}
                    </code>
                    {hint && (
                        <span className="text-muted-foreground"> {hint}</span>
                    )}
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                    {percent(value)}
                </span>
            </div>
            <Bar value={value} strong={strong} />
        </li>
    );
}

function Bar({ value, strong }: { value: number; strong: boolean }) {
    return (
        <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
            <div
                className={`h-full rounded-full ${strong ? 'bg-jev' : 'bg-jev/35'}`}
                style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
            />
        </div>
    );
}

function Pre({ children }: { children: string }) {
    return (
        <pre className="bg-muted mt-2 max-h-96 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed">
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
