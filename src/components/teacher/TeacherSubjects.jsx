import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  BookOpen, Plus, Pencil, Trash2, ArrowUp, ArrowDown,
  Loader2, AlertTriangle, Check, BookMarked, Sparkles, RefreshCw, Copy
} from 'lucide-react';
import { fetchSchoolData, mutateRow, mutateBatch } from '../../services/gsheet';
import { Modal, ModalFooter, ConfirmDialog } from './ModalKit';

const ALL_GRADES = [
  { key: 'TK', label: 'TK', fase: 'Fondasi' },
  { key: 'SD 1', label: 'Kelas 1', fase: 'Fase A' },
  { key: 'SD 2', label: 'Kelas 2', fase: 'Fase A' },
  { key: 'SD 3', label: 'Kelas 3', fase: 'Fase B' },
  { key: 'SD 4', label: 'Kelas 4', fase: 'Fase B' },
  { key: 'SD 5', label: 'Kelas 5', fase: 'Fase C' },
  { key: 'SD 6', label: 'Kelas 6', fase: 'Fase C' },
];

const SD_KELOMPOK = [
  { key: 'umum', label: 'Mapel Umum (Kurikulum Merdeka)', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'mulok', label: 'Muatan Lokal (Diniyyah Sekolah)', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
];

const TK_KELOMPOK = [
  { key: 'agama', label: 'Nilai Agama & Budi Pekerti', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'jatidiri', label: 'Jati Diri', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'literasi', label: 'Dasar Literasi, Sains & Seni', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
];

// Standar Baku Kurikulum Merdeka per Jenjang
const getStandardDefaultsForGrade = (grade) => {
  if (grade === 'TK') {
    return [
      { level: 'TK', kelompok: 'agama', nama: "Mengenal Allah Subhanahu wa Ta'ala dan Ciptaan-Nya", induk: '', urutan: 1 },
      { level: 'TK', kelompok: 'agama', nama: 'Mempraktikkan Doa Harian, Adab Islami, dan Ibadah', induk: '', urutan: 2 },
      { level: 'TK', kelompok: 'agama', nama: 'Menunjukkan Sikap Kasih Sayang dan Akhlak Mulia', induk: '', urutan: 3 },
      { level: 'TK', kelompok: 'jatidiri', nama: 'Mengenali dan Mengelola Emosi Diri secara Positif', induk: '', urutan: 1 },
      { level: 'TK', kelompok: 'jatidiri', nama: 'Menjaga Kebersihan Diri, Kerapian, dan Keselamatan', induk: '', urutan: 2 },
      { level: 'TK', kelompok: 'jatidiri', nama: 'Keterampilan Motorik Kasar dan Motorik Halus', induk: '', urutan: 3 },
      { level: 'TK', kelompok: 'literasi', nama: 'Mengenal Huruf Hijaiyah, Abjad, dan Perbendaharaan Kata', induk: '', urutan: 1 },
      { level: 'TK', kelompok: 'literasi', nama: 'Mengenal Konsep Bilangan, Bentuk, dan Berhitung', induk: '', urutan: 2 },
      { level: 'TK', kelompok: 'literasi', nama: 'Eksplorasi Sains, Rasa Ingin Tahu, dan Ekspresi Seni Kreatif', induk: '', urutan: 3 },
    ];
  }

  // Kelas 1 & 2 (Fase A: belum ada IPAS)
  const isFaseA = grade === 'SD 1' || grade === 'SD 2';
  const umum = [
    { level: grade, kelompok: 'umum', nama: 'Pendidikan Agama Islam dan Budi Pekerti', induk: '', urutan: 1 },
    { level: grade, kelompok: 'umum', nama: 'Pendidikan Pancasila', induk: '', urutan: 2 },
    { level: grade, kelompok: 'umum', nama: 'Bahasa Indonesia', induk: '', urutan: 3 },
    { level: grade, kelompok: 'umum', nama: 'Matematika', induk: '', urutan: 4 },
  ];

  if (!isFaseA) {
    umum.push({ level: grade, kelompok: 'umum', nama: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', induk: '', urutan: 5 });
    umum.push({ level: grade, kelompok: 'umum', nama: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', induk: '', urutan: 6 });
    umum.push({ level: grade, kelompok: 'umum', nama: 'Seni Rupa', induk: 'Seni (Pilihan)', urutan: 7 });
    umum.push({ level: grade, kelompok: 'umum', nama: 'Bahasa Inggris', induk: '', urutan: 8 });
  } else {
    umum.push({ level: grade, kelompok: 'umum', nama: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)', induk: '', urutan: 5 });
    umum.push({ level: grade, kelompok: 'umum', nama: 'Seni Rupa', induk: 'Seni (Pilihan)', urutan: 6 });
    umum.push({ level: grade, kelompok: 'umum', nama: 'Bahasa Inggris', induk: '', urutan: 7 });
  }

  const mulok = [
    { level: grade, kelompok: 'mulok', nama: "Tahfidz Al-Qur'an", induk: '', urutan: 1 },
    { level: grade, kelompok: 'mulok', nama: 'Tauhid & Aqidah', induk: '', urutan: 2 },
    { level: grade, kelompok: 'mulok', nama: 'Fiqih Ibadah', induk: '', urutan: 3 },
    { level: grade, kelompok: 'mulok', nama: 'Bahasa Arab', induk: '', urutan: 4 },
  ];

  return [...umum, ...mulok];
};

export default function TeacherSubjects() {
  const [subjects, setSubjects] = useState(null);
  const [activeGrade, setActiveGrade] = useState('SD 1'); // 'TK' | 'SD 1'..'SD 6'
  const [activeKelompok, setActiveKelompok] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Modal Editor
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    level: 'SD 1',
    kelompok: 'umum',
    nama: '',
    induk: '',
    urutan: 1,
    isActive: 1,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Modal Salin ke Kelas Lain
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [targetCopyGrade, setTargetCopyGrade] = useState('SD 2');
  const [copying, setCopying] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchSchoolData();
      setSubjects((d && d.MasterSubjects) || []);
    } catch (e) {
      setError('Gagal memuat daftar mata pelajaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isTK = activeGrade === 'TK';
  const kelompokOptions = isTK ? TK_KELOMPOK : SD_KELOMPOK;
  const currentGradeMeta = ALL_GRADES.find((g) => g.key === activeGrade) || ALL_GRADES[1];

  const filteredSubjects = useMemo(() => {
    if (!subjects) return [];
    return subjects
      .filter((s) => s.level === activeGrade && (activeKelompok === 'all' || s.kelompok === activeKelompok))
      .sort((a, b) => {
        if (a.kelompok !== b.kelompok) {
          const orderKeys = kelompokOptions.map((k) => k.key);
          return orderKeys.indexOf(a.kelompok) - orderKeys.indexOf(b.kelompok);
        }
        return (Number(a.urutan) || 0) - (Number(b.urutan) || 0);
      });
  }, [subjects, activeGrade, activeKelompok, kelompokOptions]);

  const openAddModal = (defaultKelompok) => {
    setError('');
    const k = defaultKelompok || (isTK ? 'agama' : 'umum');
    const existingInK = (subjects || []).filter((s) => s.level === activeGrade && s.kelompok === k);
    setEditingItem(null);
    setFormData({
      level: activeGrade,
      kelompok: k,
      nama: '',
      induk: '',
      urutan: existingInK.length + 1,
      isActive: 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setError('');
    setEditingItem(item);
    setFormData({
      level: item.level || activeGrade,
      kelompok: item.kelompok || (isTK ? 'agama' : 'umum'),
      nama: item.nama || '',
      induk: item.induk || '',
      urutan: Number(item.urutan) || 1,
      isActive: item.isActive === 0 ? 0 : 1,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.nama.trim()) {
      setError('Nama mata pelajaran / aspek wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const row = {
        level: formData.level,
        kelompok: formData.kelompok,
        nama: formData.nama.trim(),
        induk: formData.induk.trim(),
        urutan: Number(formData.urutan) || 0,
        isActive: Number(formData.isActive) ? 1 : 0,
      };

      if (editingItem && editingItem.id) {
        const res = await mutateRow({
          action: 'update',
          sheetName: 'MasterSubjects',
          id: editingItem.id,
          expectedUpdatedAt: editingItem.updatedAt ?? null,
          row,
        });
        if (!res.success) {
          setError(res.error || 'Gagal mengubah data.');
          setSaving(false);
          return;
        }
        setSubjects((prev) =>
          prev.map((s) => (s.id === editingItem.id ? { ...s, ...row, updatedAt: res.updatedAt } : s))
        );
        showToast('Mata pelajaran berhasil diperbarui.');
      } else {
        const res = await mutateRow({
          action: 'add',
          sheetName: 'MasterSubjects',
          row,
        });
        if (!res.success) {
          setError(res.error || 'Gagal menambah data.');
          setSaving(false);
          return;
        }
        setSubjects((prev) => [...prev, { ...row, id: res.id, updatedAt: res.updatedAt }]);
        showToast(`Mata pelajaran baru berhasil ditambahkan ke ${formData.level}.`);
      }
      setModalOpen(false);
    } catch (err) {
      setError('Terjadi kesalahan jaringan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await mutateRow({
        action: 'delete',
        sheetName: 'MasterSubjects',
        id: confirmDelete.id,
        expectedUpdatedAt: confirmDelete.updatedAt ?? null,
      });
      if (!res.success) {
        setError(res.error || 'Gagal menghapus.');
        setDeleting(false);
        setConfirmDelete(null);
        return;
      }
      setSubjects((prev) => prev.filter((s) => s.id !== confirmDelete.id));
      showToast('Mata pelajaran berhasil dihapus.');
      setConfirmDelete(null);
    } catch (e) {
      setError('Gagal menghapus.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (item) => {
    const nextState = item.isActive === 0 ? 1 : 0;
    const res = await mutateRow({
      action: 'update',
      sheetName: 'MasterSubjects',
      id: item.id,
      expectedUpdatedAt: item.updatedAt ?? null,
      row: { isActive: nextState },
    });
    if (res.success) {
      setSubjects((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, isActive: nextState, updatedAt: res.updatedAt } : s))
      );
      showToast(`Mata pelajaran ${nextState ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } else {
      showToast('Gagal mengubah status aktif.', 'error');
    }
  };

  const handleMoveOrder = async (item, direction) => {
    const itemsInSameGroup = (subjects || [])
      .filter((s) => s.level === item.level && s.kelompok === item.kelompok)
      .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));

    const curIdx = itemsInSameGroup.findIndex((s) => s.id === item.id);
    if (curIdx < 0) return;
    const targetIdx = direction === 'up' ? curIdx - 1 : curIdx + 1;
    if (targetIdx < 0 || targetIdx >= itemsInSameGroup.length) return;

    const otherItem = itemsInSameGroup[targetIdx];
    const ops = [
      {
        action: 'update',
        sheetName: 'MasterSubjects',
        id: item.id,
        expectedUpdatedAt: item.updatedAt ?? null,
        row: { urutan: otherItem.urutan },
      },
      {
        action: 'update',
        sheetName: 'MasterSubjects',
        id: otherItem.id,
        expectedUpdatedAt: otherItem.updatedAt ?? null,
        row: { urutan: item.urutan },
      },
    ];

    const res = await mutateBatch(ops);
    if (res.success) {
      setSubjects((prev) =>
        prev.map((s) => {
          if (s.id === item.id) return { ...s, urutan: otherItem.urutan };
          if (s.id === otherItem.id) return { ...s, urutan: item.urutan };
          return s;
        })
      );
    } else {
      showToast('Gagal memindahkan urutan.', 'error');
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm(`Muat ulang susunan standar mata pelajaran untuk ${activeGrade}? Mapel yang belum ada akan ditambahkan.`)) return;
    setLoading(true);
    const defaults = getStandardDefaultsForGrade(activeGrade);
    const existingNames = new Set(
      (subjects || []).filter((s) => s.level === activeGrade).map((s) => s.nama.toLowerCase().trim())
    );

    const ops = defaults
      .filter((d) => !existingNames.has(d.nama.toLowerCase().trim()))
      .map((d) => ({
        action: 'add',
        sheetName: 'MasterSubjects',
        row: { ...d, isActive: 1 },
      }));

    if (ops.length === 0) {
      showToast(`Susunan standar ${activeGrade} sudah lengkap.`);
      setLoading(false);
      return;
    }

    const res = await mutateBatch(ops);
    if (res.success) {
      showToast(`${ops.length} mata pelajaran standar berhasil ditambahkan ke ${activeGrade}.`);
      await load();
    } else {
      setError('Gagal memuat standar: ' + (res.error || 'Terjadi kesalahan'));
    }
    setLoading(false);
  };

  // Salin seluruh mapel dari activeGrade ke targetCopyGrade
  const handleCopyGrade = async () => {
    if (targetCopyGrade === activeGrade) {
      setError('Pilih kelas target yang berbeda dari kelas asal.');
      return;
    }
    setCopying(true);
    setError('');

    const sourceSubjects = (subjects || []).filter((s) => s.level === activeGrade && s.isActive !== 0);
    if (sourceSubjects.length === 0) {
      setError(`Tidak ada mata pelajaran di ${activeGrade} untuk disalin.`);
      setCopying(false);
      return;
    }

    const targetExistingNames = new Set(
      (subjects || []).filter((s) => s.level === targetCopyGrade).map((s) => s.nama.toLowerCase().trim())
    );

    const ops = sourceSubjects
      .filter((s) => !targetExistingNames.has(s.nama.toLowerCase().trim()))
      .map((s) => ({
        action: 'add',
        sheetName: 'MasterSubjects',
        row: {
          level: targetCopyGrade,
          kelompok: s.kelompok,
          nama: s.nama,
          induk: s.induk || '',
          urutan: s.urutan || 1,
          isActive: 1,
        },
      }));

    if (ops.length === 0) {
      showToast(`Semua mata pelajaran dari ${activeGrade} sudah ada di ${targetCopyGrade}.`);
      setCopyModalOpen(false);
      setCopying(false);
      return;
    }

    const res = await mutateBatch(ops);
    if (res.success) {
      showToast(`Berhasil menyalin ${ops.length} mata pelajaran ke ${targetCopyGrade}.`);
      setCopyModalOpen(false);
      await load();
      setActiveGrade(targetCopyGrade);
    } else {
      setError('Gagal menyalin: ' + (res.error || 'Terjadi kesalahan'));
    }
    setCopying(false);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold text-white transition-all transform animate-bounce ${
            toast.type === 'error' ? 'bg-rose-500' : 'bg-secondary'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-secondary/10 text-secondary">
              <BookMarked size={22} />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900">Mata Pelajaran</h2>
              <p className="text-slate-400 font-bold text-xs mt-0.5">
                Pengaturan Kurikulum & Template Rapor per Kelas (TK & SD 1–6)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {!isTK && (
            <button
              onClick={() => {
                const nextOptions = ALL_GRADES.filter((g) => g.key !== 'TK' && g.key !== activeGrade);
                setTargetCopyGrade(nextOptions[0]?.key || 'SD 2');
                setError('');
                setCopyModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-black text-xs hover:bg-slate-50 transition-all shadow-sm"
              title="Salin daftar mapel kelas ini ke kelas SD lainnya"
            >
              <Copy size={14} /> Salin ke Kelas Lain
            </button>
          )}

          <button
            onClick={handleResetDefaults}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-black text-xs hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            title="Pulihkan paket standar bila ada yang terhapus"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Muat Standar {activeGrade}
          </button>

          <button
            onClick={() => openAddModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-white font-black text-xs hover:brightness-95 transition-all shadow-lg shadow-secondary/20"
          >
            <Plus size={16} /> Tambah {isTK ? 'Aspek' : 'Mapel'}
          </button>
        </div>
      </div>

      {/* Banner Penjelasan Alur Otomatis */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-secondary/20 rounded-2xl p-4 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-secondary text-white shrink-0 mt-0.5">
          <Sparkles size={16} />
        </div>
        <div className="text-xs">
          <p className="font-black text-slate-800">
            Kurikulum Rapor Aktif: <span className="text-secondary">{currentGradeMeta.label} ({currentGradeMeta.fase})</span>
          </p>
          <p className="text-slate-600 font-medium mt-0.5 leading-relaxed">
            Daftar mapel yang aktif untuk <b className="text-emerald-700">{activeGrade}</b> di bawah ini otomatis terpasang saat guru membuka rapor semester murid {activeGrade} di menu <b>E-Raport</b>. Guru tidak perlu mengetik nama mapel satu per satu dan tinggal menginput angka nilai serta deskripsi capaian.
          </p>
        </div>
      </div>

      {/* Tab Pemilihan Kelas (TK & SD 1 s/d SD 6) */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto hide-scrollbar w-fit max-w-full">
        {ALL_GRADES.map((g) => {
          const isSelected = activeGrade === g.key;
          const count = (subjects || []).filter((s) => s.level === g.key).length;
          return (
            <button
              key={g.key}
              onClick={() => {
                setActiveGrade(g.key);
                setActiveKelompok('all');
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <span>{g.label}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count} mapel • {g.fase}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-filter Kelompok */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
        <button
          onClick={() => setActiveKelompok('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeKelompok === 'all'
              ? 'bg-secondary/15 text-secondary font-black'
              : 'text-slate-400 hover:text-slate-600 bg-white border border-slate-100'
          }`}
        >
          Semua ({subjects ? subjects.filter((s) => s.level === activeGrade).length : 0})
        </button>
        {kelompokOptions.map((k) => {
          const count = (subjects || []).filter((s) => s.level === activeGrade && s.kelompok === k.key).length;
          return (
            <button
              key={k.key}
              onClick={() => setActiveKelompok(k.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeKelompok === k.key
                  ? 'bg-secondary/15 text-secondary font-black'
                  : 'text-slate-400 hover:text-slate-600 bg-white border border-slate-100'
              }`}
            >
              {k.label.split('(')[0].trim()} ({count})
            </button>
          );
        })}
      </div>

      {/* Tabel Master Mata Pelajaran */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && !subjects ? (
          <div className="flex justify-center py-24 text-slate-300">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="text-center py-20 px-4">
            <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="font-black text-slate-700">Belum ada mata pelajaran untuk {activeGrade}</p>
            <p className="text-slate-400 text-xs mt-1">
              Klik tombol "Muat Standar {activeGrade}" untuk memasukkan paket baku atau klik "Salin dari Kelas Lain".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-4 w-14 text-center">No</th>
                  <th className="py-4 px-4">Nama Mata Pelajaran / Aspek</th>
                  <th className="py-4 px-4">Kelompok</th>
                  {!isTK && <th className="py-4 px-4">Induk (Rapor)</th>}
                  <th className="py-4 px-4 text-center w-28">Status Rapor</th>
                  <th className="py-4 px-4 text-right w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSubjects.map((s, idx) => {
                  const kelConfig = kelompokOptions.find((k) => k.key === s.kelompok) || {
                    label: s.kelompok,
                    badge: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const isFirst = idx === 0 || filteredSubjects[idx - 1].kelompok !== s.kelompok;
                  const isLast = idx === filteredSubjects.length - 1 || filteredSubjects[idx + 1].kelompok !== s.kelompok;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-black text-slate-400 text-xs">{s.urutan || idx + 1}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className={s.isActive === 0 ? 'line-through text-slate-400' : ''}>{s.nama}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border ${kelConfig.badge}`}
                        >
                          {kelConfig.label.split('(')[0].trim()}
                        </span>
                      </td>
                      {!isTK && (
                        <td className="py-3.5 px-4 text-slate-500 font-semibold">
                          {s.induk || <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(s)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                            s.isActive !== 0
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                          title="Klik untuk ubah aktif / nonaktif di rapor murid"
                        >
                          {s.isActive !== 0 ? '✓ Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleMoveOrder(s, 'up')}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                            title="Naikkan urutan"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMoveOrder(s, 'down')}
                            disabled={isLast}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                            title="Turunkan urutan"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-secondary/10 hover:text-secondary"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add / Edit Subject */}
      <AnimatePresence>
        {modalOpen && (
          <Modal
            title={editingItem ? `Edit Mata Pelajaran (${formData.level})` : `Tambah Mata Pelajaran (${formData.level})`}
            onClose={() => !saving && setModalOpen(false)}
            maxWidthClass="max-w-md"
          >
            <form onSubmit={handleSave} className="p-6 md:p-8 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={15} /> {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Kelas / Jenjang
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                >
                  {ALL_GRADES.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label} ({g.fase})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Nama Mata Pelajaran / Aspek *
                </label>
                <input
                  type="text"
                  required
                  placeholder={formData.level === 'TK' ? 'mis. Menghafal Surah Pendek' : 'mis. Matematika'}
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Kelompok
                </label>
                <select
                  value={formData.kelompok}
                  onChange={(e) => setFormData({ ...formData, kelompok: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                >
                  {(formData.level === 'TK' ? TK_KELOMPOK : SD_KELOMPOK).map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.level !== 'TK' && (
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    Induk Pelajaran (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="mis. Seni (Pilihan)"
                    value={formData.induk}
                    onChange={(e) => setFormData({ ...formData, induk: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Dipakai bila mata pelajaran ini adalah sub-bagian (seperti Seni Rupa di bawah Seni).
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    Urutan
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.urutan}
                    onChange={(e) => setFormData({ ...formData, urutan: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    Status Rapor
                  </label>
                  <select
                    value={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                  >
                    <option value={1}>✓ Aktif di Rapor</option>
                    <option value={0}>Nonaktif (Sembunyikan)</option>
                  </select>
                </div>
              </div>
            </form>
            <ModalFooter>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-secondary text-white font-black text-xs hover:brightness-95 transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={15} /> : editingItem ? 'Simpan Perubahan' : 'Tambah Mapel'}
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Modal Salin ke Kelas Lain */}
      <AnimatePresence>
        {copyModalOpen && (
          <Modal
            title={`Salin Mapel dari ${activeGrade}`}
            onClose={() => !copying && setCopyModalOpen(false)}
            maxWidthClass="max-w-md"
          >
            <div className="p-6 md:p-8 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Fitur ini akan menyalin seluruh susunan mata pelajaran aktif dari <b>{activeGrade}</b> ke kelas target. Mapel yang sudah ada di kelas target tidak akan diduplikasi.
              </p>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={15} /> {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Pilih Kelas Tujuan
                </label>
                <select
                  value={targetCopyGrade}
                  onChange={(e) => setTargetCopyGrade(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all"
                >
                  {ALL_GRADES.filter((g) => g.key !== 'TK' && g.key !== activeGrade).map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label} ({g.fase})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ModalFooter>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCopyModalOpen(false)}
                  disabled={copying}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCopyGrade}
                  disabled={copying}
                  className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-black transition-all flex items-center justify-center gap-2"
                >
                  {copying ? <Loader2 className="animate-spin" size={15} /> : 'Salin Sekarang'}
                </button>
              </div>
            </ModalFooter>
          </Modal>
        )}
      </AnimatePresence>

      {/* Confirm Delete */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDialog
            title="Hapus Mata Pelajaran?"
            message={
              <>
                Yakin mau menghapus <b className="text-slate-800">{confirmDelete.nama}</b> dari master mata pelajaran {confirmDelete.level}? Rapor murid yang sudah pernah disimpan tidak akan terhapus.
              </>
            }
            confirmLabel="Hapus"
            loading={deleting}
            onCancel={() => !deleting && setConfirmDelete(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
