// POST /api/auth/change-password -- guru ganti password sendiri. Wajib login &
// wajib tahu password lama (bukan cuma modal reset).
import { requireSession, json } from '../../_lib/auth.js';
import { verifyPassword, hashPassword } from '../../_lib/password.js';

export async function onRequestPost({ request, env }) {
  const session = await requireSession(request, env);
  if (!session) return json({ success: false, error: 'Belum login' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return json({ success: false, error: 'Body tidak valid' }, { status: 400 }); }

  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  if (!currentPassword || !newPassword) return json({ success: false, error: 'Password lama & baru wajib diisi' }, { status: 400 });
  if (newPassword.length < 8) return json({ success: false, error: 'Password baru minimal 8 karakter' }, { status: 400 });
  if (newPassword === currentPassword) return json({ success: false, error: 'Password baru harus berbeda dari yang lama' }, { status: 400 });

  const user = await env.DB.prepare('SELECT id, password_hash FROM teacher_users WHERE id = ?').bind(session.userId).first();
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    return json({ success: false, error: 'Password lama salah' }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE teacher_users SET password_hash = ? WHERE id = ?').bind(newHash, session.userId).run();

  return json({ success: true });
}
