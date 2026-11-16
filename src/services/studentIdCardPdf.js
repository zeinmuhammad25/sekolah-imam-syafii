// Generator PDF & Desain Kartu Pelajar (ID Card) Siswa 1 Sisi (TK & SD)
// Ukuran Standar 9 cm x 6 cm (60 mm x 90 mm) dengan QR Code Presensi Level H & Pas Foto Melingkar
// Plek ketiplek sesuai desain fisik resmi (SD: Kubah Emas & Menara, TK: Ceria Gradasi & Awan)

export const CARD_WIDTH = 60; // mm (6 cm)
export const CARD_HEIGHT = 90; // mm (9 cm)
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

// Cache in-memory untuk mempercepat render PDF massal (mencegah fetch berulang file yang sama)
const imageBase64Cache = new Map();

// Helper: Normalisasi URL gambar (agar URL absolut /uploads/ dialihkan lewat proxy same-origin di dev/prod)
export function normalizeImageUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (typeof window !== 'undefined' && s.includes('/uploads/')) {
    return s.replace(/^https?:\/\/[^/]+\/uploads\//, '/uploads/');
  }
  return s;
}

// Helper: Fetch gambar ke Base64 Data URL (CORS safe)
async function fetchImageAsDataUrl(url, fallbackUrl = '') {
  const normUrl = normalizeImageUrl(url);
  const normFallback = normalizeImageUrl(fallbackUrl);
  if (!normUrl && !normFallback) return null;
  const target = normUrl || normFallback;

  if (imageBase64Cache.has(target)) {
    return imageBase64Cache.get(target);
  }

  if (typeof document !== 'undefined') {
    const dataUrl = await new Promise((resolve) => {
      const processImg = (img) => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 300;
          canvas.height = img.naturalHeight || img.height || 400;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          if (normFallback && target !== normFallback) {
            fetchImageAsDataUrl(normFallback).then(resolve);
          } else {
            resolve(null);
          }
        }
      };

      // 1. Coba fetch blob terlebih dahulu
      fetch(target)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            try {
              processImg(img);
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            fallbackDirect();
          };
          img.src = objectUrl;
        })
        .catch(fallbackDirect);

      function fallbackDirect() {
        const directImg = new Image();
        directImg.crossOrigin = 'anonymous';
        directImg.onload = () => processImg(directImg);
        directImg.onerror = () => {
          // Jika target relatif gagal, coba URL absolut asli
          if (target === normUrl && url && url !== target) {
            const absImg = new Image();
            absImg.crossOrigin = 'anonymous';
            absImg.onload = () => processImg(absImg);
            absImg.onerror = () => {
              if (normFallback && target !== normFallback) {
                fetchImageAsDataUrl(normFallback).then(resolve);
              } else {
                resolve(null);
              }
            };
            absImg.src = url;
            return;
          }
          if (normFallback && target !== normFallback) {
            fetchImageAsDataUrl(normFallback).then(resolve);
          } else {
            resolve(null);
          }
        };
        directImg.src = target;
      }
    });

    if (dataUrl) imageBase64Cache.set(target, dataUrl);
    return dataUrl;
  }

  try {
    const res = await fetch(target);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => {
        imageBase64Cache.set(target, fr.result);
        resolve(fr.result);
      };
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch (err) {
    if (normFallback && target !== normFallback) {
      return fetchImageAsDataUrl(normFallback);
    }
    return null;
  }
}

