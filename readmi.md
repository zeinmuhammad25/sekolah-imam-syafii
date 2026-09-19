# 🏫 Website SD Modern (SD MIAS) - Official Repository

Website resmi SD MIAS yang dibangun dengan standar teknologi modern: **React (Vite 6)**, **Tailwind CSS**, dan **Google Sheets CMS**. Website ini dirancang untuk kecepatan muat yang kencang, desain premium, dan ketangguhan infrastruktur tinggi.

## ✨ Redesign v3.0 — "Emerald & Gold"
Tampilan halaman utama dirombak total menjadi bahasa desain elite: **palet emerald/gold di atas ivory**, **judul serif Fraunces**, **divider emas** antar-section, dan **ritme gelap-terang** (section forest sebagai jeda visual). Fungsi tetap 100% sama — hanya lapisan tampilan yang berganti.

## 🆕 v3.2 — Panel Admin, Preview per-Berita & Bank Soal Relasional
Tiga lompatan besar: **panel admin CMS** (kelola Galeri/Pengajar/Warta + upload foto langsung dari web), **preview link berita per-artikel** di WhatsApp/FB (via Cloudflare Pages Function), dan **bank soal relasional yang aman untuk banyak guru sekaligus** (anti-konflik) plus **export PDF ujian yang jauh lebih rapi**.

## 🆕 v3.3 — Data Siswa Lengkap, E-Raport & Naik Kelas Otomatis
Data induk siswa (dari KK) sekarang punya **CRUD penuh + import/export Excel + validasi ketat** (NIK/NISN/No. KK, agama terkunci), fitur **naik kelas & pindah 1-klik** yang otomatis memindah foto KK antar folder Drive, **E-Raport relasional** per siswa/semester (nilai mapel/aspek gaya tabel input massal), dan **update data instan** (tidak lagi reload seluruh spreadsheet tiap 1 aksi kecil). Rapor SD & TK bisa **diunduh sebagai PDF** (SD meniru 1:1 format rapor sekolah; TK format sama dengan narasi 3 kelompok aspek perkembangan, Catatan Guru & ketidakhadiran) (cover, data sekolah, identitas, capaian kompetensi, ekstrakurikuler, muatan lokal, tanda tangan, watermark logo).

