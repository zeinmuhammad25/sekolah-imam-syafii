// Generator PDF & Desain Kartu Pelajar (ID Card) Siswa 1 Sisi (TK & SD)
// Ukuran Standar ISO CR-80 (54 mm x 85.6 mm) dengan QR Code Presensi & Pas Foto Melingkar
// Plek ketiplek sesuai desain fisik resmi (SD: Kubah Emas & Menara, TK: Ceria Gradasi & Awan)

export const CARD_WIDTH = 54; // mm
export const CARD_HEIGHT = 85.6; // mm
export const CARD_RADIUS = 3.5; // mm

// Konfigurasi Resmi Sekolah Imam Syafi'i
export const SCHOOL_INFO = {
  yayasan: 'YAYASAN NASHIRUS SUNNAH PERCUT',
  sd: {
    nama: 'SD ISLAM IMAM SYAFI’I',
    npsn: '70059421',
    kepalaSekolah: 'Muhammad Khaidir, S.Pd.',
    logo: '/avatars/logo.png',
  },
  tk: {
    nama: 'TK QUR’AN IMAM SYAFI’I',
    npsn: '-',
    kepalaSekolah: 'Ustadzah Pembina TK',
    logo: '/avatars/logo-tk.png',
  },
  alamat: 'Jl. Lembaga Dusun II, Tanjung Rejo, Percut Sei Tuan, Deli Serdang',
};

// Helper: Fetch gambar ke Base64 Data URL (CORS safe)
async function fetchImageAsDataUrl(url, fallbackUrl = '') {
  if (!url && !fallbackUrl) return null;
  const target = url || fallbackUrl;
  try {
    const res = await fetch(target);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    if (typeof document !== 'undefined') {
      return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 300;
            canvas.height = img.naturalHeight || img.height || 400;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const pngDataUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(objectUrl);
            resolve(pngDataUrl);
          } catch (e) {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          if (fallbackUrl && target !== fallbackUrl) {
            fetchImageAsDataUrl(fallbackUrl).then(resolve);
          } else {
            resolve(null);
          }
        };
        img.src = objectUrl;
      });
    }

    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch (err) {
    if (fallbackUrl && target !== fallbackUrl) {
      return fetchImageAsDataUrl(fallbackUrl);
    }
    return null;
  }
}

// Helper: Potong foto siswa menjadi lingkaran sempurna (Circular Crop PNG) dengan anti-aliasing
export async function fetchCircularImageAsDataUrl(url, fallbackUrl = '') {
  if (!url && !fallbackUrl) return null;
  const target = url || fallbackUrl;
  try {
    const res = await fetch(target);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    if (typeof document !== 'undefined') {
      return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          try {
            const size = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height) || 400;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Lingkaran clipping
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            // Cover crop di tengah
            const sw = img.naturalWidth || img.width;
            const sh = img.naturalHeight || img.height;
            const sx = (sw - size) / 2;
            const sy = (sh - size) / 2;
            ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), size, size, 0, 0, size, size);

            const pngDataUrl = canvas.toDataURL('image/png');
            URL.revokeObjectURL(objectUrl);
            resolve(pngDataUrl);
          } catch (e) {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          if (fallbackUrl && target !== fallbackUrl) {
            fetchCircularImageAsDataUrl(fallbackUrl).then(resolve);
          } else {
            resolve(null);
          }
        };
        img.src = objectUrl;
      });
    }

    return await fetchImageAsDataUrl(url, fallbackUrl);
  } catch (err) {
    if (fallbackUrl && target !== fallbackUrl) {
      return fetchCircularImageAsDataUrl(fallbackUrl);
    }
    return null;
  }
}

// Generate QR Code presensi berbasis QR data URL
// Menggunakan payload ringkas (NISN / ID siswa) agar modul QR berukuran besar (Version 1, 21x21)
// Hasilnya: 10x lebih cepat terdeteksi kamera, tahan blur, dan sangat mudah di-scan dari layar HP lain
export async function generateStudentQrCode(student) {
  try {
    const QRCode = (await import('qrcode')).default;
    // Prioritaskan NISN resmi atau ID siswa (string pendek 6-10 digit)
    const payload = String(student.nisn || student.nis || student.id || '').trim();

    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('generateStudentQrCode error:', err);
    return null;
  }
}

