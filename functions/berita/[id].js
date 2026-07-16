// Cloudflare Pages Function untuk /berita/:id
// Robot preview (WhatsApp/FB) tidak menjalankan JS, jadi og:image per-artikel
// harus disisipkan di server. Ambil data berita dari Apps Script, lalu tulis ulang
// tag OG di index.html sebelum dikirim. Berlaku untuk bot & browser biasa.

const API_URL =
  'https://script.google.com/macros/s/AKfycbxZeLyTT-hteg2Rv9VXI2RwC0QTcjX_PSyiDepd5s-cozdrW2V19m9OFaADc7PXrCZGPg/exec';

export async function onRequest(context) {
  const { params, request, env } = context;

  // index.html statik dari build (SPA), selalu jadi dasar; kalau gagal apa-apa, kirim apa adanya.
  const page = await env.ASSETS.fetch(new URL('/index.html', request.url));

  let item;
  try {
    // cacheTtl: cukup fetch Apps Script sekali per 5 menit, sisanya dari cache Cloudflare.
    const res = await fetch(API_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    const data = await res.json();
    item = (data.News || []).find((n) => String(n.id) === String(params.id));
  } catch {
    item = null;
  }

  if (!item) return page; // berita tak ditemukan -> pakai OG default (hero)

  const url = new URL(request.url);
  const canonical = `${url.origin}/berita/${params.id}`;
  const title = `${item.title} — Sekolah Islam Imam Syafi'i Percut`;
  const desc = item.summary || '';
  const image = item.image_url;

  // HTMLRewriter menangani escaping atribut (judul ada tanda kutip ' dsb).
  const set = (content) => ({ element: (el) => el.setAttribute('content', content) });
  let rw = new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[property="og:type"]', { element: (el) => el.setAttribute('content', 'article') })
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
