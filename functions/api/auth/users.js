import { requireSession, json } from '../../_lib/auth.js';
import { hashPassword } from '../../_lib/password.js';

function canManageUsers(session) {
  if (!session) return false;
  if (session.username === 'admin' || session.role === 'superadmin') return true;
  try {
    const perms = JSON.parse(session.permissions || '[]');
    return perms.includes('all') || perms.includes('kelola_pengguna');
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  if (!canManageUsers(session)) {
    return json({ success: false, error: 'Akses ditolak. Hanya Administrator yang dapat mengelola pengguna.' }, { status: 403 });
  }

  try {
    const users = await env.DB.prepare(`
      SELECT id, username, name, role, permissions, is_active, created_at, updated_at
      FROM teacher_users
      ORDER BY (CASE WHEN username = 'admin' THEN 0 ELSE 1 END), name ASC
    `).all();

    return json({
      success: true,
      users: users.results || [],
    });
  } catch (err) {
    return json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  const session = await requireSession(request, env);
  if (!canManageUsers(session)) {
    return json({ success: false, error: 'Akses ditolak. Hanya Administrator yang dapat mengelola pengguna.' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Data request tidak valid.' }, { status: 400 });
  }

  const { action } = body;
  const epoch = Date.now();

  try {
    // ==================== 1. TAMBAH USER BARU ====================
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
        return json({ success: false, error: 'Username minimal 3 karakter (huruf/angka tanpa spasi).' }, { status: 400 });
      }
      if (!/^[a-z0-9_.-]+$/.test(username)) {
        return json({ success: false, error: 'Username hanya boleh berisi huruf kecil, angka, titik, atau garis bawah.' }, { status: 400 });
      }
      if (!password || password.length < 6) {
        return json({ success: false, error: 'Password minimal 6 karakter.' }, { status: 400 });
      }
      if (!name) {
        return json({ success: false, error: 'Nama pengguna wajib diisi.' }, { status: 400 });
      }

      // Cek apakah username sudah dipakai
      const existing = await env.DB.prepare('SELECT id FROM teacher_users WHERE username = ?').bind(username).first();
      if (existing) {
        return json({ success: false, error: `Username "${username}" sudah digunakan. Silakan pilih username lain.` }, { status: 400 });
      }

      const passwordHash = await hashPassword(password);
      const id = 'user-' + epoch + '-' + Math.random().toString(36).slice(2, 7);

      await env.DB.prepare(`
        INSERT INTO teacher_users (id, username, password_hash, name, role, permissions, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, username, passwordHash, name, role, permissions, isActive, epoch, epoch).run();

      return json({
        success: true,
        message: `Pengguna "${name}" (${username}) berhasil ditambahkan.`,
        userId: id,
      });
    }

    // ==================== 2. UPDATE USER ====================
    if (action === 'update_user') {
      const { id } = body;
      if (!id) return json({ success: false, error: 'ID pengguna tidak ditemukan.' }, { status: 400 });

      const target = await env.DB.prepare('SELECT * FROM teacher_users WHERE id = ?').bind(id).first();
      if (!target) return json({ success: false, error: 'Data pengguna tidak ditemukan.' }, { status: 404 });

      const isRootAdmin = target.username === 'admin';
      const name = String(body.name || target.name || '').trim();
      const password = String(body.password || '');
      let role = isRootAdmin ? 'superadmin' : String(body.role || target.role || 'guru').toLowerCase();
      let permissions = isRootAdmin
        ? '["all"]'
        : (typeof body.permissions === 'string' ? body.permissions : JSON.stringify(body.permissions || []));
      let isActive = isRootAdmin ? 1 : (body.is_active != null ? (Number(body.is_active) ? 1 : 0) : 1);

      if (!name) {
        return json({ success: false, error: 'Nama pengguna wajib diisi.' }, { status: 400 });
      }

      let passwordHash = target.password_hash;
      if (password && password.trim().length > 0) {
        if (password.length < 6) {
          return json({ success: false, error: 'Password baru minimal 6 karakter.' }, { status: 400 });
        }
        passwordHash = await hashPassword(password);
      }

      await env.DB.prepare(`
        UPDATE teacher_users SET
          name = ?,
          password_hash = ?,
          role = ?,
          permissions = ?,
          is_active = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(name, passwordHash, role, permissions, isActive, epoch, id).run();

      // Jika password diubah atau dinonaktifkan, hapus sesi login lama user tersebut agar wajib re-login
      if (password || isActive === 0) {
        await env.DB.prepare('DELETE FROM teacher_sessions WHERE user_id = ?').bind(id).run();
      }

      return json({
        success: true,
        message: `Data pengguna "${name}" berhasil diperbarui.`,
      });
    }

    // ==================== 3. HAPUS USER ====================
    if (action === 'delete_user') {
      const { id } = body;
      if (!id) return json({ success: false, error: 'ID pengguna wajib disertakan.' }, { status: 400 });

      const target = await env.DB.prepare('SELECT * FROM teacher_users WHERE id = ?').bind(id).first();
      if (!target) return json({ success: false, error: 'Pengguna tidak ditemukan.' }, { status: 404 });

      // Proteksi Akun Admin Utama
      if (target.username === 'admin') {
        return json({ success: false, error: 'Akun Administrator utama (admin) dilindungi dan tidak dapat dihapus.' }, { status: 400 });
      }

      // Proteksi Tidak Bisa Hapus Diri Sendiri
      if (target.id === session.userId) {
        return json({ success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang login.' }, { status: 400 });
      }

      await env.DB.prepare('DELETE FROM teacher_users WHERE id = ?').bind(id).run();

      return json({
        success: true,
        message: `Pengguna "${target.name}" (${target.username}) berhasil dihapus.`,
      });
    }

    return json({ success: false, error: 'Aksi pengguna tidak valid.' }, { status: 400 });
  } catch (err) {
    return json({ success: false, error: err.message }, { status: 500 });
  }
}

