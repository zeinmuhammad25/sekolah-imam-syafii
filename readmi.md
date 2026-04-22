# 🏫 Website SD Modern (SD MIAS) - Official Repository

Website resmi SD MIAS yang dibangun dengan standar teknologi modern: **React (Vite 6)**, **Tailwind CSS**, dan **Google Sheets CMS**. Website ini dirancang untuk kecepatan muat yang kencang, desain premium, dan ketangguhan infrastruktur tinggi.

## 🚀 Fitur Unggulan (Updated)
1.  **Cloudflare Pages Hosting**: Migrasi dari Netlify untuk **Bandwidth Tanpa Batas (Unlimited)**. Website tidak akan pernah mati lagi karena limit trafik.
2.  **Social Sharing Optimized**: Integrasi **Open Graph Tags**. Saat link dibagikan ke WhatsApp, akan muncul judul "Official Website..." lengkap dengan deskripsi dan logo sekolah.
3.  **Ultra-Speed Vite 6 Engine**: Menggunakan versi terbaru Vite untuk proses build yang lebih efisien dan kompatibilitas modern.
4.  **Ultra-Speed Local Assets**: Logo (`logo.png`) dan Hero Image (`hero.jpeg`) disimpan lokasl di `/public/avatars/` untuk loading instan.
5.  **Smart Gallery & Modal**: Tampilan Bento Grid di beranda dan Full Gallery Popup yang interaktif.
6.  **Gender-Based Avatar**: Otomatis menampilkan ikon Ikhwan/Akhwat untuk staf yang belum memiliki foto foto.

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

---

## 📂 Struktur Folder
- `/public/avatars/`: Tempat menyimpan `logo.png`, `hero.jpeg`, `ikhwan.png`, dan `akhwat.png`.
- `/src/services/gsheet.js`: Script koneksi ke API Google Sheets.
- `/src/App.jsx`: Komponen UI utama.

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
**Status**: ✅ Produksi Aktif | **Rev**: 1.3  
**Developer**: Zein | **Last Update**: 21 April 2026