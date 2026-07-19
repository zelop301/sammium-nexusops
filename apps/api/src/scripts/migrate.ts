import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../db.js';

const sqlPath = resolve(process.cwd(), 'src/sql/001_init.sql');
const sql = await readFile(sqlPath, 'utf8');

try {
  await pool.query(sql);
  console.log('[database] migration completed');
} finally {
  await pool.end();
}
