// Verifikasi sesi guru dari cookie HttpOnly `mias_session`.
// Dipakai row.js untuk menolak permintaan tulis (add/update/delete/dst) dari yang belum login.

const COOKIE = 'mias_session';

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function requireSession(request, env) {
  const token = getCookie(request, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT s.token, s.expires_at, u.id AS user_id, u.username, u.name FROM teacher_sessions s JOIN teacher_users u ON u.id = s.user_id WHERE s.token = ?'
  ).bind(token).first();
  if (!row) return null;
  if (Number(row.expires_at) < Date.now()) return null;
  return { userId: row.user_id, username: row.username, name: row.name };
}

export function sessionCookie(token, maxAgeSeconds) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export const json = (obj, init = {}) => {
  const { headers, ...rest } = init;
  return new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json', ...headers }, ...rest });
};
