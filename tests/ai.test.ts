import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock geminiProxy BEFORE importing the app so controllers use the mocked functions
vi.mock('../src/geminiProxy.js', () => ({
  generateReportData: vi.fn(),
  discoverSchema: vi.fn()
}));

import { AppDataSource } from '../src/data-source.js';
import createApp from '../src/app.js';
import { generateReportData, discoverSchema } from '../src/geminiProxy.js';

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  process.env.SQLITE_DB = ':memory:';
  await AppDataSource.initialize();
  app = createApp();
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  vi.resetAllMocks();
});

describe('AI endpoints', () => {
  it('POST /api/ai/discover returns schema from discoverSchema', async () => {
    const mockSchema = [{ name: 'users', columns: [{ name: 'id', type: 'string' }] }];
    (discoverSchema as any).mockResolvedValue(mockSchema);

    const res = await request(app).post('/api/ai/discover').send({ type: 'custom', dbName: 'TestDB' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockSchema);
    expect(discoverSchema).toHaveBeenCalledWith('custom', 'TestDB', '');
  });

  it('POST /api/ai/generate returns rows from generateReportData', async () => {
    // Create a datasource and report using the real endpoints so the controller finds them
    const dsRes = await request(app).post('/api/datasources').send({ name: 'AI DS', type: 'custom', tables: [], createdAt: new Date().toISOString() });
    expect(dsRes.status).toBe(200);
    const dsId = dsRes.body.id;

    const reportPayload = { name: 'AI Report', dataSourceId: dsId, ownerId: 'u1', visibility: 'private', selectedColumns: [], filters: [], sorts: [], visualization: 'table', schedule: { enabled: false }, createdAt: new Date().toISOString() };
    const reportRes = await request(app).post('/api/reports').send(reportPayload);
    expect(reportRes.status).toBe(200);
    const reportId = reportRes.body.id;

    const mockRows = [{ 'users.id': '1', 'users.name': 'Alice' }];
    (generateReportData as any).mockResolvedValue(mockRows);

    const res = await request(app).post('/api/ai/generate').send({ reportId });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockRows);
    expect(generateReportData).toHaveBeenCalled();
  });

  describe('AI error scenarios', () => {
    it('POST /api/ai/discover returns 500 when discoverSchema throws', async () => {
      (discoverSchema as any).mockRejectedValue(new Error('AI failure'));
      const res = await request(app).post('/api/ai/discover').send({ type: 'custom', dbName: 'TestDB' });
      expect(res.status).toBe(500);
    });

    it('POST /api/ai/discover returns 400 on invalid input', async () => {
      const res = await request(app).post('/api/ai/discover').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('POST /api/ai/generate returns 400 when missing inputs', async () => {
      const res = await request(app).post('/api/ai/generate').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('POST /api/ai/generate returns 500 when generateReportData rejects', async () => {
      // Create a datasource and report so the request is valid
      const dsRes = await request(app).post('/api/datasources').send({ name: 'AI DS 2', type: 'custom', tables: [], createdAt: new Date().toISOString() });
      expect(dsRes.status).toBe(200);
      const dsId = dsRes.body.id;

      const reportPayload = { name: 'AI Report 2', dataSourceId: dsId, ownerId: 'u1', visibility: 'public', selectedColumns: [], filters: [], sorts: [], visualization: 'table', schedule: { enabled: false }, createdAt: new Date().toISOString() };
      const reportRes = await request(app).post('/api/reports').send(reportPayload);
      expect(reportRes.status).toBe(200);
      const reportId = reportRes.body.id;

      (generateReportData as any).mockRejectedValue(new Error('Timeout'));

      const res = await request(app).post('/api/ai/generate').send({ reportId });
      expect(res.status).toBe(500);
    });

    it('POST /api/ai/generate returns 504 when generateReportData exceeds AI_TIMEOUT_MS', async () => {
      // Short timeout for the test
      process.env.AI_TIMEOUT_MS = '50';

      const dsRes = await request(app).post('/api/datasources').send({ name: 'AI DS 3', type: 'custom', tables: [], createdAt: new Date().toISOString() });
      expect(dsRes.status).toBe(200);
      const dsId = dsRes.body.id;

      const reportPayload = { name: 'AI Report 3', dataSourceId: dsId, ownerId: 'u1', visibility: 'public', selectedColumns: [], filters: [], sorts: [], visualization: 'table', schedule: { enabled: false }, createdAt: new Date().toISOString() };
      const reportRes = await request(app).post('/api/reports').send(reportPayload);
      expect(reportRes.status).toBe(200);
      const reportId = reportRes.body.id;

      // Mock a long-running call
      (generateReportData as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([{ 'users.id': '1' }]), 200)));

      const res = await request(app).post('/api/ai/generate').send({ reportId });
      expect(res.status).toBe(504);

      delete process.env.AI_TIMEOUT_MS;
    });

    it('POST /api/ai/discover returns 504 when discoverSchema exceeds AI_TIMEOUT_MS', async () => {
      process.env.AI_TIMEOUT_MS = '50';
      (discoverSchema as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([{ name: 't' }]), 200)));

      const res = await request(app).post('/api/ai/discover').send({ type: 'custom', dbName: 'SlowDB' });
      expect(res.status).toBe(504);

      delete process.env.AI_TIMEOUT_MS;
    });
  });
});
