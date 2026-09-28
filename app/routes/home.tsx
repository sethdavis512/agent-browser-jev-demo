import { ArrowRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ActivityPanel, type TimedActivity } from '~/components/ActivityPanel';
import {
    VIEWPORT,
    type Box,
    type JourneyStatus,
    type RunEvent,
    type StepView,
} from '~/lib/journey/shared';

type RunState =
    | { phase: 'idle' }
    | { phase: 'running'; host: string | null }
    | { phase: 'done'; status: JourneyStatus }
    | { phase: 'error'; message: string };

const LINKS = [
    {
        label: 'agent-browser',
        href: 'https://github.com/vercel-labs/agent-browser',
    },
    { label: 'Jev (TypeSafe docs)', href: 'https://docs.typesafe.ai/' },
    {
        label: 'Source on GitHub',
        href: 'https://github.com/sethdavis512/agent-browser-jev-demo',
    },
];

/** Ready-made prompts that run as soon as they are picked. */
const EXAMPLES = [
    "github.com: find the page that shows GitHub's pricing plans",
    'stripe.com: find the fee for international cards',
    'vercel.com: find the price of the Pro plan',
    'railway.com: find how much a GB of RAM costs per month',
    'python.org: find the latest Python release',
    'developer.mozilla.org: find the docs for Array.prototype.flatMap',
    'react.dev: find the reference page for useEffect',
    'tailwindcss.com: find the docs page about dark mode',
    'nodejs.org: find the download for the LTS release',
    'nasa.gov: find the page about the Artemis program',
];

const OUTCOME: Record<JourneyStatus, string> = {
    FOUND: 'Found it.',
    STUCK: 'Got stuck: nothing on the last screen looked like a way forward.',
    OUT_OF_STEPS: 'Ran out of steps before finding it.',
    BLOCKED: 'The site blocked the browser with a bot check.',
};

