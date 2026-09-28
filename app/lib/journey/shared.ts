/**
 * Journey constants and types shared by the page and the server.
 * Client-safe: no server imports.
 */

/** Browser viewport for every journey; screenshots are this size in CSS px. */
export const VIEWPORT = { width: 1280, height: 800 } as const;

/** Screens a journey may capture before it gives up. */
export const MAX_STEPS = 10;

/** Noul probability at or above which a screen counts as the destination. */
export const ARRIVAL_THRESHOLD = 0.8;

export type Box = { x: number; y: number; width: number; height: number };

export type JourneyStatus = 'FOUND' | 'STUCK' | 'OUT_OF_STEPS' | 'BLOCKED';

export type StepView = {
    index: number;
    url: string;
    title: string;
    imageUrl: string;
    /** Probability this screen is the destination. */
    arrived: number;
    /** The element clicked from this screen, or null on the last screen. */
    action: { role: string; name: string; box: Box | null } | null;
    /** On the destination screen: the passage that answers the goal. */
    evidence: { box: Box; text: string } | null;
};

/** One line of the /run response stream (newline-delimited JSON). */
export type RunEvent =
    | { type: 'start'; startUrl: string; goal: string }
    | { type: 'step'; step: StepView }
    | { type: 'done'; status: JourneyStatus; finalUrl: string }
    | { type: 'error'; message: string };
