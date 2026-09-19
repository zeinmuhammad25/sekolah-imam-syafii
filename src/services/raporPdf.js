/**
 * Generator PDF rapor SD & TK — SD meniru 1:1 format "RAPOT SD" sekolah (7 halaman A4, Times 12 pt, watermark logo):
 * 1 Sampul · 2 Data Sekolah · 3 Identitas Peserta Didik · 4+ Rapor & Profil (Muatan Pelajaran)
 * · Ekstrakurikuler + Ketidakhadiran + Tanda tangan · Muatan Lokal Sekolah + Catatan Guru + Tanda tangan.
 *
 * TK: format yang sama (sampul, data sekolah, identitas, tabel capaian, tanda tangan) dengan isi narasi per aspek
 * perkembangan (3 kelompok), Catatan Guru & ketidakhadiran.
 *
 * Semua koordinat awalnya diukur dari render dokumen asli (1060 px = 210 mm), lalu diubah lewat p().
 */
import { formatSheetDate } from './gsheet';

const SCHOOL_SD = {
  yayasan: 'YAYASAN NASHIRUS SUNNAH PERCUT',
  judul: 'SEKOLAH DASAR ISLAM IMAM SYAFI’I',
  nama: 'SD ISLAM IMAM SYAFI’I',
  namaRapor: 'SD Islam Imam Syafi’i',
  npsn: '70059421',
  nss: '102070106321',
  alamat: 'Jalan Lembaga Dusun II',
  kodePos: '20371',
  kelurahan: 'Tanjung Rejo',
  kecamatan: 'Percut Sei Tuan',
  kabupaten: 'Deli Serdang',
  provinsi: 'Sumatera Utara',
  website: '-',
  email: 'nashirussunnahpercut@gmail.com',
  kepalaSekolah: 'Muhammad Khaidir, S.Pd.',
};

// TODO: lengkapi NPSN/NSS & nama kepala sekolah TK di sini (kosong = ditulis '-' / garis tanda tangan kosong).
const SCHOOL_TK = {
  ...SCHOOL_SD,
  judul: 'TAMAN KANAK-KANAK QUR’AN IMAM SYAFI’I',
  nama: 'TK QUR’AN IMAM SYAFI’I',
  namaRapor: 'TK Qur’an Imam Syafi’i',
  npsn: '-',
  nss: '-',
  kepalaSekolah: '',
};

// Label kelompok aspek perkembangan TK (kunci = kolom `kelompok` di ReportAspects).
const TK_KELOMPOK = [
  ['agama', 'Nilai Agama dan Budi Pekerti'],
  ['jatidiri', 'Jati Diri'],
  ['literasi', 'Dasar-dasar Literasi, Matematika, Sains, Teknologi, Rekayasa, dan Seni'],
];

const KELAS_ROMAWI = { 'SD 1': 'I', 'SD 2': 'II', 'SD 3': 'III', 'SD 4': 'IV', 'SD 5': 'V', 'SD 6': 'VI' };
const KELAS_ANGKA_KATA = { 'SD 1': 'Satu', 'SD 2': 'Dua', 'SD 3': 'Tiga', 'SD 4': 'Empat', 'SD 5': 'Lima', 'SD 6': 'Enam' };
const FASE = { 'SD 1': 'A', 'SD 2': 'A', 'SD 3': 'B', 'SD 4': 'B', 'SD 5': 'C', 'SD 6': 'C' };
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const K = 210 / 1060;                 // mm per px pada render acuan
const p = (px) => px * K;
const LH = 4.87;                       // tinggi baris Times 12 pt (single spacing)
const PAGE_W = 210, PAGE_H = 297;
const BOTTOM = PAGE_H - 25.4;          // batas bawah area tulis
const GRAY = [217, 217, 217];

