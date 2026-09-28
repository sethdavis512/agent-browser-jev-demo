import { randomUUID } from 'node:crypto';
import { data } from 'react-router';
import { z } from 'zod';
import { screenshotUrl } from '~/lib/cloudinary.server';
import { navigate } from '~/lib/journey/navigate.server';
import { parsePrompt } from '~/lib/journey/prompt';
import {
    ARRIVAL_THRESHOLD,
    MAX_STEPS,
    type RunEvent,
} from '~/lib/journey/shared';
import type { Route } from './+types/run';

const bodySchema = z.object({ prompt: z.string().min(1).max(1000) });

/**
 * Runs one journey and streams it back as newline-delimited JSON: a `start`
 * line, a `step` line per captured screen, then `done` or `error`. Nothing
 * is stored; closing the page stops the browser.
 */
export async function action({ request }: Route.ActionArgs) {
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
        return data({ error: 'Type what to look for' }, { status: 400 });
    }
    const parsed = parsePrompt(body.data.prompt);
    if (!parsed.ok) return data({ error: parsed.error }, { status: 400 });

    const { startUrl, goal } = parsed;
    const runId = randomUUID();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: RunEvent) => {
                if (request.signal.aborted) return;
                controller.enqueue(
                    encoder.encode(`${JSON.stringify(event)}\n`),
                );
            };

            send({ type: 'start', startUrl, goal });
            try {
                const outcome = await navigate(
                    {
                        startUrl,
                        goal,
                        maxSteps: MAX_STEPS,
                        arrivalThreshold: ARRIVAL_THRESHOLD,
                        session: `demo-${runId}`,
                    },
                    async (step) => {
                        // The page went away: throwing ends the loop, and
                        // navigate() closes the browser on the way out.
                        if (request.signal.aborted) throw new Error('aborted');
                        send({
                            type: 'step',
                            step: {
                                index: step.index,
                                url: step.url,
                                title: step.title,
                                imageUrl: await screenshotUrl(
                                    step.screenshotPath,
                                    { runId, index: step.index },
                                ),
                                arrived: step.arrived,
                                action: step.action && {
                                    role: step.action.role,
                                    name: step.action.name,
                                    box: step.action.box,
                                },
                                evidence: step.evidence,
                            },
                        });
                    },
                );
                send({
                    type: 'done',
                    status: outcome.status,
                    finalUrl: outcome.finalUrl,
                });
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                send({ type: 'error', message: message.slice(0, 500) });
            } finally {
                if (!request.signal.aborted) controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            // no-transform keeps react-router-serve's compression from
            // buffering the stream.
            'Cache-Control': 'no-store, no-transform',
        },
    });
}