## 🚀 Fitur Unggulan (Updated)
1.  **Cloudflare Pages Hosting**: Bandwidth tanpa batas.
2.  **Preview Sosial per-Artikel (v3.2)**: `functions/berita/[id].js` (Cloudflare Pages Function) menyisipkan `og:image` / `og:title` / `og:description` / `canonical` **sesuai berita** saat link `/berita/:id` dibagikan ke WhatsApp/FB — robot preview tak menjalankan JS, jadi tag diisi di sisi server. Data berita di-cache di edge (*stale-while-revalidate*, jendela 60 dtk) agar respons instan & tahan saat Apps Script lambat.
3.  **Panel Admin CMS (v3.2)**: `/dashboard-guru/{galeri,pengajar,warta,video}` — tambah/edit/hapus **Galeri, Tim Pengajar, Warta, Galeri Video** langsung dari web, plus **atur urutan** (naik/turun) & **upload foto otomatis ke Google Drive** (dikembalikan URL publik `lh3.googleusercontent.com`). Satu komponen *config-driven* `AdminSection.jsx`. Id Warta permanen → link share tak putus. **Galeri Video**: guru cukup paste link YouTube biasa (watch/youtu.be/shorts) — ID & thumbnail diekstrak otomatis, tanpa upload file.
4.  **Data Siswa dari KK**: `/dashboard-guru/siswa` — data induk siswa untuk TU, diisi berdasarkan Kartu Keluarga (identitas siswa, alamat sesuai KK, data orang tua/wali, data sekolah). Navigasi **tab kelas TK–SD 6–Tamat** (sama seperti Dashboard Soal) + **pencarian** (nama/NIK/NISN/No. KK/nama ortu) & **filter status**.
    - **Validasi field**: NIK Siswa, NIK Ayah, NIK Ibu & No. Kartu Keluarga = tepat **16 angka**, NISN = tepat **10 angka** (angka-saja, huruf otomatis ditolak saat mengetik). Kolom-kolom ini **tidak wajib** (boleh kosong, mis. siswa belum punya NISN), tapi **kalau diisi harus sesuai** — kalau tidak, tidak bisa disimpan. Berlaku di Tambah, Edit, *dan* preview Import. **Agama** field terkunci ke **"Islam"** (sekolah Islam, tidak bisa dipilih/diubah).
    - **Mode Edit di list** (toggle tombol "Edit" di header): tiap baris dapat checkbox + Edit + Hapus. Preview **hilang** di mode ini (cuma tampil saat idle). Edit-field & Hapus **ditahan dulu** (badge titik kuning menandai ada perubahan tertahan) — baru benar-benar tersimpan ke server saat klik **"Simpan"** di bar bawah (ada popup konfirmasi ringkasan; "Batal" juga dikonfirmasi kalau ada perubahan tertahan; ada peringatan browser kalau tab ditutup sebelum Simpan).
    - **Naik Kelas & Pindah** (bar mode edit, checkbox multi-pilih): keduanya **langsung jalan** (punya konfirmasi sendiri, tidak nunggu tombol Simpan). "Naik Kelas" = TK→SD1→...→SD6→Tamat 1 tingkat (otomatis `status: Lulus` di Tamat). "Pindah" = langsung ke kelas **Tamat** dari kelas manapun dengan `status: Pindah` (siswa transfer/keluar, skip kelas antara). Keduanya memindahkan file foto KK di Drive ke folder jenjang baru otomatis (link `foto_kk` tidak berubah — ID file Drive permanen lepas dari folder).
    - **"Pindahkan ke Alumni"** (form Edit, cuma muncul di kelas SD 6): jalur individual terpisah untuk kelulusan, langsung tersimpan.
    - Popup form: anti tertutup klik-luar (cuma via X/Simpan/Batal+konfirmasi), bisa diperbesar/diperkecil.
    - **Foto/scan KK**: bukan upload dari app — TU unggah manual ke folder Google Drive per jenjang (tombol "Buka Folder KK" di form arah ke folder sesuai kelas), lalu tempel link filenya ke field `foto_kk`.
    - **Import massal dari Excel/CSV**: upload file (.xlsx/.xls/.csv, header kolom harus cocok nama field, ada tombol unduh template + peringatan format kolom NIK/NISN/No.KK sebagai **Text** di Excel) → validasi tiap baris (kolom wajib, format NIK/NISN/No.KK, format tanggal, kecocokan kelas/status/jenis kelamin, deteksi NIK duplikat; agama otomatis "Islam") → **preview wajib** sebelum data benar-benar masuk, baris bermasalah otomatis dilewati. Pakai `xlsx` (SheetJS, dimuat *lazy* cuma di halaman ini — diinstal dari CDN resmi SheetJS, bukan versi npm yang punya celah keamanan belum ditambal).
    - **Export CSV**: tombol Export buka modal filter dulu (kelas + status + pilih kolom, dikelompokkan per section) sebelum download — bukan langsung unduh semua. Aman dibuka Excel: NIK/NISN/No.KK/No.HP/Kode Pos/Tahun Ajaran dipaksa jadi teks (cegah notasi ilmiah `1.31E+09`/hilang angka nol), `tanggal_lahir` tampil jelas **DD/MM/YYYY** (tidak lagi diformat ulang otomatis oleh Excel).
    - **Performa**: Tambah/Edit/Hapus/Naik Kelas/Pindah/Import langsung update data di layar dari respons server — **tidak lagi reload seluruh spreadsheet** tiap 1 aksi (jauh lebih cepat, terutama saat spreadsheet sudah besar).
    - Komponen `TeacherStudents.jsx` + `ModalKit.jsx` (field `locked`/`numeric` generik, dipakai bareng CRUD lain), tersimpan di sheet `Students`.
