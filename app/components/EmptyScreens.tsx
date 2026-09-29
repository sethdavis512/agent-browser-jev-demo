import { ArrowRight } from 'lucide-react';

type Props = {
    /** A few prompts to start with one click. */
    suggestions: string[];
    onTry: (prompt: string) => void;
};

/**
 * What the screenshot column looks like before a run: a wireframe of the
 * screen that will appear, marked the way real screens are (blue for the
 * click Jev chose, green for the answer), so the first real result is
 * already familiar.
 */
export function EmptyScreens({ suggestions, onTry }: Props) {
    return (
        <div className="space-y-6">
            <figure className="space-y-3">
                <Wireframe />
                <figcaption className="space-y-2">
                    <p className="font-medium">
                        Each screen the browser visits lands here, one per
                        click.
                    </p>
                    <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        <li className="flex items-center gap-2">
                            <span
                                aria-hidden
                                className="border-info inline-block h-3 w-5 rounded-sm border-2"
                            />
                            What Jev chose to click
                        </li>
                        <li className="flex items-center gap-2">
                            <span
                                aria-hidden
                                className="border-success inline-block h-3 w-5 rounded-sm border-2"
                            />
                            The answer it found
                        </li>
                    </ul>
                </figcaption>
            </figure>

            <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                    Start with one of these:
                </p>
                <ul className="flex flex-col gap-2">
                    {suggestions.map((prompt) => (
                        <li key={prompt}>
                            <button
                                type="button"
                                onClick={() => onTry(prompt)}
                                className="group border-border hover:border-ring hover:bg-card focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm outline-none focus-visible:ring-2"
                            >
                                <span className="min-w-0">{prompt}</span>
                                <ArrowRight
                                    aria-hidden
                                    className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                                />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

/** A sketch of a site at the journey's 8:5 viewport, drawn with tokens. */
function Wireframe() {
    return (
        <div
            aria-hidden
            className="border-border bg-card overflow-hidden rounded-lg border border-dashed"
        >
            <div className="border-border flex items-center gap-3 border-b border-dashed px-3 py-2">
                <div className="flex gap-1">
                    <span className="bg-muted-foreground/30 size-2 rounded-full" />
                    <span className="bg-muted-foreground/30 size-2 rounded-full" />
                    <span className="bg-muted-foreground/30 size-2 rounded-full" />
                </div>
                <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 font-mono text-[10px]">
                    stripe.com
                </span>
            </div>

            <div className="flex aspect-8/5 flex-col gap-[6%] p-[5%]">
                <div className="flex items-center gap-[4%]">
                    <span className="bg-muted-foreground/40 h-2.5 w-[12%] rounded-sm" />
                    <span className="bg-muted h-2 w-[10%] rounded-sm" />
                    <span className="bg-muted h-2 w-[10%] rounded-sm" />
                    <span className="border-info animate-[wire-ring_2.4s_ease-out_infinite] rounded-md border-2 px-1.5 py-0.5 text-[10px] leading-none motion-reduce:animate-none">
                        Pricing
                    </span>
                    <span className="bg-muted ml-auto h-4 w-[12%] rounded" />
                </div>

                <div className="space-y-2">
                    <span className="bg-muted-foreground/25 block h-4 w-[70%] rounded-sm" />
                    <span className="bg-muted-foreground/25 block h-4 w-[55%] rounded-sm" />
                    <span className="bg-muted block h-2 w-[45%] rounded-sm" />
                </div>

                <div className="mt-auto grid grid-cols-3 gap-[4%]">
                    <span className="bg-muted h-10 rounded" />
                    <span className="border-success flex h-10 items-center justify-center rounded border-2 text-[10px] font-medium">
                        2.9% + 30¢
                    </span>
                    <span className="bg-muted h-10 rounded" />
                </div>
            </div>
        </div>
    );
}
