import {
    choice,
    noul,
    score,
    type EntryType,
    type Question,
} from '@typesafe-ai/sdk';
import { getJevClient } from '~/lib/typesafe.server';
import type { JevAnswer, JevExample, JevQuestion, JevResult } from './examples';

function toSdkQuestion(question: JevQuestion): Question {
    if (question.type === 'noul') {
        return noul(question.instructions, question.criteria ?? null);
    }
    if (question.type === 'choice') {
        return choice(question.instructions, question.options);
    }
    const [first, second, ...rest] = question.levels;
    return score(question.instructions, [first, second, ...rest]);
}

/**
 * Sends one example's questions over the given state in a single
 * systemOne request and times the round trip.
 */
export async function askJev(
    example: JevExample,
    state: string | Record<string, unknown>,
): Promise<JevResult> {
    const questions = Object.fromEntries(
        Object.entries(example.questions).map(([name, question]) => [
            name,
            toSdkQuestion(question),
        ]),
    );
    const started = performance.now();
    const response = await getJevClient().systemOne({
        state: state as EntryType,
        questions,
    });
    return {
        ok: true,
        exampleId: example.id,
        model: response.model,
        answers: response.answers as Record<string, JevAnswer>,
        usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
        },
        ms: Math.round(performance.now() - started),
    };
}