5.  **Bank Soal Relasional + Anti-Konflik (v3.2)**: Penyimpanan pindah dari 1 blob JSON per sel ke **relasional** (`QuestionFolders` + `Questions`, 1 soal = 1 baris) → hilang batas 50k karakter/sel. **Optimistic concurrency** (kolom `updatedAt`): dua guru mengedit soal yang sama tak saling menimpa — yang telat diminta muat ulang. CRUD **per-soal** + **atur urutan soal** (kolom `order`, aman antar-folder & antar-user).
6.  **E-Raport**: `/dashboard-guru/eraport` — raport digital per siswa, relasional 2 tingkat (`ReportPeriods` = 1 semester, `ReportGrades`/`ReportAspects` = nilai mapel per semester itu) mengikuti pola Bank Soal (anti bentrok antar-guru via `updatedAt`), bukan 1 blob per sel. Navigasi tab TK–SD 6–Tamat + daftar siswa → klik siswa lihat **riwayat semua semester** (bisa lebih dari 14 kalau ada yang tinggal kelas, dibedakan lewat `tahunAjaran`, bukan cuma `kelas`) → klik semester untuk isi data semester + nilai. **Format mengikuti rapor sekolah (Kurikulum Merdeka)**: kepala rapor otomatis (Kelas "II (Dua)", Fase A/B/C, Semester Ganjil/Genap, Tahun Pelajaran); **SD** punya 3 tabel — *Muatan Pelajaran* (nilai akhir + capaian kompetensi 2 bagian: yang dikuasai & perlu bimbingan, mendukung mapel induk mis. "Seni (Pilihan)" → Seni Rupa), *Muatan Lokal Sekolah* (Tauhid, Fiqih, Tahfidz, dst — nilai angka, **nilai huruf terbilang**, **jumlah & rata-rata otomatis**, peringkat), *Ekstrakurikuler* (predikat A–D, keterangan otomatis "Sangat Baik" dst); **TK** tetap aspek perkembangan (narasi). Data semester juga menyimpan ketidakhadiran (Sakit/Izin/Tanpa Keterangan), tempat & tanggal rapor, nama wali kelas, dan Catatan Guru. **Nilai/aspek/ekskul**: tampilan defaultnya ringkas (read-only) dengan 1 tombol "Edit" — begitu diklik, berubah jadi **tabel input gaya spreadsheet** (banyak baris sekaligus, tombol "+ Tambah" per baris, hapus per baris) dengan 1 Simpan/Batal untuk semua tabel, nilai divalidasi angka 0–100. Kelas siswa yang tampil selalu ikut `Students.kelas` **saat ini** — begitu naik kelas di Data Siswa, otomatis pindah tab di sini juga tanpa proses migrasi data. Daftar mata pelajaran/aspek **bebas diketik TU** (belum dikunci daftar baku). **Performa**: simpan semester/nilai mapel langsung update data di layar, tidak reload seluruh spreadsheet. Export PDF & pembatasan akses per guru mapel menyusul di tahap berikutnya — saat ini akses masih via login guru bersama seperti panel lain.
7.  **Export PDF Ujian Modern (v3.2)**: Kop surat + **logo TK/SD otomatis**, **kotak identitas** (Nama, Kelas, No. Absen, Hari/Tgl, Mata Pelajaran, Waktu) + **kotak Nilai**, seksi **A. Pilihan Ganda** / **B. Essai** berlatar, footer nomor halaman + "Selamat Mengerjakan".
8.  **Notifikasi & Pengaman (v3.2)**: Toast sukses/gagal dengan penjelas penyebab (bentrok, terhapus, koneksi, dll), **cegah klik-ganda** simpan (anti-duplikat saat jeda 2-4 dtk), modal input *scrollable* (fix responsive), 5-step mobile back guard.
9.  **Redesign Emerald & Gold (v3.0)**: Palet ivory/emerald/emas + serif Fraunces via token Tailwind, konsisten seluruh app.
10. **Route Code-Splitting**: Berita & Dashboard Guru dimuat *on-demand*; jsPDF/html2canvas keluar dari bundle publik.
11. **WebP Image Pipeline + SEO**: Gambar lokal di-resize/kompres ke WebP via `sharp`; satu `<h1>` benar + alt text; `og:image` default = hero.
12. **Smart Gallery, Video Showcase & Gender-Based Avatar**: Bento grid + modal galeri, **Galeri Video CRUD dari sheet** (*thumbnail* YouTube otomatis → modal player), tampil 3 dulu + tombol "Lihat Semua Video" kalau lebih, ikon Ikhwan/Akhwat untuk staf tanpa foto.
13. **Twibbon MPLS (v3.1)**: Halaman `/twibbon` — pilih jenjang (TK/SD), upload foto, atur zoom + geser, download PNG (frame di depan, lubang transparan via `sharp`). Preview jadwal MPLS dari sheet `Settings` (`MPLS TK`/`MPLS SD`).

