import { requireSession, json } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  return json({ loggedIn: !!session, name: session?.name || null });
}
