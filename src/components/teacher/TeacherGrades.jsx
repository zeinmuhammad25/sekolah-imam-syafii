import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Pencil, Trash2, ArrowLeft, Loader2, AlertTriangle,
  Award, Check, Eye, EyeOff, Calendar, Users, Save, X, BookOpen
} from 'lucide-react';
import {
  fetchSchoolData,
  fetchExamSessions,
  fetchExamSessionDetail,
  saveExamSession,
  toggleExamPublish,
  deleteExamSession
} from '../../services/gsheet';

const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];

const COMMON_SUBJECTS = [
  'Pendidikan Agama Islam',
  'Tauhid & Aqidah',
  'Fiqih Ibadah',
  'Tahfidz Al-Qur\'an',
  'Bahasa Arab',
  'Bahasa Indonesia',
  'Matematika',
  'IPAS (Sains & Sosial)',
  'Pendidikan Pancasila',
  'Seni Rupa',
  'PJOK (Olahraga)',
  'Bahasa Inggris'
];

export default function TeacherGrades() {
  const [selectedGrade, setSelectedGrade] = useState('SD 1');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Editor State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    id: '',
    grade: 'SD 1',
    subject: '',
    title: '',
    semester: '1',
    academic_year: '2025/2026',
    exam_date: new Date().toISOString().slice(0, 10),
    is_published: 1,
  });
  const [studentGrades, setStudentGrades] = useState({}); // { [studentId]: { score: '', notes: '' } }
  const [searchFilter, setSearchFilter] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Muat daftar sesi ujian saat kelas berubah
  const loadSessions = async (grade) => {
    setLoading(true);
    setError('');
    const res = await fetchExamSessions(grade);
    if (res.success) {
      setSessions(res.sessions || []);
    } else {
      setError(res.message || 'Gagal memuat daftar ujian');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSessions(selectedGrade);
  }, [selectedGrade]);

  // Buka Editor Ujian Baru
  const handleCreateNew = async () => {
    setEditorLoading(true);
    setEditorOpen(true);
    setEditingSession(null);
    setFormData({
      id: '',
      grade: selectedGrade,
      subject: COMMON_SUBJECTS[0],
      title: 'Penilaian Harian 1',
      semester: '1',
      academic_year: '2025/2026',
      exam_date: new Date().toISOString().slice(0, 10),
      is_published: 1,
    });

    // Ambil daftar siswa kelas tersebut dari snapshot master data
    const data = await fetchSchoolData();
    const classStudents = (data?.Students || [])
      .filter((s) => s.kelas === selectedGrade && s.status !== 'Pindah' && s.status !== 'Tamat')
      .sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa));

    setStudents(classStudents);
    const initialGrades = {};
    classStudents.forEach((s) => {
      initialGrades[s.id] = { score: '', notes: '' };
    });
    setStudentGrades(initialGrades);
    setEditorLoading(false);
  };

  // Buka Editor untuk Sesi yang Ada
  const handleEditSession = async (session) => {
    setEditorLoading(true);
    setEditorOpen(true);
    setEditingSession(session);
    setFormData({
      id: session.id,
      grade: session.grade,
      subject: session.subject,
      title: session.title,
      semester: session.semester || '1',
      academic_year: session.academic_year || '2025/2026',
      exam_date: session.exam_date || '',
      is_published: session.is_published ? 1 : 0,
    });

    const res = await fetchExamSessionDetail(session.id);
    if (res.success) {
      setStudents(res.students || []);
      const gradesMap = {};
      (res.students || []).forEach((s) => {
        gradesMap[s.id] = { score: s.score !== '' ? s.score : '', notes: s.notes || '' };
      });
      setStudentGrades(gradesMap);
    } else {
      showToast(res.message || 'Gagal memuat detail ujian', 'error');
      setEditorOpen(false);
    }
    setEditorLoading(false);
  };

  // Simpan Sesi & Nilai Ujian
  const handleSave = async (publishOverride = null) => {
    if (!formData.subject.trim() || !formData.title.trim()) {
      showToast('Mata pelajaran dan judul ujian harus diisi!', 'error');
      return;
    }

    setSaving(true);
    const sessionToSave = {
      ...formData,
      is_published: publishOverride !== null ? publishOverride : formData.is_published,
    };

    const gradesPayload = Object.entries(studentGrades).map(([student_id, val]) => ({
      student_id,
      score: val.score,
      notes: val.notes,
    }));

    const res = await saveExamSession(sessionToSave, gradesPayload);
    if (res.success) {
      showToast(res.message || 'Nilai ujian berhasil disimpan!', 'success');
      setEditorOpen(false);
      loadSessions(selectedGrade);
    } else {
      showToast(res.message || 'Gagal menyimpan nilai', 'error');
    }
    setSaving(false);
  };

  // Toggle Publikasi Langsung dari Tabel
  const handleTogglePublish = async (session) => {
    const nextState = session.is_published ? 0 : 1;
    const res = await toggleExamPublish(session.id, nextState);
    if (res.success) {
      showToast(`Status ujian diubah menjadi ${nextState ? 'Diterbitkan ke Ortu' : 'Draft'}`, 'success');
      loadSessions(selectedGrade);
    } else {
      showToast(res.message || 'Gagal mengubah status', 'error');
    }
  };

  // Hapus Sesi Ujian
  const handleDelete = async (session) => {
    if (!window.confirm(`Hapus ujian "${session.title} - ${session.subject}" beserta seluruh nilai di dalamnya?`)) {
      return;
    }
    const res = await deleteExamSession(session.id);
    if (res.success) {
      showToast('Ujian berhasil dihapus', 'success');
      loadSessions(selectedGrade);
    } else {
      showToast(res.message || 'Gagal menghapus ujian', 'error');
    }
  };

  // Nilai rata-rata pada editor
  const stats = useMemo(() => {
    const scores = Object.values(studentGrades)
      .map((g) => Number(g.score))
      .filter((s) => !isNaN(s) && s > 0);
    if (scores.length === 0) return { avg: 0, count: 0 };
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      avg: (sum / scores.length).toFixed(1),
      count: scores.length,
    };
  }, [studentGrades]);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast.show && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border animate-fade-in ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-primary/10 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-widest mb-1">
            <Award size={14} /> Penilaian Ujian Berkala
          </div>
          <h1 className="font-display text-2xl font-semibold text-primary">Nilai Ujian & Portal Wali Murid</h1>
          <p className="text-primary/60 text-xs mt-1">
            Input hasil ulangan/ujian harian per kelas. Nilai yang diterbitkan dapat langsung dipantau oleh orang tua murid.
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="bg-primary hover:bg-forest text-ivory px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/20 transition-all active:scale-95"
        >
          <Plus size={16} /> Buat Ujian Baru
        </button>
      </div>

      {/* Tabs Kelas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-primary/10">
        {GRADES.map((g) => (
          <button
            key={g}
            onClick={() => {
              setSelectedGrade(g);
              setEditorOpen(false);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedGrade === g
                ? 'bg-primary text-ivory shadow-sm'
                : 'bg-white text-primary/60 hover:text-primary hover:bg-primary/5 border border-primary/10'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Daftar Sesi Ujian */}
      {!editorOpen && (
        <div className="bg-white rounded-2xl border border-primary/10 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-primary/5 flex items-center justify-between gap-4">
            <h2 className="font-display font-semibold text-primary text-base flex items-center gap-2">
              <BookOpen size={18} className="text-secondary" />
              Daftar Ujian Kelas {selectedGrade} ({sessions.length})
            </h2>
          </div>

          {loading ? (
            <div className="py-16 text-center text-primary/50 flex flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin text-primary/40" />
              <span className="text-xs">Memuat daftar ujian...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 text-xs">{error}</div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-primary/50">
              <Award size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Belum ada sesi ujian untuk kelas {selectedGrade}</p>
              <p className="text-xs text-primary/40 mt-1">Klik tombol "Buat Ujian Baru" di atas untuk mulai menginput nilai.</p>
            </div>
          ) : (
            <div className="divide-y divide-primary/5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-5 hover:bg-primary/[0.02] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-lg">
                        {s.subject}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          s.is_published
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.is_published ? <Eye size={11} /> : <EyeOff size={11} />}
                        {s.is_published ? 'Terbit ke Ortu' : 'Draft (Guru Saja)'}
                      </span>
                    </div>

                    <h3 className="font-semibold text-primary text-base">{s.title}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-primary/50">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} /> {s.exam_date || 'Tanggal tidak diatur'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users size={13} /> {s.student_count || 0} Siswa Dinilai
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-primary/80">
                        Rata-rata: {s.avg_score != null ? s.avg_score : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleTogglePublish(s)}
                      title={s.is_published ? 'Tarik kembali ke Draft' : 'Terbitkan ke Portal Ortu'}
                      className={`p-2 rounded-xl text-xs font-medium border transition-colors ${
                        s.is_published
                          ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {s.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>

                    <button
                      onClick={() => handleEditSession(s)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary/5 hover:bg-primary/10 text-primary flex items-center gap-1.5 transition-colors"
                    >
                      <Pencil size={14} /> Edit Nilai
                    </button>

                    <button
                      onClick={() => handleDelete(s)}
                      className="p-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                      title="Hapus Ujian"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor Ujian & Input Nilai Massal Siswa */}
      {editorOpen && (
        <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-primary/10 pb-4">
            <button
              onClick={() => setEditorOpen(false)}
              className="text-primary/60 hover:text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={16} /> Kembali ke Daftar
            </button>
            <h2 className="font-display font-semibold text-primary text-lg">
              {editingSession ? `Edit Nilai: ${formData.title}` : `Buat Sesi Ujian Baru — Kelas ${selectedGrade}`}
            </h2>
            <div className="w-16" />
          </div>

          {editorLoading ? (
            <div className="py-16 text-center text-primary/50 flex flex-col items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin text-primary/40" />
              <span className="text-xs">Menyiapkan daftar siswa kelas {selectedGrade}...</span>
            </div>
          ) : (
            <>
              {/* Header Informasi Ujian */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-primary/[0.02] p-4 rounded-xl border border-primary/5">
                <div>
                  <label className="block text-[11px] font-bold text-primary/70 uppercase mb-1">
                    Mata Pelajaran <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="subjects-list"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Pilih atau ketik mapel"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <datalist id="subjects-list">
                    {COMMON_SUBJECTS.map((sub) => (
                      <option key={sub} value={sub} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-primary/70 uppercase mb-1">
                    Nama / Judul Ujian <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="mis. Penilaian Harian 1"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-primary/70 uppercase mb-1">
                    Tanggal Ujian
                  </label>
                  <input
                    type="date"
                    value={formData.exam_date}
                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-primary/70 uppercase mb-1">
                    Tahun Ajaran / Semester
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.academic_year}
                      onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                      placeholder="2025/2026"
                      className="w-2/3 text-xs px-2.5 py-2 rounded-lg border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      className="w-1/3 text-xs px-1.5 py-2 rounded-lg border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="1">Ganjil</option>
                      <option value="2">Genap</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Status Publikasi & Live Stats */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-ivory border border-secondary/20">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_published === 1}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked ? 1 : 0 })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                  <div>
                    <span className="text-xs font-bold text-primary block">
                      {formData.is_published ? 'Terbitkan ke Portal Wali Murid' : 'Simpan sebagai Draft Saja'}
                    </span>
                    <span className="text-[10px] text-primary/50">
                      {formData.is_published
                        ? 'Orang tua dapat langsung melihat nilai ini di /portal-ortu'
                        : 'Hanya bisa dilihat oleh guru di dashboard'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-primary">
                  <span>Siswa Terisi: <strong className="text-secondary font-bold">{stats.count}</strong> / {students.length}</span>
                  <span>•</span>
                  <span>Rata-Rata Nilai: <strong className="text-secondary font-bold">{stats.avg}</strong></span>
                </div>
              </div>

              {/* Filter Siswa */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-primary/40" />
                <input
                  type="text"
                  placeholder="Cari nama siswa di daftar ini..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Tabel Penginputan Nilai Massal Siswa */}
              <div className="border border-primary/10 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-primary/5 text-primary/70 uppercase text-[10px] font-bold border-b border-primary/10">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">No</th>
                        <th className="py-3 px-4 min-w-[200px]">Nama Siswa</th>
                        <th className="py-3 px-4 w-28">NISN</th>
                        <th className="py-3 px-4 w-32">Nilai (0 - 100)</th>
                        <th className="py-3 px-4 min-w-[240px]">Catatan / Pesan Guru untuk Ortu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {students
                        .filter((s) => s.nama_siswa.toLowerCase().includes(searchFilter.toLowerCase()))
                        .map((s, idx) => (
                          <tr key={s.id} className="hover:bg-primary/[0.01]">
                            <td className="py-3 px-4 text-center text-primary/40">{idx + 1}</td>
                            <td className="py-3 px-4 font-semibold text-primary">
                              {s.nama_siswa}
                              <span className="block text-[10px] font-normal text-primary/40">{s.jenis_kelamin || ''}</span>
                            </td>
                            <td className="py-3 px-4 text-primary/50 text-[11px]">{s.nisn || '-'}</td>
                            <td className="py-3 px-4">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={studentGrades[s.id]?.score ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStudentGrades((prev) => ({
                                    ...prev,
                                    [s.id]: { ...prev[s.id], score: val },
                                  }));
                                }}
                                placeholder="0 - 100"
                                className="w-24 px-2.5 py-1.5 rounded-lg border border-primary/20 font-bold text-center text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input
                                type="text"
                                value={studentGrades[s.id]?.notes ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStudentGrades((prev) => ({
                                    ...prev,
                                    [s.id]: { ...prev[s.id], notes: val },
                                  }));
                                }}
                                placeholder="Catatan perkembangan ananda (opsional)..."
                                className="w-full px-3 py-1.5 rounded-lg border border-primary/20 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tombol Simpan Bar Bawah */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-primary/10">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  disabled={saving}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-primary/60 hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(0)}
                  disabled={saving}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
                  Simpan sebagai Draft
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(1)}
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-forest text-ivory shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Simpan & Terbitkan ke Wali Murid
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

