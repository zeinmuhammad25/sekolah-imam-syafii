// POST /api/upload — pengganti Apps Script type:'UPLOAD' (yang menaruh file ke
// Google Drive). Sekarang ke Cloudflare R2, disajikan lewat /uploads/<key>
// (functions/uploads/[[path]].js). Dipakai dashboard-guru (AdminSection.jsx) untuk
// Gallery/Teachers/News/Videos — jadi wajib login.
import { requireSession, json } from '../_lib/auth.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — cukup untuk foto galeri/berita, cegah penyalahgunaan
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export async function onRequestPost({ request, env }) {
  const session = await requireSession(request, env);
  if (!session) return json({ success: false, error: 'Belum login' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return json({ success: false, error: 'Body tidak valid' }, { status: 400 }); }

  const dataUrl = String(body.imageBase64 || '');
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return json({ success: false, error: 'Format gambar tidak valid' }, { status: 400 });
  const mime = m[1];
  if (!ALLOWED_MIME.has(mime)) return json({ success: false, error: 'Tipe file tidak didukung: ' + mime }, { status: 400 });

  let bytes;
  try { bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)); }
  catch { return json({ success: false, error: 'Data base64 rusak' }, { status: 400 }); }
  if (bytes.byteLength > MAX_BYTES) return json({ success: false, error: `Ukuran file melebihi ${MAX_BYTES / 1024 / 1024} MB` }, { status: 400 });

  const ext = EXT_BY_MIME[mime] || 'bin';
  const key = `img-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });

  const url = new URL(request.url);
  const publicUrl = `${url.origin}/uploads/${key}`;
  return json({ success: true, url: publicUrl, fileId: key });
}
