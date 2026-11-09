import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  UserX,
  Sparkles,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getAttendanceMembers,
  addAttendanceMember,
  updateAttendanceMember,
  deleteAttendanceMember,
} from '../../services/gsheet';
import { Modal, ModalFooter, ConfirmDialog, ToastNotification } from './ModalKit';

const ALL_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'];
const DEFAULT_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const parseWorkDays = (val) => {
  if (!val) return DEFAULT_DAYS;
  if (Array.isArray(val)) return val;
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_DAYS;
  } catch (e) {
    return DEFAULT_DAYS;
  }
};

export default function TeacherAttendanceMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [form, setForm] = useState({
    name: '',
    nip: '',
    role: '',
    work_start_time: '07:15',
    late_threshold_time: '07:30',
    work_end_time: '15:00',
    work_days: DEFAULT_DAYS,
    is_active: 1,
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', title: '' });
  const showToast = (message, type = 'success', title = '') => {
    setToast({ show: true, message, type, title });
  };

  const loadData = async () => {
    setLoading(true);
    const res = await getAttendanceMembers();
    if (res.success) {
      setMembers(res.members || []);
    } else {
      showToast(res.error || 'Gagal memuat data guru absensi.', 'error', 'Error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter Search
  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.nip || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q)
    );
  }, [members, search]);

  const handleOpenAdd = () => {
    setEditingMember(null);
    setForm({
      name: '',
      nip: '',
      role: '',
      work_start_time: '07:15',
      late_threshold_time: '07:30',
      work_end_time: '15:00',
      work_days: DEFAULT_DAYS,
      is_active: 1,
    });
    setFormModalOpen(true);
  };

  const handleOpenEdit = (m) => {
    setEditingMember(m);
    setForm({
      name: m.name || '',
      nip: m.nip || '',
      role: m.role || '',
      work_start_time: m.work_start_time || '07:15',
      late_threshold_time: m.late_threshold_time || '07:30',
      work_end_time: m.work_end_time || '15:00',
      work_days: parseWorkDays(m.work_days),
      is_active: m.is_active != null ? Number(m.is_active) : 1,
    });
    setFormModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Nama guru wajib diisi.', 'error', 'Validasi Form');
      return;
    }

    if (!form.work_days || form.work_days.length === 0) {
      showToast('Pilih minimal 1 hari kerja wajib masuk.', 'error', 'Validasi Form');
      return;
    }

    setSubmitting(true);
    const payload = {
      ...form,
      work_days: JSON.stringify(form.work_days),
    };
    let res;
    if (editingMember) {
      res = await updateAttendanceMember({ id: editingMember.id, ...payload });
    } else {
      res = await addAttendanceMember(payload);
    }
    setSubmitting(false);

    if (res.success) {
      showToast(
        editingMember
          ? `Data guru & jadwal ${form.name} berhasil diperbarui.`
          : `Guru ${form.name} berhasil didaftarkan ke absensi.`,
        'success',
        'Berhasil'
      );
      setFormModalOpen(false);
      loadData();
    } else {
      showToast(res.error || 'Gagal menyimpan data.', 'error', 'Error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteAttendanceMember(deleteTarget.id);
    setDeleting(false);

    if (res.success) {
      showToast(`Guru ${deleteTarget.name} berhasil dihapus dari daftar absensi.`, 'success', 'Dihapus');
      setDeleteTarget(null);
      loadData();
    } else {
      showToast(res.error || 'Gagal menghapus data guru.', 'error', 'Error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <ToastNotification
        toast={toast}
        onClose={() => setToast({ show: false, message: '', type: 'success', title: '' })}
      />

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-secondary to-forest text-white rounded-2xl shadow-lg shadow-secondary/20">
            <Users size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                Data Guru & Jadwal Presensi
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-secondary text-xs font-black border border-secondary/20">
                {members.length} Guru
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
              Kelola daftar guru yang wajib absen beserta jam masuk, batas toleransi, dan jam pulang individual.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
            title="Muat Ulang Data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin text-secondary' : ''} />
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-secondary hover:bg-forest text-white font-black text-xs sm:text-sm shadow-lg shadow-secondary/25 transition-all transform active:scale-95"
          >
            <Plus size={18} />
            <span>Tambah Guru Presensi</span>
          </button>
        </div>
      </div>

      {/* Pencarian & Ringkasan */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama guru, NIP, atau jabatan…"
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-secondary transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-black text-slate-500 self-end sm:self-auto">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <UserCheck size={14} />
            {members.filter((m) => m.is_active === 1 || m.is_active === '1').length} Aktif
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            <UserX size={14} />
            {members.filter((m) => m.is_active === 0 || m.is_active === '0').length} Non-Aktif
          </span>
        </div>
      </div>

      {/* Konten Daftar Guru */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <RefreshCw size={32} className="animate-spin text-secondary mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">Memuat data guru presensi…</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <Users size={48} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-black text-slate-700">Tidak ada data guru yang cocok</h3>
          <p className="text-xs font-bold text-slate-400 mt-1 max-w-sm mx-auto">
            {search
              ? 'Silakan coba kata kunci pencarian yang lain.'
              : 'Belum ada guru yang terdaftar. Klik tombol "Tambah Guru Presensi" di atas.'}
          </p>
        </div>
      ) : (
        <>
          {/* Tampilan Desktop Tabel */}
          <div className="hidden lg:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-4 px-6">Guru & NIP</th>
                    <th className="py-4 px-4">Jabatan / Role</th>
                    <th className="py-4 px-4 text-center">Hari Masuk</th>
                    <th className="py-4 px-4 text-center">Jam Masuk</th>
                    <th className="py-4 px-4 text-center">Batas Toleransi</th>
                    <th className="py-4 px-4 text-center">Jam Pulang</th>
                    <th className="py-4 px-4 text-center">Status Presensi</th>
                    <th className="py-4 px-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {filteredMembers.map((m) => {
                    const isActive = m.is_active === 1 || m.is_active === '1';
                    const days = parseWorkDays(m.work_days);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-black text-xs shrink-0">
                              {(m.name || 'G').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900 text-sm">{m.name}</p>
                              <p className="text-[11px] font-semibold text-slate-400">
                                {m.nip ? `NIP: ${m.nip}` : 'ID: ' + m.id.slice(0, 12)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-black text-[11px]">
                            {m.role || 'Tenaga Pendidik'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {(() => {
                            if (days.length === 7) return <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-black border border-emerald-200">Setiap Hari</span>;
                            if (days.length === 6 && !days.includes('Ahad')) return <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-black border border-emerald-200">Senin - Sabtu</span>;
                            if (days.length === 5 && !days.includes('Sabtu') && !days.includes('Ahad')) return <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 text-[11px] font-black border border-blue-200">Senin - Jumat</span>;
                            return <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-black">{days.length} Hari / mg</span>;
                          })()}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-black text-slate-800">
                          {m.work_start_time || '07:15'} <span className="text-[10px] text-slate-400">WIB</span>
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-black text-amber-600">
                          {m.late_threshold_time || '07:30'} <span className="text-[10px] text-slate-400">WIB</span>
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-black text-slate-800">
                          {m.work_end_time || '15:00'} <span className="text-[10px] text-slate-400">WIB</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            }`}
                          >
                            {isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {isActive ? 'Wajib Absen' : 'Non-Aktif'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(m)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-secondary hover:text-white text-slate-600 transition-all"
                              title="Edit Jam Kerja & Data Guru"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(m)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-600 transition-all"
                              title="Hapus dari Master Absensi"
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
          </div>

          {/* Tampilan Mobile Kartu Responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 lg:hidden">
            {filteredMembers.map((m) => {
              const isActive = m.is_active === 1 || m.is_active === '1';
              return (
                <div
                  key={m.id}
                  className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3.5 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center font-black text-sm shrink-0">
                        {(m.name || 'G').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-sm leading-tight">{m.name}</h3>
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                          {m.nip ? `NIP: ${m.nip}` : m.role || 'Tenaga Pendidik'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isActive ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </div>

                  {/* Jam Kerja Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center font-mono">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Masuk</p>
                      <p className="text-xs font-black text-slate-800 mt-0.5">{m.work_start_time || '07:15'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Toleransi</p>
                      <p className="text-xs font-black text-amber-600 mt-0.5">{m.late_threshold_time || '07:30'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pulang</p>
                      <p className="text-xs font-black text-slate-800 mt-0.5">{m.work_end_time || '15:00'}</p>
                    </div>
                  </div>

                  {/* Hari Wajib Masuk Mobile Badge */}
                  <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar size={12} />
                      <span>Hari Kerja:</span>
                    </span>
                    <span className="font-extrabold text-secondary">
                      {(() => {
                        const days = parseWorkDays(m.work_days);
                        if (days.length === 7) return 'Setiap Hari';
                        if (days.length === 6 && !days.includes('Ahad')) return 'Senin - Sabtu';
                        if (days.length === 5 && !days.includes('Sabtu') && !days.includes('Ahad')) return 'Senin - Jumat';
                        return `${days.length} Hari / minggu`;
                      })()}
                    </span>
                  </div>

                  {/* Tombol Aksi Mobile */}
                  <div className="flex gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(m)}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-secondary hover:text-white text-slate-700 font-black text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <Edit2 size={13} />
                      <span>Edit Jadwal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(m)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-500 hover:text-white text-slate-500 transition-all"
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL FORM TAMBAH / EDIT GURU PRESENSI */}
      <AnimatePresence>
        {formModalOpen && (
          <Modal
            onClose={() => !submitting && setFormModalOpen(false)}
            title={editingMember ? 'Edit Data & Jadwal Guru' : 'Tambah Guru ke Presensi'}
          >
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  Nama Lengkap Guru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Ustadz Ahmad, S.Pd."
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-secondary transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">NIP / Kode Guru</label>
                  <input
                    type="text"
                    value={form.nip}
                    onChange={(e) => setForm({ ...form, nip: e.target.value })}
                    placeholder="Contoh: 19890101..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">Jabatan / Role</label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Contoh: Wali Kelas 3 / Guru PAI"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
              </div>

              {/* Setting Jam Kerja Individual */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
                  <Clock size={15} className="text-secondary" />
                  <span>Jadwal Jam Kerja & Batas Toleransi</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 leading-snug">
                  Setiap guru dapat memiliki jam masuk dan batas toleransi berbeda sesuai kebijakan sekolah.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 mb-1">
                      Jam Masuk (Mulai)
                    </label>
                    <input
                      type="time"
                      required
                      value={form.work_start_time}
                      onChange={(e) => setForm({ ...form, work_start_time: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs font-black text-slate-800 focus:outline-none focus:border-secondary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-amber-700 mb-1">
                      Batas Toleransi (Telat)
                    </label>
                    <input
                      type="time"
                      required
                      value={form.late_threshold_time}
                      onChange={(e) => setForm({ ...form, late_threshold_time: e.target.value })}
                      className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-mono text-xs font-black text-amber-700 focus:outline-none focus:border-secondary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 mb-1">
                      Jam Pulang
                    </label>
                    <input
                      type="time"
                      required
                      value={form.work_end_time}
                      onChange={(e) => setForm({ ...form, work_end_time: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs font-black text-slate-800 focus:outline-none focus:border-secondary transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Setting Hari Kerja Wajib Presensi */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-xs">
                    <Calendar size={15} className="text-secondary" />
                    <span>Hari Kerja Wajib Presensi</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, work_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] })}
                      className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-50 text-secondary border border-secondary/20 hover:bg-emerald-100 transition-colors"
                    >
                      Senin - Sabtu
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, work_days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] })}
                      className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-slate-200/80 text-slate-700 hover:bg-slate-300 transition-colors"
                    >
                      Senin - Jumat
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, work_days: ALL_DAYS })}
                      className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-slate-200/80 text-slate-700 hover:bg-slate-300 transition-colors"
                    >
                      Semua
                    </button>
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 leading-snug">
                  Pilih hari kerja guru. Sistem akan otomatis mendeteksi status <strong className="text-rose-600">ALPHA</strong> jika guru tidak hadir pada hari yang dipilih.
                </p>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                  {ALL_DAYS.map((day) => {
                    const isSelected = form.work_days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const nextDays = isSelected
                            ? form.work_days.filter((d) => d !== day)
                            : [...form.work_days, day];
                          setForm({ ...form, work_days: nextDays });
                        }}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-black transition-all border ${
                          isSelected
                            ? 'bg-secondary text-white border-secondary shadow-sm shadow-secondary/20'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Wajib Absen */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <p className="text-xs font-black text-slate-800">Status Wajib Presensi</p>
                  <p className="text-[11px] font-semibold text-slate-400">
                    Jika non-aktif, nama guru ini tidak akan muncul di daftar absen harian.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active === 1}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                </label>
              </div>

              <ModalFooter>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormModalOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-xs hover:bg-slate-200 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-secondary text-white font-black text-xs hover:bg-forest shadow-md shadow-secondary/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    {submitting && <RefreshCw size={14} className="animate-spin" />}
                    <span>{submitting ? 'Menyimpan…' : editingMember ? 'Perbarui Data' : 'Simpan Guru'}</span>
                  </button>
                </div>
              </ModalFooter>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI HAPUS GURU */}
      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDialog
            isOpen={true}
            title="Hapus Guru dari Presensi?"
            message={`Apakah Anda yakin ingin menghapus "${deleteTarget.name}" dari master absensi? Riwayat absensi lama yang pernah tercatat tidak akan terhapus.`}
            confirmText="Ya, Hapus Guru"
            cancelText="Batal"
            isDestructive={true}
            isLoading={deleting}
            onConfirm={handleConfirmDelete}
            onCancel={() => !deleting && setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

