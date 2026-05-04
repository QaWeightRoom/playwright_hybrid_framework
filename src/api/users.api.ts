import type { APIRequestContext } from '@playwright/test';
import { BaseClient } from '@/api/base.client';

export type ApiUser = {
  id: number;
  name: string;
  username: string;
  email: string;
};

export class UsersApi extends BaseClient {
  constructor(request: APIRequestContext) {
    super(request);
  }

  async list(): Promise<ApiUser[]> {
    return this.json(await this.request.get('/users'));
  }

  async get(id: number): Promise<ApiUser> {
    return this.json(await this.request.get(`/users/${id}`));
  }

  async create(payload: Omit<ApiUser, 'id'>): Promise<ApiUser> {
    return this.json(
      await this.request.post('/users', { data: payload, headers: { 'Content-Type': 'application/json' } }),
    );
  }
}
