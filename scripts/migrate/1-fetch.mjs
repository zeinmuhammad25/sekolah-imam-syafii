// Tahap 1: ambil snapshot data LIVE dari Google Sheets (lewat Apps Script yang sedang
// jalan) dan simpan ke dump.json. HANYA MEMBACA — tidak ada tulis apa pun ke Sheets.
// dump.json ini juga berguna sebagai cadangan tambahan di luar Sheets itu sendiri.
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gsheetSrc = readFileSync(join(__dirname, '../../src/services/gsheet.js'), 'utf8');
const m = gsheetSrc.match(/const API_URL = '([^']+)'/);
if (!m) throw new Error('Tidak menemukan API_URL di src/services/gsheet.js');
const API_URL = m[1];

console.log('Mengambil data dari:', API_URL);
const res = await fetch(API_URL);
if (!res.ok) throw new Error('Fetch gagal: HTTP ' + res.status);
const data = await res.json();

const outPath = join(__dirname, 'dump.json');
writeFileSync(outPath, JSON.stringify(data, null, 2));

console.log('Tersimpan ke', outPath);
for (const key of Object.keys(data)) {
  const v = data[key];
  console.log(' -', key, Array.isArray(v) ? `${v.length} baris` : typeof v);
}
