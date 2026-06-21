import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('./index', () => ({
  db: {
    execute: mocks.execute,
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((statement, chunk, index) => `${statement}${chunk}${values[index] ?? ''}`, ''),
}));

import { ensurePublishedPagesTable } from './published-pages';

describe('ensurePublishedPagesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes old global uid uniqueness and creates per-user uid uniqueness', async () => {
    mocks.execute.mockResolvedValue(undefined);

    await ensurePublishedPagesTable();

    const statements = mocks.execute.mock.calls.map(([statement]) => String(statement));
    expect(statements.some((statement) => statement.includes('DROP CONSTRAINT IF EXISTS "published_pages_uid_unique"'))).toBe(true);
    expect(statements.some((statement) => statement.includes('DROP INDEX IF EXISTS "published_pages_uid_idx"'))).toBe(true);
    expect(statements.some((statement) => statement.includes('CREATE UNIQUE INDEX IF NOT EXISTS "published_pages_user_id_uid_idx"'))).toBe(true);
    expect(statements.some((statement) => statement.includes('("user_id","uid")'))).toBe(true);
    expect(statements.some((statement) => statement.includes('UNIQUE("uid")'))).toBe(false);
    expect(statements.some((statement) => statement.includes('USING btree ("uid")'))).toBe(false);
  });
});