// Cache latar belakang beresolusi tinggi agar proses batch super cepat
let cachedSdBg = null;
let cachedTkBg = null;

// ==================== GENERATOR BACKGROUND SD ====================
// Desain: Deep Emerald, Islamic Arabesque Watermark, Mihrab Arch Emas, Menara Masjid Sudut Bawah
export function getSdCardBackgroundDataUrl() {
  if (cachedSdBg) return cachedSdBg;
  if (typeof document === 'undefined') return null;

  const w = 540;
  const h = 856;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 1. Base Gradient Deep Emerald
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#064e3b');   // Deep Emerald
  bgGrad.addColorStop(0.5, '#022c22'); // Forest Night
  bgGrad.addColorStop(1, '#011c15');   // Dark Forest
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Motif Arabesque / Islamic Watermark Pattern di separuh atas
  ctx.save();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.16)'; // Aksen emas lembut
  ctx.lineWidth = 1.2;
  const grid = 36;
  for (let x = -grid; x < w + grid; x += grid) {
    for (let y = -grid; y < 460; y += grid) {
      ctx.beginPath();
      ctx.moveTo(x + grid / 2, y);
      ctx.lineTo(x + grid, y + grid / 2);
      ctx.lineTo(x + grid / 2, y + grid);
      ctx.lineTo(x, y + grid / 2);
      ctx.closePath();
      ctx.stroke();

      // Lingkaran mini di titik tengah intan
      ctx.beginPath();
      ctx.arc(x + grid / 2, y + grid / 2, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
      ctx.fill();
    }
  }
  ctx.restore();

  // 3. Mihrab Arch Emas (Kubah Islami Lancip di Atas)
  ctx.save();
  const archGrad = ctx.createLinearGradient(0, 40, 0, 430);
  archGrad.addColorStop(0, '#fef08a'); // Emas Terang
  archGrad.addColorStop(0.3, '#f59e0b'); // Emas Hangat
  archGrad.addColorStop(0.7, '#d97706'); // Emas Kuningan
  archGrad.addColorStop(1, '#b45309');   // Emas Gelap

  // Outline Luar Arch
  ctx.strokeStyle = archGrad;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(28, 430);
  ctx.lineTo(28, 260);
  ctx.bezierCurveTo(28, 140, 150, 70, 270, 45); // Sisi kiri melengkung ke puncak
  ctx.bezierCurveTo(390, 70, 512, 140, 512, 260); // Puncak ke sisi kanan
  ctx.lineTo(512, 430);
  ctx.stroke();

  // Outline Dalam Arch (Double line tipis)
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(38, 430);
  ctx.lineTo(38, 265);
  ctx.bezierCurveTo(38, 155, 155, 85, 270, 62);
  ctx.bezierCurveTo(385, 85, 502, 155, 502, 265);
  ctx.lineTo(502, 430);
  ctx.stroke();
  ctx.restore();

  // 4. Menara & Kubah Masjid Sudut Bawah (Kiri & Kanan)
  const drawMosqueMinaret = (bx, isRight = false) => {
    ctx.save();
    ctx.translate(bx, h);
    if (isRight) ctx.scale(-1, 1);

    const gold = ctx.createLinearGradient(0, -150, 0, 0);
    gold.addColorStop(0, '#fef08a');
    gold.addColorStop(0.4, '#f59e0b');
    gold.addColorStop(0.9, '#b45309');
    ctx.fillStyle = gold;

    // Kubah Utama
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -65);
    ctx.bezierCurveTo(15, -75, 45, -110, 55, -135); // Puncak kubah lancip
    ctx.bezierCurveTo(65, -110, 95, -75, 110, -65);
    ctx.lineTo(110, 0);
    ctx.closePath();
    ctx.fill();

    // Ujung Bulan Sabit / Kubah Tip
    ctx.beginPath();
    ctx.arc(55, -145, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();

    // Jendela Melengkung Kubah
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(55, -45, 10, Math.PI, 0, false);
    ctx.lineTo(65, -15);
    ctx.lineTo(45, -15);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  drawMosqueMinaret(0, false);   // Menara Kiri
  drawMosqueMinaret(w, true);    // Menara Kanan

  // 5. Pita Emas Melengkung di Bawah (Pemisah / Dasar Kubah)
  ctx.save();
  const ribbonGrad = ctx.createLinearGradient(0, 0, w, 0);
  ribbonGrad.addColorStop(0, '#b45309');
  ribbonGrad.addColorStop(0.5, '#fbbf24');
  ribbonGrad.addColorStop(1, '#b45309');
  ctx.fillStyle = ribbonGrad;
  ctx.beginPath();
  ctx.moveTo(0, h - 30);
  ctx.quadraticCurveTo(w / 2, h - 70, w, h - 30);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 6. Indikator Lubang Tali ID Card di Tengah Atas (Lanyard Punch Hole)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(w / 2 - 38, 14, 76, 22, 11);
  ctx.stroke();
  ctx.restore();

  cachedSdBg = canvas.toDataURL('image/png');
  return cachedSdBg;
}

// ==================== GENERATOR BACKGROUND TK ====================
// Desain: Gradasi Hijau Muda ke Kuning Ceria, Awan Kartun Putih, Bintang Kuning, Daun, Gelombang Rumput Bawah
export function getTkCardBackgroundDataUrl() {
  if (cachedTkBg) return cachedTkBg;
  if (typeof document === 'undefined') return null;

  const w = 540;
  const h = 856;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 1. Base Gradient Ceria: Hijau Muda -> Kuning Hangat
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h * 0.85);
  bgGrad.addColorStop(0, '#84cc16');    // Lime Green Cerah
  bgGrad.addColorStop(0.4, '#a3e635');  // Light Lime
  bgGrad.addColorStop(0.7, '#facc15');  // Sunny Yellow
  bgGrad.addColorStop(1, '#fde047');    // Bright Sun Yellow
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Helper Gambar Awan Kartun Putih Fluffy
  const drawCloud = (cx, cy, scale = 1) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 30 * scale, cy + 5 * scale, 22 * scale, 0, Math.PI * 2);
    ctx.arc(cx, cy - 10 * scale, 30 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 30 * scale, cy + 5 * scale, 22 * scale, 0, Math.PI * 2);
    ctx.arc(cx - 15 * scale, cy + 12 * scale, 20 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 15 * scale, cy + 12 * scale, 20 * scale, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // 2. Awan-Awan Dekoratif
  drawCloud(85, 125, 0.9);   // Awan Kiri Atas
  drawCloud(490, 380, 0.95); // Awan Kanan Tengah
  drawCloud(60, 520, 1.0);   // Awan Kiri Tengah

  // Helper Gambar Bintang 4 Titik
  const drawStar = (cx, cy, r, color = '#facc15') => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx, cy, cx + r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + r);
    ctx.quadraticCurveTo(cx, cy, cx - r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // 3. Bintang-Bintang Ceria
  drawStar(470, 150, 24, '#fde047'); // Bintang Kanan Atas Besar
  drawStar(55, 385, 16, '#ffffff');  // Bintang Putih Kiri
  drawStar(490, 630, 20, '#15803d'); // Bintang Aksen Bawah
  drawStar(65, 625, 16, '#ca8a04');  // Bintang Aksen Kiri Bawah

  // Helper Gambar Daun Kartun
  const drawLeaf = (cx, cy, angle, scale = 1) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.fillStyle = '#15803d'; // Hijau Daun
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(15 * scale, -10 * scale, 25 * scale, 0);
    ctx.quadraticCurveTo(15 * scale, 10 * scale, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Daun-daun kecil melayang
  drawLeaf(480, 70, -25, 1.1);
  drawLeaf(430, 105, 45, 0.9);
  drawLeaf(500, 230, -60, 1.0);
  drawLeaf(480, 280, 30, 0.8);
  drawLeaf(48, 470, -40, 0.9);

  // 4. Gelombang Rumput Hijau Tua di Bagian Bawah
  ctx.save();
  ctx.fillStyle = '#16a34a'; // Gelombang hijau tengah
  ctx.beginPath();
  ctx.moveTo(0, h - 85);
  ctx.bezierCurveTo(140, h - 130, 360, h - 60, w, h - 110);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#15803d'; // Gelombang hijau tua depan
  ctx.beginPath();
  ctx.moveTo(0, h - 70);
  ctx.bezierCurveTo(180, h - 50, 340, h - 120, w, h - 75);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Daun hias di pojok bawah gelombang rumput
  drawLeaf(45, h - 45, 40, 1.2);
  drawLeaf(500, h - 50, -40, 1.2);
  drawLeaf(470, h - 80, -20, 0.9);

  // 5. Indikator Lubang Tali ID Card di Tengah Atas
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(w / 2 - 38, 14, 76, 22, 11);
  ctx.stroke();
  ctx.restore();

  cachedTkBg = canvas.toDataURL('image/png');
  return cachedTkBg;
}

// Helper gambar garis putus-putus untuk gunting / potong kartu
function drawCutGuidelines(doc, x, y, w, h) {
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([2, 2], 0);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.setLineDashPattern([], 0);
}

// ==================== DRAW KARTU DEPAN (1:1 PLEK KETIPLEK FOTO ASLI) ====================
export async function drawCardFront(doc, student, ox, oy, isTk = false) {
  const cfg = isTk ? SCHOOL_INFO.tk : SCHOOL_INFO.sd;
  const isAkhwat = String(student.jenis_kelamin || '').toLowerCase().includes('p');
  const fallbackAvatar = isAkhwat ? '/avatars/akhwat.webp' : '/avatars/ikhwan.webp';

  // 1. Gambar Latar Belakang Kartu Resolusi Tinggi
  const bgDataUrl = isTk ? getTkCardBackgroundDataUrl() : getSdCardBackgroundDataUrl();
  if (bgDataUrl) {
    try {
      doc.addImage(bgDataUrl, 'PNG', ox, oy, CARD_WIDTH, CARD_HEIGHT);
    } catch (e) {
      console.warn('Gagal load canvas background:', e);
    }
  } else {
    // Fallback solid jika tanpa canvas
    doc.setFillColor(isTk ? 132 : 6, isTk ? 204 : 78, isTk ? 22 : 59);
    doc.roundedRect(ox, oy, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, CARD_RADIUS, 'F');
  }

  // 2. Logo Bulat Sekolah di Bagian Atas (Diberi jarak aman dari lubang gantungan atas)
  const logoData = await fetchImageAsDataUrl(cfg.logo);
  const logoSize = isTk ? 12.2 : 11.6;
  const logoX = ox + (CARD_WIDTH - logoSize) / 2;
  const logoY = oy + 7.2;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn('Gagal render logo sekolah:', e);
    }
  }

  // 3. Header Text: KARTU PELAJAR & NAMA SEKOLAH
  doc.setFont('helvetica', 'bold');
  if (isTk) {
    // TK: KARTU PELAJAR Kuning Emas, TK QUR'AN Putih
    doc.setTextColor(202, 138, 4); // Golden Amber #ca8a04
    doc.setFontSize(7.6);
    doc.text('KARTU PELAJAR', ox + CARD_WIDTH / 2, oy + 22, { align: 'center' });

    doc.setTextColor(255, 255, 255); // Putih Bersih
    doc.setFontSize(7.2);
    doc.text('TK QUR\'AN IMAM SYAFI\'I', ox + CARD_WIDTH / 2, oy + 26, { align: 'center' });
  } else {
    // SD: KARTU PELAJAR Putih, SD ISLAM Kuning Emas
    doc.setTextColor(255, 255, 255); // Putih Bersih
    doc.setFontSize(7.6);
    doc.text('KARTU PELAJAR', ox + CARD_WIDTH / 2, oy + 22, { align: 'center' });

    doc.setTextColor(251, 191, 36); // Emas Terang #fbbf24
    doc.setFontSize(7.2);
    doc.text('SD ISLAM IMAM SYAFI\'I', ox + CARD_WIDTH / 2, oy + 26, { align: 'center' });
  }

  // 4. Pas Foto Siswa Bulat (Circular Photo Frame)
  const photoSize = 22; // Diameter 22 mm
  const photoRadius = photoSize / 2;
  const photoCenterX = ox + CARD_WIDTH / 2;
  const photoCenterY = oy + 39.5;
  const photoX = photoCenterX - photoRadius;
  const photoY = photoCenterY - photoRadius;

  // Render Foto Siswa Terpotong Lingkaran Sempurna
  const circularPhotoData = await fetchCircularImageAsDataUrl(student.foto_siswa, fallbackAvatar);
  if (circularPhotoData) {
    try {
      doc.addImage(circularPhotoData, 'PNG', photoX, photoY, photoSize, photoSize);
    } catch (e) {
      console.warn('Gagal render circular photo:', e);
    }
  }

  // Ring Bingkai Emas / Hijau di Sekeliling Foto
  if (isTk) {
    // TK: Ring Hijau Tua & Aksen Putih
    doc.setDrawColor(21, 128, 61); // Grass Dark Green
    doc.setLineWidth(1.1);
    doc.circle(photoCenterX, photoCenterY, photoRadius + 0.4, 'S');

    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.4);
    doc.circle(photoCenterX, photoCenterY, photoRadius - 0.2, 'S');
  } else {
    // SD: Double Ring Emas Megah
    doc.setDrawColor(217, 119, 6); // Warm Gold
    doc.setLineWidth(1.1);
    doc.circle(photoCenterX, photoCenterY, photoRadius + 0.6, 'S');

    doc.setDrawColor(251, 191, 36); // Bright Gold
    doc.setLineWidth(0.5);
    doc.circle(photoCenterX, photoCenterY, photoRadius - 0.1, 'S');
  }

  // 5. Data Identitas Siswa
  const studentName = String(student.nama_siswa || 'NAMA SISWA').toUpperCase();
  doc.setFont('helvetica', 'bold');

  if (isTk) {
    // TK di foto asli: NAMA : [NAMA SISWA]
    doc.setTextColor(6, 78, 59); // Forest Dark Green
    let nameSize = 6.8;
    if (studentName.length > 24) nameSize = 5.6;
    else if (studentName.length > 18) nameSize = 6.2;
    doc.setFontSize(nameSize);

    // Diletakkan rapi di tengah / sedikit indent
    doc.text(`NAMA  :  ${studentName}`, ox + CARD_WIDTH / 2, oy + 55, {
      align: 'center',
      maxWidth: CARD_WIDTH - 8,
    });
  } else {
    // SD di foto asli:
    // NAMA : [NAMA SISWA]
    // NISN : [NISN SISWA]
    doc.setTextColor(255, 255, 255); // Putih Bersih
    let nameSize = 6.4;
    if (studentName.length > 24) nameSize = 5.2;
    else if (studentName.length > 18) nameSize = 5.8;

    const dataLeftX = ox + 8.5;
    doc.setFontSize(nameSize);
    doc.text('NAMA', dataLeftX, oy + 54.5);
    doc.text(':', dataLeftX + 9.5, oy + 54.5);
    doc.text(studentName, dataLeftX + 11.5, oy + 54.5, { maxWidth: 32 });

    const nisnVal = student.nisn || student.nis || student.id || '-';
    doc.setFontSize(6.4);
    doc.text('NISN', dataLeftX, oy + 58.5);
    doc.text(':', dataLeftX + 9.5, oy + 58.5);
    doc.text(String(nisnVal), dataLeftX + 11.5, oy + 58.5);
  }

  // 6. Kotak Putih Rounded Berisi QR Code Presensi
  const qrBoxW = 20.5;
  const qrBoxH = 17.5;
  const qrBoxX = ox + (CARD_WIDTH - qrBoxW) / 2;
  const qrBoxY = oy + 61.2;

  // Kotak Putih Bersih
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 2.2, 2.2, 'F');

  // Gambar QR Code
  const qrDataUrl = await generateStudentQrCode(student);
  const qrSize = 13;
  const qrX = ox + (CARD_WIDTH - qrSize) / 2;
  const qrY = qrBoxY + 1.2;
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.warn('Gagal render QR Code:', e);
    }
  }

  // Nomor di Bawah QR Code (Dalam Kotak Putih)
  const idOrNisn = isTk
    ? String(student.nis || student.id || '242501001')
    : String(student.nisn || student.nis || student.id || '20240987');
  doc.setTextColor(0, 0, 0); // Hitam Pekat
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.text(idOrNisn, ox + CARD_WIDTH / 2, qrBoxY + 16, { align: 'center' });

  // 7. Teks SCAN UNTUK ABSENSI di Paling Bawah
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  if (isTk) {
    doc.setTextColor(255, 255, 255); // Putih Bersih di atas gelombang hijau
  } else {
    doc.setTextColor(251, 191, 36); // Emas Kuning Cerah di atas pita kubah
  }
  doc.text('SCAN UNTUK ABSENSI', ox + CARD_WIDTH / 2, oy + 82.8, { align: 'center' });
}

