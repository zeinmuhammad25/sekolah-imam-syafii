// GET /uploads/<key> — sajikan file dari R2 lewat domain yang sama (bukan URL r2.dev
// terpisah). Alasan: URL absolut & satu origin dibutuhkan untuk <img>, dan juga untuk
// og:image preview link WhatsApp/FB (lihat functions/berita/[id].js).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequestGet({ params, env }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  if (!key) return new Response('Not found', { status: 404, headers: CORS_HEADERS });

  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404, headers: CORS_HEADERS });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  // Nama file di-uploadImage() selalu unik (lihat functions/api/upload.js) -> aman di-cache permanen.
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  return new Response(obj.body, { headers });
}

export async function onRequestHead(context) {
  const res = await onRequestGet(context);
  return new Response(null, {
    status: res.status,
    headers: res.headers,
  });
}
