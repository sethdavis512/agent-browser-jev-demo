import { Info, X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

/**
 * An info button that opens a developer-facing explanation of how
 * agent-browser and Jev work together. Uses the native <dialog>, which
 * handles focus, Escape, and the backdrop on its own.
 */
export function AboutButton() {
    const dialog = useRef<HTMLDialogElement>(null);

    function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
        // Clicks on the backdrop land on the <dialog> itself.
        if (event.target === event.currentTarget) event.currentTarget.close();
    }

    return (
        <>
            <button
                type="button"
                onClick={() => dialog.current?.showModal()}
                aria-label="How this works"
                title="How this works"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 pointer-coarse:size-11"
            >
                <Info className="size-4" />
            </button>
            <dialog
                ref={dialog}
                onClick={handleBackdropClick}
                aria-labelledby="about-title"
                className="bg-card text-foreground border-border m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl rounded-lg border p-0 shadow-xl backdrop:bg-black/60"
            >
                <div className="bg-card border-border sticky top-0 flex items-center justify-between gap-4 border-b px-5 py-4">
                    <h2 id="about-title" className="text-lg font-semibold">
                        How agent-browser and Jev work together
                    </h2>
                    <button
                        type="button"
                        onClick={() => dialog.current?.close()}
                        aria-label="Close"
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 pointer-coarse:size-11"
                    >
                        <X className="size-5" />
                    </button>
                </div>
                <AboutContent />
            </dialog>
        </>
    );
}

function AboutContent() {
    return (
        <div className="space-y-6 px-5 py-5 text-sm leading-relaxed">
            <p>
                Two tools split the work. <Strong>agent-browser</Strong> is a
                CLI that drives a real Chrome and describes each page in a form
                a model can reason about. <Strong>Jev</Strong> (TypeSafe's
                System One model) answers typed questions about that
                description. Plain TypeScript sits between them and makes every
                rule-based call: when to stop, what counts as found, which
                clicks are allowed.
            </p>

            <Section title="The loop, once per screen">
                <ol className="list-decimal space-y-2 pl-5">
                    <li>
                        <Strong>Read.</Strong> agent-browser runs{' '}
                        <Code>snapshot -i -c -u</Code>: the page's accessibility
                        tree, trimmed to interactive elements, each tagged with
                        a short ref like <Code>@e12</Code>. An <Code>eval</Code>{' '}
                        grabs the main text.
                    </li>
                    <li>
                        <Strong>Narrow.</Strong> Code keeps only clickable roles
                        (links, buttons, tabs, menu items) with a readable name,
                        drops duplicates, in-page anchors, and anything already
                        clicked, and caps the list at 200.
                    </li>
                    <li>
                        <Strong>Judge.</Strong> One Jev request asks two
                        questions over the same state, answered in parallel.
                    </li>
                    <li>
                        <Strong>Decide.</Strong> Code turns the answers into
                        stop or go: 80% or more means found; no useful click
                        means found if at least 50%, otherwise stuck; 10 screens
                        is the limit.
                    </li>
                    <li>
                        <Strong>Act.</Strong> agent-browser scrolls the chosen
                        element into view, measures its box for the highlight,
                        takes the screenshot, and runs <Code>click @e12</Code>.
                        If the click leaves the site, it goes <Code>back</Code>.
                    </li>
                </ol>
            </Section>

            <Section title="The handoff: refs are the shared language">
                <p>
                    Every candidate becomes an option key for Jev, and every key
                    maps back to a ref agent-browser can click. No CSS
                    selectors, no pixel coordinates, no parsing a model's prose
                    to find out what it meant.
                </p>
                <Pre>{`const { answers } = await jev.systemOne({
  state: { goal, page: { url, title, text, elements }, history },
  questions: {
    arrived: noul('Can they accomplish goal from this screen?', …),
    next: choice('Which element should they click next?', {
      el_0: 'link "Pricing" -> github.com/pricing',
      el_1: 'button "Sign in"',
      // … up to 200 candidates
      none: 'None of these leads closer',
    }),
  },
});

answers.arrived.noul     // 0.12  probability, not prose
answers.next.choice      // "el_0" -> ref e12 -> agent-browser click @e12
answers.next.confidence  // 0.91`}</Pre>
            </Section>

            <Section title="Why the combination works">
                <ul className="space-y-2">
                    <Point title="Semantic input, not raw HTML.">
                        The accessibility tree reads like what a person sees (
                        <Code>link "Pricing"</Code>), so the state Jev gets is a
                        few thousand characters instead of hundreds of kilobytes
                        of markup. On long pages, only the passages that match
                        the goal are sent.
                    </Point>
                    <Point title="Typed output, nothing to parse.">
                        Jev returns a probability and a choice with a
                        confidence. It can only pick from options that exist on
                        the page (or say none), so it can't invent an element to
                        click.
                    </Point>
                    <Point title="Fast enough to watch.">
                        Each decision takes a few hundred milliseconds, so the
                        browser, not the model, sets the pace. Compare the
                        agent-browser and Jev totals in the panel.
                    </Point>
                    <Point title="Rules stay in code.">
                        Thresholds, the step limit, the same-site guard, and the
                        bot-check stop are plain TypeScript, unit tested and
                        easy to change. The model only does judgment.
                    </Point>
                    <Point title="Each tool does one job.">
                        agent-browser owns Chrome: sessions, waits, tabs,
                        timeouts. Jev owns the judgment. Either could be swapped
                        without touching the other.
                    </Point>
                </ul>
            </Section>

            <Section title="Finding the answer on the last screen">
                <p>
                    When a screen counts as found, agent-browser runs a script
                    in the page that collects short passages mentioning the
                    goal's words. Jev picks the one that actually answers the
                    goal (keyword scores alone often pick the wrong one), and
                    agent-browser scrolls it into view for the green ring.
                </p>
            </Section>

            <Section title="Plumbing">
                <p>
                    The page posts to a React Router resource route that holds
                    the request open and streams newline-delimited JSON: an{' '}
                    <Code>activity</Code> line for each action above, a{' '}
                    <Code>step</Code> line per screenshot, then{' '}
                    <Code>done</Code>. Nothing is stored. Closing the tab aborts
                    the request, which ends the loop and closes Chrome.
                </p>
                <p>
                    Source:{' '}
                    <a
                        href="https://github.com/sethdavis512/agent-browser-jev-demo"
                        className="underline underline-offset-2"
                        target="_blank"
                        rel="noreferrer"
                    >
                        agent-browser-jev-demo
                    </a>
                    {' · '}
                    <a
                        href="https://github.com/vercel-labs/agent-browser"
                        className="underline underline-offset-2"
                        target="_blank"
                        rel="noreferrer"
                    >
                        agent-browser
                    </a>
                </p>
            </Section>
        </div>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h3 className="font-semibold">{title}</h3>
            {children}
        </section>
    );
}

function Point({ title, children }: { title: string; children: ReactNode }) {
    return (
        <li>
            <Strong>{title}</Strong> {children}
        </li>
    );
}

function Strong({ children }: { children: ReactNode }) {
    return <strong className="font-semibold">{children}</strong>;
}

function Code({ children }: { children: ReactNode }) {
    return (
        <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">
            {children}
        </code>
    );
}

function Pre({ children }: { children: string }) {
    return (
        <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed">
            {children}
        </pre>
    );
}
