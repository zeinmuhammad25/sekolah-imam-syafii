# 🏫 Website SD Modern (SD MIAS) - Official Repository

Website resmi SD MIAS yang dibangun dengan standar teknologi modern: **React (Vite 6)**, **Tailwind CSS**, dan **Google Sheets CMS**. Website ini dirancang untuk kecepatan muat yang kencang, desain premium, dan ketangguhan infrastruktur tinggi.

## ✨ Redesign v3.0 — "Emerald & Gold"
Tampilan halaman utama dirombak total menjadi bahasa desain elite: **palet emerald/gold di atas ivory**, **judul serif Fraunces**, **divider emas** antar-section, dan **ritme gelap-terang** (section forest sebagai jeda visual). Fungsi tetap 100% sama — hanya lapisan tampilan yang berganti.

## 🚀 Fitur Unggulan (Updated)
1.  **Cloudflare Pages Hosting**: Bandwidth Tanpa Batas (Unlimited).
2.  **Social Sharing Optimized**: Open Graph Tags — link yang dibagikan ke WhatsApp tampil dengan judul, deskripsi, dan gambar sekolah.
3.  **Redesign Emerald & Gold (v3.0)**: Palet ivory/emerald/emas + serif Fraunces, dikelola via token Tailwind sehingga seluruh app konsisten.
4.  **Route Code-Splitting (v3.0)**: Berita & Dashboard Guru dimuat *on-demand*; jsPDF/html2canvas keluar dari bundle publik → JS halaman utama **255 KB → 108 KB (gzip)**.
5.  **WebP Image Pipeline (v3.0)**: Gambar lokal di-resize + kompres ke WebP via `sharp` → aset kritis **~5 MB → ~92 KB**.
6.  **SEO Boost (v3.0)**: Satu `<h1>` yang benar + alt text deskriptif di semua gambar.
7.  **Trust-Stats & Sticky CTA (v3.0)**: Angka kepercayaan di hero + bar aksi bawah khusus mobile (Daftar PPDB + WhatsApp).
8.  **Smart Gallery & Modal**: Bento Grid di beranda + Full Gallery Popup interaktif.
9.  **Video Showcase**: Tiga video YouTube sejajar (kini di section forest gelap), *thumbnail facade* → modal autoplay saat diklik. Sumber diatur via array `VIDEOS` di `src/Home.jsx`.
10. **Gender-Based Avatar**: Otomatis menampilkan ikon Ikhwan/Akhwat untuk staf tanpa foto.
11. **Dashboard Guru & Bank Soal (Hybrid)**: Panel input bank soal digital (PG & Essai) terintegrasi Cloud, dimuat *lazy*.
12. **Atomic Column Sync (v1.9)**: Sinkronisasi tingkat sel per folder ujian — menghilangkan resiko data terhapus antar guru.
13. **Advanced PDF Sectioning**: Ekspor soal terbagi Section I (PG) & Section II (Essai) dengan area isian lega.
14. **5-Step Mobile Guard**: Proteksi tombol "Back" HP agar popup tidak tertutup sebelum data disimpan.

---

## 📊 Konfigurasi CMS (Google Sheets)
Website ini dikontrol melalui satu Spreadsheet dengan tab berikut:

| Tab Name | Fungsi Utama | Key Fields |
| :--- | :--- | :--- |
| `Settings` | Branding & Teks Utama | `school_logo`, `hero_image`, `vision`, `mission` |
| `Staff` | Tim Pengajar | Nama, Jabatan, Foto, Gender (`ikhwan`/`akhwat`) |
| `Gallery` | Dokumentasi Siswa | Judul, Kategori, Link Gambar |
| `Announcements` | Running Info | Teks, Active (`Yes`/`No`) |
| `PPDB` | Database Pendaftar | Data Calon Siswa Baru |
| `TeacherQuestions` | **Bank Soal Digital** | Atomic JSON per Cell (Isolasi Folder per Kolom) |

---

## 📂 Struktur Folder
- `/public/avatars/`: Aset lokal — `logo.png` (favicon), `hero.jpeg` (og:image), `hero.webp`, `ikhwan.webp`, `akhwat.webp`.
- `/src/services/gsheet.js`: Service API (GET & POST) ke Google Apps Script Engine.
- `/src/components/teacher/`: Modul Dashboard Guru (dimuat *lazy*).
- `/src/App.jsx`: Routing utama + `React.lazy`/`Suspense`.
- `/src/Home.jsx`: Halaman utama (redesign v3.0).
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
**Status**: ✅ Produksi Aktif | **Rev**: 3.0  
**Developer**: Antigravity AI | **Last Update**: 7 Juli 2026
