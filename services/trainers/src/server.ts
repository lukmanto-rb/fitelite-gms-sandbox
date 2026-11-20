import { buildApp } from './app.js';
import { migrate, postgresDb } from './db.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = await postgresDb(url);
await migrate(db);
const app = await buildApp({ db });
const port = Number(process.env.PORT ?? 3000);
await app.listen({ host: '0.0.0.0', port });
console.log('trainers on :' + port);
