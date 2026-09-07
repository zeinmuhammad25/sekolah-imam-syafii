import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, SlidersHorizontal, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { fetchSchoolData, mutateRow, uploadImage, extractYoutubeId } from '../../services/gsheet';
import { Modal, ModalFooter, ConfirmDialog, Thumb, Field } from './ModalKit';

// Konfigurasi tiap section. Semua CRUD pakai komponen ini.
const CONFIGS = {
  gallery: {
    title: 'Galeri Siswa',
    sheetName: 'Gallery',
    imageField: 'image_url',
    primary: 'title',
    secondary: 'category',
    fields: [
      { name: 'title', label: 'Judul', type: 'text', required: true },
      { name: 'image_url', label: 'Foto', type: 'image', required: true },
      {
        name: 'category', label: 'Kategori', type: 'select', required: true, allowCustom: true,
        options: ['Seragam Putih', 'Seragam Sekolah', 'Kegiatan Ramadhan', 'Kreativitas Siswa', 'Siswa Berprestasi', 'Ruang Kelas', 'Upacara'],
      },
    ],
  },
  teachers: {
    title: 'Tim Pengajar',
    sheetName: 'Teachers',
    imageField: 'photo_url',
    primary: 'name',
    secondary: 'role',
    fields: [
      { name: 'name', label: 'Nama', type: 'text', required: true },
      { name: 'role', label: 'Jabatan', type: 'select', required: true, allowCustom: true, options: ['guru', 'Operator'] },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['ikhwan', 'akhwat'] },
      { name: 'photo_url', label: 'Foto (opsional)', type: 'image' },
    ],
  },
  news: {
    title: 'Warta Terbaru',
    sheetName: 'News',
    imageField: 'image_url',
    primary: 'title',
    secondary: 'summary',
    fields: [
      { name: 'title', label: 'Judul', type: 'text', required: true },
      { name: 'summary', label: 'Ringkasan singkat', type: 'textarea', rows: 3, required: true },
      { name: 'image_url', label: 'Foto', type: 'image', required: true },
      { name: 'date', label: 'Tanggal (opsional)', type: 'date' },
      { name: 'description', label: 'Isi berita lengkap', type: 'textarea', rows: 10, required: true },
    ],
  },
  videos: {
    title: 'Galeri Video',
    sheetName: 'Videos',
    imageField: null,
    youtubeField: 'youtube_url', // thumbnail diambil otomatis dari YouTube, bukan upload foto
    primary: 'title',
    secondary: 'youtube_url',
    fields: [
      { name: 'title', label: 'Judul', type: 'text', required: true },
      { name: 'youtube_url', label: 'Link YouTube', type: 'text', required: true, placeholder: 'https://youtube.com/watch?v=...' },
    ],
  },
};

const youtubeThumb = (url) => {
  const id = extractYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
};

const emptyForm = (fields) => Object.fromEntries(fields.map((f) => [f.name, '']));

