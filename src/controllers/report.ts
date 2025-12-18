import express from 'express';
import { AppDataSource } from '../data-source.js';
import { ReportEntity } from '../entities/ReportEntity.js';

export const reportRouter = express.Router();

reportRouter.get('/', async (req, res) => {
  const repo = AppDataSource.getRepository(ReportEntity);
  const list = await repo.find();
  res.json(list);
});

reportRouter.post('/', async (req, res) => {
  const repo = AppDataSource.getRepository(ReportEntity);
  const payload = req.body;
  if (!payload.name || !payload.dataSourceId) return res.status(400).json({ error: 'name and dataSourceId required' });
  const report = repo.create({
    ...payload,
    createdAt: payload.createdAt || new Date().toISOString()
  });
  const saved = await repo.save(report);
  res.json(saved);
});

reportRouter.get('/:id', async (req, res) => {
  const repo = AppDataSource.getRepository(ReportEntity);
  const r = await repo.findOneBy({ id: req.params.id });
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json(r);
});

reportRouter.put('/:id', async (req, res) => {
  const repo = AppDataSource.getRepository(ReportEntity);
  const r = await repo.findOneBy({ id: req.params.id });
  if (!r) return res.status(404).json({ error: 'not found' });
  repo.merge(r, req.body);
  const saved = await repo.save(r);
  res.json(saved);
});

reportRouter.delete('/:id', async (req, res) => {
  const repo = AppDataSource.getRepository(ReportEntity);
  const r = await repo.findOneBy({ id: req.params.id });
  if (!r) return res.status(404).json({ error: 'not found' });
  await repo.delete({ id: req.params.id });
  res.json({ success: true });
});

