import { TypeSafeClient } from '@typesafe-ai/sdk';

let client: TypeSafeClient | undefined;

/** The shared Jev client. Throws when JEV_API_KEY is missing. */
export function getJevClient() {
    const apiKey = process.env.JEV_API_KEY;
    if (!apiKey) {
        throw new Error('JEV_API_KEY is not set, so Jev cannot answer');
    }
    client ??= new TypeSafeClient({ apiKey });
    return client;
}
