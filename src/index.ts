import 'reflect-metadata';
import dotenv from 'dotenv';
import { AppDataSource } from './data-source.js';
import createApp from './app.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    console.log('[Server] Initializing database connection...');
    await AppDataSource.initialize();
    console.log('[Server] ✅ DB initialized successfully');
    console.log(`[Server] Database driver: ${AppDataSource.options.type}`);
    console.log(`[Server] Synchronize enabled: ${AppDataSource.options.synchronize}`);
    
    if (AppDataSource.options.synchronize) {
      console.log('[Server] ✅ Database schema auto-sync is ENABLED');
      console.log('[Server] Tables will be created/updated automatically');
    } else {
      console.log('[Server] ⚠️  Database schema auto-sync is DISABLED');
      console.log('[Server] You need to manually create tables or run migrations');
    }

    const app = createApp();

    app.listen(PORT, () => console.log(`[Server] 🚀 API server listening on port ${PORT}`));
  } catch (err) {
    console.error('[Server] ❌ Failed to start server', err);
    process.exit(1);
  }
}

start();
