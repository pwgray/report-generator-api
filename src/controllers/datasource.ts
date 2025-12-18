import express from 'express';
import { AppDataSource } from '../data-source.js';
import { DataSourceEntity } from '../entities/DataSourceEntity.js';

export const datasourceRouter = express.Router();

datasourceRouter.get('/', async (req, res) => {
  const repo = AppDataSource.getRepository(DataSourceEntity);
  const list = await repo.find();
  res.json(list);
});

datasourceRouter.post('/', async (req, res) => {
  const repo = AppDataSource.getRepository(DataSourceEntity);
  const payload = req.body;
  if (!payload.name) return res.status(400).json({ error: 'name required' });
  const ds = repo.create({
    ...payload,
    createdAt: payload.createdAt || new Date().toISOString()
  });
  const saved = await repo.save(ds);
  res.json(saved);
});

datasourceRouter.get('/:id', async (req, res) => {
  const repo = AppDataSource.getRepository(DataSourceEntity);
  const ds = await repo.findOneBy({ id: req.params.id });
  if (!ds) return res.status(404).json({ error: 'not found' });
  res.json(ds);
});

datasourceRouter.put('/:id', async (req, res) => {
  const repo = AppDataSource.getRepository(DataSourceEntity);
  const ds = await repo.findOneBy({ id: req.params.id });
  if (!ds) return res.status(404).json({ error: 'not found' });
  repo.merge(ds, req.body);
  const saved = await repo.save(ds);
  res.json(saved);
});

datasourceRouter.delete('/:id', async (req, res) => {
  const repo = AppDataSource.getRepository(DataSourceEntity);
  const ds = await repo.findOneBy({ id: req.params.id });
  if (!ds) return res.status(404).json({ error: 'not found' });
  await repo.delete({ id: req.params.id });
  res.json({ success: true });
});

