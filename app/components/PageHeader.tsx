import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

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

type Props = {
    title: string;
    description?: ReactNode;
    /** Show a link back to the demo picker. */
    back?: boolean;
};

/** Page title, an optional way back home, and the resource links. */
export function PageHeader({ title, description, back = false }: Props) {
    return (
        <header className="mb-6 space-y-2">
            {back && (
                <Link
                    to="/"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-sm outline-none focus-visible:ring-2"
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    All demos
                </Link>
            )}
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
            </h1>
            {description && (
                <p className="text-muted-foreground max-w-3xl">{description}</p>
            )}
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
    );
}
