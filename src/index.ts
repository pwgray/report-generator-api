import 'reflect-metadata';
import dotenv from 'dotenv';
import { AppDataSource } from './data-source.js';
import createApp from './app.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await AppDataSource.initialize();
    console.log('DB initialized');

    const app = createApp();

    app.listen(PORT, () => console.log(`API server listening on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