---

## 📊 Konfigurasi CMS (Google Sheets)
Website ini dikontrol melalui satu Spreadsheet dengan tab berikut:

| Tab Name | Fungsi Utama | Key Fields |
| :--- | :--- | :--- |
| `Settings` | Branding & Teks Utama | `school_logo`, `hero_image`, `MPLS TK`, `MPLS SD` |
| `Teachers` | Tim Pengajar | `name`, `role`, `photo_url`, `gender` (`ikhwan`/`akhwat`) |
| `Gallery` | Dokumentasi Siswa | `title`, `category`, `image_url` |
| `News` | Warta / Berita | `id`, `title`, `summary`, `image_url`, `date`, `description` |
| `Videos` | Galeri Video | `id`, `title`, `youtube_url`, `order`, `updatedAt` |
| `Students` | Data Siswa (dari KK), untuk TU | `id`, `nama_siswa`, `nik_siswa`, `nisn`, `jenis_kelamin`, `tempat_lahir`, `tanggal_lahir`, `agama`, `anak_ke`, `no_kk`, `alamat`, `kelurahan`, `kecamatan`, `kabupaten`, `provinsi`, `kode_pos`, `nama_ayah`, `nik_ayah`, `pekerjaan_ayah`, `pendidikan_ayah`, `nama_ibu`, `nik_ibu`, `pekerjaan_ibu`, `pendidikan_ibu`, `nama_wali`, `pekerjaan_wali`, `alamat_wali`, `pendidikan_sebelumnya`, `no_hp_ortu`, `kelas`, `tahun_ajaran_masuk`, `status`, `foto_kk` (link Drive, teks biasa — bukan upload), `updatedAt` |
| `Announcements` | Running Info | Teks, Active |
| `PPDB` | Database Pendaftar | Data calon siswa baru |
| `QuestionFolders` | Folder/jenis ujian (relasional) | `id`, `grade`, `name`, `updatedAt` |
| `Questions` | **Bank Soal** (1 soal = 1 baris) | `id`, `folderId`, `text`, `optionA–D`, `correctAnswer`, `type`, `order`, `updatedAt` |
| `ReportPeriods` | **E-Raport**: 1 baris = 1 siswa untuk 1 semester | `id`, `studentId`, `kelas`, `tahunAjaran`, `semester`, `kehadiranSakit`, `kehadiranIzin`, `kehadiranAlpa`, `tempatRapor`, `tanggalRapor`, `tanggalIdentitas`, `namaWaliKelas`, `peringkat`, `catatanWaliKelas`, `updatedAt` *(kolom lama `sikapSpiritual`, `sikapSosial`, `ekstrakurikuler` tidak dipakai lagi)* |
| `ReportGrades` | Nilai per mapel (SD) dalam 1 `ReportPeriods` — `kelompok` = `umum` / `mulok` (baris lama tanpa `kelompok` dianggap `umum`) | `id`, `reportPeriodId`, `kelompok`, `induk`, `mataPelajaran`, `nilaiAngka`, `deskripsiCapaian`, `capaianBimbingan`, `updatedAt` |
| `ReportAspects` | Aspek perkembangan (TK) dalam 1 `ReportPeriods` | `id`, `reportPeriodId`, `kelompok` (`agama`/`jatidiri`/`literasi`; kosong = agama), `aspek`, `deskripsi`, `updatedAt` |
| `ReportExtras` | Ekstrakurikuler (SD) dalam 1 `ReportPeriods` | `id`, `reportPeriodId`, `nama`, `predikat`, `keterangan`, `updatedAt` |
| `TeacherQuestions` | *(Lama)* blob JSON per sel — **backup pra-migrasi** | Atomic JSON per cell |

