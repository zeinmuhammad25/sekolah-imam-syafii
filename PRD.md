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

## 3. Spesifikasi Teknis
- **Framework**: React.js 18+ (Vite)
- **Styling**: Tailwind CSS 3.x
- **Animation**: Framer Motion 10+
- **Icons**: Lucide React
- **Hosting**: Netlify (CI/CD Integrated)
- **CMS**: Google Apps Script & Google Sheets

## 4. Keamanan & Deployment
- **SSL Encryption**: Sertifikat Let's Encrypt melalui Netlify.
- **Direct Domain**: https://sekolahislamimamsyafii.web.id

---
**Status Dokumen**: Rev 1.2 (Final Stable)
**Terakhir Diperbarui**: 21 April 2026
