import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { AppDataSource } from '../src/data-source.js';
import createApp from '../src/app.js';

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  // Use in-memory DB for tests
  process.env.SQLITE_DB = ':memory:';
  await AppDataSource.initialize();
  app = createApp();
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

describe('API health', () => {
  it('responds ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('/api/datasources CRUD', () => {
  let id: string | undefined;

  it('creates a datasource', async () => {
    const payload = { name: 'Test DS', type: 'custom', description: 'smoke test', tables: [], createdAt: new Date().toISOString() };
    const res = await request(app).post('/api/datasources').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe(payload.name);
    id = res.body.id;
  });

  it('gets the created datasource', async () => {
    const res = await request(app).get(`/api/datasources/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('updates the datasource', async () => {
    const res = await request(app).put(`/api/datasources/${id}`).send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('deletes the datasource', async () => {
    const res = await request(app).delete(`/api/datasources/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await request(app).get(`/api/datasources/${id}`);
    expect(check.status).toBe(404);
  });
});

describe('/api/reports CRUD', () => {
  let dsId: string | undefined;
  let reportId: string | undefined;

  it('creates a datasource for reports', async () => {
    const res = await request(app).post('/api/datasources').send({ name: 'Report DS', type: 'custom', tables: [], createdAt: new Date().toISOString() });
    expect(res.status).toBe(200);
    dsId = res.body.id;
  });

  it('creates a report', async () => {
    const payload = { name: 'Test Report', dataSourceId: dsId, ownerId: 'u1', visibility: 'public', selectedColumns: [], filters: [], sorts: [], visualization: 'table', schedule: { enabled: false }, createdAt: new Date().toISOString() };
    const res = await request(app).post('/api/reports').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    reportId = res.body.id;
  });

  it('gets report', async () => {
    const res = await request(app).get(`/api/reports/${reportId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reportId);
  });

  it('updates report', async () => {
    const res = await request(app).put(`/api/reports/${reportId}`).send({ name: 'Updated Report' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Report');
  });

  it('deletes report', async () => {
    const res = await request(app).delete(`/api/reports/${reportId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
