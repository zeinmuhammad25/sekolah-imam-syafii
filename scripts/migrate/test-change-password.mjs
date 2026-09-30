// Uji langsung functions/api/*.js dengan SQLite asli lewat tiruan D1 (scripts/migrate/_d1.mjs).
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createEnv, root } from './_d1.mjs';

const imp = (p) => import(pathToFileURL(p).href);
const { env, sqlite } = createEnv();
const DB = env.DB;

let failed = 0, total = 0;
const ok = (label, cond) => { total++; console.log(cond ? 'OK  ' : 'GAGAL', '-', label); if (!cond) failed++; };

const loginMod = await imp(join(root, 'functions/api/auth/login.js'));
const login = await loginMod.onRequestPost({ request: new Request('http://x', { method: 'POST', body: JSON.stringify({ username: 'guru', password: 'pz9eqeu1zOx2' }) }), env });
const token = decodeURIComponent((login.headers.get('Set-Cookie').match(/mias_session=([^;]+)/) || [])[1]);
const authedReq = (bodyObj) => new Request('http://x/api/auth/change-password', { method: 'POST', headers: { Cookie: `mias_session=${token}` }, body: JSON.stringify(bodyObj) });

const cpMod = await imp(join(root, 'functions/api/auth/change-password.js'));

const noAuth = await cpMod.onRequestPost({ request: new Request('http://x', { method: 'POST', body: '{}' }), env });
ok('Tanpa login -> 401', noAuth.status === 401);

const wrongOld = await cpMod.onRequestPost({ request: authedReq({ currentPassword: 'salah', newPassword: 'passwordbaru123' }), env });
const wrongOldBody = await wrongOld.json();
ok('Password lama salah -> ditolak', wrongOld.status === 401 && wrongOldBody.success === false);

const tooShort = await cpMod.onRequestPost({ request: authedReq({ currentPassword: 'pz9eqeu1zOx2', newPassword: 'short' }), env });
ok('Password baru < 8 karakter -> ditolak', (await tooShort.json()).success === false);

const same = await cpMod.onRequestPost({ request: authedReq({ currentPassword: 'pz9eqeu1zOx2', newPassword: 'pz9eqeu1zOx2' }), env });
ok('Password baru sama dgn lama -> ditolak', (await same.json()).success === false);

const good = await cpMod.onRequestPost({ request: authedReq({ currentPassword: 'pz9eqeu1zOx2', newPassword: 'passwordbaru123' }), env });
const goodBody = await good.json();
ok('Ganti password valid -> success', goodBody.success === true);

// Login dgn password lama harus GAGAL, dgn password baru harus BERHASIL.
const loginOld = await loginMod.onRequestPost({ request: new Request('http://x', { method: 'POST', body: JSON.stringify({ username: 'guru', password: 'pz9eqeu1zOx2' }) }), env });
ok('Login pakai password lama -> gagal', loginOld.status === 401);
const loginNew = await loginMod.onRequestPost({ request: new Request('http://x', { method: 'POST', body: JSON.stringify({ username: 'guru', password: 'passwordbaru123' }) }), env });
ok('Login pakai password baru -> berhasil', (await loginNew.json()).success === true);

console.log('\n' + (failed === 0 ? `SEMUA ${total} SKENARIO LULUS` : `${failed} SKENARIO GAGAL`));
process.exit(failed ? 1 : 0);
