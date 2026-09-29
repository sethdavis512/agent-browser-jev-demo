import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '~/components/PageHeader';

const DEMOS = [
    {
        to: '/jev',
        step: '1',
        title: 'Jev',
        description:
            'Ask typed questions about a piece of text and get probabilities back, not prose. Start here if Jev is new to you.',
    },
    {
        to: '/agent-browser',
        step: '2',
        title: 'Jev + Agent Browser',
        description:
            'Jev drives a real browser through a website, deciding every click, while you watch each screen and decision.',
    },
];

export default function Home() {
    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-16">
            <title>Agent Browser and Jev Demo</title>
            <PageHeader
                title="Agent Browser and Jev Demo"
                description="Two small playgrounds. Pick one, choose an example, and watch what happens."
            />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {DEMOS.map((demo) => (
                    <li key={demo.to}>
                        <Link
                            to={demo.to}
                            className="group border-border bg-card hover:border-ring focus-visible:ring-ring flex h-full flex-col gap-3 rounded-lg border p-6 outline-none focus-visible:ring-2"
                        >
                            <span className="text-muted-foreground font-mono text-sm">
                                {demo.step}
                            </span>
                            <span className="text-xl font-semibold">
                                {demo.title}
                            </span>
                            <span className="text-muted-foreground flex-1">
                                {demo.description}
                            </span>
                            <span className="inline-flex items-center gap-1 text-sm font-medium">
                                Open
                                <ArrowRight
                                    aria-hidden
                                    className="size-4 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5"
                                />
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