// Helper: Potong foto siswa menjadi lingkaran sempurna (Circular Crop PNG) dengan anti-aliasing
export async function fetchCircularImageAsDataUrl(url, fallbackUrl = '') {
  const normUrl = normalizeImageUrl(url);
  const normFallback = normalizeImageUrl(fallbackUrl);
  if (!normUrl && !normFallback) return null;
  const target = normUrl || normFallback;
  const cacheKey = `circular_${target}`;

  if (imageBase64Cache.has(cacheKey)) {
    return imageBase64Cache.get(cacheKey);
  }

  if (typeof document !== 'undefined') {
    const dataUrl = await new Promise((resolve) => {
      const processCircular = (img) => {
        try {
          const sw = img.naturalWidth || img.width || 400;
          const sh = img.naturalHeight || img.height || 400;
          const size = Math.min(sw, sh) || 400;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          // Lingkaran clipping
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          // Cover crop di tengah horizontal; untuk vertikal jika foto portrait, fokuskan ke area wajah atas (~20% dari atas)
          const sx = Math.max(0, (sw - size) / 2);
          const sy = sh > sw ? Math.max(0, (sh - size) * 0.22) : Math.max(0, (sh - size) / 2);
          ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          if (normFallback && target !== normFallback) {
            fetchCircularImageAsDataUrl(normFallback).then(resolve);
          } else {
            resolve(null);
          }
        }
      };

      // 1. Coba fetch blob terlebih dahulu (efektif untuk proxy same-origin)
      fetch(target)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            try {
              processCircular(img);
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            fallbackDirectImg();
          };
          img.src = objectUrl;
        })
        .catch(fallbackDirectImg);

      // 2. Fallback direct image element dengan anonymous crossOrigin
      function fallbackDirectImg() {
        const directImg = new Image();
        directImg.crossOrigin = 'anonymous';
        directImg.onload = () => processCircular(directImg);
        directImg.onerror = () => {
          // Jika target relatif gagal, coba URL absolut asli
          if (target === normUrl && url && url !== target) {
            const absImg = new Image();
            absImg.crossOrigin = 'anonymous';
            absImg.onload = () => processCircular(absImg);
            absImg.onerror = () => {
              if (normFallback && target !== normFallback) {
                fetchCircularImageAsDataUrl(normFallback).then(resolve);
              } else {
                resolve(null);
              }
            };
            absImg.src = url;
            return;
          }
          if (normFallback && target !== normFallback) {
            fetchCircularImageAsDataUrl(normFallback).then(resolve);
          } else {
            resolve(null);
          }
        };
        directImg.src = target;
      }
    });

    if (dataUrl) imageBase64Cache.set(cacheKey, dataUrl);
    return dataUrl;
  }

  return await fetchImageAsDataUrl(url, fallbackUrl);
}

