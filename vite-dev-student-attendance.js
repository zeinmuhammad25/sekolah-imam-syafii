import { execSync } from 'node:child_process';

function queryD1(sql) {
  try {
    const isWindows = process.platform === 'win32';
    const npx = isWindows ? 'npx.cmd' : 'npx';
    const cmdStr = `${npx} wrangler d1 execute sekolah-db --remote --json --command="${sql.replace(/"/g, '\\"')}"`;
    
    const stdout = execSync(cmdStr, {
      encoding: 'utf8',
      timeout: 25000,
      windowsHide: true,
    });

    const jsonStart = stdout.indexOf('[');
    if (jsonStart === -1) return [];

    const parsed = JSON.parse(stdout.slice(jsonStart));
    if (Array.isArray(parsed) && parsed[0]) {
      return parsed[0].results || [];
    }
    return [];
  } catch (err) {
    console.error('[devStudentAttendance] queryD1 error:', err.message);
    throw err;
  }
}

function getWibDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (7 * 3600000));
  
  const yyyy = wib.getFullYear();
  const mm = String(wib.getMonth() + 1).padStart(2, '0');
  const dd = String(wib.getDate()).padStart(2, '0');
  const hh = String(wib.getHours()).padStart(2, '0');
  const ii = String(wib.getMinutes()).padStart(2, '0');
  const ss = String(wib.getSeconds()).padStart(2, '0');

  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${ii}:${ss}`,
    timeShort: `${hh}:${ii}`,
    hours: wib.getHours(),
    minutes: wib.getMinutes(),
    epoch: now.getTime(),
  };
}

const escapeSql = (str) => String(str || '').replace(/'/g, "''");

export function devStudentAttendancePlugin() {
  return {
    name: 'dev-student-attendance-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        
        if (url.pathname === '/api/upload' && req.method === 'DELETE') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true, message: 'Dev simulated R2 delete' }));
        }

        if (url.pathname !== '/api/student-attendance') {
          return next();
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // GET Handlers
        if (req.method === 'GET') {
          try {
            const action = url.searchParams.get('action') || 'today_class';
            const kelas = url.searchParams.get('kelas') || 'SD 1';
            const studentId = url.searchParams.get('studentId');
            const dateParam = url.searchParams.get('date');
            const startDate = url.searchParams.get('startDate');
            const endDate = url.searchParams.get('endDate');

            const wib = getWibDate();
            const targetDate = dateParam || wib.date;

            if (action === 'today_class') {
              const studentsSql = `SELECT id, nama_siswa, nisn, nis, jenis_kelamin, kelas, foto_siswa, status FROM students WHERE LOWER(TRIM(kelas)) = LOWER(TRIM('${escapeSql(kelas)}')) AND (status IS NULL OR LOWER(TRIM(status)) != 'alumni') ORDER BY nama_siswa ASC`;
              const students = queryD1(studentsSql);

              const attSql = `SELECT * FROM student_attendances WHERE date = '${escapeSql(targetDate)}' AND LOWER(TRIM(kelas)) = LOWER(TRIM('${escapeSql(kelas)}')) ORDER BY student_name ASC`;
              const attendances = queryD1(attSql);

              res.statusCode = 200;
              return res.end(JSON.stringify({
                success: true,
                date: targetDate,
                kelas,
                serverTime: wib,
                students,
                attendances,
                isSubmitted: attendances.length > 0,
              }));
            }

            if (action === 'parent_today') {
              if (!studentId) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, error: 'ID Siswa wajib disertakan.' }));
              }

              const sql = `SELECT id, date, kelas, student_id, student_name, status, method, scan_time, notes, updated_at FROM student_attendances WHERE student_id = '${escapeSql(studentId)}' AND date = '${escapeSql(targetDate)}' LIMIT 1`;
              const rows = queryD1(sql);

              res.statusCode = 200;
              return res.end(JSON.stringify({
                success: true,
                date: targetDate,
                studentId,
                serverTime: wib,
                attendance: rows[0] || null,
              }));
            }

            if (action === 'recap') {
              let sql = 'SELECT * FROM student_attendances WHERE ';
              const conds = [];

              if (startDate && endDate) {
                conds.push(`date >= '${escapeSql(startDate)}' AND date <= '${escapeSql(endDate)}'`);
              } else {
                conds.push(`date = '${escapeSql(targetDate)}'`);
              }

              if (kelas && kelas !== 'ALL') {
                conds.push(`LOWER(TRIM(kelas)) = LOWER(TRIM('${escapeSql(kelas)}'))`);
              }

              if (studentId && studentId !== 'ALL') {
                conds.push(`student_id = '${escapeSql(studentId)}'`);
              }

              sql += conds.join(' AND ') + ' ORDER BY date DESC, kelas ASC, student_name ASC';
              const attendances = queryD1(sql);

              res.statusCode = 200;
              return res.end(JSON.stringify({
                success: true,
                startDate: startDate || targetDate,
                endDate: endDate || targetDate,
                kelas: kelas || 'ALL',
                attendances,
              }));
            }

            res.statusCode = 400;
            return res.end(JSON.stringify({ success: false, error: 'Aksi GET tidak dikenali.' }));
          } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ success: false, error: err.message }));
          }
        }

        // POST Handlers
        if (req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const { action } = body;
              const epoch = Date.now();
              const wib = getWibDate();

              if (action === 'submit_batch') {
                const { date, kelas, submitted_by = 'Guru Wali Kelas', items = [] } = body;
                const targetDate = date || wib.date;

                if (!kelas || !Array.isArray(items) || items.length === 0) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, error: 'Kelas dan daftar presensi siswa wajib disertakan.' }));
                }

                // Bangun statement batch SQL
                const sqlStatements = items.map(item => {
                  const studentId = String(item.student_id || item.id || '').trim();
                  const studentName = String(item.student_name || item.name || '').trim();
                  const status = ['hadir', 'sakit', 'izin', 'alpha'].includes(item.status) ? item.status : 'hadir';
                  const method = item.method || (item.status === 'hadir' ? 'qr_scan' : 'manual_wali_kelas');
                  const scanTime = item.scan_time || (status === 'hadir' ? wib.time : null);
                  const notes = item.notes || '';
                  const recId = `att-${targetDate}-${studentId}`;

                  return `INSERT INTO student_attendances (id, date, kelas, student_id, student_name, status, method, scan_time, notes, submitted_by, created_at, updated_at) VALUES ('${escapeSql(recId)}', '${escapeSql(targetDate)}', '${escapeSql(kelas)}', '${escapeSql(studentId)}', '${escapeSql(studentName)}', '${escapeSql(status)}', '${escapeSql(method)}', ${scanTime ? `'${escapeSql(scanTime)}'` : 'NULL'}, '${escapeSql(notes)}', '${escapeSql(submitted_by)}', ${epoch}, ${epoch}) ON CONFLICT(id) DO UPDATE SET status = excluded.status, method = excluded.method, scan_time = excluded.scan_time, notes = excluded.notes, submitted_by = excluded.submitted_by, updated_at = excluded.updated_at;`;
                });

                // Eksekusi SQL
                queryD1(sqlStatements.join(' '));

                res.statusCode = 200;
                return res.end(JSON.stringify({
                  success: true,
                  message: `Presensi ${items.length} siswa kelas ${kelas} tanggal ${targetDate} berhasil disimpan.`,
                  date: targetDate,
                  kelas,
                  count: items.length,
                }));
              }

              if (action === 'update_single') {
                const {
                  student_id,
                  date,
                  kelas,
                  student_name,
                  status = 'hadir',
                  method = 'manual_wali_kelas',
                  scan_time,
                  notes = '',
                  submitted_by = 'Koreksi Guru',
                } = body;

                const targetDate = date || wib.date;
                if (!student_id || !kelas) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, error: 'Student ID dan Kelas wajib disertakan.' }));
                }

                const recId = `att-${targetDate}-${student_id}`;
                const scanTimeVal = scan_time || (status === 'hadir' ? wib.time : null);
                const sql = `INSERT INTO student_attendances (id, date, kelas, student_id, student_name, status, method, scan_time, notes, submitted_by, created_at, updated_at) VALUES ('${escapeSql(recId)}', '${escapeSql(targetDate)}', '${escapeSql(kelas)}', '${escapeSql(student_id)}', '${escapeSql(student_name)}', '${escapeSql(status)}', '${escapeSql(method)}', ${scanTimeVal ? `'${escapeSql(scanTimeVal)}'` : 'NULL'}, '${escapeSql(notes)}', '${escapeSql(submitted_by)}', ${epoch}, ${epoch}) ON CONFLICT(id) DO UPDATE SET status = excluded.status, method = excluded.method, scan_time = excluded.scan_time, notes = excluded.notes, submitted_by = excluded.submitted_by, updated_at = excluded.updated_at;`;

                queryD1(sql);

                res.statusCode = 200;
                return res.end(JSON.stringify({ success: true, message: 'Presensi siswa berhasil diperbarui.' }));
              }

              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Aksi POST tidak dikenali.' }));
            } catch (err) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        return next();
      });
    },
  };
}
