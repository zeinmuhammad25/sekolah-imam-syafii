import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Upload, Loader2, ImageOff } from 'lucide-react';
import { fetchSchoolData, mutateRow, uploadImage } from '../../services/gsheet';

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
};

const emptyForm = (fields) => Object.fromEntries(fields.map((f) => [f.name, '']));

export default function AdminSection({ section }) {
  const cfg = CONFIGS[section];
  const [items, setItems] = useState(null); // null = loading
  const [editing, setEditing] = useState(null); // {form, id|null} saat form terbuka
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = () => fetchSchoolData().then((d) => setItems((d && d[cfg.sheetName]) || []));
  useEffect(() => { setItems(null); load(); }, [section]);

  const openAdd = () => { setError(''); setEditing({ id: null, form: emptyForm(cfg.fields) }); };
  const openEdit = (item) => {
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
    // Validasi field wajib
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

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus "${item[cfg.primary] || item.id}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await mutateRow({ action: 'delete', sheetName: cfg.sheetName, id: item.id });
    if (res.success) { setItems(null); await load(); }
    else window.alert('Gagal menghapus: ' + (res.error || 'tidak diketahui'));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">{cfg.title}</h2>
          <p className="text-slate-400 font-bold text-sm mt-1">
            {items === null ? 'Memuat…' : `${items.length} data`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 bg-secondary text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:brightness-95 active:scale-95 transition-all shadow-lg shadow-secondary/20"
        >
          <Plus size={18} /> Tambah
        </button>
      </div>

      {/* Daftar */}
      {items === null ? (
        <div className="flex justify-center py-20 text-slate-300"><Loader2 className="animate-spin" size={32} /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold">Belum ada data. Klik "Tambah".</div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 bg-white rounded-2xl p-3 border border-slate-100 shadow-sm">
              <Thumb src={item[cfg.imageField]} />
              <div className="min-w-0 flex-grow">
                <p className="font-black text-slate-900 truncate">{item[cfg.primary] || '(tanpa judul)'}</p>
                <p className="text-slate-400 font-bold text-xs truncate">{item[cfg.secondary]}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(item)} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-secondary hover:text-white transition-all" title="Edit"><Pencil size={16} /></button>
                <button onClick={() => handleDelete(item)} className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-500 hover:text-white transition-all" title="Hapus"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {editing && (
        <div className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 my-8 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => !saving && setEditing(null)} className="absolute top-5 right-5 p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-700"><X size={18} /></button>
            <h3 className="text-xl font-black text-slate-900 mb-6">{editing.id ? 'Edit' : 'Tambah'} {cfg.title}</h3>

            <div className="space-y-4">
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
            </div>

            {error && <div className="mt-4 text-rose-500 font-bold text-sm">{error}</div>}

            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="w-full mt-6 bg-slate-900 text-white p-4 rounded-2xl font-black text-sm hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <><Loader2 className="animate-spin" size={18} /> Menyimpan…</> : 'Simpan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Thumb({ src }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><ImageOff size={20} /></div>;
  return <img src={src} onError={() => setErr(true)} className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0" alt="" />;
}

function Field({ field, value, uploading, onChange, onFile }) {
  const base = 'w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3.5 font-bold text-slate-800 outline-none focus:border-secondary transition-all';
  const label = <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">{field.label}</label>;

  if (field.type === 'image') {
    return (
      <div>
        {label}
        <div className="flex items-center gap-3">
          <Thumb src={value} />
          <label className="flex-grow cursor-pointer">
            <div className={`${base} flex items-center justify-center gap-2 text-slate-500 hover:border-secondary`}>
              {uploading ? <><Loader2 className="animate-spin" size={16} /> Mengunggah…</> : <><Upload size={16} /> {value ? 'Ganti foto' : 'Pilih foto'}</>}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files[0])} disabled={uploading} />
          </label>
        </div>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return <div>{label}<textarea rows={field.rows || 4} value={value} onChange={(e) => onChange(e.target.value)} className={base} /></div>;
  }

  if (field.type === 'select' && !field.allowCustom) {
    return (
      <div>{label}
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">— pilih —</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === 'select' && field.allowCustom) {
    const listId = `dl-${field.name}`;
    return (
      <div>{label}
        <input list={listId} value={value} onChange={(e) => onChange(e.target.value)} className={base} placeholder="pilih atau ketik baru" />
        <datalist id={listId}>{field.options.map((o) => <option key={o} value={o} />)}</datalist>
      </div>
    );
  }

  return <div>{label}<input type={field.type === 'date' ? 'date' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} className={base} /></div>;
}