> Backend Apps Script ada di **`apps-script/Code.gs`** — tempel ke editor Apps Script (Extensions → Apps Script), lalu **Deploy → Manage deployments → Edit → New version**. Fungsi `migrateBankSoal()` dijalankan **sekali** untuk memindah bank soal lama ke tab relasional.

---

## 📂 Struktur Folder
- `/functions/berita/[id].js`: **Cloudflare Pages Function** — inject OG tag & canonical per-berita di sisi server.
- `/apps-script/Code.gs`: **Backend Google Apps Script** (doGet/doPost: CRUD baris, upload foto ke Drive, reorder, migrasi bank soal). Ditempel manual ke editor Apps Script.
- `/public/`: Favicon situs — `favicon.ico`, `apple-touch-icon.png`, `favicon-32.png`.
- `/public/avatars/`: Aset lokal — `logo.png` (SD), `logo-tk.png` (logo TK utk kop ujian), `hero.jpeg` (og:image), `hero.webp`, `ikhwan.webp`, `akhwat.webp`.
- `/public/twibbon/`: Frame twibbon dengan lubang transparan — `tk.png`, `sd.png`.
- `/src/services/gsheet.js`: Service API ke Apps Script — `fetchSchoolData`, `mutateRow` (CRUD/reorder), `uploadImage`, `moveKKFile` (pindah foto KK antar folder Drive), `formatSheetDate`/`formatSheetDateDMY` (rapikan tanggal ISO dari Sheets), `submitPPDBForm`.
- `/src/services/raporPdf.js`: Generator PDF rapor SD (jsPDF, *lazy import*) — `generateRaporPdf`, `raporFileName`. Konstanta identitas sekolah (`SCHOOL_SD`, `SCHOOL_TK`: NPSN, NSS, alamat, kepala sekolah) ada di bagian atas file — **lengkapi NPSN/NSS & kepala sekolah TK di `SCHOOL_TK`**; watermark SD dari `public/avatars/rapor-watermark.jpeg`, TK dari `public/avatars/logo-tk.png`.
- `/src/components/teacher/`: Dashboard Guru (*lazy*) — `AdminSection.jsx` (CRUD Galeri/Pengajar/Warta/Video), `TeacherStudents.jsx` (Data Siswa dari KK — cari, filter, export CSV, naik kelas), `TeacherEraport.jsx` (E-Raport relasional per siswa/semester + tombol Unduh Rapor PDF), `TeacherSoal.jsx` (bank soal), `TeacherLayout.jsx`, `ModalKit.jsx` (Modal/Field/Thumb dipakai bersama antar panel CRUD).
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
**Status**: ✅ Produksi Aktif | **Rev**: 3.3  
**Developer**: Antigravity AI | **Last Update**: 7 September 2026
