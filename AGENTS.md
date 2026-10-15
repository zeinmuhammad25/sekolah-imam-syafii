# Autonomous Execution & Repository Rules

## Mode Otonom Penuh (Full Auto-Approve)
- **Auto-Approve Segala Aksi**: Agen memiliki izin penuh untuk mengeksekusi semua instruksi, modifikasi file, pembuatan file, eksekusi perintah terminal (PowerShell), migrasi database, dan pengujian tanpa perlu meminta konfirmasi berulang kali kepada pengguna.
- **Proaktif & Tuntas**: Selesaikan tugas dari hulu ke hilir secara mandiri. Jangan berhenti di tengah jalan hanya untuk bertanya persetujuan kecuali ada ambiguitas bisnis yang fatal.
- **Validasi Mandiri**: Jalankan build (`npm run build`), tes, atau verifikasi script setelah melakukan perubahan untuk memastikan tidak ada error/regresi.

---

## Ringkasan Arsitektur Repositori (Sekolah Imam Syafi'i)

### 1. Frontend
- **Framework**: React 18 (Vite 6), React Router v7
- **Styling**: Tailwind CSS dengan palet khusus *Emerald & Gold di atas Ivory* (`primary`, `secondary`, `accent`, `ivory`, `forest`, `ink`) serta tipografi Fraunces (serif display) & Inter (sans body).
- **Komponen Utama**:
  - `src/Home.jsx`: Landing page sekolah (Hero, Profil, Keunggulan, Galeri, Video, Fasilitas, Pengajar, PPDB CTA).
  - `src/NewsDetail.jsx`: Detail berita sekolah.
  - `src/Twibbon.jsx`: Generator twibbon MPLS TK/SD.
  - `src/components/teacher/`: Panel dashboard guru & TU (Bank Soal, Data Siswa KK, E-Raport Kurikulum Merdeka, CMS Admin Galeri/Pengajar/Warta/Video, Pengaturan ganti password).
  - `src/services/gsheet.js`: Service penghubung API frontend ke backend (`/api/data`, `/api/row`, `/api/upload`, dll).
  - `src/services/raporPdf.js`: Engine generator cetak PDF rapor siswa SD & TK (jsPDF + autoTable).

### 2. Backend & Infrastruktur
- **Hosting**: Cloudflare Pages
- **Serverless API**: Cloudflare Pages Functions (`functions/api/`):
  - `data.js`: Endpoint fetch seluruh data master / publik.
  - `row.js`: Mutasi CRUD baris per-tabel dengan proteksi *optimistic concurrency* (`updated_at`).
  - `upload.js`: Upload file gambar langsung ke Cloudflare R2.
  - `auth/`: Login sesi cookie HTTP-only (`login.js`, `logout.js`, `me.js`, `change-password.js`).
  - `berita/[id].js`: Server-side injection meta OpenGraph/Twitter card untuk WhatsApp/FB crawler.
- **Database**: Cloudflare D1 (SQLite serverless) — skema lengkap di [d1/schema.sql](file:///c:/Users/Iweka/OneDrive/Dokumen/zein/sekolah-imam-syafii/d1/schema.sql).
- **Storage**: Cloudflare R2 bucket `sekolah-uploads`.
- **Legacy Support**: Script Apps Script lama tersimpan di `apps-script/Code.gs` (sudah dimigrasikan ke Cloudflare D1 & R2).

