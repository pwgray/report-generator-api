import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import createApp from '../src/app.js';
import { AppDataSource } from '../src/data-source.js';
import { DataSourceEntity } from '../src/entities/DataSourceEntity.js';

let app = createApp();

beforeAll(async () => {
  process.env.SQLITE_DB = ':memory:';
  await AppDataSource.initialize();
  app = createApp();
});

afterAll(async () => {
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
});

// Mock pg Client
vi.mock('pg', () => {
  const mClient = vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn()
  }));
  return { Client: mClient };
});

// Mock mssql
let __mssql_currentPool: any = null;
vi.mock('mssql', () => {
  const ConnectionPool = vi.fn().mockImplementation(() => __mssql_currentPool);
  return { ConnectionPool, __setPool: (p: any) => { __mssql_currentPool = p; } };
});

import { Client } from 'pg';
import * as mssqlModule from 'mssql';
import { createMockPgClient, applyMockPgClient } from './utils/mockPgClient';
import { createMockMssqlPool, applyMockMssqlPool } from './utils/mockMssql';

describe('POST /api/datasources/query', () => {
  it('returns rows for postgres', async () => {
    const mockClient = createMockPgClient();
    applyMockPgClient(mockClient);

    // mock result rows
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] });

    const repo = AppDataSource.getRepository(DataSourceEntity);
    const ds = repo.create({ name: 'pg', type: 'postgres', connectionDetails: { host: 'localhost' }, tables: [{ name: 'users', columns: [{ name: 'id' }, { name: 'name' }] }], createdAt: new Date().toISOString() });
    await repo.save(ds);

    const res = await request(app)
      .post('/api/datasources/query')
      .send({ dataSourceId: ds.id, table: 'users', columns: ['id', 'name'], limit: 2 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].name).toBe('Alice');
  });

  it('returns rows for mssql', async () => {
    const mockPool = createMockMssqlPool();
    (mssqlModule as any).__setPool(mockPool);

    // mock recordset
    mockPool._query.mockResolvedValueOnce({ recordset: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] });

    const repo = AppDataSource.getRepository(DataSourceEntity);
    const ds = repo.create({ name: 'mssql', type: 'sql', connectionDetails: { host: 'localhost' }, tables: [{ name: 'users', columns: [{ name: 'id' }, { name: 'name' }] }], createdAt: new Date().toISOString() });
    await repo.save(ds);

    const res = await request(app)
      .post('/api/datasources/query')
      .send({ dataSourceId: ds.id, table: 'users', columns: ['id', 'name'], limit: 2 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[1].name).toBe('Bob');
  });

  it('returns 400 for invalid columns', async () => {
    const repo = AppDataSource.getRepository(DataSourceEntity);
    const ds = repo.create({ name: 'pg2', type: 'postgres', connectionDetails: {}, tables: [{ name: 'users', columns: [{ name: 'id' }] }], createdAt: new Date().toISOString() });
    await repo.save(ds);

    const res = await request(app)
      .post('/api/datasources/query')
      .send({ dataSourceId: ds.id, table: 'users', columns: ['id', 'name'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid columns');
  });

  it('returns 400 for unsupported type', async () => {
    const repo = AppDataSource.getRepository(DataSourceEntity);
    const ds = repo.create({ name: 'custom', type: 'custom', connectionDetails: {}, tables: [{ name: 't', columns: [{ name: 'c' }] }], createdAt: new Date().toISOString() });
    await repo.save(ds);

    const res = await request(app)
      .post('/api/datasources/query')
      .send({ dataSourceId: ds.id, table: 't', columns: ['c'] });

    expect(res.status).toBe(400);
  });

  it('supports ad-hoc postgres datasource in request body', async () => {
    const mockClient = createMockPgClient();
    applyMockPgClient(mockClient);

    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'AdHoc' }] });

    const adHoc = { type: 'postgres', connectionDetails: { host: 'localhost' }, tables: [{ name: 'users', columns: [{ name: 'id' }, { name: 'name' }] }] };

    const res = await request(app)
      .post('/api/datasources/query')
      .send({ dataSource: adHoc, table: 'users', columns: ['id', 'name'], limit: 10 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('AdHoc');
  });

  it('supports ad-hoc mssql datasource in request body', async () => {
    const mockPool = createMockMssqlPool();
    (mssqlModule as any).__setPool(mockPool);

    mockPool._query.mockResolvedValueOnce({ recordset: [{ id: 1, name: 'AdHoc' }] });

    const adHoc = { type: 'sql', connectionDetails: { host: 'localhost' }, tables: [{ name: 'users', columns: [{ name: 'id' }, { name: 'name' }] }] };

    const res = await request(app)
      .post('/api/datasources/query')
      .send({ dataSource: adHoc, table: 'users', columns: ['id', 'name'], limit: 10 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('AdHoc');
  });
});