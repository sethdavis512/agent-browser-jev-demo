import { useEffect, useRef, useState } from 'react';
import { AboutButton } from '~/components/AboutDialog';
import type { Activity, ActivitySource } from '~/lib/journey/shared';

export type TimedActivity = Activity & { at: number };

type Props = {
    activities: TimedActivity[];
    running: boolean;
    /** Client clock when the run started, for the live timer. */
    startedAt: number | null;
    /** Server-measured total once the run ends. */
    totalMs: number | null;
};

const SOURCES: Record<
    ActivitySource,
    { label: string; dot: string; bar: string }
> = {
    browser: { label: 'agent-browser', dot: 'bg-browser', bar: 'bg-browser' },
    jev: { label: 'Jev', dot: 'bg-jev', bar: 'bg-jev' },
    app: { label: 'App', dot: 'bg-app', bar: 'bg-app' },
};

const ORDER: ActivitySource[] = ['browser', 'jev', 'app'];

/**
 * What happens behind each screenshot: every agent-browser action, every
 * Jev decision, and how long each took, grouped by screen.
 */
export function ActivityPanel({
    activities,
    running,
    startedAt,
    totalMs,
}: Props) {
    const now = useNow(running);
    const list = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (running && list.current) {
            list.current.scrollTop = list.current.scrollHeight;
        }
    }, [activities.length, running]);

    const elapsed =
        totalMs ?? (running && startedAt ? Math.max(0, now - startedAt) : 0);
    const totals = ORDER.map((source) => {
        const own = activities.filter((a) => a.source === source);
        return {
            source,
            count: own.length,
            ms: own.reduce((sum, a) => sum + a.ms, 0),
        };
    });
    const measured = totals.reduce((sum, t) => sum + t.ms, 0);

    return (
        <aside
            aria-label="Behind the scenes"
            className="border-border bg-card flex max-h-[70dvh] flex-col rounded-lg border lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]"
        >
            <div className="border-border space-y-3 border-b p-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1">
                        <h2 className="font-medium">Behind the scenes</h2>
                        <AboutButton />
                    </div>
                    <span className="text-muted-foreground font-mono text-sm tabular-nums">
                        {formatMs(elapsed)}
                    </span>
                </div>
                <div
                    className="bg-muted flex h-2 overflow-hidden rounded-full"
                    aria-hidden
                >
                    {measured > 0 &&
                        totals.map((t) => (
                            <span
                                key={t.source}
                                className={SOURCES[t.source].bar}
                                style={{ width: `${(t.ms / measured) * 100}%` }}
                            />
                        ))}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                    {totals.map((t) => (
                        <div key={t.source}>
                            <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                <span
                                    className={`size-2 rounded-full ${SOURCES[t.source].dot}`}
                                />
                                {SOURCES[t.source].label}
                            </dt>
                            <dd className="font-mono tabular-nums">
                                {formatMs(t.ms)}
                                <span className="text-muted-foreground text-xs">
                                    {' '}
                                    · {t.count}
                                </span>
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>

            <div ref={list} className="min-h-0 flex-1 overflow-y-auto p-4">
                {activities.length === 0 ? (
                    <Intro running={running} />
                ) : (
                    <ol className="space-y-5">
                        {groupByStep(activities).map(([step, entries]) => (
                            <li key={step}>
                                <h3 className="text-muted-foreground mb-2 flex justify-between text-xs font-medium tracking-wide uppercase">
                                    <span>Screen {step + 1}</span>
                                    <span className="font-mono tabular-nums">
                                        {formatMs(
                                            entries.reduce(
                                                (sum, e) => sum + e.ms,
                                                0,
                                            ),
                                        )}
                                    </span>
                                </h3>
                                <ol className="space-y-3">
                                    {entries.map((entry, i) => (
                                        <ActivityRow key={i} entry={entry} />
                                    ))}
                                </ol>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </aside>
    );
}

function ActivityRow({ entry }: { entry: TimedActivity }) {
    const source = SOURCES[entry.source];
    return (
        <li className="flex gap-3 text-sm">
            <span
                aria-hidden
                className={`mt-1.5 size-2 shrink-0 rounded-full ${source.dot}`}
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0">
                        <span className="text-muted-foreground text-xs">
                            {source.label}
                        </span>{' '}
                        <span className="font-medium">{entry.title}</span>
                    </p>
                    <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                        {formatMs(entry.ms)}
                    </span>
                </div>
                <code className="text-muted-foreground block truncate font-mono text-xs">
                    {entry.command}
                </code>
                {entry.detail.map((line, i) => (
                    <p
                        key={i}
                        className="text-muted-foreground text-xs break-words"
                    >
                        {line}
                    </p>
                ))}
            </div>
        </li>
    );
}

function Intro({ running }: { running: boolean }) {
    if (running) {
        return (
            <p className="text-muted-foreground text-sm">Starting a browser…</p>
        );
    }
    return (
        <div className="text-muted-foreground space-y-3 text-sm">
            <p>Every step of a journey shows up here as it happens:</p>
            <ul className="space-y-2">
                <li className="flex gap-2">
                    <span className="bg-browser mt-1.5 size-2 shrink-0 rounded-full" />
                    <span>
                        <strong className="text-foreground font-medium">
                            agent-browser
                        </strong>{' '}
                        drives a real Chrome: opens pages, reads the
                        accessibility tree, clicks, and takes screenshots.
                    </span>
                </li>
                <li className="flex gap-2">
                    <span className="bg-jev mt-1.5 size-2 shrink-0 rounded-full" />
                    <span>
                        <strong className="text-foreground font-medium">
                            Jev
                        </strong>{' '}
                        looks at each screen and decides: is this the
                        destination, and if not, what to click next.
                    </span>
                </li>
                <li className="flex gap-2">
                    <span className="bg-app mt-1.5 size-2 shrink-0 rounded-full" />
                    <span>
                        <strong className="text-foreground font-medium">
                            App
                        </strong>{' '}
                        sends each screenshot to this page.
                    </span>
                </li>
            </ul>
        </div>
    );
}

/** Ticks every 100 ms while `active`, for the live timer. */
function useNow(active: boolean) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(id);
    }, [active]);
    return now;
}

function groupByStep(activities: TimedActivity[]) {
    const groups = new Map<number, TimedActivity[]>();
    for (const activity of activities) {
        const group = groups.get(activity.step) ?? [];
        group.push(activity);
        groups.set(activity.step, group);
    }
    return [...groups.entries()];
}

function formatMs(ms: number) {
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
