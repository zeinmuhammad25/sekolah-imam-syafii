// Uji langsung functions/api/*.js dengan SQLite asli lewat tiruan D1 (scripts/migrate/_d1.mjs).
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createEnv, root } from './_d1.mjs';

const imp = (p) => import(pathToFileURL(p).href);
const { env, sqlite } = createEnv();
const DB = env.DB;

// Bucket R2 tiruan: Map<key, {bytes, contentType}>
const store = new Map();
const BUCKET = {
  put: async (key, bytes, opts) => { store.set(key, { bytes, contentType: opts?.httpMetadata?.contentType }); },
  get: async (key) => {
    const o = store.get(key);
    if (!o) return null;
    return { body: o.bytes, httpEtag: '"fake"', writeHttpMetadata: (h) => h.set('content-type', o.contentType) };
  },
};
env.BUCKET = BUCKET;

let failed = 0, total = 0;
const ok = (label, cond) => { total++; console.log(cond ? 'OK  ' : 'GAGAL', '-', label); if (!cond) failed++; };

const loginMod = await imp(join(root, 'functions/api/auth/login.js'));
const login = await loginMod.onRequestPost({ request: new Request('http://x', { method: 'POST', body: JSON.stringify({ username: 'guru', password: 'pz9eqeu1zOx2' }) }), env });
const token = decodeURIComponent((login.headers.get('Set-Cookie').match(/mias_session=([^;]+)/) || [])[1]);

const uploadMod = await imp(join(root, 'functions/api/upload.js'));
const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// 1) tanpa login
const noAuth = await uploadMod.onRequestPost({ request: new Request('http://x/api/upload', { method: 'POST', body: JSON.stringify({ imageBase64: `data:image/png;base64,${tinyPngB64}`, filename: 'a.png' }) }), env });
ok('Upload tanpa login -> 401', noAuth.status === 401);

// 2) tipe tak didukung
const authedReq = (bodyObj) => new Request('http://x/api/upload', { method: 'POST', headers: { Cookie: `mias_session=${token}` }, body: JSON.stringify(bodyObj) });
const badType = await uploadMod.onRequestPost({ request: authedReq({ imageBase64: 'data:application/pdf;base64,AAAA' }), env });
const badTypeBody = await badType.json();
ok('Tipe file tak didukung -> ditolak', badType.status === 400 && badTypeBody.success === false);

// 3) upload valid
const good = await uploadMod.onRequestPost({ request: authedReq({ imageBase64: `data:image/png;base64,${tinyPngB64}`, filename: 'foto.png' }), env });
const goodBody = await good.json();
ok('Upload valid -> success + url', goodBody.success === true && /^http:\/\/x\/uploads\/img-/.test(goodBody.url));

// 4) ambil lagi lewat proxy /uploads/[[path]]
const key = goodBody.fileId;
const uploadsMod = await imp(join(root, 'functions/uploads/[[path]].js'));
const fetched = await uploadsMod.onRequestGet({ params: { path: key }, env });
ok('File bisa diambil lagi via /uploads/<key>', fetched.status === 200 || fetched.status === undefined);
ok('Content-Type tersimpan benar', fetched.headers.get('content-type') === 'image/png');

const missing = await uploadsMod.onRequestGet({ params: { path: 'tidak-ada.png' }, env });
ok('Key tidak ada -> 404', missing.status === 404);

console.log('\n' + (failed === 0 ? `SEMUA ${total} SKENARIO LULUS` : `${failed} SKENARIO GAGAL`));
process.exit(failed ? 1 : 0);
