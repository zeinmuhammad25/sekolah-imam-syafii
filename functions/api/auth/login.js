import { verifyPassword, randomToken } from '../../_lib/password.js';
import { sessionCookie, json } from '../../_lib/auth.js';

const SESSION_DAYS = 14;

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ success: false, error: 'Body tidak valid' }, { status: 400 }); }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return json({ success: false, error: 'Username/password wajib diisi' }, { status: 400 });

  const user = await env.DB.prepare('SELECT id, username, password_hash, name, role, permissions, is_active FROM teacher_users WHERE username = ?').bind(username).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ success: false, error: 'Username atau password salah' }, { status: 401 });
  }

  if (user.is_active != null && Number(user.is_active) === 0) {
    return json({ success: false, error: 'Akun ini sedang dinonaktifkan. Hubungi Administrator.' }, { status: 403 });
  }

  const token = randomToken();
  const now = Date.now();
  const expiresAt = now + SESSION_DAYS * 86400 * 1000;
  // Banyak guru login dari banyak perangkat -> bersihkan sesi kedaluwarsa supaya tabel tidak menumpuk.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM teacher_sessions WHERE expires_at < ?').bind(now),
    env.DB.prepare('INSERT INTO teacher_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expiresAt),
  ]);

  return json({
    success: true,
    name: user.name || user.username,
    user: {
      id: user.id,
      username: user.username,
      name: user.name || user.username,
      role: user.role || (user.username === 'admin' ? 'superadmin' : 'guru'),
      permissions: user.permissions || '["all"]',
    },
  }, {
    headers: { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) },
  });
}
