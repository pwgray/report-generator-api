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
      
      // Fetch columns with additional metadata
      const colsRes = await client.query(`
        SELECT 
          c.column_name, 
          c.data_type,
          c.is_nullable,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
          CASE WHEN uc.column_name IS NOT NULL THEN true ELSE false END as is_unique
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku 
            ON tc.constraint_name = ku.constraint_name
            AND tc.table_schema = ku.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = $1
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku 
            ON tc.constraint_name = ku.constraint_name
            AND tc.table_schema = ku.table_schema
          WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_schema = 'public'
            AND tc.table_name = $1
        ) uc ON c.column_name = uc.column_name
        WHERE c.table_schema='public' AND c.table_name = $1
      `, [tableName]);
      
      console.debug('[datasource] columns query returned rows', { table: tableName, count: (colsRes?.rows || []).length });
      
        const columns = colsRes.rows.map((c: any) => ({
          id: crypto.randomUUID(),
          name: c.column_name,
          type: mapPgTypeToColumnType(c.data_type),
          alias: c.column_name,
          description: '',
          sampleValue: '',
          isNullable: c.is_nullable === 'YES',
          isPrimaryKey: c.is_primary_key,
          isUnique: c.is_unique
        }));

        // Fetch foreign keys
        const fkRes = await client.query(`
          SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column,
            rc.update_rule as on_update,
            rc.delete_rule as on_delete
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
            AND tc.table_schema = rc.constraint_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name = $1
        `, [tableName]);

        const foreignKeys = fkRes.rows.map((fk: any) => ({
          id: crypto.randomUUID(),
          name: fk.constraint_name,
          columnName: fk.column_name,
          referencedTable: fk.referenced_table,
          referencedColumn: fk.referenced_column,
          onUpdate: fk.on_update,
          onDelete: fk.on_delete
        }));

        // Fetch indexes
        const idxRes = await client.query(`
          SELECT
            i.relname as index_name,
            idx.indisunique as is_unique,
            idx.indisprimary as is_primary,
            ARRAY_AGG(a.attname ORDER BY k.ordinality) as columns
          FROM pg_index idx
          JOIN pg_class i ON i.oid = idx.indexrelid
          JOIN pg_class t ON t.oid = idx.indrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          CROSS JOIN LATERAL unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ordinality)
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
          WHERE n.nspname = 'public'
            AND t.relname = $1
          GROUP BY i.relname, idx.indisunique, idx.indisprimary
        `, [tableName]);

        const indexes = idxRes.rows.map((idx: any) => ({
          id: crypto.randomUUID(),
          name: idx.index_name,
          columns: idx.columns,
          isUnique: idx.is_unique,
          isPrimary: idx.is_primary
        }));

        // Fetch constraints
        const conRes = await client.query(`
          SELECT
            tc.constraint_name,
            tc.constraint_type,
            ARRAY_AGG(kcu.column_name) as columns,
            cc.check_clause as definition
          FROM information_schema.table_constraints tc
          LEFT JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          LEFT JOIN information_schema.check_constraints cc
            ON tc.constraint_name = cc.constraint_name
            AND tc.constraint_schema = cc.constraint_schema
          WHERE tc.table_schema = 'public'
            AND tc.table_name = $1
          GROUP BY tc.constraint_name, tc.constraint_type, cc.check_clause
        `, [tableName]);

        const constraints = conRes.rows.map((con: any) => ({
          id: crypto.randomUUID(),
          name: con.constraint_name,
          type: con.constraint_type,
          columns: con.columns || [],
          definition: con.definition
        }));

        tables.push({
          id: crypto.randomUUID(),
          name: tableName,
          alias: tableName,
          description: '',
          exposed: true,
          columns,
          foreignKeys,
          indexes,
          constraints
        });
      }

      // Fetch views
      const viewsRes = await client.query(`
        SELECT table_name, view_definition
        FROM information_schema.views
        WHERE table_schema = 'public'
      `);
      
      const views: any[] = [];
      for (const row of viewsRes.rows) {
        const viewName = row.table_name;
        
        // Fetch view columns
        const viewColsRes = await client.query(`
          SELECT 
            column_name, 
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema='public' AND table_name = $1
        `, [viewName]);

        const columns = viewColsRes.rows.map((c: any) => ({
          id: crypto.randomUUID(),
          name: c.column_name,
          type: mapPgTypeToColumnType(c.data_type),
          alias: c.column_name,
          description: '',
          sampleValue: '',
          isNullable: c.is_nullable === 'YES'
        }));

        views.push({
          id: crypto.randomUUID(),
          name: viewName,
          alias: viewName,
          description: '',
          definition: row.view_definition,
          exposed: true,
          columns
        });
      }

      await client.end();
      return res.json({ tables, views });
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
        
        // Fetch columns with additional metadata
        const colsRes = await pool.request()
          .input('tableName', tableName)
          .query(`
            SELECT 
              c.column_name,
              c.data_type,
              c.is_nullable,
              CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END as is_primary_key,
              CASE WHEN uc.column_name IS NOT NULL THEN 1 ELSE 0 END as is_unique
            FROM information_schema.columns c
            LEFT JOIN (
              SELECT ku.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage ku 
                ON tc.constraint_name = ku.constraint_name
                AND tc.table_schema = ku.table_schema
              WHERE tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_schema = 'dbo'
                AND tc.table_name = @tableName
            ) pk ON c.column_name = pk.column_name
            LEFT JOIN (
              SELECT ku.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage ku 
                ON tc.constraint_name = ku.constraint_name
                AND tc.table_schema = ku.table_schema
              WHERE tc.constraint_type = 'UNIQUE'
                AND tc.table_schema = 'dbo'
                AND tc.table_name = @tableName
            ) uc ON c.column_name = uc.column_name
            WHERE c.table_schema='dbo' AND c.table_name = @tableName
          `);
        
        const colRows = colsRes.rows || colsRes.recordset || [];
        console.debug('[datasource] mssql columns query returned rows', { table: tableName, count: colRows.length });

        const columns = colRows.map((c: any) => ({
          id: crypto.randomUUID(),
          name: c.column_name || c.COLUMN_NAME,
          type: mapMssqlTypeToColumnType(c.data_type || c.DATA_TYPE),
          alias: c.column_name || c.COLUMN_NAME,
          description: '',
          sampleValue: '',
          isNullable: (c.is_nullable || c.IS_NULLABLE) === 'YES',
          isPrimaryKey: !!(c.is_primary_key || c.IS_PRIMARY_KEY),
          isUnique: !!(c.is_unique || c.IS_UNIQUE)
        }));

        // Fetch foreign keys
        let foreignKeys: any[] = [];
        try {
          console.debug('[datasource] fetching foreign keys for mssql table', { table: tableName });
          const fkRes = await pool.request()
            .input('tableName', tableName)
            .query(`
              SELECT
                fk.name as constraint_name,
                COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as column_name,
                OBJECT_NAME(fkc.referenced_object_id) as referenced_table,
                COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as referenced_column,
                fk.delete_referential_action_desc as on_delete,
                fk.update_referential_action_desc as on_update
              FROM sys.foreign_keys fk
              INNER JOIN sys.foreign_key_columns fkc 
                ON fk.object_id = fkc.constraint_object_id
              WHERE OBJECT_NAME(fk.parent_object_id) = @tableName
            `);
          
          const fkRows = fkRes.rows || fkRes.recordset || [];
          console.debug('[datasource] mssql foreign keys query returned rows', { table: tableName, count: fkRows.length });
          foreignKeys = fkRows.map((fk: any) => ({
            id: crypto.randomUUID(),
            name: fk.constraint_name || fk.CONSTRAINT_NAME,
            columnName: fk.column_name || fk.COLUMN_NAME,
            referencedTable: fk.referenced_table || fk.REFERENCED_TABLE,
            referencedColumn: fk.referenced_column || fk.REFERENCED_COLUMN,
            onUpdate: fk.on_update || fk.ON_UPDATE,
            onDelete: fk.on_delete || fk.ON_DELETE
          }));
        } catch (fkErr) {
          console.error('[datasource] Failed to fetch foreign keys for table', tableName, fkErr);
        }

        // Fetch indexes
        let indexes: any[] = [];
        try {
          console.debug('[datasource] fetching indexes for mssql table', { table: tableName });
          const idxRes = await pool.request()
            .input('tableName', tableName)
            .query(`
              SELECT
                i.name as index_name,
                i.is_unique,
                i.is_primary_key,
                STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) as columns
              FROM sys.indexes i
              INNER JOIN sys.index_columns ic 
                ON i.object_id = ic.object_id AND i.index_id = ic.index_id
              INNER JOIN sys.columns c 
                ON ic.object_id = c.object_id AND ic.column_id = c.column_id
              WHERE i.object_id = OBJECT_ID(@tableName)
              GROUP BY i.name, i.is_unique, i.is_primary_key
            `);
          
          const idxRows = idxRes.rows || idxRes.recordset || [];
          console.debug('[datasource] mssql indexes query returned rows', { table: tableName, count: idxRows.length });
          indexes = idxRows.map((idx: any) => ({
            id: crypto.randomUUID(),
            name: idx.index_name || idx.INDEX_NAME,
            columns: (idx.columns || idx.COLUMNS || '').split(','),
            isUnique: !!(idx.is_unique || idx.IS_UNIQUE),
            isPrimary: !!(idx.is_primary_key || idx.IS_PRIMARY_KEY)
          }));
        } catch (idxErr) {
          console.error('[datasource] Failed to fetch indexes for table', tableName, idxErr);
        }

        // Fetch constraints
        let constraints: any[] = [];
        try {
          console.debug('[datasource] fetching constraints for mssql table', { table: tableName });
          const conRes = await pool.request()
            .input('tableName', tableName)
            .query(`
              SELECT
                tc.constraint_name,
                tc.constraint_type,
                STUFF((
                  SELECT ',' + kcu.column_name
                  FROM information_schema.key_column_usage kcu
                  WHERE kcu.constraint_name = tc.constraint_name
                    AND kcu.table_schema = tc.table_schema
                  FOR XML PATH('')
                ), 1, 1, '') as columns,
                cc.check_clause as definition
              FROM information_schema.table_constraints tc
              LEFT JOIN information_schema.check_constraints cc
                ON tc.constraint_name = cc.constraint_name
                AND tc.constraint_schema = cc.constraint_schema
              WHERE tc.table_schema = 'dbo'
                AND tc.table_name = @tableName
            `);
          
          const conRows = conRes.rows || conRes.recordset || [];
          console.debug('[datasource] mssql constraints query returned rows', { table: tableName, count: conRows.length });
          constraints = conRows.map((con: any) => ({
            id: crypto.randomUUID(),
            name: con.constraint_name || con.CONSTRAINT_NAME,
            type: con.constraint_type || con.CONSTRAINT_TYPE,
            columns: (con.columns || con.COLUMNS || '').split(',').filter((c: string) => c),
            definition: con.definition || con.DEFINITION
          }));
        } catch (conErr) {
          console.error('[datasource] Failed to fetch constraints for table', tableName, conErr);
        }

        tables.push({
          id: crypto.randomUUID(),
          name: tableName,
          alias: tableName,
          description: '',
          exposed: true,
          columns,
          foreignKeys,
          indexes,
          constraints
        });
      }

      // Fetch views
      let views: any[] = [];
      try {
        console.debug('[datasource] fetching views for mssql database');
        const viewsRes = await pool.request().query(`
          SELECT 
            v.table_name,
            m.definition
          FROM information_schema.views v
          LEFT JOIN sys.sql_modules m 
            ON m.object_id = OBJECT_ID(v.table_schema + '.' + v.table_name)
          WHERE v.table_schema = 'dbo'
        `);
        
        const viewRows = viewsRes.rows || viewsRes.recordset || [];
        console.debug('[datasource] mssql views query returned rows', { count: viewRows.length });
        
        for (const row of viewRows) {
          const viewName = row.table_name || row.TABLE_NAME;
          console.debug('[datasource] fetching columns for mssql view', { view: viewName });
          
          // Fetch view columns
          const viewColsRes = await pool.request()
            .input('viewName', viewName)
            .query(`
              SELECT 
                column_name,
                data_type,
                is_nullable
              FROM information_schema.columns
              WHERE table_schema='dbo' AND table_name = @viewName
            `);

          const viewColRows = viewColsRes.rows || viewColsRes.recordset || [];
          console.debug('[datasource] mssql view columns query returned rows', { view: viewName, count: viewColRows.length });
          const columns = viewColRows.map((c: any) => ({
            id: crypto.randomUUID(),
            name: c.column_name || c.COLUMN_NAME,
            type: mapMssqlTypeToColumnType(c.data_type || c.DATA_TYPE),
            alias: c.column_name || c.COLUMN_NAME,
            description: '',
            sampleValue: '',
            isNullable: (c.is_nullable || c.IS_NULLABLE) === 'YES'
          }));

          views.push({
            id: crypto.randomUUID(),
            name: viewName,
            alias: viewName,
            description: '',
            definition: row.definition || row.DEFINITION,
            exposed: true,
            columns
          });
        }
      } catch (viewErr) {
        console.error('[datasource] Failed to fetch views', viewErr);
      }

      await pool.close();
      return res.json({ tables, views });
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

  // Find the table or view definition in stored metadata to validate columns
  let tbl = (ds.tables || []).find((t: any) => t.name === table || t.id === table);
  if (!tbl) {
    // Check if it's a view
    tbl = (ds.views || []).find((v: any) => v.name === table || v.id === table);
  }
  if (!tbl) return res.status(400).json({ error: 'table or view not found on datasource' });

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