// ==================== CETAK SATUAN (SINGLE CARD PDF 1 HALAMAN) ====================
// Sesuai instruksi: Halaman belakang tidak perlu ada karena akan polos saja.
export async function generateSingleCardPdf(student, isTkOverride = null) {
  const { jsPDF } = await import('jspdf');
  const isTk = isTkOverride !== null ? isTkOverride : String(student.kelas || '').toUpperCase().includes('TK');

  // Halaman 1 Saja (Single Sided ISO CR-80: 54 x 85.6 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [CARD_WIDTH, CARD_HEIGHT],
  });

  await drawCardFront(doc, student, 0, 0, isTk);

  const cleanName = String(student.nama_siswa || 'siswa').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`ID_Card_${cleanName}_${student.kelas || 'SD'}.pdf`);
  return doc;
}

// ==================== CETAK MASSAL A4 (10 KARTU PER LEMBAR A4) ====================
// A4 Landscape: 297 mm x 210 mm
// Grid 5 Kolom x 2 Baris = Tepat 10 Kartu per Halaman!
// Dilengkapi garis potong putus-putus untuk memudahkan pemotongan lurus dengan gunting / paper cutter.
export async function generateBatchA4Pdf(students, targetKelas = 'Semua', isTkOverride = null) {
  const { jsPDF } = await import('jspdf');
  if (!Array.isArray(students) || students.length === 0) {
    throw new Error('Daftar siswa kosong.');
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const cardsPerPage = 10; // 5 kolom x 2 baris
  const cols = 5;
  const rows = 2;

  // Perhitungan Presisi Margin Lembar A4 Landscape (297 x 210 mm)
  const totalGridW = cols * CARD_WIDTH;  // 5 * 54 = 270 mm
  const totalGridH = rows * CARD_HEIGHT; // 2 * 85.6 = 171.2 mm
  const marginX = (297 - totalGridW) / 2; // 13.5 mm (Kiri & Kanan seimbang)
  const marginY = (210 - totalGridH) / 2; // 19.4 mm (Atas & Bawah seimbang)

  for (let idx = 0; idx < students.length; idx++) {
    const student = students[idx];
    const isTk = isTkOverride !== null ? isTkOverride : String(student.kelas || targetKelas || '').toUpperCase().includes('TK');
    const posInPage = idx % cardsPerPage;

    if (idx > 0 && posInPage === 0) {
      doc.addPage('a4', 'landscape');
    }

    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);

    const x = marginX + col * CARD_WIDTH;
    const y = marginY + row * CARD_HEIGHT;

    // 1. Gambar Garis Potong (Cutting Line) di sekeliling kartu
    drawCutGuidelines(doc, x, y, CARD_WIDTH, CARD_HEIGHT);

    // 2. Gambar Sisi Depan Kartu
    await drawCardFront(doc, student, x, y, isTk);
  }

  const cleanGrade = String(targetKelas || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`ID_Cards_A4_10_Kartu_${cleanGrade}_${students.length}_Siswa.pdf`);
  return doc;
}

// Alias untuk menjaga backward compatibility
export const generateBatchA4FoldPdf = generateBatchA4Pdf;
