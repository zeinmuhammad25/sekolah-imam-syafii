# Migrasi ke Cloudflare D1 — Tahap 1: setup DB & skema

Tahap ini **belum mengubah aplikasi yang sedang jalan**. Situs publik dan
dashboard-guru tetap memakai Google Sheets / Apps Script seperti biasa sampai
tahap "cutover" nanti. Tujuan tahap ini cuma menyiapkan database-nya.

## 1. Install Wrangler (CLI Cloudflare)

```bash
npm install -D wrangler
```

## 2. Login ke akun Cloudflare kamu

```bash
npx wrangler login
```

Ini membuka browser untuk otorisasi akun Cloudflare yang dipakai untuk Pages
saat ini.

## 3. Buat database D1

```bash
npx wrangler d1 create sekolah-db
```

Perintah ini mencetak blok seperti:

```toml
[[d1_databases]]
binding = "DB"
database_name = "sekolah-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Salin `database_id` itu ke [wrangler.toml](../wrangler.toml) (baris
`database_id = "GANTI_DENGAN_ID_..."`).

## 4. Jalankan skema

```bash
npx wrangler d1 execute sekolah-db --remote --file=d1/schema.sql
```

`--remote` menjalankan ke database asli di Cloudflare (bukan cuma simulasi
lokal). Untuk mencoba dulu di lokal (tanpa menyentuh akun Cloudflare), pakai
`--local` sebagai gantinya — Wrangler membuat file SQLite lokal di
`.wrangler/state`.

## 5. Sambungkan D1 ke Cloudflare Pages

Buka **Cloudflare Dashboard → Workers & Pages → (nama project Pages ini) →
Settings → Functions → D1 database bindings**, lalu tambahkan binding
`DB` -> `sekolah-db`. Ini supaya `functions/**/*.js` (Pages Functions) bisa
mengakses D1 lewat `env.DB`.

## Setelah ini

Tahap berikutnya (belum dikerjakan): bangun API pengganti Apps Script
(`functions/api/*.js`) yang meniru bentuk balasan `fetchSchoolData` /
`mutateRow` supaya `src/services/gsheet.js` bisa diganti isinya tanpa
menulis ulang komponen React, skrip migrasi data dari Sheets ke D1, sistem
login guru asli (tabel `teacher_users` / `teacher_sessions` sudah disiapkan
di schema.sql), dan pemindahan upload foto ke Cloudflare R2.
