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

/** Who did the work: the browser, Jev's judgment, or the app itself. */
export type ActivitySource = 'browser' | 'jev' | 'app';

/** One thing that happened behind the scenes, for the activity panel. */
export type Activity = {
    source: ActivitySource;
    /** The screen (0-based) this belongs to. */
    step: number;
    title: string;
    /** The command or API call that did the work. */
    command: string;
    detail: string[];
    ms: number;
};

/** One line of the /run response stream (newline-delimited JSON). */
export type RunEvent =
    | { type: 'start'; startUrl: string; goal: string }
    | { type: 'activity'; activity: Activity & { at: number } }
    | { type: 'step'; step: StepView }
    | {
          type: 'done';
          status: JourneyStatus;
          finalUrl: string;
          totalMs: number;
      }
    | { type: 'error'; message: string; totalMs: number };
