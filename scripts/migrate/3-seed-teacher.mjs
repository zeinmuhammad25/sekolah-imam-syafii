// Tahap 3: buat akun login guru pertama di D1 (tabel teacher_users), menggantikan
// password "admin" statis di frontend. Skrip ini hanya MENCETAK perintah SQL
// (insert.sql tambahan) -- dijalankan lewat wrangler d1 execute seperti langkah lain,
// supaya password tidak pernah dikirim lewat argumen CLI / tersimpan di riwayat shell.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// Node 20+ sudah punya globalThis.crypto (Web Crypto) bawaan, sama seperti di
// runtime Cloudflare Workers — jadi functions/_lib/password.js bisa dipakai langsung.
const { hashPassword } = await import('../../functions/_lib/password.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const username = process.argv[2] || 'guru';
const password = process.argv[3];
const name = process.argv[4] || 'Admin Sekolah';

if (!password) {
  console.error('Pakai: node scripts/migrate/3-seed-teacher.mjs <username> <password> ["Nama Tampilan"]');
  process.exit(1);
}

const hash = await hashPassword(password);
const id = 'u-' + Date.now();
const esc = (v) => `'${String(v).replace(/'/g, "''")}'`;
const sql = `INSERT OR REPLACE INTO teacher_users (id, username, password_hash, name, created_at) VALUES (${esc(id)}, ${esc(username)}, ${esc(hash)}, ${esc(name)}, ${Date.now()});\n`;

const outPath = join(__dirname, 'seed-teacher.sql');
writeFileSync(outPath, sql);
console.log('Ditulis ke', outPath);
console.log('Jalankan: npx wrangler d1 execute sekolah-db --remote --file=scripts/migrate/seed-teacher.sql');
