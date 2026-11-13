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

export function exportStudentAttendancePdf({
  studentSummary = [],
  startDate = '',
  endDate = '',
  selectedGrade = 'Semua Kelas',
  stats = { totalRecords: 0, totalHadir: 0, totalSakit: 0, totalIzin: 0, totalAlpha: 0, totalBelumAbsen: 0, rate: 0 },
}) {
  const isSingleDay = startDate === endDate;
  const doc = new jsPDF({
    orientation: isSingleDay ? 'portrait' : 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // ==================== 1. KOP SURAT RESMI SEKOLAH ====================
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('YAYASAN NASHIRUS SUNNAH PERCUT', pageWidth / 2, 13, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(6, 95, 70); // Emerald Forest
  doc.text('TK & SD ISLAM IMAM SYAFI’I', pageWidth / 2, 19, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Alamat: Jalan Lembaga Dusun II, Kelurahan Tanjung Rejo, Kecamatan Percut Sei Tuan, Deli Serdang - 20371',
    pageWidth / 2,
    23.5,
    { align: 'center' }
  );
  doc.text(
    'Email: nashirussunnahpercut@gmail.com | NPSN SD: 70059421 | NPSN TK: 70015344',
    pageWidth / 2,
    27,
    { align: 'center' }
  );

  // Garis Kop Ganda
  doc.setLineWidth(0.8);
  doc.setDrawColor(6, 95, 70);
  doc.line(14, 29.5, pageWidth - 14, 29.5);

  doc.setLineWidth(0.2);
  doc.setDrawColor(100, 116, 139);
  doc.line(14, 30.5, pageWidth - 14, 30.5);

  // ==================== 2. JUDUL LAPORAN & INFORMASI FILTER ====================
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const judulLaporan = isSingleDay
    ? 'LAPORAN PRESENSI HARIAN SANTRI'
    : 'LAPORAN REKAPITULASI PRESENSI SANTRI';
  doc.text(judulLaporan, pageWidth / 2, 38, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  const periodeText = isSingleDay
    ? `Hari / Tanggal: ${formatTanggalIndo(startDate)}`
    : `Periode: ${formatTanggalIndo(startDate)} s/d ${formatTanggalIndo(endDate)}`;
  const kelasText = `Jenjang / Kelas: ${selectedGrade}`;

  doc.text(periodeText, 14, 44);
  doc.text(kelasText, pageWidth - 14, 44, { align: 'right' });

  // Ringkasan Statistik
  let ringkasanText = `Total Santri: ${studentSummary.length}  |  Hadir: ${stats.totalHadir}  |  Sakit: ${stats.totalSakit}  |  Izin: ${stats.totalIzin}  |  Alpha: ${stats.totalAlpha}`;
  if (isSingleDay) {
    ringkasanText += `  |  Belum Scan: ${stats.totalBelumAbsen}`;
  }
  ringkasanText += `  |  Kehadiran: ${stats.rate}%`;

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(ringkasanText, 14, 49);

  // ==================== 3. TABEL DATA PRESENSI (AUTOTABLE) ====================
  let headCols = [];
  let bodyRows = [];
  let colStyles = {};

  if (isSingleDay) {
    headCols = ['No', 'NISN / NIS', 'Nama Santri', 'Kelas', 'Status Hari Ini', 'Jam Scan', 'Metode'];
    bodyRows = studentSummary.map((s, idx) => {
      let statusStr = 'BELUM SCAN';
      if (s.statusHariIni === 'hadir') statusStr = 'HADIR';
      else if (s.statusHariIni === 'sakit') statusStr = 'SAKIT';
      else if (s.statusHariIni === 'izin') statusStr = 'IZIN';
      else if (s.statusHariIni === 'alpha') statusStr = 'ALPHA';

      const jamStr = s.scanTime ? s.scanTime.slice(0, 5) : '-';
      const metodeStr = s.method === 'qr_scan' ? 'QR Code' : s.method ? 'Manual Guru' : '-';

      return [
        idx + 1,
        s.nisn && s.nisn !== '-' ? s.nisn : '-',
        s.nama,
        s.kelas,
        statusStr,
        jamStr,
        metodeStr,
      ];
    });

    colStyles = {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'left', cellWidth: 64 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'center' },
    };
  } else {
    headCols = ['No', 'NISN / NIS', 'Nama Santri', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Total Hari', '% Hadir'];
    bodyRows = studentSummary.map((s, idx) => {
      const rate = s.total > 0 ? `${Math.round((s.hadir / s.total) * 100)}%` : '0%';
      return [
        idx + 1,
        s.nisn && s.nisn !== '-' ? s.nisn : '-',
        s.nama,
        s.kelas,
        s.hadir,
        s.sakit,
        s.izin,
        s.alpha,
        s.total,
        rate,
      ];
    });

    colStyles = {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 28 },
      2: { halign: 'left', cellWidth: 72 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 24 },
      9: { halign: 'center', cellWidth: 22 },
    };
  }

  autoTable(doc, {
    startY: 53,
    head: [headCols],
    body: bodyRows,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 95, 70], // Emerald Forest
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
    },
    columnStyles: colStyles,
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${data.pageNumber} dari ${pageCount}  •  Dicetak Sistem Presensi Sekolah Islam Imam Syafi'i: ${new Date().toLocaleString('id-ID')}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 7,
        { align: 'center' }
      );
    },
  });

  // ==================== 4. LEMBAR TANDA TANGAN KEPALA SEKOLAH (TK & SD) ====================
  const finalY = doc.lastAutoTable.finalY + 8;
  const pageHeight = doc.internal.pageSize.getHeight();

  if (finalY + 38 > pageHeight) {
    doc.addPage();
  }

  const signY = finalY + 38 > pageHeight ? 18 : finalY;
  const signX_TK = isSingleDay ? 55 : 65;
  const signX_SD = isSingleDay ? pageWidth - 55 : pageWidth - 65;

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  const tglCetak = formatTanggalIndo(new Date().toISOString().slice(0, 10));

  doc.text(`Deli Serdang, ${tglCetak}`, signX_SD, signY, { align: 'center' });

  doc.text('Kepala Sekolah TK Islam Imam Syafi’i,', signX_TK, signY + 5, { align: 'center' });
  doc.text('Kepala Sekolah SD Islam Imam Syafi’i,', signX_SD, signY + 5, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.text('Abdul Rahman, S.Hum.', signX_TK, signY + 23, { align: 'center' });
  const nameWidthTK = doc.getTextWidth('Abdul Rahman, S.Hum.');
  doc.setLineWidth(0.3);
  doc.setDrawColor(30, 41, 59);
  doc.line(signX_TK - nameWidthTK / 2, signY + 24.5, signX_TK + nameWidthTK / 2, signY + 24.5);

  doc.text('Muhammad Khaidir, S.Pd.', signX_SD, signY + 23, { align: 'center' });
  const nameWidthSD = doc.getTextWidth('Muhammad Khaidir, S.Pd.');
  doc.line(signX_SD - nameWidthSD / 2, signY + 24.5, signX_SD + nameWidthSD / 2, signY + 24.5);

  doc.setFont('times', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('NIP: ', signX_TK - nameWidthTK / 2, signY + 28.5);
  doc.text('NIP: ', signX_SD - nameWidthSD / 2, signY + 28.5);

  // Simpan / Unduh Dokumen PDF
  const cleanGrade = selectedGrade.replace(/\s+/g, '_');
  const cleanStart = startDate.replace(/-/g, '');
  const cleanEnd = endDate.replace(/-/g, '');
  const fileName = isSingleDay
    ? `Rekap_Presensi_Siswa_${cleanGrade}_${cleanStart}.pdf`
    : `Rekap_Presensi_Siswa_${cleanGrade}_${cleanStart}_sd_${cleanEnd}.pdf`;

  doc.save(fileName);
}
