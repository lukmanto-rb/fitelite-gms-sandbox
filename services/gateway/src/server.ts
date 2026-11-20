import { buildGateway, parseRoutes } from './app.js';

const port = Number(process.env.PORT ?? 8080);
const app = await buildGateway({ webUrl: process.env.WEB_URL ?? 'http://web:80', routes: parseRoutes(process.env.ROUTES), sessionSecret: process.env.SESSION_SECRET });
await app.listen({ host: '0.0.0.0', port });
console.log(`gateway on :${port}`);
