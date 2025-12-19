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

// New: Test connection and fetch schema from a supported DB (Postgres)
import crypto from 'crypto';
import { Client } from 'pg';

function mapPgTypeToColumnType(pgType: string) {
  const t = pgType.toLowerCase();
  if (t.includes('char') || t.includes('text') || t === 'uuid') return 'string';
  if (t === 'boolean') return 'boolean';
  if (t.includes('int') || t === 'numeric' || t === 'decimal' || t === 'real' || t === 'double precision') return 'number';
  if (t.includes('time') || t.includes('date')) return 'date';
  if (t === 'money') return 'currency';
  return 'string';
}

function mapMssqlTypeToColumnType(m: string) {
  const t = m?.toLowerCase() || '';
  if (t.includes('char') || t.includes('text') || t.includes('string') || t === 'uniqueidentifier') return 'string';
  if (t === 'bit' || t === 'boolean') return 'boolean';
  if (t.includes('int') || t === 'numeric' || t === 'decimal' || t === 'real' || t === 'money' || t === 'float') return 'number';
  if (t.includes('time') || t.includes('date')) return 'date';
  if (t === 'money') return 'currency';
  return 'string';
}

datasourceRouter.post('/test-connection', async (req, res) => {
  const { type, connectionDetails } = req.body || {};
  console.debug('[datasource] test-connection called', { type, connectionDetails: connectionDetails ? { ...connectionDetails, password: connectionDetails.password ? '***' : undefined } : undefined });
  if (!type) return res.status(400).json({ error: 'type required' });
  if (!connectionDetails || !connectionDetails.host || !connectionDetails.database) return res.status(400).json({ error: 'connectionDetails required' });

  const { host, port, database, username, password } = connectionDetails;

  // Small helper to avoid logging sensitive fields
  const mask = (c: any) => ({ ...c, password: c?.password ? '***' : undefined });
  console.debug('[datasource] test-connection request', { type, connectionDetails: mask(connectionDetails) });

  // Postgres
  if (type === 'postgres') {
    const client = new Client({ host, port: Number(port) || 5432, database, user: username, password });

    try {
      await client.connect();
    console.debug(`[datasource] connected to postgres ${host}/${database}@${port}`);

    // Get tables in public schema
    const tablesRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
    console.debug('[datasource] postgres tables query returned rows', { count: (tablesRes?.rows || []).length });

      const tables: any[] = [];
      for (const row of tablesRes.rows) {
        const tableName = row.table_name;
      console.debug('[datasource] fetching columns for table', { table: tableName });
      const colsRes = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name = $1`, [tableName]);
      console.debug('[datasource] columns query returned rows', { table: tableName, count: (colsRes?.rows || []).length });
        const columns = colsRes.rows.map((c: any) => ({
          id: crypto.randomUUID(),
          name: c.column_name,
          type: mapPgTypeToColumnType(c.data_type),
          alias: c.column_name,
          description: '',
          sampleValue: ''
        }));

        tables.push({
          id: crypto.randomUUID(),
          name: tableName,
          alias: tableName,
          description: '',
          exposed: true,
          columns
        });
      }

      await client.end();
      return res.json(tables);
    } catch (err) {
      console.error('[datasource] Postgres test failed', err || err);
      try { await client.end(); } catch (e) { }
      return res.status(502).json({ error: 'Unable to connect or fetch schema' });
    }
  }

  // MSSQL
  if (type === 'sql') {
    try {
        console.debug('[datasource] loading mssql driver');
      let ConnectionPool: any;
      try {
        const mssqlModule: any = await import('mssql');
        // Support both ESM named export and CommonJS default-wrapped shape
        ConnectionPool = mssqlModule?.ConnectionPool ?? mssqlModule?.default?.ConnectionPool ?? mssqlModule?.default;
        console.debug('[datasource] mssql module loaded', { keys: Object.keys(mssqlModule || {}), hasConnectionPool: !!ConnectionPool });
      } catch (e) {
        console.error('[datasource] failed to import mssql module', e || e);
        return res.status(502).json({ error: 'MSSQL driver not installed or could not be loaded. Run `npm i mssql`' });
      }

      if (!ConnectionPool) {
        console.error('[datasource] ConnectionPool export not found on mssql module');
        return res.status(502).json({ error: 'MSSQL driver missing ConnectionPool export. Ensure `mssql` is installed and up-to-date.' });
      }

      const pool = new ConnectionPool({ server: host, port: Number(port) || 1433, database, user: username, password, options: { encrypt: false, trustServerCertificate: true } });

      await pool.connect();
      console.debug(`[datasource] connected to mssql ${host}/${database}@${port}`);

      const tablesRes = await pool.request().query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'dbo' AND table_type = 'BASE TABLE'`);
      const tableRows = tablesRes.rows || tablesRes.recordset || [];
      console.debug('[datasource] mssql tables query returned rows', { count: tableRows.length });

      const tables: any[] = [];
      for (const row of tableRows) {
        const tableName = row.table_name || row.TABLE_NAME || row.table_name;
        console.debug('[datasource] fetching columns for mssql table', { table: tableName });
        const req = pool.request();
        // Note: some drivers return recordset, others rows
        const colsRes = await req.input('tableName', tableName).query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='dbo' AND table_name = @tableName`);
        const colRows = colsRes.rows || colsRes.recordset || [];
        console.debug('[datasource] mssql columns query returned rows', { table: tableName, count: colRows.length });

        const columns = colRows.map((c: any) => ({
          id: crypto.randomUUID(),
          name: c.column_name || c.COLUMN_NAME,
          type: mapMssqlTypeToColumnType(c.data_type || c.DATA_TYPE),
          alias: c.column_name || c.COLUMN_NAME,
          description: '',
          sampleValue: ''
        }));

        tables.push({
          id: crypto.randomUUID(),
          name: tableName,
          alias: tableName,
          description: '',
          exposed: true,
          columns
        });
      }

      await pool.close();
      return res.json(tables);
    } catch (err) {
      console.error('[datasource] MSSQL test failed', err || err);
      return res.status(502).json({ error: 'Unable to connect or fetch schema' });
    }
  }

  console.debug('[datasource] unsupported type requested', { type });
  return res.status(400).json({ error: 'unsupported type' });
});

// New: Query a datasource table for real data (limited, safe)
datasourceRouter.post('/query', async (req, res) => {
  const { dataSourceId, dataSource: adHocDataSource, table, columns, limit = 50 } = req.body || {};
  if ((!dataSourceId && !adHocDataSource) || !table || !Array.isArray(columns) || columns.length === 0) return res.status(400).json({ error: 'dataSourceId or dataSource, table and columns required' });

  const repo = AppDataSource.getRepository(DataSourceEntity);
  let ds: any = null;

  if (dataSourceId) {
    ds = await repo.findOneBy({ id: dataSourceId });
    if (!ds) return res.status(404).json({ error: 'datasource not found' });
  } else {
    const minimal = adHocDataSource || {};
    if (!minimal.type || !minimal.connectionDetails || !Array.isArray(minimal.tables)) return res.status(400).json({ error: 'invalid ad-hoc datasource' });
    ds = minimal;
  }

  // Find the table definition in stored metadata to validate columns
  const tbl = (ds.tables || []).find((t: any) => t.name === table || t.id === table);
  if (!tbl) return res.status(400).json({ error: 'table not found on datasource' });

  const allowedCols = (tbl.columns || []).map((c: any) => c.name);
  // Validate requested columns are subset
  const invalid = columns.filter((c: string) => !allowedCols.includes(c));
  if (invalid.length > 0) return res.status(400).json({ error: 'invalid columns', invalid });

  // Build safe column list
  const colList = columns.map(c => c.includes('"') || c.includes('[') ? c : c).join(', ');

  try {
    if (ds.type === 'postgres') {
      const cd = ds.connectionDetails || {};
      const client = new Client({ host: cd.host, port: Number(cd.port) || 5432, database: cd.database, user: cd.username, password: cd.password });
      await client.connect();

      // Quote identifiers
      const quotedCols = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(', ');
      const q = `SELECT ${quotedCols} FROM "public"."${tbl.name.replace(/"/g, '""')}" LIMIT $1`;
      const result = await client.query(q, [Number(limit) || 50]);
      await client.end();
      return res.json(result.rows || []);
    } else if (ds.type === 'sql') {
      const cd = ds.connectionDetails || {};
      const mssqlMod: any = await import('mssql');
      const ConnectionPool = mssqlMod?.ConnectionPool ?? mssqlMod?.default?.ConnectionPool ?? mssqlMod?.default;
      if (!ConnectionPool) return res.status(502).json({ error: 'MSSQL driver not available' });

      const pool = new ConnectionPool({ server: cd.host, port: Number(cd.port) || 1433, database: cd.database, user: cd.username, password: cd.password, options: { encrypt: false, trustServerCertificate: true } });
      await pool.connect();
      const quotedCols = columns.map(c => `[${c.replace(/\]/g, '')}]`).join(', ');
      const q = `SELECT TOP (${Number(limit) || 50}) ${quotedCols} FROM [dbo].[${tbl.name}]`;
      const r = await pool.request().query(q);
      await pool.close();
      return res.json(r.recordset || r.rows || []);
    } else {
      return res.status(400).json({ error: 'unsupported datasource type for querying' });
    }
  } catch (err) {
    console.error('[datasource] query failed', (err as any)?.stack || err);
    return res.status(502).json({ error: 'Unable to execute query' });
  }
});

