import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import request from 'supertest';
import createApp from '../src/app.js';
import { AppDataSource } from '../src/data-source.js';

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

// Mock mssql - allow tests to substitute the runtime pool instance via __setPool
let __mssql_currentPool: any = null;
vi.mock('mssql', () => {
  const ConnectionPool = vi.fn().mockImplementation(() => __mssql_currentPool);
  return { ConnectionPool, __setPool: (p: any) => { __mssql_currentPool = p; } };
});

import { Client } from 'pg';
import * as mssqlModule from 'mssql';
import { createMockPgClient, applyMockPgClient } from './utils/mockPgClient';
import { createMockMssqlPool, applyMockMssqlPool } from './utils/mockMssql';

describe('POST /api/datasources/test-connection', () => {
  it('returns schema for postgres', async () => {
    // Use shared helper to create and apply mock client
    const mockClient = createMockPgClient();
    applyMockPgClient(mockClient);

    // Mock all queries made by the enhanced schema fetching
    mockClient.query
      // 1. Tables query
      .mockResolvedValueOnce({ rows: [{ table_name: 'users' }, { table_name: 'orders' }] })
      // For 'users' table:
      // 2. columns
      .mockResolvedValueOnce({ rows: [{ column_name: 'id', data_type: 'integer' }, { column_name: 'name', data_type: 'character varying' }] })
      // 3. foreign keys
      .mockResolvedValueOnce({ rows: [] })
      // 4. indexes
      .mockResolvedValueOnce({ rows: [] })
      // 5. constraints
      .mockResolvedValueOnce({ rows: [] })
      // For 'orders' table:
      // 6. columns
      .mockResolvedValueOnce({ rows: [{ column_name: 'id', data_type: 'integer' }, { column_name: 'total', data_type: 'numeric' }] })
      // 7. foreign keys
      .mockResolvedValueOnce({ rows: [] })
      // 8. indexes
      .mockResolvedValueOnce({ rows: [] })
      // 9. constraints
      .mockResolvedValueOnce({ rows: [] })
      // 10. Views query
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/datasources/test-connection')
      .send({ type: 'postgres', connectionDetails: { host: 'localhost', port: '5432', database: 'db', username: 'u', password: 'p' } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tables');
    expect(res.body).toHaveProperty('views');
    expect(Array.isArray(res.body.tables)).toBe(true);
    expect(Array.isArray(res.body.views)).toBe(true);
    expect(res.body.tables.length).toBe(2);
    expect(res.body.tables[0].columns.length).toBe(2);
    expect(res.body.tables[0].columns[0].type).toBeDefined();
  });

  it('returns 400 for missing params', async () => {
    const res = await request(app).post('/api/datasources/test-connection').send({});
    expect(res.status).toBe(400);
  });

  it('returns 502 when connection fails', async () => {
    const FaultyClient = vi.fn().mockImplementation(() => ({ connect: vi.fn().mockRejectedValue(new Error('conn fail')), end: vi.fn() }));
    (Client as unknown as Mock).mockImplementation(FaultyClient);

    const res = await request(app)
      .post('/api/datasources/test-connection')
      .send({ type: 'postgres', connectionDetails: { host: 'bad', port: '5432', database: 'db', username: 'u', password: 'p' } });

    expect(res.status).toBe(502);
  });

  it('returns schema for mssql', async () => {
    const mockPool = createMockMssqlPool();
    // set the runtime pool instance used by the controller
    (mssqlModule as any).__setPool(mockPool);

    // Mock all queries made by the enhanced schema fetching
    mockPool._query
      // 1. Tables query
      .mockResolvedValueOnce({ recordset: [{ table_name: 'users' }, { table_name: 'orders' }] })
      // For 'users' table:
      // 2. columns
      .mockResolvedValueOnce({ recordset: [{ column_name: 'id', data_type: 'int' }, { column_name: 'name', data_type: 'varchar' }] })
      // 3. foreign keys
      .mockResolvedValueOnce({ recordset: [] })
      // 4. indexes
      .mockResolvedValueOnce({ recordset: [] })
      // 5. constraints
      .mockResolvedValueOnce({ recordset: [] })
      // For 'orders' table:
      // 6. columns
      .mockResolvedValueOnce({ recordset: [{ column_name: 'id', data_type: 'int' }, { column_name: 'total', data_type: 'numeric' }] })
      // 7. foreign keys
      .mockResolvedValueOnce({ recordset: [] })
      // 8. indexes
      .mockResolvedValueOnce({ recordset: [] })
      // 9. constraints
      .mockResolvedValueOnce({ recordset: [] })
      // 10. Views query
      .mockResolvedValueOnce({ recordset: [] });

    const res = await request(app)
      .post('/api/datasources/test-connection')
      .send({ type: 'sql', connectionDetails: { host: 'localhost', port: '1433', database: 'db', username: 'u', password: 'p' } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tables');
    expect(res.body).toHaveProperty('views');
    expect(Array.isArray(res.body.tables)).toBe(true);
    expect(Array.isArray(res.body.views)).toBe(true);
    expect(res.body.tables.length).toBe(2);
    expect(res.body.tables[0].columns.length).toBe(2);
    expect(res.body.tables[0].columns[0].type).toBeDefined();
  });

  it('returns 502 for mssql connection failure', async () => {
    const failingPool = { connect: vi.fn().mockRejectedValue(new Error('conn fail')), close: vi.fn() } as any;
    (mssqlModule as any).__setPool(failingPool);

    const res = await request(app)
      .post('/api/datasources/test-connection')
      .send({ type: 'sql', connectionDetails: { host: 'bad', port: '1433', database: 'db', username: 'u', password: 'p' } });

    expect(res.status).toBe(502);
  });
});