// "2025-12-20" / ISO datetime -> "20 Desember 2025"
export const tglIndo = (v) => {
  const iso = formatSheetDate(v);
  const m = typeof iso === 'string' && iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}` : '';
};

const parseScore = (v) => Number(String(v).trim().replace(',', '.'));
const SATUAN = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
const terbilangLower = (n) => {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} puluh${n % 10 ? ` ${SATUAN[n % 10]}` : ''}`;
  if (n < 200) return `seratus${n % 100 ? ` ${terbilangLower(n % 100)}` : ''}`;
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} ratus${n % 100 ? ` ${terbilangLower(n % 100)}` : ''}`;
  return String(n);
};
export const terbilang = (v) => {
  const n = parseScore(v);
  return isFinite(n) ? terbilangLower(Math.round(n)).replace(/\b\w/g, (c) => c.toUpperCase()) : '';
};
const fmtNum = (n) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
const dash = (v) => (String(v ?? '').trim() ? String(v).trim() : '-');
const hari = (v) => { const n = Number(String(v ?? '').trim()); return n > 0 ? `${n} hari` : '-'; };

export async function generateRaporPdf({ student, period, umum = [], mulok = [], extras = [], aspek = {}, watermark }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setLineHeightFactor(1);

  const kelas = period.kelas;
  const isTK = kelas === 'TK';
  const SCHOOL = isTK ? SCHOOL_TK : SCHOOL_SD;
  const kepsek = SCHOOL.kepalaSekolah || ' '.repeat(28);
  const anak = isTK ? 'Anak Didik' : 'Peserta Didik';
  const kelasLabel = `${KELAS_ROMAWI[kelas] || kelas} (${KELAS_ANGKA_KATA[kelas] || ''})`.replace(' ()', '');
  const semesterLabel = String(period.semester) === '2' ? 'Genap' : 'Ganjil';
  const nisn = String(student.nisn || '').trim();
  const alamatSiswa = String(student.alamat || '').trim();
  const tahunMulai = String(period.tahunAjaran || '').split('/')[0] || String(new Date().getFullYear());
  const tglIdentitas = tglIndo(period.tanggalIdentitas) || `14 Juli ${tahunMulai}`;
  const tglRapor = tglIndo(period.tanggalRapor);
  const tempatRapor = String(period.tempatRapor || '').trim() || SCHOOL.kelurahan;

  // ---------- util gambar/teks ----------
  const font = (style = 'normal', size = 12) => { doc.setFont('times', style); doc.setFontSize(size); };
  const text = (s, x, y, o = {}) => doc.text(String(s), x, y - 0.5, { baseline: 'middle', ...o });
  const center = (s, x, y, style = 'normal', size = 12) => { font(style, size); text(s, x, y, { align: 'center' }); };
  const width = (s) => doc.getTextWidth(String(s));

  const watermarkPage = () => {
    if (!watermark) return;
    doc.setGState(new doc.GState({ opacity: 0.18 }));
    doc.addImage(watermark, watermark.startsWith('data:image/png') ? 'PNG' : 'JPEG', p(128), p(345), p(807), p(810));
    doc.setGState(new doc.GState({ opacity: 1 }));
  };
  let firstPage = true;
  const newPage = () => { if (!firstPage) doc.addPage(); firstPage = false; watermarkPage(); };

  const underlined = (s, x, y, style = 'bold', size = 12) => {
    font(style, size); text(s, x, y, { align: 'center' });
    const w = width(s);
    doc.setLineWidth(0.25); doc.setDrawColor(0); doc.line(x - w / 2, y + 1.8, x + w / 2, y + 1.8);
  };
  const dotted = (x1, x2, y) => {
    doc.setLineWidth(0.15); doc.setLineDashPattern([0.35, 0.45], 0); doc.line(x1, y, x2, y); doc.setLineDashPattern([], 0);
  };
  const cell = (x, y, w, h, fill) => {
    doc.setLineWidth(0.2); doc.setDrawColor(0);
    if (fill) { doc.setFillColor(...fill); doc.rect(x, y, w, h, 'FD'); } else doc.rect(x, y, w, h);
  };

  // Pembungkus teks ala Word: boleh putus setelah tanda hubung ("teman-" / "temannya"), per paragraf (\n).
  const tokenize = (str) => {
    const out = [];
    String(str).trim().split(/\s+/).filter(Boolean).forEach((word) => {
      (word.match(/[^-]+-+|[^-]+$|-+/g) || [word]).forEach((sg, i) => out.push({ t: sg, sp: i === 0 }));
    });
    return out;
  };
  const layout = (str, w) => {
    const res = [];
    String(str ?? '').split('\n').forEach((par) => {
      const toks = tokenize(par);
      if (!toks.length) { res.push({ ln: [], last: true }); return; }
      let cur = [], curW = 0;
      const flush = (last) => { if (cur.length) res.push({ ln: cur, last }); };
      toks.forEach((tk) => {
        const tw = width(tk.t), gap = cur.length && tk.sp ? width(' ') : 0;
        if (cur.length && curW + gap + tw > w + 0.001) { flush(false); cur = [{ ...tk, sp: false }]; curW = tw; }
        else { cur.push(tk); curW += gap + tw; }
      });
      flush(true);
    });
    return res;
  };
  const lineStr = (ln) => ln.map((tk, i) => (i && tk.sp ? ' ' : '') + tk.t).join('');
  const wrapStr = (str, w) => layout(str, w).map((o) => lineStr(o.ln));

  // Teks rata kiri-kanan (justify); baris terakhir tiap paragraf tetap rata kiri.
  const justified = (paragraph, x, yMid, w) => {
    const lines = layout(paragraph, w);
    lines.forEach((o, i) => {
      const yy = yMid + i * LH;
      const words = [];
      o.ln.forEach((tk, j) => { if (j && !tk.sp) words[words.length - 1] += tk.t; else words.push(tk.t); });
      if (o.last || words.length < 2) { text(lineStr(o.ln), x, yy); return; }
      const sum = words.reduce((a, wd) => a + width(wd), 0);
      const gap = (w - sum) / (words.length - 1);
      let cx = x;
      words.forEach((wd) => { text(wd, cx, yy); cx += width(wd) + gap; });
    });
    return lines.length;
  };
  const linesFor = (str, w) => (String(str || '').trim() ? layout(str, w).length : 0);

// ================= RAPOR TK — capaian perkembangan + catatan + pertumbuhan + ketidakhadiran + tanda tangan =================
  function buildTK() {
    newPage();
    raporHeader();
    const PAD = 2, PADV = 0.5;
    const TT = { x0: p(129), x1: p(180), x2: p(392), x3: p(935) };
    let ty = p(340);
    const head = () => {
      const h = p(36);
      [[TT.x0, TT.x1, 'No.'], [TT.x1, TT.x2, 'Aspek'], [TT.x2, TT.x3, 'Capaian Perkembangan']].forEach(([a, b, t]) => {
        cell(a, ty, b - a, h, GRAY); font('bold', 12); text(t, (a + b) / 2, ty + h / 2, { align: 'center' });
      });
      ty += h;
    };
    const breakPage = () => { doc.addPage(); watermarkPage(); ty = p(128); head(); };
    head();

    const contentW = TT.x3 - TT.x2 - 3.6;
    const nameW = TT.x2 - TT.x1 - PAD * 2;
    const headW = TT.x3 - TT.x0 - PAD * 2;
    let no = 0;
    TK_KELOMPOK.forEach(([key, label]) => {
      const items = (aspek[key] || []).filter((r) => String(r.aspek || '').trim() || String(r.deskripsi || '').trim());
      if (!items.length) return;
      font('bold', 12);
      const hl = wrapStr(label, headW);
      const GH = hl.length * LH + PADV * 2 + 1;
      const itemH = (r) => {
        font('normal', 12);
        const d = Math.max(linesFor(r.deskripsi, contentW), 1) * LH + PADV * 2;
        const n = linesFor(r.aspek, nameW) * LH + PADV * 2;
        return Math.max(d, n);
      };
      if (ty + GH + itemH(items[0]) > BOTTOM) breakPage();
      cell(TT.x0, ty, TT.x3 - TT.x0, GH, [235, 235, 235]);
      font('bold', 12);
      hl.forEach((ln, i) => text(ln, TT.x0 + PAD, ty + PADV + 0.5 + LH / 2 + i * LH));
      ty += GH;
      items.forEach((r) => {
        const h = itemH(r);
        if (ty + h > BOTTOM) breakPage();
        no += 1;
        cell(TT.x0, ty, TT.x1 - TT.x0, h); cell(TT.x1, ty, TT.x2 - TT.x1, h); cell(TT.x2, ty, TT.x3 - TT.x2, h);
        font('normal', 12);
        text(String(no) + '.', (TT.x0 + TT.x1) / 2, ty + h / 2, { align: 'center' });
        const nl = wrapStr(String(r.aspek || '').trim(), nameW);
        const ns = ty + h / 2 - (nl.length * LH) / 2 + LH / 2;
        nl.forEach((ln, i) => text(ln, TT.x1 + PAD, ns + i * LH));
        justified(String(r.deskripsi || '').trim() || '-', TT.x2 + 1.8, ty + PADV + LH / 2, contentW);
        ty += h;
      });
    });

    // ---- blok akhir: Catatan Guru, Ketidakhadiran, Diberikan di, tanda tangan ----
    const ROW = p(26);
    const CB = { x0: p(129), x1: p(935) };
    const catW = CB.x1 - CB.x0 - PAD * 2;
    font('normal', 12);
    const catLines = wrapStr(String(period.catatanWaliKelas || '').trim(), catW);
    const catHead = p(32), catBody = Math.max(catLines.length, 1) * LH + 1.5;
    const total = catHead + catBody + p(40) + ROW * 4 + p(44) + p(336);
    if (ty + p(40) + total > BOTTOM) { doc.addPage(); watermarkPage(); ty = p(128); } else ty += p(40);

    cell(CB.x0, ty, CB.x1 - CB.x0, catHead, GRAY);
    font('bold', 12); text('Catatan Guru', CB.x0 + PAD, ty + catHead / 2);
    ty += catHead;
    cell(CB.x0, ty, CB.x1 - CB.x0, catBody);
    font('normal', 12);
    catLines.forEach((ln, i) => text(ln, CB.x0 + PAD, ty + 0.75 + LH / 2 + i * LH));
    ty += catBody + p(40);

    const small = (x0, title, rows) => {
      const x1 = x0 + p(214), x2 = x0 + p(329);
      let yy = ty;
      cell(x0, yy, x2 - x0, ROW, GRAY); center(title, (x0 + x2) / 2, yy + ROW / 2, 'bold', 12);
      yy += ROW;
      rows.forEach(([lb, v]) => {
        cell(x0, yy, x1 - x0, ROW); cell(x1, yy, x2 - x1, ROW);
        font('normal', 12); text(lb, x0 + 1.5, yy + ROW / 2); text(v, (x1 + x2) / 2, yy + ROW / 2, { align: 'center' });
        yy += ROW;
      });
    };
    small(p(129), 'Ketidakhadiran', [['Sakit', hari(period.kehadiranSakit)], ['Izin', hari(period.kehadiranIzin)], ['Tanpa keterangan', hari(period.kehadiranAlpa)]]);
    ty += ROW * 4 + p(44);

    font('normal', 12);
    text('Diberikan di', p(578), ty); text(`: ${tempatRapor}`, p(707), ty);
    text('Tanggal', p(578), ty + p(25)); text(`: ${tglRapor}`, p(707), ty + p(25));
    const g2 = ty + p(88);
    center('Diketahui,', p(763), g2, 'normal', 12);
    const g3 = g2 + p(28);
    center('Orang Tua / Wali', p(239), g3, 'normal', 12);
    center('Guru Kelas', p(515), g3, 'normal', 12);
    center('Kepala Sekolah', p(763), g3, 'normal', 12);
    const g4 = g3 + p(121);
    font('bold', 12);
    wrapStr(String(student.nama_ayah || '').trim() || '-', p(150)).forEach((ln, i) => {
      center(ln, p(239), g4 + i * LH, 'bold', 12);
      if (i === 0) { const w = width(ln); doc.setLineWidth(0.25); doc.line(p(239) - w / 2, g4 + 1.8, p(239) + w / 2, g4 + 1.8); }
    });
    underlined(String(period.namaWaliKelas || '').trim() || '-', p(515), g4);
    underlined(kepsek, p(763), g4);
  }

  // ================= HALAMAN 1 — SAMPUL =================
  newPage();
  ['LAPORAN', isTK ? 'PERKEMBANGAN ANAK DIDIK' : 'HASIL CAPAIAN KOMPETENSI PESERTA DIDIK', SCHOOL.judul].forEach((t, i) => center(t, PAGE_W / 2, p(145 + i * 33.5), 'bold', 16));
  center(`Nama ${anak} :`, PAGE_W / 2, p(507), 'bold', 16);
  doc.setLineWidth(0.55); doc.setDrawColor(0);
  doc.rect(p(250), p(548), p(838 - 250), p(643 - 548));
  center(String(student.nama_siswa || '').toUpperCase(), PAGE_W / 2, p(605), 'bold', 16);
  center('NISN / NIS', PAGE_W / 2, p(737), 'bold', 16);
  doc.rect(p(250), p(775), p(838 - 250), p(871 - 775));
  center(nisn, PAGE_W / 2, p(823), 'bold', 16);
  [SCHOOL.yayasan, `KECAMATAN ${SCHOOL.kecamatan.toUpperCase()}`, `KABUPATEN ${SCHOOL.kabupaten.toUpperCase()}`]
    .forEach((t, i) => center(t, PAGE_W / 2, p(901 + i * 33), 'bold', 16));

  // ================= HALAMAN 2 — DATA SEKOLAH =================
  newPage();
  (isTK ? ['LAPORAN', 'PERKEMBANGAN ANAK DIDIK', 'TAMAN KANAK-KANAK'] : ['RAPORT', 'PESERTA DIDIK', 'SEKOLAH DASAR']).forEach((t, i) => center(t, PAGE_W / 2, p(143 + i * 28.5), 'bold', 14));
  [
    ['Nama Sekolah', SCHOOL.nama], ['NPSN', dash(SCHOOL.npsn)], ['NSS', dash(SCHOOL.nss)], ['Alamat Sekolah', SCHOOL.alamat],
    ['Kode Pos', SCHOOL.kodePos], ['Kelurahan/Desa', SCHOOL.kelurahan], ['Kecamatan', SCHOOL.kecamatan],
    ['Kabupaten', SCHOOL.kabupaten], ['Provinsi', SCHOOL.provinsi], ['Website', SCHOOL.website], ['Email', SCHOOL.email],
  ].forEach(([lb, val], i) => {
    const y = p(315 + i * 47);
    font('normal', 12);
    text(lb, p(176), y); text(':', p(445), y); text(val, p(499), y);
    dotted(p(489), p(899), y + p(12));
  });

  // ================= HALAMAN 3 — IDENTITAS PESERTA DIDIK =================
  newPage();
  center(`IDENTITAS ${anak.toUpperCase()}`, PAGE_W / 2, p(143), 'bold', 14);
  const tglLahir = tglIndo(student.tanggal_lahir);
  const ttl = [String(student.tempat_lahir || '').trim(), tglLahir].filter(Boolean).join(', ');
  const valX = p(567), valW = p(338);
  let y = p(232);
  const head = (n, label) => { font('normal', 12); text(n, p(165), y); text(label, p(216), y); y += p(25.4); };
  const row = (n, label, value, o = {}) => {
    font('normal', 12);
    if (n) text(n, p(165), y);
    text(label, o.sub ? p(216) : p(216), y);
    text(':', p(513), y);
    font('normal', 12);
    const lines = wrapStr(String(value || '').trim() || (o.blank ? '' : '-'), valW);
    lines.forEach((ln, i) => text(ln, valX, y + i * p(25)));
    const lastY = y + (lines.length - 1) * p(25);
    dotted(p(557), p(930), lastY + p(13));
    y = lastY + p(25.4);
  };
  row('1.', `Nama ${anak}`, student.nama_siswa);
  y += p(3.6);
  row('2.', 'NISN / NIS', nisn, { blank: true });
  row('3.', 'Tempat, Tanggal Lahir', ttl);
  row('4.', 'Jenis Kelamin', student.jenis_kelamin);
  row('5.', 'Agama', student.agama || 'Islam');
  row('6.', 'Pendidikan Sebelumnya', student.pendidikan_sebelumnya);
  row('7.', `Alamat ${anak}`, alamatSiswa);
  y += p(0.6);
  head('8', 'Nama Orang Tua');
  row('', 'a. Ayah', student.nama_ayah); row('', 'b. Ibu', student.nama_ibu);
  head('9.', 'Pekerjaan Orang Tua');
  row('', 'a. Ayah', student.pekerjaan_ayah); row('', 'b. Ibu', student.pekerjaan_ibu);
  head('10', 'Alamat Orang Tua');
  row('', 'Jalan', alamatSiswa);
  row('', 'Kelurahan/Desa', student.kelurahan); row('', 'Kecamatan', student.kecamatan);
  row('', 'Kabupaten/Kota', student.kabupaten); row('', 'Provinsi', student.provinsi);
  head('11.', `Wali ${anak}`);
  row('', 'a. Nama', student.nama_wali); row('', 'b. Pekerjaan', student.pekerjaan_wali); row('', 'c. Alamat', student.alamat_wali);

  const sigY = Math.max(y + p(60), p(947));
  doc.setLineWidth(0.2); doc.setDrawColor(0);
  doc.rect(p(461), sigY, p(613 - 461), p(204));
  center(`${SCHOOL.kabupaten}, ${tglIdentitas}`, p(785), sigY + p(21), 'normal', 12);
  center('Kepala Sekolah', p(785), sigY + p(49), 'normal', 12);
  underlined(kepsek, p(785), sigY + p(162));

  // ---------- kepala rapor (Nama, NISN, Sekolah, Alamat | Kelas, Fase, Semester, Tahun) ----------
  const raporHeader = () => {
    center(isTK ? 'LAPORAN PERKEMBANGAN ANAK DIDIK' : 'RAPOR DAN PROFIL PESERTA DIDIK', PAGE_W / 2, p(143), 'bold', 14);
    font('normal', 12);
    const L = [[`Nama ${anak}`, student.nama_siswa], ['NISN', dash(nisn)], ['Sekolah', SCHOOL.namaRapor], ['Alamat', SCHOOL.alamat]];
    const R = isTK
      ? [['Fase', 'Fondasi'], ['Semester', semesterLabel], ['Tahun Pelajaran', period.tahunAjaran]]
      : [['Kelas', kelasLabel], ['Fase', FASE[kelas] || '-'], ['Semester', semesterLabel], ['Tahun Pelajaran', period.tahunAjaran]];
    L.forEach(([a, b], i) => { const yy = p(195 + i * 24.5); text(a, p(138), yy); text(':', p(350), yy); text(b, p(373), yy); });
    R.forEach(([a, b], i) => { const yy = p(195 + i * 24.5); text(a, p(661), yy); text(':', p(845), yy); text(b, p(868), yy); });
    text(`Desa ${SCHOOL.kelurahan}`, p(373), p(293));
  };

  if (isTK) { buildTK(); return doc; }

  // ================= HALAMAN 4+ — RAPOR: MUATAN PELAJARAN =================
  newPage();
  raporHeader();
  const T = { x0: p(129), x1: p(180), x2: p(392), x3: p(495), x4: p(935) };
  const PAD = 2, PADV = 0.5;
  let ty = p(354);
  const tableHeader = () => {
    const h = p(50);
    cell(T.x0, ty, T.x1 - T.x0, h, GRAY); cell(T.x1, ty, T.x2 - T.x1, h, GRAY);
    cell(T.x2, ty, T.x3 - T.x2, h, GRAY); cell(T.x3, ty, T.x4 - T.x3, h, GRAY);
    font('bold', 12);
    text('No.', (T.x0 + T.x1) / 2, ty + h / 2, { align: 'center' });
    text('Muatan Pelajaran', (T.x1 + T.x2) / 2, ty + h / 2, { align: 'center' });
    text('Nilai', (T.x2 + T.x3) / 2, ty + h / 2 - 2.4, { align: 'center' });
    text('Akhir', (T.x2 + T.x3) / 2, ty + h / 2 + 2.4, { align: 'center' });
    text('Capaian Kompetensi', (T.x3 + T.x4) / 2, ty + h / 2, { align: 'center' });
    ty += h;
  };
  tableHeader();

  // kelompokkan mapel bersarang (baris berurutan dengan "induk" sama = 1 nomor)
  const groups = [];
  umum.forEach((r) => {
    const induk = String(r.induk || '').trim();
    const last = groups[groups.length - 1];
    if (induk && last && last.induk === induk) last.items.push(r); else groups.push({ induk, items: [r] });
  });

  const contentW = T.x4 - T.x3 - 3.6;
  const nameW = T.x2 - T.x1 - PAD * 2;
  const itemHeight = (r) => {
    font('normal', 12);
    const a = Math.max(linesFor(r.deskripsiCapaian, contentW), 1) * LH + PADV * 2;
    const b = String(r.capaianBimbingan || '').trim() ? linesFor(r.capaianBimbingan, contentW) * LH + PADV * 2 : 0;
    const nm = linesFor(r.mataPelajaran, nameW) * LH + PADV * 2;
    return { a, b, h: Math.max(a + b, nm) };
  };
  const GROUP_H = p(25);

  groups.forEach((g, gi) => {
    let segStart = ty;
    let numberDrawn = false;
    const closeNumberCell = () => {
      if (ty - segStart < 1) return;
      cell(T.x0, segStart, T.x1 - T.x0, ty - segStart);
      if (!numberDrawn) { font('normal', 12); text(`${gi + 1}.`, (T.x0 + T.x1) / 2, segStart + (ty - segStart) / 2, { align: 'center' }); numberDrawn = true; }
    };
    const ensure = (h) => {
      if (ty + h <= BOTTOM) return;
      closeNumberCell();
      doc.addPage(); watermarkPage(); ty = p(128); tableHeader(); segStart = ty;
    };

    if (g.induk) {
      ensure(GROUP_H + itemHeight(g.items[0]).h);
      cell(T.x1, ty, T.x4 - T.x1, GROUP_H);
      font('bold', 12); text(g.induk, T.x1 + PAD, ty + GROUP_H / 2);
      ty += GROUP_H;
    }
    g.items.forEach((r) => {
      const { a, b, h } = itemHeight(r);
      ensure(h);
      cell(T.x1, ty, T.x2 - T.x1, h); cell(T.x2, ty, T.x3 - T.x2, h);
      cell(T.x3, ty, T.x4 - T.x3, a + b === h ? a : h - b);
      font('normal', 12);
      const nl = wrapStr(String(r.mataPelajaran || '').trim(), nameW);
      const nStart = ty + h / 2 - (nl.length * LH) / 2 + LH / 2;
      nl.forEach((ln, i) => text(ln, T.x1 + PAD, nStart + i * LH));
      text(String(r.nilaiAngka || '').trim(), (T.x2 + T.x3) / 2, ty + h / 2, { align: 'center' });
      const capH = a + b === h ? a : h - b;
      justified(String(r.deskripsiCapaian || '').trim() || '-', T.x3 + 1.8, ty + PADV + LH / 2, contentW);
      if (b) {
        cell(T.x3, ty + capH, T.x4 - T.x3, b);
        justified(String(r.capaianBimbingan).trim(), T.x3 + 1.8, ty + capH + PADV + LH / 2, contentW);
      }
      ty += h;
    });
    closeNumberCell();
  });

  // ================= EKSTRAKURIKULER + KETIDAKHADIRAN + TANDA TANGAN =================
  const eks = extras.length >= 3 ? extras : [...extras, ...Array(3 - extras.length).fill(null)];
  const ROW = p(26);
  const eksH = ROW * (1 + eks.length);
  const absH = ROW * 4;
  const sigTotal = p(470 + 22);
  const blockH = eksH + p(49) + absH + p(118) + sigTotal;
  if (ty + p(30) + blockH > BOTTOM) { doc.addPage(); watermarkPage(); ty = p(128); } else ty += p(30);

  const E = { x0: p(129), x1: p(180), x2: p(393), x3: p(497), x4: p(935) };
  [[E.x0, E.x1], [E.x1, E.x2], [E.x2, E.x3], [E.x3, E.x4]].forEach(([a, b]) => cell(a, ty, b - a, ROW, GRAY));
  font('bold', 12);
  text('No.', (E.x0 + E.x1) / 2, ty + ROW / 2, { align: 'center' });
  text('Ekstrakurikuler', (E.x1 + E.x2) / 2, ty + ROW / 2, { align: 'center' });
  text('Predikat', (E.x2 + E.x3) / 2, ty + ROW / 2, { align: 'center' });
  text('Keterangan', (E.x3 + E.x4) / 2, ty + ROW / 2, { align: 'center' });
  ty += ROW;
  eks.forEach((r, i) => {
    [[E.x0, E.x1], [E.x1, E.x2], [E.x2, E.x3], [E.x3, E.x4]].forEach(([a, b]) => cell(a, ty, b - a, ROW));
    font('normal', 12);
    const yy = ty + ROW / 2;
    text(`${i + 1}.`, E.x0 + 1.5, yy);
    text(r ? dash(r.nama) : '-', E.x1 + 1.5, yy);
    text(r ? dash(r.predikat) : '-', (E.x2 + E.x3) / 2, yy, { align: 'center' });
    text(r ? dash(r.keterangan) : '-', (E.x3 + E.x4) / 2, yy, { align: 'center' });
    ty += ROW;
  });

  ty += p(49);
  const A = { x0: p(129), x1: p(343), x2: p(458) };
  cell(A.x0, ty, A.x2 - A.x0, ROW, GRAY);
  center('Ketidakhadiran', (A.x0 + A.x2) / 2, ty + ROW / 2, 'bold', 12);
  ty += ROW;
  [['Sakit', hari(period.kehadiranSakit)], ['Izin', hari(period.kehadiranIzin)], ['Tanpa keterangan', hari(period.kehadiranAlpa)]].forEach(([lb, v]) => {
    cell(A.x0, ty, A.x1 - A.x0, ROW); cell(A.x1, ty, A.x2 - A.x1, ROW);
    font('normal', 12); text(lb, A.x0 + 1.5, ty + ROW / 2); text(v, (A.x1 + A.x2) / 2, ty + ROW / 2, { align: 'center' });
    ty += ROW;
  });

  const s0 = ty + p(118);
  const tglTtd = `${SCHOOL.kabupaten}, ${tglRapor}`;
  center('Mengetahui,', p(259), s0, 'normal', 12); center('Orang Tua / Wali', p(259), s0 + p(28), 'normal', 12);
  center(tglTtd, p(755), s0, 'normal', 12); center('Wali Kelas', p(755), s0 + p(28), 'normal', 12);
  underlined(String(student.nama_ayah || '').trim() || '-', p(259), s0 + p(149));
  underlined(String(period.namaWaliKelas || '').trim() || '-', p(755), s0 + p(149));
  center('Mengetahui,', p(515), s0 + p(275), 'normal', 12); center('Kepala Sekolah', p(515), s0 + p(303), 'normal', 12);
  underlined(kepsek, p(515), s0 + p(470));

  // ================= HALAMAN AKHIR — MUATAN LOKAL SEKOLAH =================
  doc.addPage(); watermarkPage();
  raporHeader();
  const M = { x0: p(129), x1: p(199), x2: p(492), x3: p(596), x4: p(969) };
  let my = p(354);
  const H1 = p(66), H2 = p(27), MR = p(25.6);
  cell(M.x0, my, M.x1 - M.x0, H1 + H2, GRAY);
  cell(M.x1, my, M.x2 - M.x1, H1, GRAY);
  cell(M.x2, my, M.x4 - M.x2, H1, GRAY);
  font('bold', 12);
  text('No.', (M.x0 + M.x1) / 2, my + p(14), { align: 'center' });
  text('Muatan Lokal', (M.x1 + M.x2) / 2, my + p(14), { align: 'center' });
  text(SCHOOL.namaRapor, (M.x1 + M.x2) / 2, my + p(39), { align: 'center' });
  text('Nilai', (M.x2 + M.x4) / 2, my + p(14), { align: 'center' });
  my += H1;
  cell(M.x1, my, M.x2 - M.x1, H2, GRAY); cell(M.x2, my, M.x3 - M.x2, H2, GRAY); cell(M.x3, my, M.x4 - M.x3, H2, GRAY);
  text('Bidang Ilmu', M.x1 + PAD, my + H2 / 2);
  text('Angka', (M.x2 + M.x3) / 2, my + H2 / 2, { align: 'center' });
  text('Huruf', (M.x3 + M.x4) / 2, my + H2 / 2, { align: 'center' });
  my += H2;

  mulok.forEach((r, i) => {
    [[M.x0, M.x1], [M.x1, M.x2], [M.x2, M.x3], [M.x3, M.x4]].forEach(([a, b]) => cell(a, my, b - a, MR));
    font('normal', 12);
    const yy = my + MR / 2;
    text(`${i + 1}.`, (M.x0 + M.x1) / 2, yy, { align: 'center' });
    text(dash(r.mataPelajaran), M.x1 + PAD, yy);
    text(dash(r.nilaiAngka), (M.x2 + M.x3) / 2, yy, { align: 'center' });
    text(String(r.nilaiAngka || '').trim() ? terbilang(r.nilaiAngka) : '-', M.x3 + PAD, yy);
    my += MR;
  });
  const scores = mulok.map((r) => r.nilaiAngka).filter((v) => String(v ?? '').trim() !== '' && isFinite(parseScore(v))).map(parseScore);
  const jumlah = scores.reduce((a, b) => a + b, 0);
  const jumlahTxt = scores.length ? fmtNum(jumlah) : '-';
  const rataTxt = scores.length ? fmtNum(jumlah / scores.length) : '-';
  [['Jumlah Nilai', jumlahTxt, true], ['Rata-Rata', rataTxt, true], ['Peringkat', String(period.peringkat || '').trim(), false]].forEach(([lb, v, split]) => {
    cell(M.x0, my, M.x2 - M.x0, MR);
    if (split) { cell(M.x2, my, M.x3 - M.x2, MR); cell(M.x3, my, M.x4 - M.x3, MR); } else cell(M.x2, my, M.x4 - M.x2, MR);
    font('normal', 12);
    text(lb, M.x0 + PAD, my + MR / 2);
    text(v, split ? (M.x2 + M.x3) / 2 : (M.x2 + M.x4) / 2, my + MR / 2, { align: 'center' });
    my += MR;
  });

  // Catatan Guru
  my += p(44);
  const CB = { x0: p(129), x1: p(967) };
  const catW = CB.x1 - CB.x0 - PAD * 2;
  font('normal', 12);
  const catLines = wrapStr(String(period.catatanWaliKelas || '').trim(), catW);
  const catHead = p(32), catBody = Math.max(catLines.length, 1) * LH + 1.5;
  cell(CB.x0, my, CB.x1 - CB.x0, catHead, GRAY);
  font('bold', 12); text('Catatan Guru', CB.x0 + PAD, my + catHead / 2);
  my += catHead;
  cell(CB.x0, my, CB.x1 - CB.x0, catBody);
  font('normal', 12);
  catLines.forEach((ln, i) => text(ln, CB.x0 + PAD, my + 0.75 + LH / 2 + i * LH));
  my += catBody;

  // Diberikan di / Tanggal
  let gy = my + p(99);
  font('normal', 12);
  text('Diberikan di', p(578), gy); text(`: ${tempatRapor}`, p(707), gy);
  text('Tanggal', p(578), gy + p(25)); text(`: ${tglRapor}`, p(707), gy + p(25));
  const g2 = gy + p(88);
  center('Diketahui,', p(763), g2, 'normal', 12);
  const g3 = g2 + p(28);
  center('Orang Tua / Wali', p(239), g3, 'normal', 12);
  center(`Wali Kelas ${KELAS_ROMAWI[kelas] || ''}`.trim(), p(515), g3, 'normal', 12);
  center('Kepala Sekolah', p(763), g3, 'normal', 12);
  const g4 = g3 + p(121);
  const ortu = String(student.nama_ayah || '').trim() || '-';
  font('bold', 12);
  const ortuLines = wrapStr(ortu, p(150));
  ortuLines.forEach((ln, i) => {
    center(ln, p(239), g4 + i * LH, 'bold', 12);
    if (i === 0) { const w = width(ln); doc.setLineWidth(0.25); doc.line(p(239) - w / 2, g4 + 1.8, p(239) + w / 2, g4 + 1.8); }
  });
  underlined(String(period.namaWaliKelas || '').trim() || '-', p(515), g4);
  underlined(kepsek, p(763), g4);

  return doc;
}

export const raporFileName = (student, period) =>
  `Rapor_${String(student.nama_siswa || 'siswa').replace(/[^\w]+/g, '_')}_${period.kelas.replace(/\s+/g, '')}_Smt${period.semester}_${String(period.tahunAjaran || '').replace('/', '-')}.pdf`;
