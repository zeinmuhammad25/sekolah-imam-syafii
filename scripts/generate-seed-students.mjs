import { writeFileSync } from 'node:fs';

const studentsData = [
  // Kelas 1 (SD 1)
  { nis: '260032', nama: 'ABIZAR RAMADHAN', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260033', nama: 'AIDIE ARKA JAYA HASIBUAN', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260034', nama: 'AIMAN NUR HADI', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260035', nama: 'ALIF IBRAHIM ALKAHFI', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260036', nama: 'ALIYAH KHAIRANI', jk: 'Perempuan', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260037', nama: 'ALYA FAUZIA RAFIFA', jk: 'Perempuan', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260038', nama: 'FAQIH ABDURRAHMAN', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260039', nama: 'HAFSAH HUNAIFA MANIK', jk: 'Perempuan', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260040', nama: 'HAFSHOH NAURA HANIFAH', jk: 'Perempuan', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260041', nama: 'HANA AHANTI RAHILLA', jk: 'Perempuan', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260042', nama: 'IBRAHIM MALIK ISWANTO', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260043', nama: 'MUHAMMAD AZKA RAVINDRA', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260044', nama: 'MUHAMMAD HUSEIN NASUTION', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260045', nama: 'NADHIFA RAISAH', jk: 'Perempuan', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260046', nama: 'NADIRA PUTRI', jk: 'Perempuan', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260047', nama: 'NAZRIL AHMAD', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260048', nama: 'RAZZAN SAPRILIAN SAHMI', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260049', nama: 'RUMAYSHA AIZZAH RAHMAN', jk: 'Perempuan', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260050', nama: 'SARFARAZ ANDHRA R. ATMAJA', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260051', nama: 'TENGKU HUMAYRAH SANTUN', jk: 'Perempuan', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },
  { nis: '260052', nama: 'UBAY LUQMAN', jk: 'Laki-laki', kelas: 'SD 1', tahun: '2026/2027', tgl: '2019-01-01' },

  // Kelas 2 (SD 2)
  { nis: '250015', nama: 'ABHI VANDYA', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250016', nama: 'AISYAH SALSABILA', jk: 'Perempuan', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250017', nama: 'AISYAH ZAHIRA', jk: 'Perempuan', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250018', nama: 'ALDRIAN NOOR HARBYANSAH', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250019', nama: 'AL HAKIM SANJAYA', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250020', nama: 'ALIYA ATMAJA', jk: 'Perempuan', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250021', nama: 'AL ZAIDAN FAEYZA', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250022', nama: 'AZRIL RAHANDIKA', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250023', nama: 'EVAN YAHYA', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250024', nama: 'M. DWI AFANDI', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250025', nama: 'M. HAZWAN SANDI', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250026', nama: 'M. SULTAN ATHA ABQARY NST', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250027', nama: 'NAILAH HANA SYAKIRAH', jk: 'Perempuan', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250028', nama: 'NAZWA ZAHIRA', jk: 'Perempuan', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250029', nama: 'RAYNA SYAHIDAH', jk: 'Perempuan', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250030', nama: 'RESVAN APRILIAN SAHMI', jk: 'Laki-laki', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },
  { nis: '250031', nama: 'VIRANDA AL MAIDANI', jk: 'Perempuan', kelas: 'SD 2', tahun: '2025/2026', tgl: '2018-01-01' },

  // Kelas 3 (SD 3)
  { nis: '240001', nama: 'Aisha Alifa Tanoto', jk: 'Perempuan', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240002', nama: 'Arrasyid Al Ausy', jk: 'Laki-laki', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240003', nama: 'Dzaky Noor Habibi', jk: 'Laki-laki', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240004', nama: 'Fira Maharani', jk: 'Perempuan', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240005', nama: 'Humairah Hanum Manik', jk: 'Perempuan', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240006', nama: 'Kahfi Khoirun Fikri', jk: 'Laki-laki', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240007', nama: 'Kei Nadhira Nasution', jk: 'Perempuan', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240008', nama: 'Khaira Sabilillah', jk: 'Perempuan', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240009', nama: 'Khairunnisa', jk: 'Perempuan', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240010', nama: 'Muhammad Abizar Ilham', jk: 'Laki-laki', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240011', nama: 'Nasira Askadina', jk: 'Perempuan', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240012', nama: 'Nazran Azraqi', jk: 'Laki-laki', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240013', nama: 'Rihannah Shihah', jk: 'Perempuan', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },
  { nis: '240014', nama: 'Shidqiyah Ayu Nasyrah', jk: 'Perempuan', kelas: 'SD 3', tahun: '2024/2025', tgl: '2017-01-01' },

  // Kelas TK (TK Qur'an Imam Syafi'i)
  { nis: '260053', nama: 'ADZKIA FAIHA', jk: 'Perempuan', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260054', nama: 'AIN FARHANNA HUMAIRAH', jk: 'Perempuan', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260055', nama: 'AL AYUBI FAIZ', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260056', nama: 'ARUNIKA SALSABILA', jk: 'Perempuan', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260057', nama: 'ANNAZA FATIH RAMADAN', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260058', nama: 'ASLAM KAFFAH', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260059', nama: 'DEAR AMMIRA', jk: 'Perempuan', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260060', nama: 'DWI NOVI YANTO', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260061', nama: 'HILYA', jk: 'Perempuan', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260062', nama: 'KAUREEN FAZLUNA SINAGA', jk: 'Perempuan', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260063', nama: 'KHALEED SHARIM MUDZAFAR', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260064', nama: 'MIFTAHUL JANNAH', jk: 'Perempuan', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260065', nama: 'M. IZZAN SYAFIQ', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260066', nama: 'MUHAMMAD IRWAN MAULANA', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260067', nama: 'MUHAMMAD JOVANKHA', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260068', nama: 'QONITAH HANIFAH', jk: 'Perempuan', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260069', nama: 'SHERAZ ABDURRAHMAN SARAGIH', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
  { nis: '260070', nama: 'UMAR ILYAS LUBIS', jk: 'Laki-laki', kelas: 'TK', tahun: '2026/2027', tgl: '2021-01-01' },
];

const now = Date.now();
const esc = (v) => `'${String(v || '').replace(/'/g, "''")}'`;

const sqlLines = studentsData.map((s) => {
  return `INSERT INTO students (id, nama_siswa, nis, jenis_kelamin, kelas, agama, status, tahun_ajaran_masuk, tempat_lahir, tanggal_lahir, updated_at) VALUES (${esc(s.nis)}, ${esc(s.nama)}, ${esc(s.nis)}, ${esc(s.jk)}, ${esc(s.kelas)}, 'Islam', 'Aktif', ${esc(s.tahun)}, '-', ${esc(s.tgl)}, ${now});`;
});

// Naikkan version di meta supaya cache snapshot edge / api/data ter-refresh otomatis
sqlLines.push("UPDATE meta SET value = value + 1 WHERE key = 'data_version';");

const outputSql = sqlLines.join('\n') + '\n';
writeFileSync('scripts/seed-students.sql', outputSql);
console.log(`Generated scripts/seed-students.sql with ${studentsData.length} students.`);