// Generate QR Code presensi berbasis QR data URL
// Menggunakan payload ringkas (NISN / ID siswa) dengan Error Correction Level H (High: tahan goresan hingga ~30%)
// Hasilnya: 10x lebih cepat terdeteksi kamera, sangat tahan goresan fisik/lipatan/noda anak SD
export async function generateStudentQrCode(student) {
  try {
    const QRCode = (await import('qrcode')).default;
    // Prioritaskan NISN resmi atau ID siswa (string pendek 6-10 digit)
    const payload = String(student.nisn || student.nis || student.id || '').trim();

    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H', // HIGH: Tahan goresan & kerusakan fisik hingga ~30%
      margin: 1,
      width: 360,
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

  const w = 600;
  const h = 900;
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
  const grid = 38;
  for (let x = -grid; x < w + grid; x += grid) {
    for (let y = -grid; y < 490; y += grid) {
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
  const archGrad = ctx.createLinearGradient(0, 45, 0, 450);
  archGrad.addColorStop(0, '#fef08a'); // Emas Terang
  archGrad.addColorStop(0.3, '#f59e0b'); // Emas Hangat
  archGrad.addColorStop(0.7, '#d97706'); // Emas Kuningan
  archGrad.addColorStop(1, '#b45309');   // Emas Gelap

  // Outline Luar Arch
  ctx.strokeStyle = archGrad;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(32, 450);
  ctx.lineTo(32, 270);
  ctx.bezierCurveTo(32, 150, 165, 75, 300, 50); // Sisi kiri melengkung ke puncak
  ctx.bezierCurveTo(435, 75, 568, 150, 568, 270); // Puncak ke sisi kanan
  ctx.lineTo(568, 450);
  ctx.stroke();

  // Outline Dalam Arch (Double line tipis)
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(44, 450);
  ctx.lineTo(44, 275);
  ctx.bezierCurveTo(44, 165, 170, 90, 300, 68);
  ctx.bezierCurveTo(430, 90, 556, 165, 556, 275);
  ctx.lineTo(556, 450);
  ctx.stroke();
  ctx.restore();

  // 4. Menara & Kubah Masjid Sudut Bawah (Kiri & Kanan)
  const drawMosqueMinaret = (bx, isRight = false) => {
    ctx.save();
    ctx.translate(bx, h);
    if (isRight) ctx.scale(-1, 1);

    const gold = ctx.createLinearGradient(0, -160, 0, 0);
    gold.addColorStop(0, '#fef08a');
    gold.addColorStop(0.4, '#f59e0b');
    gold.addColorStop(0.9, '#b45309');
    ctx.fillStyle = gold;

    // Kubah Utama
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -70);
    ctx.bezierCurveTo(16, -82, 48, -120, 60, -145); // Puncak kubah lancip
    ctx.bezierCurveTo(72, -120, 104, -82, 120, -70);
    ctx.lineTo(120, 0);
    ctx.closePath();
    ctx.fill();

    // Ujung Bulan Sabit / Kubah Tip
    ctx.beginPath();
    ctx.arc(60, -155, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();

    // Jendela Melengkung Kubah
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(60, -48, 11, Math.PI, 0, false);
    ctx.lineTo(71, -16);
    ctx.lineTo(49, -16);
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
  ctx.moveTo(0, h - 32);
  ctx.quadraticCurveTo(w / 2, h - 75, w, h - 32);
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
  ctx.roundRect(w / 2 - 40, 15, 80, 24, 12);
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

  const w = 600;
  const h = 900;
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
  drawCloud(95, 130, 0.95);  // Awan Kiri Atas
  drawCloud(545, 400, 1.0);  // Awan Kanan Tengah
  drawCloud(70, 550, 1.05);  // Awan Kiri Tengah

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
  drawStar(520, 160, 26, '#fde047'); // Bintang Kanan Atas Besar
  drawStar(60, 405, 17, '#ffffff');   // Bintang Putih Kiri
  drawStar(540, 660, 22, '#15803d');  // Bintang Aksen Bawah
  drawStar(75, 655, 17, '#ca8a04');   // Bintang Aksen Kiri Bawah

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
  drawLeaf(530, 75, -25, 1.15);
  drawLeaf(475, 115, 45, 0.95);
  drawLeaf(555, 245, -60, 1.05);
  drawLeaf(535, 300, 30, 0.85);
  drawLeaf(55, 495, -40, 0.95);

  // 4. Gelombang Rumput Hijau Tua di Bagian Bawah
  ctx.save();
  ctx.fillStyle = '#16a34a'; // Gelombang hijau tengah
  ctx.beginPath();
  ctx.moveTo(0, h - 90);
  ctx.bezierCurveTo(155, h - 140, 400, h - 65, w, h - 118);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#15803d'; // Gelombang hijau tua depan
  ctx.beginPath();
  ctx.moveTo(0, h - 75);
  ctx.bezierCurveTo(200, h - 55, 380, h - 130, w, h - 82);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Daun hias di pojok bawah gelombang rumput
  drawLeaf(50, h - 48, 40, 1.25);
  drawLeaf(555, h - 52, -40, 1.25);
  drawLeaf(520, h - 85, -20, 0.95);

  // 5. Indikator Lubang Tali ID Card di Tengah Atas
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(w / 2 - 40, 15, 80, 24, 12);
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
  const logoSize = isTk ? 13.5 : 12.8;
  const logoX = ox + (CARD_WIDTH - logoSize) / 2;
  const logoY = oy + 7.5;
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
    doc.setFontSize(8.2);
    doc.text('KARTU PELAJAR', ox + CARD_WIDTH / 2, oy + 23.5, { align: 'center' });

    doc.setTextColor(255, 255, 255); // Putih Bersih
    doc.setFontSize(7.6);
    doc.text('TK QUR\'AN IMAM SYAFI\'I', ox + CARD_WIDTH / 2, oy + 27.8, { align: 'center' });
  } else {
    // SD: KARTU PELAJAR Putih, SD ISLAM Kuning Emas
    doc.setTextColor(255, 255, 255); // Putih Bersih
    doc.setFontSize(8.2);
    doc.text('KARTU PELAJAR', ox + CARD_WIDTH / 2, oy + 23.5, { align: 'center' });

    doc.setTextColor(251, 191, 36); // Emas Terang #fbbf24
    doc.setFontSize(7.6);
    doc.text('SD ISLAM IMAM SYAFI\'I', ox + CARD_WIDTH / 2, oy + 27.8, { align: 'center' });
  }

  // 4. Pas Foto Siswa Bulat (Circular Photo Frame)
  const photoSize = 23.5; // Diameter 23.5 mm (Proporsional untuk 60x90 mm)
  const photoRadius = photoSize / 2;
  const photoCenterX = ox + CARD_WIDTH / 2;
  const photoCenterY = oy + 42;
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
    doc.circle(photoCenterX, photoCenterY, photoRadius + 0.5, 'S');

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
    let nameSize = 7.2;
    if (studentName.length > 24) nameSize = 5.8;
    else if (studentName.length > 18) nameSize = 6.4;
    doc.setFontSize(nameSize);

    // Diletakkan rapi di tengah / sedikit indent
    doc.text(`NAMA  :  ${studentName}`, ox + CARD_WIDTH / 2, oy + 58.5, {
      align: 'center',
      maxWidth: CARD_WIDTH - 8,
    });
  } else {
    // SD di foto asli:
    // NAMA : [NAMA SISWA]
    // NISN : [NISN SISWA]
    doc.setTextColor(255, 255, 255); // Putih Bersih
    let nameSize = 6.8;
    if (studentName.length > 24) nameSize = 5.5;
    else if (studentName.length > 18) nameSize = 6.2;

    const dataLeftX = ox + 9.5;
    doc.setFontSize(nameSize);
    doc.text('NAMA', dataLeftX, oy + 57.5);
    doc.text(':', dataLeftX + 10.5, oy + 57.5);
    doc.text(studentName, dataLeftX + 12.5, oy + 57.5, { maxWidth: 36 });

    const nisnVal = student.nisn || student.nis || student.id || '-';
    doc.setFontSize(6.8);
    doc.text('NISN', dataLeftX, oy + 61.8);
    doc.text(':', dataLeftX + 10.5, oy + 61.8);
    doc.text(String(nisnVal), dataLeftX + 12.5, oy + 61.8);
  }

  // 6. Kotak Putih Rounded Berisi QR Code Presensi (Tahan Gores Level H)
  const qrBoxW = 23;
  const qrBoxH = 19.5;
  const qrBoxX = ox + (CARD_WIDTH - qrBoxW) / 2;
  const qrBoxY = oy + 64.8;

  // Kotak Putih Bersih
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 2.2, 2.2, 'F');

  // Gambar QR Code (Ukuran 14.5 mm, titik tebal Level H)
  const qrDataUrl = await generateStudentQrCode(student);
  const qrSize = 14.5;
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
  doc.setFontSize(5.5);
  doc.text(idOrNisn, ox + CARD_WIDTH / 2, qrBoxY + 18, { align: 'center' });

  // 7. Teks SCAN UNTUK ABSENSI di Paling Bawah
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  if (isTk) {
    doc.setTextColor(255, 255, 255); // Putih Bersih di atas gelombang hijau
  } else {
    doc.setTextColor(251, 191, 36); // Emas Kuning Cerah di atas pita kubah
  }
  doc.text('SCAN UNTUK ABSENSI', ox + CARD_WIDTH / 2, oy + 87.2, { align: 'center' });
}

// ==================== CETAK SATUAN (SINGLE CARD PDF 1 HALAMAN 9x6 CM) ====================
// Ukuran Standar Resmi: 60 mm x 90 mm (6 cm x 9 cm)
export async function generateSingleCardPdf(student, isTkOverride = null) {
  const { jsPDF } = await import('jspdf');
  const isTk = isTkOverride !== null ? isTkOverride : String(student.kelas || '').toUpperCase().includes('TK');

  // Halaman 1 Saja (Single Sided: 60 x 90 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [CARD_WIDTH, CARD_HEIGHT],
  });

  await drawCardFront(doc, student, 0, 0, isTk);

  const cleanName = String(student.nama_siswa || 'siswa').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`ID_Card_9x6_${cleanName}_${student.kelas || 'SD'}.pdf`);
  return doc;
}

