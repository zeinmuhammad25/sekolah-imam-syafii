// POST /api/row — pengganti Apps Script handleRow() (type: 'ROW'). Semua aksi di
// sini mengubah data, jadi wajib login (lihat requireSession).
import { TABLES, jsonToRow, rowToJson } from '../_lib/tables.js';
import { requireSession, json } from '../_lib/auth.js';

const nextId = async (env, cfg) => {
  const { results } = await env.DB.prepare(`SELECT id FROM ${cfg.table}`).all();
  let max = 0;
  for (const r of results) {
    const m = String(r.id ?? '').match(/\d+/);
    if (m) max = Math.max(max, parseInt(m[0], 10));
  }
  const next = max + 1;
  return cfg.idSuffix ? `${next}${cfg.idSuffix}` : String(next);
};

export async function onRequestPost({ request, env }) {
  const session = await requireSession(request, env);
  if (!session) return json({ success: false, error: 'Belum login' }, { status: 401 });

  let params;
  try { params = await request.json(); } catch { return json({ success: false, error: 'Body tidak valid' }); }

  const { action, sheetName } = params;
  const cfg = TABLES[sheetName];
  if (!cfg) return json({ success: false, error: 'sheet tidak diizinkan' });
  const db = env.DB;

  try {
    if (action === 'add') {
      const id = await nextId(env, cfg);
      const now = Date.now();
      const row = { ...(params.row || {}), id, updatedAt: now };
      const data = jsonToRow(cfg, row);
      const cols = Object.keys(data);
      const stmt = `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
      await db.prepare(stmt).bind(...cols.map((c) => data[c])).run();
      return json({ success: true, id, updatedAt: now });
    }

    if (action === 'deleteFolder') {
      // Khusus QuestionFolders: hapus folder + semua soal di dalamnya.
      const id = String(params.id);
      await db.prepare('DELETE FROM questions WHERE folder_id = ?').bind(id).run();
      await db.prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).bind(id).run();
      return json({ success: true });
    }

    if (action === 'update' || action === 'delete') {
      const targetId = String(params.id != null ? params.id : (params.row || {}).id);
      const existing = await db.prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).bind(targetId).first();
      if (!existing) return json({ success: false, error: 'id tidak ditemukan: ' + targetId });

      if (action === 'delete') {
        await db.prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).bind(targetId).run();
        return json({ success: true });
      }

      if (params.expectedUpdatedAt != null && String(existing.updated_at) !== String(params.expectedUpdatedAt)) {
        return json({ success: false, conflict: true, current: rowToJson(cfg, existing) });
      }

      const row = { ...(params.row || {}) };
      delete row.id; delete row.updatedAt;
      const data = jsonToRow(cfg, row);
      const cols = Object.keys(data);
      const now = Date.now();
      if (cols.length) {
        const setSql = cols.map((c) => `${c} = ?`).join(', ') + ', updated_at = ?';
        await db.prepare(`UPDATE ${cfg.table} SET ${setSql} WHERE id = ?`).bind(...cols.map((c) => data[c]), now, targetId).run();
      } else {
        await db.prepare(`UPDATE ${cfg.table} SET updated_at = ? WHERE id = ?`).bind(now, targetId).run();
      }
      return json({ success: true, id: targetId, updatedAt: now });
    }

    if (action === 'reorderQuestions') {
      const ids = params.ids || [];
      for (let i = 0; i < ids.length; i++) {
        await db.prepare('UPDATE questions SET order_num = ? WHERE id = ?').bind(i + 1, String(ids[i])).run();
      }
      return json({ success: true });
    }

    if (action === 'reorder') {
      const ids = params.ids || [];
      const orderCol = cfg.orderCol === 'rowid' ? null : cfg.orderCol;
      if (!orderCol) return json({ success: false, error: 'tabel ini tidak mendukung reorder' });
      for (let i = 0; i < ids.length; i++) {
        await db.prepare(`UPDATE ${cfg.table} SET ${orderCol} = ? WHERE id = ?`).bind(i + 1, String(ids[i])).run();
      }
      return json({ success: true });
    }

    return json({ success: false, error: 'action tidak dikenal: ' + action });
  } catch (err) {
    return json({ success: false, error: String((err && err.message) || err) });
  }
}
