import express from 'express';
import { AppDataSource } from '../data-source.js';
import { ReportEntity } from '../entities/ReportEntity.js';
import { ReportViewEntity } from '../entities/ReportViewEntity.js';

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

// Track a report view
reportRouter.post('/:id/view', async (req, res) => {
  try {
    const { userId } = req.body;
    const reportId = req.params.id;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Verify report exists
    const reportRepo = AppDataSource.getRepository(ReportEntity);
    const report = await reportRepo.findOneBy({ id: reportId });
    if (!report) {
      return res.status(404).json({ error: 'report not found' });
    }

    // Check if there's an existing view for this user+report combination
    const viewRepo = AppDataSource.getRepository(ReportViewEntity);
    const existingView = await viewRepo.findOne({
      where: { reportId, userId }
    });

    if (existingView) {
      // Update the timestamp
      existingView.viewedAt = new Date();
      await viewRepo.save(existingView);
    } else {
      // Create new view
      const newView = viewRepo.create({
        reportId,
        userId,
        viewedAt: new Date()
      });
      await viewRepo.save(newView);
    }

    // Keep only the most recent 10 views per user
    const allUserViews = await viewRepo.find({
      where: { userId },
      order: { viewedAt: 'DESC' }
    });

    if (allUserViews.length > 10) {
      // Delete the oldest views beyond the limit
      const viewsToDelete = allUserViews.slice(10);
      await viewRepo.remove(viewsToDelete);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Report] Error tracking view:', error);
    res.status(500).json({ error: 'Failed to track view', message: error.message });
  }
});

// Get recent report IDs for a user
reportRouter.get('/recent', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId query parameter required' });
    }

    const viewRepo = AppDataSource.getRepository(ReportViewEntity);
    const views = await viewRepo.find({
      where: { userId },
      order: { viewedAt: 'DESC' },
      take: 10
    });

    const reportIds = views.map(v => v.reportId);
    res.json(reportIds);
  } catch (error: any) {
    console.error('[Report] Error fetching recent reports:', error);
    res.status(500).json({ error: 'Failed to fetch recent reports', message: error.message });
  }
});

