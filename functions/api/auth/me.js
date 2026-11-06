import { requireSession, sessionCookie, json, getCookie } from '../../_lib/auth.js';

const SESSION_DAYS = 30; // 30 hari rolling session otomatis

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  if (!session) {
    return json({ loggedIn: false }, { status: 401 });
  }

  // Rolling session: perpanjang masa aktif sesi jika token masih valid
  const token = getCookie(request, 'mias_session');
  let headers = {};
  if (token && env?.DB) {
    try {
      const newExpiresAt = Date.now() + SESSION_DAYS * 86400 * 1000;
      await env.DB.prepare('UPDATE teacher_sessions SET expires_at = ? WHERE token = ?').bind(newExpiresAt, token).run();
      headers['Set-Cookie'] = sessionCookie(token, SESSION_DAYS * 86400);
    } catch {
      // Abaikan jika update keepalive gagal di edge
    }
  }

  return json({
    loggedIn: true,
    userId: session?.userId || null,
    username: session?.username || null,
    name: session?.name || null,
    role: session?.role || null,
    permissions: session?.permissions || null,
  }, { headers });
}
