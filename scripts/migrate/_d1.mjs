// Tiruan D1 di atas SQLite asli (node:sqlite) untuk pengujian lokal functions/api/*.
// Meniru perilaku yang relevan di produksi:
//  - PRAGMA foreign_keys = ON (D1 menegakkan foreign key secara default)
//  - prepare().bind().all()/first()/run() dan db.batch() = satu transaksi (semua/tidak sama sekali)
//  - eksekusi serial: setiap statement/batch berjalan utuh tanpa disela (seperti D1)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

export const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const imp = (p) => import(pathToFileURL(join(root, p)).href);

const normArg = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

class Stmt {
  constructor(sqlite, sql, args = []) { this.sqlite = sqlite; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.sqlite, this.sql, args); }
  _exec() {
    const s = this.sqlite.prepare(this.sql);
    const args = this.args.map(normArg);
    const returnsRows = /^\s*(SELECT|PRAGMA|WITH)\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql);
    if (returnsRows) {
      const rows = s.all(...args);
      const changes = this.sqlite.prepare('SELECT changes() AS c').get().c;
      return { success: true, results: rows, meta: { changes: /^\s*SELECT/i.test(this.sql) ? 0 : changes } };
    }
    const r = s.run(...args);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async all() { return this._exec(); }
  async run() { return this._exec(); }
  async first(col) { const row = this._exec().results[0] ?? null; return col && row ? row[col] : row; }
}

export function createEnv({ withData = true } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const files = ['d1/schema.sql'];
  if (withData && existsSync(join(root, 'scripts/migrate/insert.sql'))) files.push('scripts/migrate/insert.sql');
  files.push('d1/migrations/0002_concurrency.sql', 'scripts/migrate/seed-teacher.sql');
  for (const f of files) sqlite.exec(readFileSync(join(root, f), 'utf8'));
  sqlite.exec('PRAGMA foreign_keys = ON');

  const DB = {
    prepare: (sql) => new Stmt(sqlite, sql),
    batch: async (stmts) => {
      sqlite.exec('BEGIN');
      try { const out = stmts.map((s) => s._exec()); sqlite.exec('COMMIT'); return out; }
      catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    },
  };
  return { env: { DB }, sqlite };
}

// Login sebagai akun seed -> token sesi.
export async function loginToken(env, password = 'pz9eqeu1zOx2') {
  const loginMod = await imp('functions/api/auth/login.js');
  const res = await loginMod.onRequestPost({ request: new Request('http://x/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'guru', password }) }), env });
  const m = (res.headers.get('Set-Cookie') || '').match(/mias_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function makeChecker() {
  let failed = 0, total = 0;
  const ok = (label, cond) => { total++; console.log(cond ? 'OK   ' : 'GAGAL', '-', label); if (!cond) failed++; };
  const done = () => { console.log('\n' + (failed === 0 ? `SEMUA ${total} SKENARIO LULUS` : `${failed} DARI ${total} SKENARIO GAGAL`)); process.exit(failed ? 1 : 0); };
  return { ok, done };
}
