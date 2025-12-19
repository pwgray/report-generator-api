import { vi } from 'vitest';

export function createMockMssqlPool() {
  const q = vi.fn();
  const reqObj: any = { query: q, input: vi.fn().mockImplementation(() => reqObj) };
  const request = vi.fn().mockImplementation(() => reqObj);
  return {
    connect: vi.fn(),
    close: vi.fn(),
    request,
    _query: q
  } as const;
}

export function applyMockMssqlPool(pool: any) {
  const mssql = require('mssql') as any;
  if (mssql && typeof mssql.__setPool === 'function') {
    mssql.__setPool(pool);
  }
}
