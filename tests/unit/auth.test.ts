import { test, expect } from '@playwright/test';
import path from 'node:path';
import { storageStatePath } from '@/utils/auth';

test('storageStatePath returns .auth/<role>.json under cwd', () => {
  const p = storageStatePath('admin');
  expect(p).toBe(path.resolve(process.cwd(), '.auth', 'admin.json'));
});

test('storageStatePath rejects empty role', () => {
  expect(() => storageStatePath('' as never)).toThrow(/role/i);
});
