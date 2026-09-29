import type { Config } from '@react-router/dev/config';

export default {
    ssr: true,
    // React Router checks that an action's Origin header matches the request
    // URL, protocol included. Behind Railway's proxy, react-router-serve sees
    // http:// while browsers send https://, so the /jev action would fail
    // with a 400. Allow the production host; add any custom domain here.
    allowedActionOrigins: ['web-production-512c2.up.railway.app'],
} satisfies Config;