export default function Home() {
    const [prompt, setPrompt] = useState('');
    const [steps, setSteps] = useState<StepView[]>([]);
    const [run, setRun] = useState<RunState>({ phase: 'idle' });
    const [activities, setActivities] = useState<TimedActivity[]>([]);
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [totalMs, setTotalMs] = useState<number | null>(null);
    const abort = useRef<AbortController | null>(null);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void start(prompt);
    }

    function handleExample(event: ChangeEvent<HTMLSelectElement>) {
        const example = event.target.value;
        if (!example) return;
        setPrompt(example);
        void start(example);
    }

    async function start(text: string) {
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        setSteps([]);
        setActivities([]);
        setStartedAt(Date.now());
        setTotalMs(null);
        setRun({ phase: 'running', host: null });

        try {
            const response = await fetch('/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text }),
                signal: controller.signal,
            });
            if (!response.ok || !response.body) {
                const body = await response.json().catch(() => null);
                setRun({
                    phase: 'error',
                    message: body?.error ?? 'Something went wrong',
                });
                return;
            }
            for await (const event of readEvents(response.body)) {
                handleEvent(event);
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            setRun({
                phase: 'error',
                message: error instanceof Error ? error.message : 'Failed',
            });
        }
    }

    function handleEvent(event: RunEvent) {
        if (event.type === 'start') {
            setRun({
                phase: 'running',
                host: new URL(event.startUrl).hostname,
            });
        } else if (event.type === 'activity') {
            setActivities((current) => [...current, event.activity]);
        } else if (event.type === 'step') {
            setSteps((current) => [...current, event.step]);
        } else if (event.type === 'done') {
            setTotalMs(event.totalMs);
            setRun({ phase: 'done', status: event.status });
        } else {
            setTotalMs(event.totalMs);
            setRun({ phase: 'error', message: event.message });
        }
    }

    const running = run.phase === 'running';

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
            <title>Agent Browser and Jev Demo</title>
            <header className="mb-6 space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Agent Browser and Jev Demo
                </h1>
                <nav aria-label="Resources">
                    <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        {LINKS.map((link) => (
                            <li key={link.href}>
                                <a
                                    href={link.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-0.5 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2"
                                >
                                    {link.label}
                                    <ArrowUpRight
                                        aria-hidden
                                        className="size-3.5"
                                    />
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            </header>
            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto]"
            >
                <label htmlFor="prompt" className="sr-only">
                    Where to start and what to find
                </label>
                <input
                    id="prompt"
                    name="prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="stripe.com: find the fee for international cards"
                    autoComplete="off"
                    autoFocus
                    required
                    className="border-border bg-card placeholder:text-muted-foreground focus:ring-ring h-12 min-w-0 flex-1 rounded-lg border px-4 text-base outline-none focus:ring-2"
                />
                <label htmlFor="example" className="sr-only">
                    Run an example
                </label>
                <select
                    id="example"
                    value=""
                    onChange={handleExample}
                    disabled={running}
                    className="border-border bg-card focus:ring-ring col-span-2 row-start-2 h-12 min-w-0 rounded-lg border px-3 text-base outline-none focus:ring-2 disabled:opacity-60 sm:col-span-1 sm:row-start-auto sm:w-56"
                >
                    <option value="">Run an example…</option>
                    {EXAMPLES.map((example) => (
                        <option key={example} value={example}>
                            {example}
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    disabled={running}
                    aria-label="Start"
                    className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex size-12 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                    {running ? (
                        <Loader2 className="size-5 animate-spin" />
                    ) : (
                        <ArrowRight className="size-5" />
                    )}
                </button>
            </form>

            <RunStatus run={run} steps={steps.length} />

            <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
                <ol className="grid gap-6 empty:hidden lg:empty:grid">
                    {steps.map((step) => (
                        <StepCard key={step.index} step={step} />
                    ))}
                    {running && <PendingCard />}
                </ol>
                <ActivityPanel
                    activities={activities}
                    running={running}
                    startedAt={startedAt}
                    totalMs={totalMs}
                />
            </div>
        </main>
    );
}

function RunStatus({ run, steps }: { run: RunState; steps: number }) {
    if (run.phase === 'idle') return null;
    const text =
        run.phase === 'running'
            ? run.host
                ? `Browsing ${run.host}…`
                : 'Starting…'
            : run.phase === 'done'
              ? `${OUTCOME[run.status]} ${steps} ${steps === 1 ? 'screen' : 'screens'}.`
              : run.message;
    return (
        <p
            role="status"
            className={
                run.phase === 'error'
                    ? 'text-destructive mt-4 text-sm'
                    : 'text-muted-foreground mt-4 text-sm'
            }
        >
            {text}
        </p>
    );
}

function StepCard({ step }: { step: StepView }) {
    return (
        <li className="border-border bg-card overflow-hidden rounded-lg border">
            <div className="relative">
                <img
                    src={step.imageUrl}
                    alt={`Screen ${step.index + 1}: ${step.title}`}
                    width={VIEWPORT.width}
                    height={VIEWPORT.height}
                    className="block h-auto w-full"
                />
                {step.action?.box && (
                    <Highlight box={step.action.box} className="border-info" />
                )}
                {step.evidence && (
                    <Highlight
                        box={step.evidence.box}
                        className="border-success"
                    />
                )}
            </div>
            <div className="space-y-1 p-3 text-sm">
                <p className="truncate font-medium">
                    {step.index + 1}. {step.title || step.url}
                </p>
                {step.action && (
                    <p className="text-muted-foreground truncate">
                        Clicked {step.action.role} “{step.action.name}”
                    </p>
                )}
                {step.evidence && (
                    <p className="text-muted-foreground line-clamp-2">
                        “{step.evidence.text}”
                    </p>
                )}
            </div>
        </li>
    );
}

/** A ring over the screenshot, positioned in percent of the viewport. */
function Highlight({ box, className }: { box: Box; className: string }) {
    const pad = 4;
    return (
        <span
            aria-hidden
            className={`pointer-events-none absolute rounded-md border-[3px] ${className}`}
            style={{
                left: `${((box.x - pad) / VIEWPORT.width) * 100}%`,
                top: `${((box.y - pad) / VIEWPORT.height) * 100}%`,
                width: `${((box.width + pad * 2) / VIEWPORT.width) * 100}%`,
                height: `${((box.height + pad * 2) / VIEWPORT.height) * 100}%`,
            }}
        />
    );
}

function PendingCard() {
    return (
        <li className="border-border bg-muted flex aspect-8/5 animate-pulse items-center justify-center rounded-lg border">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </li>
    );
}

/** Parses a newline-delimited JSON stream into events as they arrive. */
async function* readEvents(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (line.trim()) yield JSON.parse(line) as RunEvent;
        }
    }
}
