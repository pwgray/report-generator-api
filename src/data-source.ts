import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DataSourceEntity } from './entities/DataSourceEntity.js';
import { ReportEntity } from './entities/ReportEntity.js';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  // Allow overriding DB file for tests (set SQLITE_DB=':memory:' for in-memory DB)
  database: process.env.SQLITE_DB || './server/db.sqlite',
  synchronize: true,
  logging: false,
  entities: [DataSourceEntity, ReportEntity]
});
