import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DataSourceEntity } from './entities/DataSourceEntity.js';
import { ReportEntity } from './entities/ReportEntity.js';

// Read database configuration from environment variables
const getDatabaseConfig = (): DataSourceOptions => {
  const dbType = (process.env.DB_TYPE || 'sqlite') as 'sqlite' | 'postgres' | 'mysql' | 'mariadb' | 'mssql';

  // Common configuration
  const baseConfig = {
    synchronize: process.env.DB_SYNCHRONIZE !== 'false', // Default true for development
    logging: process.env.DB_LOGGING === 'true', // Default false
    entities: [DataSourceEntity, ReportEntity]
  };

  // SQLite configuration (default for development)
  if (dbType === 'sqlite') {
    return {
      ...baseConfig,
      type: 'sqlite',
      database: process.env.SQLITE_DB || process.env.DB_DATABASE || './server/db.sqlite'
    } as DataSourceOptions;
  }

  // PostgreSQL configuration
  if (dbType === 'postgres') {
    return {
      ...baseConfig,
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'report_generator',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    } as DataSourceOptions;
  }

  // MySQL/MariaDB configuration
  if (dbType === 'mysql' || dbType === 'mariadb') {
    return {
      ...baseConfig,
      type: dbType,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'report_generator'
    } as DataSourceOptions;
  }

  // Microsoft SQL Server configuration
  if (dbType === 'mssql') {
    return {
      ...baseConfig,
      type: 'mssql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '1433', 10),
      username: process.env.DB_USERNAME || 'sa',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'report_generator',
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false'
      }
    } as DataSourceOptions;
  }

  // Default fallback to SQLite
  console.warn(`Unknown DB_TYPE: ${dbType}, falling back to SQLite`);
  return {
    ...baseConfig,
    type: 'sqlite',
    database: './server/db.sqlite'
  } as DataSourceOptions;
};

export const AppDataSource = new DataSource(getDatabaseConfig());
