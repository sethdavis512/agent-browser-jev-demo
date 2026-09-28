import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
    index('routes/home.tsx'),
    route('run', 'routes/run.ts'),
] satisfies RouteConfig;
