import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const BULAN_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = parts[0];
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  return `${d} ${BULAN_INDO[m] || ''} ${y}`;
}

export function exportAttendancePdf({
  attendances = [],
  startDate = '',
  endDate = '',
  teacherName = 'Semua Guru',
  stats = { total: 0, tepatWaktu: 0, terlambat: 0, izinSakitDinas: 0, pulangCepat: 0 },
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // ==================== 1. KOP SURAT RESMI SEKOLAH ====================
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('YAYASAN NASHIRUS SUNNAH PERCUT', pageWidth / 2, 13, { align: 'center' });

  doc.setFontSize(15);
  doc.setTextColor(6, 95, 70); // Emerald Forest
  doc.text('TK & SD ISLAM IMAM SYAFI’I', pageWidth / 2, 19, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Alamat: Jalan Lembaga Dusun II, Kelurahan Tanjung Rejo, Kecamatan Percut Sei Tuan, Deli Serdang - 20371',
    pageWidth / 2,
    24,
    { align: 'center' }
  );
  doc.text(
    'Email: nashirussunnahpercut@gmail.com | NPSN SD: 70059421 | NPSN TK: 70015344',
    pageWidth / 2,
    28,
    { align: 'center' }
  );

  // Garis Kop Ganda
  doc.setLineWidth(0.8);
  doc.setDrawColor(6, 95, 70);
  doc.line(14, 31, pageWidth - 14, 31);

  doc.setLineWidth(0.2);
  doc.setDrawColor(100, 116, 139);
  doc.line(14, 32, pageWidth - 14, 32);
  doc.setDrawColor(100, 116, 139);
  doc.line(14, 33, pageWidth - 14, 33);

  // ==================== 2. JUDUL LAPORAN & INFORMASI FILTER ====================
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN REKAPITULASI PRESENSI GURU & PEGAWAI', pageWidth / 2, 41, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  const periodeText = `Periode: ${formatTanggalIndo(startDate)} s/d ${formatTanggalIndo(endDate)}`;
  const guruText = `Guru: ${teacherName}`;

  doc.text(periodeText, 14, 48);
  doc.text(guruText, pageWidth - 14, 48, { align: 'right' });

  // Ringkasan Statistik
  const tidakTapText = stats.tidakTapPulang ? `  |  Tidak Tap Pulang: ${stats.tidakTapPulang}` : '';
  const ringkasanText = `Ringkasan: Hadir: ${stats.hadirTotal || (stats.tepatWaktu || 0) + (stats.terlambat || 0)}  |  Tepat Waktu: ${stats.tepatWaktu || 0}  |  Terlambat: ${stats.terlambat || 0}${tidakTapText}  |  Izin/Sakit: ${stats.izinSakitDinas || 0}  |  Alpha: ${stats.alpha || 0}`;
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(ringkasanText, 14, 53);

  // ==================== 3. TABEL DATA PRESENSI (AUTOTABLE) ====================
  const tableData = attendances.map((item, idx) => {
    const isLate = item.check_in_status === 'terlambat';
    const isEarly = item.check_out_status === 'pulang_cepat' || (item.early_minutes && Number(item.early_minutes) > 0);
    const isMissingOut = item.status === 'hadir' && Boolean(item.check_in_time) && !item.check_out_time;

    const statusMasuk = item.check_in_time
      ? isLate
        ? `Telat (${item.late_minutes || 0}m)`
        : 'Tepat Waktu'
      : '-';

    const statusPulang = item.check_out_time
      ? isEarly
        ? `Cepat (${item.early_minutes || 0}m)`
        : 'Tepat Waktu (OK)'
      : isMissingOut
      ? 'Tidak Tap Pulang'
      : '-';

    const jamPulang = item.check_out_time
      ? item.check_out_time.slice(0, 5)
      : isMissingOut
      ? 'Tidak Tap'
      : '-';

    const noteText = isMissingOut
      ? (item.notes ? `[Tidak tap pulang] ${item.notes}` : 'Tidak melakukan presensi pulang')
      : (item.notes || '-');

    return [
      idx + 1,
      item.date || '-',
      item.teacher_name || '-',
      (item.status || 'hadir').replace(/_/g, ' ').toUpperCase(),
      item.check_in_time ? item.check_in_time.slice(0, 5) : '-',
      statusMasuk,
      jamPulang,
      statusPulang,
      noteText,
    ];
  });

  autoTable(doc, {
    startY: 57,
    head: [[
      'No', 'Tanggal', 'Nama Guru', 'Status',
      'Jam Masuk', 'Ket. Masuk', 'Jam Pulang', 'Ket. Pulang', 'Catatan'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 95, 70], // Emerald Forest
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5,
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'left', cellWidth: 55 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 28 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 32 },
      8: { halign: 'left' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer Nomor Halaman
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${data.pageNumber} dari ${pageCount}  •  Dicetak pada: ${new Date().toLocaleString('id-ID')}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    },
  });

  // ==================== 4. LEMBAR TANDA TANGAN KEPALA SEKOLAH (TK & SD) ====================
  const finalY = doc.lastAutoTable.finalY + 10;
  const pageHeight = doc.internal.pageSize.getHeight();

  // Jika sisa ruang di halaman kurang dari 42mm, tambah halaman baru untuk tanda tangan
  if (finalY + 42 > pageHeight) {
    doc.addPage();
  }

  const signY = finalY + 42 > pageHeight ? 20 : finalY;
  const signX_TK = 65;               // Kolom Tanda Tangan Kiri (TK)
  const signX_SD = pageWidth - 65;   // Kolom Tanda Tangan Kanan (SD)

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  const tglCetak = formatTanggalIndo(new Date().toISOString().slice(0, 10));

  // Tanggal Dokumen di Kanan Atas
  doc.text(`Deli Serdang, ${tglCetak}`, signX_SD, signY, { align: 'center' });

  // Jabatan Kedua Kepala Sekolah
  doc.text('Kepala Sekolah TK Islam Imam Syafi’i,', signX_TK, signY + 6, { align: 'center' });
  doc.text('Kepala Sekolah SD Islam Imam Syafi’i,', signX_SD, signY + 6, { align: 'center' });

  // Nama Kepala Sekolah TK (Abdul Rahman, S.Hum)
  doc.setFont('times', 'bold');
  doc.text('Abdul Rahman, S.Hum.', signX_TK, signY + 28, { align: 'center' });
  const nameWidthTK = doc.getTextWidth('Abdul Rahman, S.Hum.');
  doc.setLineWidth(0.3);
  doc.setDrawColor(30, 41, 59);
  doc.line(signX_TK - nameWidthTK / 2, signY + 29.5, signX_TK + nameWidthTK / 2, signY + 29.5);

  // Nama Kepala Sekolah SD (Muhammad Khaidir, S.Pd.)
  doc.text('Muhammad Khaidir, S.Pd.', signX_SD, signY + 28, { align: 'center' });
  const nameWidthSD = doc.getTextWidth('Muhammad Khaidir, S.Pd.');
  doc.line(signX_SD - nameWidthSD / 2, signY + 29.5, signX_SD + nameWidthSD / 2, signY + 29.5);

  // Label NIP (Rata kiri sejajar dengan awal garis nama agar pas untuk pengisian nomor NIP)
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('NIP: ', signX_TK - nameWidthTK / 2, signY + 34);
  doc.text('NIP: ', signX_SD - nameWidthSD / 2, signY + 34);

  // Simpan / Unduh Dokumen PDF
  const cleanStart = startDate.replace(/-/g, '');
  const cleanEnd = endDate.replace(/-/g, '');
  const cleanName = teacherName.replace(/[^\w]/g, '_');
  const fileName = `Rekap_Presensi_${cleanName}_${cleanStart}_sd_${cleanEnd}.pdf`;

  doc.save(fileName);
}

