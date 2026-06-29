# Product Requirements Document (PRD) - Website SD Modern (SD MIAS)

## 1. Visi Produk
Membangun platform informasi sekolah yang **Serverless**, **Ultra-Fast**, dan **High-Aesthetics**. Menghilangkan hambatan teknis pengelolaan website tradisional dengan menggunakan Google Sheets sebagai CMS yang bisa dikelola oleh staf sekolah mana pun.

## 2. Cakupan Fitur (Core Features)

### A. Performa & Optimasi (The Speed Engine)
- **Local Asset Migration**: Aset kritis (Logo & Hero) disimpan secara lokal untuk menghilangkan latensi akses cloud.
- **Smart Image Resizing**: Logika otomatis yang menyesuaikan resolusi gambar dari Google Drive agar pas dengan ukuran layar.
- **Turbo Preload**: Teknik pre-loading aset di tingkat browser untuk render instan.
- **Adaptive Fallback**: Komponen `OptimizedImage` yang cerdas—jika gambar rusak, sistem menampilkan placeholder abu-abu premium agar desain tetap terjaga.

### B. User Interface & Experience (Aesthetics)
- **Minimalist Mobile Navigation**: Burger menu dengan efek *smooth-slide* dan staggered animation (muncul satu per satu).
- **Responsive Branding**: Logo sekolah tampil konsisten di Header, Footer, dan Mobile Menu.
- **Glassmorphism Design**: Header transparan melayang dengan efek blur saat di-scroll.
- **Gender-Based Avatar**: Sistem otomatis menampilkan ikon Ikhwan/Akhwat jika staf tidak memiliki foto di database.

### C. Manajemen Data (Serverless CMS)
- **Google Sheets Integration**: Sinkronisasi data dua arah untuk Settings, News, Staff, Gallery, dan Pendaftaran PPDB.
- **Caching Mechanism**: Versi data (v1.1) memastikan pengguna mendapatkan update terbaru setiap kali ada perubahan struktur di spreadsheet.

### D. Galeri Dokumentasi
- **Limited Bento Grid**: Menampilkan 5 foto terbaik di halaman utama untuk menjaga kerapian.
- **Full-Screen Gallery Modal**: Jendela dokumentasi lengkap dengan transisi halus untuk melihat seluruh aktivitas siswa.
- **Video Showcase (v2.0)**: Tiga video YouTube tersusun sejajar (3 kolom) di antara Galeri dan profil Pengajar. Menggunakan teknik *thumbnail facade* (memuat gambar dulu, hemat bandwidth, tanpa autoplay) — saat diklik, video membuka di modal layar besar dengan autoplay dan tombol X untuk menutup.

### E. Modul Administrasi Guru (Bank Soal)
- **Teacher Dashboard & Bank Soal (Hybrid)**: Panel lengkap bagi pengajar untuk menginput bank soal digital (Pilihan Ganda & Essai) yang terintegrasi langsung dengan Cloud.
- **Atomic Column Isolation (v1.9)**: Arsitektur sinkronisasi tingkat sel (cell) yang memisahkan data per folder ujian. Menjamin keamanan data 100% meskipun banyak guru mengedit di kelas yang sama secara bersamaan.
- **Advanced PDF Sectioning**: Ekspor dokumen soal otomatis yang terbagi menjadi Section I (PG) dan Section II (Essai).
- **Simplified UX**: Penghapusan field Bobot Nilai untuk mempercepat alur kerja penginputan soal oleh guru.
- **5-Step Navigation Protection**: Mekanisme khusus untuk mencegah penutupan modal tak sengaja via tombol Hardware Back (Lock 1-3, Alert 4, Exit 5).

## 3. Spesifikasi Teknis (Extended)
- **Framework**: React.js 18+ (Vite 6)
- **Styling**: Tailwind CSS 3.x
- **Animation**: Framer Motion 10+
- **PDF Engine**: jsPDF & AutoTable (Advanced Sectioning v2.0)
- **CMS**: Google Apps Script (v1.9 - Atomic) & Horizontal Cell Storage

---
**Status**: ✅ Produksi Aktif | **Rev**: 2.0  
**Developer**: Antigravity AI | **Last Update**: 29 Juni 2026
