// Cloudflare Pages Function untuk /berita/:id
//
// Robot preview (WhatsApp/FB) tidak menjalankan JS, jadi og:image per-artikel
// harus disisipkan di server. Ambil data berita dari Apps Script (di-cache di
// edge), lalu tulis ulang tag OG + canonical di index.html sebelum dikirim.
//
// Apps Script lambat (~4-5 dtk) & kadang gagal. Pakai stale-while-revalidate:
// balas instan dari cache, refresh di background, dan tetap pakai data lama
// kalau Apps Script down -> tidak pernah jatuh ke OG default lagi.

const API_URL =
  'https://script.google.com/macros/s/AKfycbxZeLyTT-hteg2Rv9VXI2RwC0QTcjX_PSyiDepd5s-cozdrW2V19m9OFaADc7PXrCZGPg/exec';

const FRESH_MS = 15 * 60 * 1000; // dianggap fresh 15 menit; lewat itu refresh di background

async function getNews(context, origin) {
  const cache = caches.default;
  const key = new Request(`${origin}/__news-cache-v1`);

  let cached = null;
  let fresh = false;
  const hit = await cache.match(key);
  if (hit) {
    try {
      cached = await hit.json();
    } catch {}
    const ts = Number(hit.headers.get('x-ts')) || 0;
    fresh = Date.now() - ts < FRESH_MS;
  }

  const revalidate = async () => {
    const res = await fetch(API_URL, { redirect: 'follow' });
    if (!res.ok) throw new Error('apps script ' + res.status);
    const data = await res.json();
    await cache.put(
      key,
      new Response(JSON.stringify(data), {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=86400',
          'x-ts': String(Date.now()),
        },
      })
    );
    return data;
  };

  if (cached && fresh) return cached; // cache masih fresh -> instan
  if (cached) {
    context.waitUntil(revalidate().catch(() => {})); // stale -> pakai stale, refresh background
    return cached;
  }
  try {
    return await revalidate(); // cache kosong -> harus fetch sekali
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { params, request, env } = context;
  const url = new URL(request.url);

  // index.html statik dari build (SPA), selalu jadi dasar.
  const page = await env.ASSETS.fetch(new URL('/index.html', request.url));

  const data = await getNews(context, url.origin).catch(() => null);
  const item = data && (data.News || []).find((n) => String(n.id) === String(params.id));
  if (!item) return page; // id tak ada di data -> OG default (hero)

  const canonical = `${url.origin}/berita/${params.id}`;
  const title = `${item.title} — Sekolah Islam Imam Syafi'i Percut`;
  const desc = item.summary || '';
  const image = item.image_url;

  // HTMLRewriter menangani escaping atribut (judul ada tanda kutip ' dsb).
  const set = (content) => ({ element: (el) => el.setAttribute('content', content) });
  let rw = new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('link[rel="canonical"]', { element: (el) => el.setAttribute('href', canonical) })
    .on('meta[property="og:type"]', set('article'))
    .on('meta[property="og:url"]', set(canonical))
    .on('meta[property="twitter:url"]', set(canonical))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="twitter:title"]', set(title))
    .on('meta[property="og:description"]', set(desc))
    .on('meta[property="twitter:description"]', set(desc))
    .on('meta[name="description"]', set(desc));

  if (image) {
    rw = rw
      .on('meta[property="og:image"]', set(image))
      .on('meta[property="twitter:image"]', set(image));
  }

  return rw.transform(page);
}