export default function AdminSection({ section }) {
  const cfg = CONFIGS[section];
  const [items, setItems] = useState(null); // null = loading
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState(null); // {form, id|null} saat form terbuka
  const [confirming, setConfirming] = useState(null); // item yang mau dihapus
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);       // urutan berubah, belum disimpan
  const [savingOrder, setSavingOrder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = () => fetchSchoolData().then((d) => setItems((d && d[cfg.sheetName]) || []));
  useEffect(() => { setItems(null); setEditMode(false); setDirty(false); load(); }, [section]);

  // Simpan urutan ke server sekali jalan. Return true kalau sukses / tak perlu.
  const commitOrder = async () => {
    if (!dirty) return true;
    setSavingOrder(true);
    const res = await mutateRow({ action: 'reorder', sheetName: cfg.sheetName, ids: items.map((i) => i.id) });
    setSavingOrder(false);
    if (res.success) { setDirty(false); return true; }
    window.alert('Gagal menyimpan urutan: ' + (res.error || 'tidak diketahui'));
    return false;
  };

  const exitEdit = async () => { if (await commitOrder()) setEditMode(false); };

  const openAdd = async () => { if (!(await commitOrder())) return; setError(''); setEditing({ id: null, form: emptyForm(cfg.fields) }); };
  const openEdit = async (item) => {
    if (!(await commitOrder())) return;
    setError('');
    const form = {};
    cfg.fields.forEach((f) => { form[f.name] = item[f.name] != null ? String(item[f.name]) : ''; });
    setEditing({ id: item.id, form });
  };

  const handleFile = async (field, file) => {
    if (!file) return;
    setUploading(true); setError('');
    const res = await uploadImage(file);
    setUploading(false);
    if (res.success && res.url) {
      setEditing((e) => ({ ...e, form: { ...e.form, [field]: res.url } }));
    } else {
      setError('Upload foto gagal: ' + (res.error || 'tidak diketahui'));
    }
  };

  const handleSave = async () => {
    setError('');
    for (const f of cfg.fields) {
      if (f.required && !String(editing.form[f.name] || '').trim()) {
        setError(`"${f.label}" wajib diisi`);
        return;
      }
    }
    setSaving(true);
    const res = await mutateRow({
      action: editing.id ? 'update' : 'add',
      sheetName: cfg.sheetName,
      id: editing.id || undefined,
      row: editing.form,
    });
    setSaving(false);
    if (res.success) {
      setEditing(null);
      setItems(null);
      await load();
    } else {
      setError('Gagal menyimpan: ' + (res.error || 'tidak diketahui'));
    }
  };

  const handleMove = (index, direction) => {
    const j = direction === 'up' ? index - 1 : index + 1;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);  // geser lokal, instan — bebas berkali-kali
    setDirty(true);  // disimpan pas "Selesai"
  };

  const confirmDelete = async () => {
    if (!(await commitOrder())) return;
    setDeleting(true);
    const res = await mutateRow({ action: 'delete', sheetName: cfg.sheetName, id: confirming.id });
    setDeleting(false);
    if (res.success) { setConfirming(null); setItems(null); await load(); }
    else { setConfirming(null); setError('Gagal menghapus: ' + (res.error || 'tidak diketahui')); }
  };

  return (
    <div className={editMode ? 'pb-24' : ''}>
      {/* Header + aksi */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">{cfg.title}</h2>
          <p className="text-slate-400 font-bold text-sm mt-1">
            {items === null ? 'Memuat…' : `${items.length} data`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => (editMode ? exitEdit() : setEditMode(true))}
            disabled={savingOrder}
            className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all border-2 disabled:opacity-60 ${
              editMode
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-900 hover:text-slate-900'
            }`}
          >
            {editMode
              ? (savingOrder ? <><Loader2 className="animate-spin" size={16} /> Menyimpan…</> : <><Check size={16} /> Selesai</>)
              : <><SlidersHorizontal size={16} /> Edit</>}
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-secondary text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:brightness-95 active:scale-95 transition-all shadow-lg shadow-secondary/20"
          >
            <Plus size={18} /> Tambah
          </button>
        </div>
      </div>

      {/* Daftar */}
      {items === null ? (
        <div className="flex justify-center py-20 text-slate-300"><Loader2 className="animate-spin" size={32} /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold">Belum ada data. Klik "Tambah".</div>
      ) : (
        <div className="grid gap-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 bg-white rounded-2xl p-3 border shadow-sm transition-colors ${
                editMode ? 'border-slate-200' : 'border-slate-100'
              }`}
            >
              {editMode && (
                <div className="flex flex-col shrink-0">
                  <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-secondary disabled:opacity-20 disabled:hover:bg-transparent transition-all" title="Naikkan"><ChevronUp size={16} /></button>
                  <button onClick={() => handleMove(index, 'down')} disabled={index === items.length - 1} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-secondary disabled:opacity-20 disabled:hover:bg-transparent transition-all" title="Turunkan"><ChevronDown size={16} /></button>
                </div>
              )}
              <Thumb src={cfg.youtubeField ? youtubeThumb(item[cfg.youtubeField]) : item[cfg.imageField]} />
              <div className="min-w-0 flex-grow">
                <p className="font-black text-slate-900 truncate">{item[cfg.primary] || '(tanpa judul)'}</p>
                <p className="text-slate-400 font-bold text-xs truncate">{item[cfg.secondary]}</p>
              </div>
              {editMode && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-secondary hover:text-white transition-all" title="Edit"><Pencil size={16} /></button>
                  <button onClick={() => setConfirming(item)} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-500 hover:text-white transition-all" title="Hapus"><Trash2 size={16} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bar mode edit (mengambang bawah) */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-4 bg-slate-900 text-white pl-5 pr-2 py-2 rounded-full shadow-2xl"
          >
            <span className="text-xs font-bold text-slate-300 hidden sm:inline">
              {dirty ? 'Urutan belum disimpan' : 'Mode edit — atur urutan, ubah, atau hapus'}
            </span>
            <button onClick={exitEdit} disabled={savingOrder} className="bg-white text-slate-900 px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-wider hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60">
              {savingOrder ? <><Loader2 className="animate-spin" size={16} /> Menyimpan…</> : <><Check size={16} /> {dirty ? 'Simpan & Selesai' : 'Selesai'}</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form modal (tambah / edit) */}
      <AnimatePresence>
        {editing && (
          <Modal onClose={() => !saving && setEditing(null)} title={`${editing.id ? 'Edit' : 'Tambah'} ${cfg.title}`}>
            <div className="px-6 md:px-8 py-6 space-y-4">
              {cfg.fields.map((f) => (
                <Field
                  key={f.name}
                  field={f}
                  value={editing.form[f.name]}
                  uploading={uploading}
                  onChange={(v) => setEditing((e) => ({ ...e, form: { ...e.form, [f.name]: v } }))}
                  onFile={(file) => handleFile(f.name, file)}
                />
              ))}
              {error && <div className="flex items-center gap-2 text-rose-500 font-bold text-sm bg-rose-50 rounded-xl p-3"><AlertTriangle size={16} /> {error}</div>}
            </div>
            <ModalFooter>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-sm hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <><Loader2 className="animate-spin" size={18} /> Menyimpan…</> : 'Simpan'}
              </button>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Konfirmasi hapus */}
      <AnimatePresence>
        {confirming && (
          <ConfirmDialog
            title="Hapus data ini?"
            message={<>Yakin mau menghapus <b className="text-slate-800">"{confirming[cfg.primary] || confirming.id}"</b>? Tindakan ini permanen dan tidak bisa dibatalkan.</>}
            confirmLabel="Hapus"
            loading={deleting}
            onCancel={() => !deleting && setConfirming(null)}
            onConfirm={confirmDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
