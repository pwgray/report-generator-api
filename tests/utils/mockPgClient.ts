import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { Client } from 'pg';

export function createMockPgClient() {
  return {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn()
  } as const;
}

export function applyMockPgClient(mockClient: any) {
  (Client as unknown as Mock).mockImplementation(() => mockClient);
}

export function resetPgClientMock() {
  try {
    const c = (Client as unknown as Mock);
    if (c.mockReset) c.mockReset();
    if (c.mockClear) c.mockClear();
  } catch (e) {
    // ignore
  }
}
