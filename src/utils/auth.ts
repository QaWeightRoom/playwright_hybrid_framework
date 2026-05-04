import path from 'node:path';
import type { UserRole } from '@/config/types';

export function storageStatePath(role: UserRole): string {
  if (!role) {
    throw new Error('storageStatePath: role is required');
  }
  return path.resolve(process.cwd(), '.auth', `${role}.json`);
}
