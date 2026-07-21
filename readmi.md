# 🏫 Website SD Modern (SD MIAS) - Official Repository

Website resmi SD MIAS yang dibangun dengan standar teknologi modern: **React (Vite 6)**, **Tailwind CSS**, dan **Google Sheets CMS**. Website ini dirancang untuk kecepatan muat yang kencang, desain premium, dan ketangguhan infrastruktur tinggi.

## ✨ Redesign v3.0 — "Emerald & Gold"
Tampilan halaman utama dirombak total menjadi bahasa desain elite: **palet emerald/gold di atas ivory**, **judul serif Fraunces**, **divider emas** antar-section, dan **ritme gelap-terang** (section forest sebagai jeda visual). Fungsi tetap 100% sama — hanya lapisan tampilan yang berganti.

## 🆕 v3.2 — Panel Admin, Preview per-Berita & Bank Soal Relasional
Tiga lompatan besar: **panel admin CMS** (kelola Galeri/Pengajar/Warta + upload foto langsung dari web), **preview link berita per-artikel** di WhatsApp/FB (via Cloudflare Pages Function), dan **bank soal relasional yang aman untuk banyak guru sekaligus** (anti-konflik) plus **export PDF ujian yang jauh lebih rapi**.

## 🚀 Fitur Unggulan (Updated)
1.  **Cloudflare Pages Hosting**: Bandwidth tanpa batas.
2.  **Preview Sosial per-Artikel (v3.2)**: `functions/berita/[id].js` (Cloudflare Pages Function) menyisipkan `og:image` / `og:title` / `og:description` / `canonical` **sesuai berita** saat link `/berita/:id` dibagikan ke WhatsApp/FB — robot preview tak menjalankan JS, jadi tag diisi di sisi server. Data berita di-cache di edge (*stale-while-revalidate*, jendela 60 dtk) agar respons instan & tahan saat Apps Script lambat.
3.  **Panel Admin CMS (v3.2)**: `/dashboard-guru/{galeri,pengajar,warta}` — tambah/edit/hapus **Galeri, Tim Pengajar, Warta** langsung dari web, plus **atur urutan** (naik/turun) & **upload foto otomatis ke Google Drive** (dikembalikan URL publik `lh3.googleusercontent.com`). Satu komponen *config-driven* `AdminSection.jsx`. Id Warta permanen → link share tak putus.
4.  **Bank Soal Relasional + Anti-Konflik (v3.2)**: Penyimpanan pindah dari 1 blob JSON per sel ke **relasional** (`QuestionFolders` + `Questions`, 1 soal = 1 baris) → hilang batas 50k karakter/sel. **Optimistic concurrency** (kolom `updatedAt`): dua guru mengedit soal yang sama tak saling menimpa — yang telat diminta muat ulang. CRUD **per-soal** + **atur urutan soal** (kolom `order`, aman antar-folder & antar-user).
5.  **Export PDF Ujian Modern (v3.2)**: Kop surat + **logo TK/SD otomatis**, **kotak identitas** (Nama, Kelas, No. Absen, Hari/Tgl, Mata Pelajaran, Waktu) + **kotak Nilai**, seksi **A. Pilihan Ganda** / **B. Essai** berlatar, footer nomor halaman + "Selamat Mengerjakan".
6.  **Notifikasi & Pengaman (v3.2)**: Toast sukses/gagal dengan penjelas penyebab (bentrok, terhapus, koneksi, dll), **cegah klik-ganda** simpan (anti-duplikat saat jeda 2-4 dtk), modal input *scrollable* (fix responsive), 5-step mobile back guard.
7.  **Redesign Emerald & Gold (v3.0)**: Palet ivory/emerald/emas + serif Fraunces via token Tailwind, konsisten seluruh app.
8.  **Route Code-Splitting**: Berita & Dashboard Guru dimuat *on-demand*; jsPDF/html2canvas keluar dari bundle publik.
9.  **WebP Image Pipeline + SEO**: Gambar lokal di-resize/kompres ke WebP via `sharp`; satu `<h1>` benar + alt text; `og:image` default = hero.
10. **Smart Gallery, Video Showcase & Gender-Based Avatar**: Bento grid + modal galeri, tiga video YouTube (*thumbnail* → modal), ikon Ikhwan/Akhwat untuk staf tanpa foto.
11. **Twibbon MPLS (v3.1)**: Halaman `/twibbon` — pilih jenjang (TK/SD), upload foto, atur zoom + geser, download PNG (frame di depan, lubang transparan via `sharp`). Preview jadwal MPLS dari sheet `Settings` (`MPLS TK`/`MPLS SD`).

