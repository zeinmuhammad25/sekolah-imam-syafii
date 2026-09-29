import { verifyPassword, randomToken } from '../../_lib/password.js';
import { sessionCookie, json } from '../../_lib/auth.js';

const SESSION_DAYS = 14;

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ success: false, error: 'Body tidak valid' }, { status: 400 }); }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return json({ success: false, error: 'Username/password wajib diisi' }, { status: 400 });

  const user = await env.DB.prepare('SELECT id, username, password_hash, name FROM teacher_users WHERE username = ?').bind(username).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ success: false, error: 'Username atau password salah' }, { status: 401 });
  }

  const token = randomToken();
  const expiresAt = Date.now() + SESSION_DAYS * 86400 * 1000;
  await env.DB.prepare('INSERT INTO teacher_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expiresAt).run();

  return json({ success: true, name: user.name || user.username }, {
    headers: { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) },
  });
}
