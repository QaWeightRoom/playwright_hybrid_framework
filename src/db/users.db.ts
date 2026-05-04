import type { Pool } from 'pg';

export type SeededUser = {
  id: number;
  email: string;
  createdAt: Date;
};

export type InsertUserInput = {
  email: string;
};

/**
 * Sample schema assumed:
 *   CREATE TABLE users (
 *     id          serial PRIMARY KEY,
 *     email       text UNIQUE NOT NULL,
 *     created_at  timestamptz NOT NULL DEFAULT now()
 *   );
 */
export const usersDb = {
  async insertUser(pool: Pool, input: InsertUserInput): Promise<SeededUser> {
    const result = await pool.query<{ id: number; email: string; created_at: Date }>(
      'INSERT INTO users (email) VALUES ($1) RETURNING id, email, created_at',
      [input.email],
    );
    const row = result.rows[0];
    if (!row) throw new Error('insertUser: no row returned');
    return { id: row.id, email: row.email, createdAt: row.created_at };
  },

  async deleteUserById(pool: Pool, id: number): Promise<void> {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  },

  async findByEmail(pool: Pool, email: string): Promise<SeededUser | null> {
    const result = await pool.query<{ id: number; email: string; created_at: Date }>(
      'SELECT id, email, created_at FROM users WHERE email = $1',
      [email],
    );
    const row = result.rows[0];
    return row ? { id: row.id, email: row.email, createdAt: row.created_at } : null;
  },

  async findById(pool: Pool, id: number): Promise<SeededUser | null> {
    const result = await pool.query<{ id: number; email: string; created_at: Date }>(
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    return row ? { id: row.id, email: row.email, createdAt: row.created_at } : null;
  },
};
