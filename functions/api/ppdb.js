// POST /api/ppdb — publik (form pendaftaran di halaman utama), tanpa login.
// Memperbaiki bug lama: submitPPDBForm() mengirim ke Apps Script tapi tidak
// pernah benar-benar tersimpan di server (tidak ada handler type: 'PPDB' di Code.gs).
import { json } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ success: false, error: 'Body tidak valid' }, { status: 400 }); }

  const parent_name = String(body.parent_name || '').trim();
  const student_name = String(body.student_name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  if (!parent_name || !student_name || !phone) {
    return json({ success: false, error: 'Data wajib belum lengkap' }, { status: 400 });
  }

  const id = 'ppdb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  await env.DB.prepare(
    'INSERT INTO ppdb (id, parent_name, student_name, phone, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, parent_name, student_name, phone, email, 'baru', Date.now()).run();

  return json({ success: true, id });
}
