import 'reflect-metadata';
import dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DataSourceEntity } from './entities/DataSourceEntity.js';
import { ReportEntity } from './entities/ReportEntity.js';
import { ReportViewEntity } from './entities/ReportViewEntity.js';

// Load .env file at the top of this module so environment variables are available
dotenv.config();

// Read database configuration from environment variables
const getDatabaseConfig = (): DataSourceOptions => {
  const dbType = (process.env.DB_TYPE || 'sqlite') as 'sqlite' | 'postgres' | 'mysql' | 'mariadb' | 'mssql';

  // Log database type being used
  console.log(`[DB Config] Using database type: ${dbType}`);
  console.log(`[DB Config] DB_SYNCHRONIZE env var: "${process.env.DB_SYNCHRONIZE}"`);
  
  // Common configuration
  const baseConfig = {
    synchronize: process.env.DB_SYNCHRONIZE !== 'false', // Default true for development
    logging: process.env.DB_LOGGING === 'true', // Default false
    entities: [DataSourceEntity, ReportEntity, ReportViewEntity]
  };
  
  console.log(`[DB Config] Synchronize will be: ${baseConfig.synchronize}`);

  // SQLite configuration (default for development)
  if (dbType === 'sqlite') {
    const config = {
      ...baseConfig,
      type: 'sqlite',
      database: process.env.SQLITE_DB || process.env.DB_DATABASE || './server/db.sqlite'
    } as DataSourceOptions;
    console.log(`[DB Config] SQLite database file: ${config.database}`);
    console.log(`[DB Config] Final synchronize setting: ${config.synchronize}`);
    return config;
  }

  // PostgreSQL configuration
  if (dbType === 'postgres') {
    const config = {
      ...baseConfig,
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'report_generator',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    } as DataSourceOptions;
    console.log(`[DB Config] PostgreSQL: ${(config as any).username}@${(config as any).host}:${(config as any).port}/${(config as any).database}`);
    console.log(`[DB Config] Final synchronize setting: ${config.synchronize}`);
    return config;
  }

  // MySQL/MariaDB configuration
  if (dbType === 'mysql' || dbType === 'mariadb') {
    const config = {
      ...baseConfig,
      type: dbType,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'report_generator'
    } as DataSourceOptions;
    console.log(`[DB Config] ${dbType.toUpperCase()}: ${(config as any).username}@${(config as any).host}:${(config as any).port}/${(config as any).database}`);
    console.log(`[DB Config] Final synchronize setting: ${config.synchronize}`);
    return config;
  }

  // Microsoft SQL Server configuration
  if (dbType === 'mssql') {
    const config = {
      ...baseConfig,
      type: 'mssql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '1433', 10),
      username: process.env.DB_USERNAME || 'sa',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'report_generator',
      schema: process.env.DB_SCHEMA || 'dbo',
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== 'false'
      }
      // Note: synchronize is already in baseConfig, no need to override
    } as DataSourceOptions;
    console.log(`[DB Config] MSSQL: ${(config as any).username}@${(config as any).host}:${(config as any).port}/${(config as any).database} (schema: ${(config as any).schema})`);
    console.log(`[DB Config] MSSQL options: encrypt=${(config as any).options.encrypt}, trustServerCertificate=${(config as any).options.trustServerCertificate}`);
    console.log(`[DB Config] Final synchronize setting: ${config.synchronize}`);
    return config;
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
