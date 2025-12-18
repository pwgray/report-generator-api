import express from 'express';
import cors from 'cors';
import { datasourceRouter } from './controllers/datasource.js';
import { reportRouter } from './controllers/report.js';
import { aiRouter } from './controllers/ai.js';

export const createApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/datasources', datasourceRouter);
  app.use('/api/reports', reportRouter);
  app.use('/api/ai', aiRouter);
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  return app;
};

export default createApp;
