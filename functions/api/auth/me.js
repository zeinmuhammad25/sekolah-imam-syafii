import { requireSession, json } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  return json({
    loggedIn: !!session,
    userId: session?.userId || null,
    username: session?.username || null,
    name: session?.name || null,
    role: session?.role || null,
    permissions: session?.permissions || null,
  });
}