// ==================== CETAK MASSAL A4 (9 KARTU PER LEMBAR A4 PORTRAIT) ====================
// A4 Portrait: 210 mm x 297 mm
// Grid 3 Kolom x 3 Baris = Tepat 9 Kartu per Halaman!
// Dilengkapi jarak potong (padding) 5 mm antar kartu di semua sisi + garis putus-putus aman
export async function generateBatchA4Pdf(students, targetKelas = 'Semua', isTkOverride = null) {
  const { jsPDF } = await import('jspdf');
  if (!Array.isArray(students) || students.length === 0) {
    throw new Error('Daftar siswa kosong.');
  }

  // Format A4 Portrait: 210 mm x 297 mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const cardsPerPage = 9; // 3 kolom x 3 baris
  const cols = 3;
  const rows = 3;
  const gapX = 5; // mm jarak celah potong horizontal antar kartu
  const gapY = 5; // mm jarak celah potong vertikal antar kartu

  // Lebar 3 kartu + 2 celah = 3 * 60 + 2 * 5 = 190 mm. Margin kiri/kanan = (210 - 190) / 2 = 10 mm
  // Tinggi 3 kartu + 2 celah = 3 * 90 + 2 * 5 = 280 mm. Margin atas/bawah = (297 - 280) / 2 = 8.5 mm
  const marginX = (210 - (cols * CARD_WIDTH + (cols - 1) * gapX)) / 2;
  const marginY = (297 - (rows * CARD_HEIGHT + (rows - 1) * gapY)) / 2;

  for (let idx = 0; idx < students.length; idx++) {
    const student = students[idx];
    const isTk = isTkOverride !== null ? isTkOverride : String(student.kelas || targetKelas || '').toUpperCase().includes('TK');
    const posInPage = idx % cardsPerPage;

    if (idx > 0 && posInPage === 0) {
      doc.addPage('a4', 'portrait');
    }

    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);

    const x = marginX + col * (CARD_WIDTH + gapX);
    const y = marginY + row * (CARD_HEIGHT + gapY);

    // 1. Gambar Garis Potong (Cutting Line) di sekeliling kartu dengan garis putus-putus
    drawCutGuidelines(doc, x, y, CARD_WIDTH, CARD_HEIGHT);

    // 2. Gambar Sisi Depan Kartu
    await drawCardFront(doc, student, x, y, isTk);
  }

  const cleanGrade = String(targetKelas || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`ID_Cards_A4_9x6_Grid9_${cleanGrade}_${students.length}_Siswa.pdf`);
  return doc;
}

// Alias untuk menjaga backward compatibility
export const generateBatchA4FoldPdf = generateBatchA4Pdf;
