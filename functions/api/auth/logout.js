import { getCookie, clearSessionCookie, json } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, 'mias_session');
  if (token) await env.DB.prepare('DELETE FROM teacher_sessions WHERE token = ?').bind(token).run();
  return json({ success: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}
