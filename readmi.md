# 🏫 Website SD Modern (SD MIAS) - Official Repository

Website resmi SD MIAS yang dibangun dengan standar teknologi modern: **React (Vite)**, **Tailwind CSS**, dan **Google Sheets CMS**. Website ini dirancang untuk kecepatan muat yang kencang, desain premium, dan kemudahan pengelolaan data.

## 🚀 Fitur Unggulan (Update April 2026)
1. **Ultra-Speed Local Assets**: Logo (`logo.png`) dan Hero Image (`hero.jpeg`) disimpan di lokal (`/public/avatars/`) untuk loading instan tanpa latensi cloud.
2. **Minimalist Mobile Menu**: Burger menu modern dengan *smooth slide animation* dan desain yang bersih.
3. **Smart Gallery Modal**:
   - Tampilan Beranda: Terbatas 5 foto terbaik (Bento Grid).
   - Galleri Lengkap: Popup interaktif untuk melihat seluruh dokumentasi dari Google Sheets.
4. **Adaptive Optimized Image**: Komponen gambar cerdas dengan auto-fallback ke warna abu-abu premium jika link rusak/kosong.
5. **Gender-Based Avatar**: Otomatis mendeteksi ustadz (Ikhwan) atau ustadzah (Akhwat) dan menampilkan ikon yang sesuai jika foto tidak tersedia.
6. **Deploy Ready**: Terintegrasi penuh dengan Netlify untuk deployment otomatis (CI/CD).

---

## 📊 Konfigurasi CMS (Google Sheets)
Website ini dikontrol melalui satu Spreadsheet dengan tab berikut:

| Tab Name | Fungsi Utama | Key Fields |
| :--- | :--- | :--- |
| `Settings` | Branding & Teks Utama | `school_logo`, `hero_image`, `vision`, `mission` |
| `Staff` | Tim Pengajar | Nama, Jabatan, Foto, Gender (`ikhwan`/`akhwat`) |
| `Gallery` | Dokumentasi Siswa | Judul, Kategori, Link Gambar |
| `Announcements` | Running Info | Teks, Active (`Yes`/`No`) |
| `News` | Berita Terbaru | Judul, Isi, Gambar |
| `PPDB` | Database Pendaftar | Data Calon Siswa Baru |

---

## 📂 Struktur Folder
- `/public/avatars/`: Tempat menyimpan `logo.png`, `hero.jpeg`, `ikhwan.png`, dan `akhwat.png`.
- `/src/services/gsheet.js`: Script koneksi ke Google Apps Script.
- `/src/App.jsx`: Logika utama dan desain antarmuka.

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
**Status**: ✅ Produksi Stabil | **Rev**: 1.2
**Developer**: Zein