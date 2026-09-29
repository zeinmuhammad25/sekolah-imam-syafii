// Hash password dengan PBKDF2-SHA256 (Web Crypto — tersedia di runtime Cloudflare
// Workers/Pages Functions, dan di Node 20+ lewat globalThis.crypto).
// Disimpan sebagai "<garam_base64>:<hash_base64>" di kolom teacher_users.password_hash.
const ITER = 100000;

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, keyMaterial, 256);
  return bits;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return `${toB64(salt)}:${toB64(bits)}`;
}

export async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = String(stored || '').split(':');
  if (!saltB64 || !hashB64) return false;
  const salt = fromB64(saltB64);
  const bits = await derive(password, salt);
  const got = toB64(bits);
  // Perbandingan waktu-konstan sederhana (cukup untuk skala aplikasi ini).
  if (got.length !== hashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hashB64.charCodeAt(i);
  return diff === 0;
}

export function randomToken() {
  return toB64(crypto.getRandomValues(new Uint8Array(24))).replace(/[^a-zA-Z0-9]/g, '');
}
