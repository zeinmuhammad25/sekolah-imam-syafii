# Product Requirements Document (PRD) - Website SD Modern (SD MIAS)

## 1. Visi Produk
Membangun platform informasi sekolah yang **Serverless**, **Ultra-Fast**, dan **High-Aesthetics**. Menghilangkan hambatan teknis pengelolaan website tradisional dengan menggunakan Google Sheets sebagai CMS yang bisa dikelola oleh staf sekolah mana pun.

## 2. Cakupan Fitur (Core Features)

### A. Performa & Optimasi (The Speed Engine)
- **Route Code-Splitting (v3.0)**: Berita & seluruh Dashboard Guru dimuat *on-demand* via `React.lazy`. Library berat (jsPDF, html2canvas) tidak lagi ikut ke bundle publik — JS halaman utama turun dari **255 KB → 108 KB (gzip)**.
- **WebP Image Pipeline (v3.0)**: Aset lokal (hero & avatar) di-resize + dikompres ke WebP via `sharp`. Total aset kritis turun dari **~5 MB → ~92 KB**. Logo tetap PNG demi kompatibilitas favicon; `hero.jpeg` dipertahankan khusus untuk `og:image` (social crawler).
- **Local Asset Migration**: Aset kritis (Logo & Hero) disimpan secara lokal untuk menghilangkan latensi akses cloud.
- **Smart Image Resizing**: Logika otomatis yang menyesuaikan resolusi gambar dari Google Drive agar pas dengan ukuran layar.
- **Turbo Preload**: Teknik pre-loading aset di tingkat browser untuk render instan.
- **Adaptive Fallback**: Komponen `OptimizedImage` yang cerdas—jika gambar rusak, sistem menampilkan placeholder abu-abu premium agar desain tetap terjaga.

### B. User Interface & Experience (Redesign v3.0 — "Emerald & Gold")
- **Palet Emerald & Gold di atas Ivory**: Bahasa desain elite—latar ivory hangat, warna utama emerald deep, aksen emas tipis. Dikelola lewat token Tailwind (`primary/secondary/accent/ivory/forest/ink`) sehingga seluruh app konsisten otomatis.
- **Serif Display (Fraunces)**: Seluruh judul memakai serif Fraunces untuk kesan editorial/premium; body tetap sans (Inter) agar terbaca.
- **Ritme Gelap-Terang**: Section berselang antara ivory, putih, dan **forest** (Video & Fasilitas) sebagai jeda visual.
- **Ornamen Divider Emas**: Motif pemisah emas tipis (garis + berlian) berulang di tiap section terang.
- **Hero Trust-Stats**: Baris angka kepercayaan (Berdiri 2019, Gratis 100%, Target 3 Juz, 2 Jenjang) untuk konversi PPDB.
- **Sticky Mobile CTA**: Bar bawah khusus mobile (Daftar PPDB + WhatsApp) agar aksi utama selalu terjangkau.
- **Header Adaptif**: Header melayang yang berubah jadi kartu blur saat di-scroll.
- **Minimalist Mobile Navigation**: Burger menu dengan efek *smooth-slide* dan staggered animation.
- **Gender-Based Avatar**: Sistem otomatis menampilkan ikon Ikhwan/Akhwat jika staf tidak memiliki foto di database.

### C. SEO & Aksesibilitas (v3.0)
- **Single H1**: Hanya satu `<h1>` di hero (memuat nama sekolah + tagline); nama sekolah di header/footer diturunkan ke elemen non-heading.
- **Descriptive Alt Text**: Semua gambar lokal memakai alt deskriptif yang menyebut nama sekolah (baik untuk SEO gambar & pembaca layar).
- **Structured Data & Open Graph**: JSON-LD (`School` + `WebSite`), meta Open Graph/Twitter, canonical, sitemap, dan robots tetap aktif.

### D. Manajemen Data (Serverless CMS)
- **Google Sheets Integration**: Sinkronisasi data dua arah untuk Settings, News, Staff, Gallery, dan Pendaftaran PPDB.
- **Caching Mechanism**: Versi data (v1.1) memastikan pengguna mendapatkan update terbaru setiap kali ada perubahan struktur di spreadsheet.

### E. Galeri & Video
- **Limited Bento Grid**: Menampilkan 5 foto terbaik di halaman utama untuk menjaga kerapian.
- **Full-Screen Gallery Modal**: Jendela dokumentasi lengkap dengan transisi halus untuk melihat seluruh aktivitas siswa.
- **Video Showcase**: Tiga video YouTube sejajar (3 kolom), kini tampil di **section forest gelap**. Menggunakan *thumbnail facade* (hemat bandwidth, tanpa autoplay) — saat diklik, video membuka di modal layar besar dengan autoplay.

### F. Modul Administrasi Guru (Bank Soal)
- **Teacher Dashboard & Bank Soal (Hybrid)**: Panel lengkap bagi pengajar untuk menginput bank soal digital (Pilihan Ganda & Essai) yang terintegrasi langsung dengan Cloud. Dimuat *lazy* — tidak membebani pengunjung publik.
- **Atomic Column Isolation (v1.9)**: Arsitektur sinkronisasi tingkat sel (cell) yang memisahkan data per folder ujian. Menjamin keamanan data 100% meskipun banyak guru mengedit di kelas yang sama secara bersamaan.
- **Advanced PDF Sectioning**: Ekspor dokumen soal otomatis yang terbagi menjadi Section I (PG) dan Section II (Essai).
- **Simplified UX**: Penghapusan field Bobot Nilai untuk mempercepat alur kerja penginputan soal oleh guru.
- **5-Step Navigation Protection**: Mekanisme khusus untuk mencegah penutupan modal tak sengaja via tombol Hardware Back (Lock 1-3, Alert 4, Exit 5).

## 3. Spesifikasi Teknis (Extended)
- **Framework**: React.js 18+ (Vite 6)
- **Styling**: Tailwind CSS 3.x — palet Emerald/Gold/Ivory
- **Fonts**: Fraunces (display/serif) + Inter (body/sans)
- **Animation**: Framer Motion 10+
- **Image Optimization**: `sharp` (devDependency) → pipeline WebP
- **Code Splitting**: `React.lazy` + `Suspense` per-route
- **PDF Engine**: jsPDF & AutoTable (Advanced Sectioning) — dimuat *lazy*
- **CMS**: Google Apps Script (v1.9 - Atomic) & Horizontal Cell Storage

---
**Status**: ✅ Produksi Aktif | **Rev**: 3.0  
**Developer**: Antigravity AI | **Last Update**: 7 Juli 2026
