import { execSync } from 'node:child_process';
import { hashPassword } from './functions/_lib/password.js';

// Cache daftar user di memori dev server agar respon GET secepat kilat (~2ms)
let cachedUsers = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 detik

function queryD1(sql) {
  try {
    const isWindows = process.platform === 'win32';
    const npx = isWindows ? 'npx.cmd' : 'npx';
    const cmdStr = `${npx} wrangler d1 execute sekolah-db --remote --json --command="${sql.replace(/"/g, '\\"')}"`;
    
    const stdout = execSync(cmdStr, {
      encoding: 'utf8',
      timeout: 20000,
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
    console.error('[devAuthUsers] queryD1 error:', err.message);
    throw err;
  }
}

function fetchUsersFromDb() {
  const sql = "SELECT id, username, name, role, permissions, is_active, created_at, updated_at FROM teacher_users ORDER BY (CASE WHEN username = 'guru' OR username = 'admin' THEN 0 ELSE 1 END), name ASC";
  const rows = queryD1(sql);
  cachedUsers = rows;
  lastFetchTime = Date.now();
  return rows;
}

export function devAuthUsersPlugin() {
  return {
    name: 'dev-auth-users-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        
        if (url.pathname !== '/api/auth/users') {
          return next();
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // GET: Ambil daftar user
        if (req.method === 'GET') {
          try {
            if (!cachedUsers || Date.now() - lastFetchTime > CACHE_TTL) {
              fetchUsersFromDb();
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, users: cachedUsers || [] }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message, users: cachedUsers || [] }));
          }
          return;
        }

        // POST: Mutasi data user (add, update, delete)
        if (req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });

          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const { action } = body;
              const epoch = Date.now();

              if (action === 'add_user') {
                const username = String(body.username || '').trim().toLowerCase();
                const password = String(body.password || '');
                const name = String(body.name || '').trim();
                const role = String(body.role || 'guru').toLowerCase();
                const permissions = typeof body.permissions === 'string'
                  ? body.permissions
                  : JSON.stringify(body.permissions || []);
                const isActive = body.is_active != null ? (Number(body.is_active) ? 1 : 0) : 1;

                if (!username || username.length < 3) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, error: 'Username minimal 3 karakter.' }));
                }
                if (!password || password.length < 6) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, error: 'Password minimal 6 karakter.' }));
                }

                const passwordHash = await hashPassword(password);
                const id = 'user-' + epoch + '-' + Math.random().toString(36).slice(2, 7);

                const escapeSql = (str) => String(str).replace(/'/g, "''");
                const sql = `INSERT INTO teacher_users (id, username, password_hash, name, role, permissions, is_active, created_at, updated_at) VALUES ('${escapeSql(id)}', '${escapeSql(username)}', '${escapeSql(passwordHash)}', '${escapeSql(name)}', '${escapeSql(role)}', '${escapeSql(permissions)}', ${isActive}, ${epoch}, ${epoch})`;

                queryD1(sql);
                cachedUsers = null; // Invalidate cache

                res.statusCode = 200;
                return res.end(JSON.stringify({
                  success: true,
                  message: `Pengguna "${name}" (${username}) berhasil ditambahkan.`,
                  userId: id,
                }));
              }

              if (action === 'update_user') {
                const { id, name, role, permissions, is_active, password } = body;
                if (!id) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, error: 'ID pengguna wajib disertakan.' }));
                }

                const escapeSql = (str) => String(str).replace(/'/g, "''");
                const updates = [];
                if (name != null) updates.push(`name = '${escapeSql(String(name).trim())}'`);
                if (role != null) updates.push(`role = '${escapeSql(String(role).trim().toLowerCase())}'`);
                if (permissions != null) {
                  const permStr = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
                  updates.push(`permissions = '${escapeSql(permStr)}'`);
                }
                if (is_active != null) updates.push(`is_active = ${Number(is_active) ? 1 : 0}`);
                if (password && password.length >= 6) {
                  const passwordHash = await hashPassword(password);
                  updates.push(`password_hash = '${escapeSql(passwordHash)}'`);
                }
                updates.push(`updated_at = ${epoch}`);

                const sql = `UPDATE teacher_users SET ${updates.join(', ')} WHERE id = '${escapeSql(id)}'`;
                queryD1(sql);
                cachedUsers = null; // Invalidate cache

                res.statusCode = 200;
                return res.end(JSON.stringify({ success: true, message: 'Data pengguna berhasil diperbarui.' }));
              }

              if (action === 'delete_user') {
                const { id } = body;
                if (!id) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, error: 'ID pengguna wajib disertakan.' }));
                }

                const escapeSql = (str) => String(str).replace(/'/g, "''");
                const sql = `DELETE FROM teacher_users WHERE id = '${escapeSql(id)}' AND username != 'admin' AND username != 'guru'`;
                queryD1(sql);
                cachedUsers = null; // Invalidate cache

                res.statusCode = 200;
                return res.end(JSON.stringify({ success: true, message: 'Pengguna berhasil dihapus.' }));
              }

              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: 'Aksi tidak dikenal.' }));
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