---

## 📊 Konfigurasi CMS (Google Sheets)
Website ini dikontrol melalui satu Spreadsheet dengan tab berikut:

| Tab Name | Fungsi Utama | Key Fields |
| :--- | :--- | :--- |
| `Settings` | Branding & Teks Utama | `school_logo`, `hero_image`, `MPLS TK`, `MPLS SD` |
| `Teachers` | Tim Pengajar | `name`, `role`, `photo_url`, `gender` (`ikhwan`/`akhwat`) |
| `Gallery` | Dokumentasi Siswa | `title`, `category`, `image_url` |
| `News` | Warta / Berita | `id`, `title`, `summary`, `image_url`, `date`, `description` |
| `Announcements` | Running Info | Teks, Active |
| `PPDB` | Database Pendaftar | Data calon siswa baru |
| `QuestionFolders` | Folder/jenis ujian (relasional) | `id`, `grade`, `name`, `updatedAt` |
| `Questions` | **Bank Soal** (1 soal = 1 baris) | `id`, `folderId`, `text`, `optionA–D`, `correctAnswer`, `type`, `order`, `updatedAt` |
| `TeacherQuestions` | *(Lama)* blob JSON per sel — **backup pra-migrasi** | Atomic JSON per cell |

> Backend Apps Script ada di **`apps-script/Code.gs`** — tempel ke editor Apps Script (Extensions → Apps Script), lalu **Deploy → Manage deployments → Edit → New version**. Fungsi `migrateBankSoal()` dijalankan **sekali** untuk memindah bank soal lama ke tab relasional.

---

## 📂 Struktur Folder
- `/functions/berita/[id].js`: **Cloudflare Pages Function** — inject OG tag & canonical per-berita di sisi server.
- `/apps-script/Code.gs`: **Backend Google Apps Script** (doGet/doPost: CRUD baris, upload foto ke Drive, reorder, migrasi bank soal). Ditempel manual ke editor Apps Script.
- `/public/`: Favicon situs — `favicon.ico`, `apple-touch-icon.png`, `favicon-32.png`.
- `/public/avatars/`: Aset lokal — `logo.png` (SD), `logo-tk.png` (logo TK utk kop ujian), `hero.jpeg` (og:image), `hero.webp`, `ikhwan.webp`, `akhwat.webp`.
- `/public/twibbon/`: Frame twibbon dengan lubang transparan — `tk.png`, `sd.png`.
- `/src/services/gsheet.js`: Service API ke Apps Script — `fetchSchoolData`, `mutateRow` (CRUD/reorder), `uploadImage`, `submitPPDBForm`.
- `/src/components/teacher/`: Dashboard Guru (*lazy*) — `AdminSection.jsx` (CRUD Galeri/Pengajar/Warta), `TeacherSoal.jsx` (bank soal), `TeacherLayout.jsx`.
- `/src/App.jsx`: Routing utama + `React.lazy`/`Suspense` (termasuk route admin `/dashboard-guru/*`).
- `/src/Home.jsx`: Halaman utama. `/src/NewsDetail.jsx`: Detail berita. `/src/Twibbon.jsx`: Generator twibbon.
- `tailwind.config.js`: Token palet Emerald/Gold/Ivory & font Fraunces/Inter.

> **Catatan optimasi gambar**: gambar lokal sudah ter-resize/kompres. Untuk mengganti, edit gambar sumber lalu kompres ke WebP (mis. via `sharp` atau [squoosh.app](https://squoosh.app)) — hindari resize berulang agar kualitas tidak menurun.

## 🛠️ Pengembangan
```bash
# Instalasi
npm install

# Pengembangan Lokal
npm run dev

# Build Final
npm run build
```

---
**Domain Resmi**: [sekolahislamimamsyafii.web.id](https://sekolahislamimamsyafii.web.id)  
**Infrastructure**: 🌐 Cloudflare Pages (Production)  
**Status**: ✅ Produksi Aktif | **Rev**: 3.2  
**Developer**: Antigravity AI | **Last Update**: 21 Juli 2026
