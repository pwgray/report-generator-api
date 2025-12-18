import express from 'express';
import { generateReportData, discoverSchema } from '../geminiProxy.js';
import { AppDataSource } from '../data-source.js';
import { DataSourceEntity } from '../entities/DataSourceEntity.js';
import { ReportEntity } from '../entities/ReportEntity.js';
import { withTimeout, TimeoutError } from '../utils/timeout.js';

export const aiRouter = express.Router();

aiRouter.post('/generate', async (req, res) => {
  try {
    // Accept either ids or full payload
    const { reportId, dataSourceId, rowCount } = req.body;

    let ds: any = null;
    let report: any = null;

    if (dataSourceId) {
      ds = await AppDataSource.getRepository(DataSourceEntity).findOneBy({ id: dataSourceId });
    }

    if (reportId) {
      report = await AppDataSource.getRepository(ReportEntity).findOneBy({ id: reportId });
      if (report && !ds) {
        ds = await AppDataSource.getRepository(DataSourceEntity).findOneBy({ id: report.dataSourceId });
      }
    }

    if (!ds || !report) return res.status(400).json({ error: 'dataSource and report required' });

    // Enforce timeout for AI call
    const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '5000', 10);
    try {
      const rows = await withTimeout(generateReportData(ds, report, rowCount || 20), timeoutMs);
      res.json(rows);
    } catch (err) {
      if (err instanceof TimeoutError) {
        console.error('AI generate timed out');
        return res.status(504).json({ error: 'AI timeout' });
      }
      console.error('AI generate failed', err);
      res.status(500).json({ error: 'AI generation failed' });
    }
  } catch (err) {
    console.error('AI generate failed', err);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

aiRouter.post('/discover', async (req, res) => {
  try {
    const { type, dbName, context } = req.body;
    if (!type || !dbName) return res.status(400).json({ error: 'type and dbName required' });
    const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '5000', 10);
    try {
      const schema = await withTimeout(discoverSchema(type, dbName, context || ''), timeoutMs);
      res.json(schema);
    } catch (err) {
      if (err instanceof TimeoutError) {
        console.error('AI discover timed out');
        return res.status(504).json({ error: 'AI timeout' });
      }
      throw err; // let outer catch handle it
    }
  } catch (err) {
    console.error('AI discover failed', err);
    res.status(500).json({ error: 'AI discover failed' });
  }
});

