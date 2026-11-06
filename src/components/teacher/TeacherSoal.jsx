import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  FileEdit, 
  Trash2, 
  ChevronRight, 
  BookOpen, 
  AlertCircle, 
  CheckCircle2, 
  FileDown, 
  X, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown,
  Copy,
  Layers,
  Sparkles,
  HelpCircle,
  FileCheck,
  Check,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { mutateRow, fetchSchoolData } from '../../services/gsheet';
import { ConfirmDialog } from './ModalKit';
import { jsPDF } from "jspdf";
import "jspdf-autotable";

const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];

const normGrade = (g) => String(g || '').trim().replace(/^sd\s*(\d+)$/i, 'SD $1').toUpperCase();

export default function TeacherSoal() {
  const [activeGrade, setActiveGrade] = useState(() => localStorage.getItem('last_active_grade_soal') || 'SD 1');

  const changeActiveGrade = (grade) => {
    setActiveGrade(grade);
    try { localStorage.setItem('last_active_grade_soal', grade); } catch {}
  };
  
  // Data Master Mata Pelajaran (Otomatis dari Master Mapel)
  const [masterSubjects, setMasterSubjects] = useState([]);
  
  // Data Folder Ujian & Soal dari D1
  const [allFolders, setAllFolders] = useState([]); // [{id, grade, name}]
  const [questions, setQuestions] = useState({});   // { [folderId]: [questions] }
  
  // Folder / Mapel yang sedang dipilih guru
  const [activeExamFolder, setActiveExamFolder] = useState(null);
  
  // Modal Input Soal
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    text: '',
    options: { a: '', b: '', c: '', d: '' },
    correctAnswer: 'a',
    type: 'pg'
  });

  // Modal Cetak Pilihan (Lembar Siswa vs Kunci Jawaban Guru)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Modal Cetak Multi-Mapel
  const [isMultiExportModalOpen, setIsMultiExportModalOpen] = useState(false);
  const [selectedSubjectsForExport, setSelectedSubjectsForExport] = useState([]);
  const [multiExportMode, setMultiExportMode] = useState('STUDENT'); // 'STUDENT' | 'ANSWER_KEY' | 'BOTH'
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [notify, setNotify] = useState(null); // { type: 'success' | 'error' | 'warning', title, message }
  const [confirmingDeleteQuestionId, setConfirmingDeleteQuestionId] = useState(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const savingRef = useRef(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [orderDraft, setOrderDraft] = useState([]);

  // Sequence ref untuk isolasi agar hasil sync lama tidak menimpa state yang sedang diedit
  const writeSeqRef = useRef(0);
  const lastVersionRef = useRef(null);
  const editingRef = useRef(null);
  useEffect(() => { editingRef.current = editingQuestion; }, [editingQuestion]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!notify) return;
    const t = setTimeout(() => setNotify(null), notify.type === 'error' ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [notify]);

  // 1. Load Data dari Server (Master Mapel, Folder Soal, dan Butir Soal)
  const loadAllData = async (showSilently = false) => {
    if (showSilently && savingRef.current) return;
    const seq = writeSeqRef.current;
    if (!showSilently) setIsSyncing(true);

    try {
      const data = await fetchSchoolData();
      if (showSilently && (seq !== writeSeqRef.current || savingRef.current)) return;
      if (showSilently && data && data._version != null && data._version === lastVersionRef.current) return;
      if (data && data._version != null) lastVersionRef.current = data._version;

      if (data) {
        // Simpan Master Mapel
        if (data.MasterSubjects) {
          setMasterSubjects(data.MasterSubjects);
        }

        // Simpan Folders & Soal dari QuestionFolders & Questions (atau TeacherQuestions)
        let qMap = {};
        let fList = [];

        if (Array.isArray(data.QuestionFolders) && data.QuestionFolders.length > 0) {
          fList = data.QuestionFolders;
        }

        if (data.TeacherQuestions && Array.isArray(data.TeacherQuestions)) {
          data.TeacherQuestions.forEach(tq => {
            const gr = tq.grade;
            const examTypes = tq?.data?.examTypes?.[gr];
            if (Array.isArray(examTypes)) {
              examTypes.forEach(et => {
                if (et && et.id && !fList.some(existing => String(existing.id) === String(et.id))) {
                  fList.push({ id: String(et.id), grade: gr, name: et.name, updatedAt: et.updatedAt });
                }
              });
            }
            if (tq && tq.data && tq.data.questions) {
              Object.assign(qMap, tq.data.questions);
            }
          });
        }

        if (Array.isArray(data.Questions)) {
          data.Questions.forEach(q => {
            const fid = String(q.folderId);
            if (!qMap[fid]) qMap[fid] = [];
            if (!qMap[fid].some(x => String(x.id) === String(q.id))) {
              qMap[fid].push({
                id: String(q.id),
                text: q.text,
                options: { a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD },
                correctAnswer: q.correctAnswer,
                type: q.type || 'pg',
                updatedAt: q.updatedAt,
                order: q.order
              });
            }
          });
        }

        setAllFolders(fList);
        setQuestions(qMap);
      }
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      if (!showSilently) setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const refresh = () => { if (document.visibilityState === 'visible') loadAllData(true); };
    const interval = setInterval(refresh, 20000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // 2. Daftar Mata Pelajaran untuk Kelas Aktif (Tersinkron 100% dari Master Mapel)
  const currentClassSubjects = useMemo(() => {
    const isTK = activeGrade === 'TK';
    return (masterSubjects || [])
      .filter((s) => (s.level === activeGrade || (!isTK && s.level === 'SD')) && s.isActive !== 0)
      .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0));
  }, [masterSubjects, activeGrade]);

  // Map nama mapel -> folder terdaftar di database (toleran huruf besar-kecil, spasi & format grade)
  const subjectFolders = useMemo(() => {
    const list = allFolders.filter((f) => normGrade(f.grade) === normGrade(activeGrade));
    const map = new Map();
    list.forEach((f) => {
      if (f && f.name) {
        map.set(f.name.trim().toLowerCase(), f);
      }
    });
    return map;
  }, [allFolders, activeGrade]);

  // Auto-upgrade: jika activeExamFolder masih bertipe 'auto:NamaMapel' dan folder fisiknya ditemukan,
  // langsung switch ke ID fisik agar seluruh butir soal yang sudah ada tampil instan
  useEffect(() => {
    if (activeExamFolder && activeExamFolder.startsWith('auto:')) {
      const subjectName = activeExamFolder.replace('auto:', '').trim().toLowerCase();
      const foundFolder = subjectFolders.get(subjectName);
      if (foundFolder && foundFolder.id) {
        setActiveExamFolder(String(foundFolder.id));
      }
    }
  }, [activeExamFolder, subjectFolders]);

  // Otomatis pilih mapel saat pertama kali dimuat, saat data server tiba, atau saat ganti tab jenjang
  useEffect(() => {
    if (currentClassSubjects.length > 0) {
      // Pertahankan mapel aktif jika masih relevan, atau pilih mapel pertama
      const currentSubjName = activeSubjectObj?.nama?.trim().toLowerCase();
      const matchedSubject = currentSubjName
        ? currentClassSubjects.find(s => s.nama.trim().toLowerCase() === currentSubjName)
        : null;
      const targetSubj = matchedSubject || currentClassSubjects[0];

      const foundFolder = subjectFolders.get(targetSubj.nama.trim().toLowerCase());
      if (foundFolder && foundFolder.id) {
        setActiveExamFolder(String(foundFolder.id));
      } else {
        setActiveExamFolder(`auto:${targetSubj.nama}`);
      }
    } else {
      setActiveExamFolder(null);
    }
    setReorderMode(false);
  }, [activeGrade, currentClassSubjects, subjectFolders]);

  // Menentukan subject aktif dan folder aktif saat ini
  const activeSubjectObj = useMemo(() => {
    if (!activeExamFolder) return null;
    if (activeExamFolder.startsWith('auto:')) {
      const name = activeExamFolder.replace('auto:', '').trim();
      return currentClassSubjects.find((s) => s.nama.trim().toLowerCase() === name.toLowerCase()) || { nama: name };
    }
    const f = allFolders.find((x) => String(x.id) === String(activeExamFolder));
    if (!f) return null;
    return currentClassSubjects.find((s) => s.nama.trim().toLowerCase() === f.name.trim().toLowerCase()) || { nama: f.name };
  }, [activeExamFolder, allFolders, currentClassSubjects]);

  // Cari ID folder fisik riil di D1 (atau buat jika belum ada)
  const ensurePhysicalFolder = async (subjectName) => {
    const cleanName = (subjectName || '').trim();
    const existing = subjectFolders.get(cleanName.toLowerCase()) ||
                     allFolders.find(f => normGrade(f.grade) === normGrade(activeGrade) && f.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (existing && existing.id) return String(existing.id);

    // Buat folder fisik otomatis di D1
    const res = await mutateRow({
      action: 'add',
      sheetName: 'QuestionFolders',
      row: { grade: activeGrade, name: cleanName },
    });

    if (res.success && res.id) {
      const folderId = String(res.id);
      const newF = { id: folderId, grade: activeGrade, name: cleanName, updatedAt: res.updatedAt };
      setAllFolders((prev) => {
        const already = prev.some(x => String(x.id) === folderId);
        return already ? prev : [...prev, newF];
      });
      setQuestions((prev) => ({ ...prev, [folderId]: prev[folderId] || [] }));
      return folderId;
    }

    // Jika terjadi duplikasi (sudah ada di D1) atau state lokal belum sinkron,
    // fetch data terbaru dari server secara proaktif untuk mengambil ID-nya
    try {
      const freshData = await fetchSchoolData();
      let matchedId = null;
      if (freshData) {
        const serverFolders = Array.isArray(freshData.QuestionFolders) ? freshData.QuestionFolders : [];
        const found = serverFolders.find(f => normGrade(f.grade) === normGrade(activeGrade) && f.name.trim().toLowerCase() === cleanName.toLowerCase());
        if (found && found.id) matchedId = String(found.id);

        if (!matchedId && Array.isArray(freshData.TeacherQuestions)) {
          freshData.TeacherQuestions.forEach(tq => {
            if (normGrade(tq.grade) === normGrade(activeGrade)) {
              const types = tq?.data?.examTypes?.[tq.grade] || [];
              const f = types.find(x => x.name.trim().toLowerCase() === cleanName.toLowerCase());
              if (f && f.id) matchedId = String(f.id);
            }
          });
        }
      }

      if (matchedId) {
        const recoveredF = { id: matchedId, grade: activeGrade, name: cleanName };
        setAllFolders((prev) => {
          const list = prev.filter(x => String(x.id) !== matchedId);
          return [...list, recoveredF];
        });
        return matchedId;
      }
    } catch (e) {
      console.warn("Folder recovery error:", e);
    }

    throw new Error(res.error || 'Gagal menyiapkan folder mapel.');
  };

  // Pilih Mapel
  const handleSelectSubject = (subj) => {
    const found = subjectFolders.get(subj.nama.trim().toLowerCase());
    if (found) {
      setActiveExamFolder(String(found.id));
    } else {
      setActiveExamFolder(`auto:${subj.nama}`);
    }
    setReorderMode(false);
    setSearchTerm('');
  };

  // Butir soal di folder mapel aktif
  const currentQuestions = useMemo(() => {
    if (!activeExamFolder || activeExamFolder.startsWith('auto:')) {
      // Belum ada soal
      return [];
    }
    const key = String(activeExamFolder);
    return questions[key] || questions[activeExamFolder] || [];
  }, [activeExamFolder, questions]);

  const filteredQuestions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return currentQuestions;
    return currentQuestions.filter((item) =>
      item.text.toLowerCase().includes(q) ||
      (item.options && Object.values(item.options).some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [currentQuestions, searchTerm]);

  // Statistik Kunci Jawaban (Next-Level Analysis Guru)
  const keyDistribution = useMemo(() => {
    const pgs = currentQuestions.filter((q) => (q.type || 'pg') === 'pg');
    const dist = { a: 0, b: 0, c: 0, d: 0 };
    pgs.forEach((q) => {
      const k = String(q.correctAnswer || 'a').toLowerCase();
      if (dist[k] !== undefined) dist[k]++;
    });
    return {
      total: pgs.length,
      essayCount: currentQuestions.length - pgs.length,
      dist,
    };
  }, [currentQuestions]);

  // Buka Modal Tambah Soal
  const handleOpenNewQuestion = () => {
    setEditingQuestion(null);
    setQuestionForm({
      text: '',
      options: { a: '', b: '', c: '', d: '' },
      correctAnswer: 'a',
      type: 'pg',
    });
    setIsQuestionModalOpen(true);
  };

  // Buka Modal Edit Soal
  const handleOpenEditQuestion = (q) => {
    setEditingQuestion(q);
    setQuestionForm({
      text: q.text || '',
      options: q.options || { a: '', b: '', c: '', d: '' },
      correctAnswer: q.correctAnswer || 'a',
      type: q.type || 'pg',
    });
    setIsQuestionModalOpen(true);
  };

  // Duplikat Cepat Soal (1-Klik Clone)
  const handleDuplicateQuestion = async (q) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSyncing(true);

    try {
      const subjectName = activeSubjectObj?.nama || currentClassSubjects[0]?.nama || '';
      const physicalFolderId = (!activeExamFolder || activeExamFolder.startsWith('auto:'))
        ? await ensurePhysicalFolder(subjectName)
        : String(activeExamFolder);

      if (activeExamFolder !== physicalFolderId) {
        setActiveExamFolder(physicalFolderId);
      }

      const isEssay = (q.type || 'pg') === 'essay';
      const row = {
        folderId: physicalFolderId,
        text: `${q.text} (Salinan)`,
        optionA: isEssay ? '' : (q.options?.a || ''),
        optionB: isEssay ? '' : (q.options?.b || ''),
        optionC: isEssay ? '' : (q.options?.c || ''),
        optionD: isEssay ? '' : (q.options?.d || ''),
        correctAnswer: isEssay ? '' : (q.correctAnswer || 'a'),
        type: q.type || 'pg',
      };

      const res = await mutateRow({ action: 'add', sheetName: 'Questions', row });
      if (res.success) {
        const cloned = {
          id: String(res.id),
          text: row.text,
          options: { a: row.optionA, b: row.optionB, c: row.optionC, d: row.optionD },
          correctAnswer: row.correctAnswer,
          type: row.type,
          updatedAt: res.updatedAt,
        };
        setQuestions((prev) => ({
          ...prev,
          [physicalFolderId]: [...(prev[physicalFolderId] || []), cloned],
        }));
        setNotify({ type: 'success', title: 'Soal Diduplikasi', message: 'Salinan soal berhasil dibuat di posisi akhir.' });
      } else {
        setNotify({ type: 'error', title: 'Gagal Duplikasi', message: res.error || 'Gagal menyalin soal.' });
      }
    } catch (err) {
      setNotify({ type: 'error', title: 'Kesalahan', message: String(err.message || err) });
    } finally {
      setIsSyncing(false);
      savingRef.current = false;
    }
  };

  // Simpan Soal (Tambah atau Update)
  const handleSaveQuestion = async () => {
    if (!questionForm.text.trim()) {
      setNotify({ type: 'error', title: 'Pertanyaan Kosong', message: 'Isi teks pertanyaan wajib diisi.' });
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setIsSyncing(true);

    try {
      const subjectName = activeSubjectObj?.nama || currentClassSubjects[0]?.nama || '';
      const physicalFolderId = (!activeExamFolder || activeExamFolder.startsWith('auto:'))
        ? await ensurePhysicalFolder(subjectName)
        : String(activeExamFolder);

      if (activeExamFolder !== physicalFolderId) {
        setActiveExamFolder(physicalFolderId);
      }

      const wasEdit = !!editingQuestion;
      const isEssay = (questionForm.type || 'pg') === 'essay';
      const opts = questionForm.options || { a: '', b: '', c: '', d: '' };

      const row = {
        folderId: physicalFolderId,
        text: questionForm.text.trim(),
        optionA: isEssay ? '' : opts.a.trim(),
        optionB: isEssay ? '' : opts.b.trim(),
        optionC: isEssay ? '' : opts.c.trim(),
        optionD: isEssay ? '' : opts.d.trim(),
        correctAnswer: isEssay ? '' : (questionForm.correctAnswer || 'a'),
        type: questionForm.type || 'pg',
      };

      const res = wasEdit
        ? await mutateRow({ action: 'update', sheetName: 'Questions', id: editingQuestion.id, expectedUpdatedAt: editingQuestion.updatedAt ?? null, row })
        : await mutateRow({ action: 'add', sheetName: 'Questions', row });

      if (res.success) {
        const item = {
          id: String(wasEdit ? editingQuestion.id : res.id),
          text: row.text,
          options: { a: row.optionA, b: row.optionB, c: row.optionC, d: row.optionD },
          correctAnswer: row.correctAnswer,
          type: row.type,
          updatedAt: res.updatedAt,
        };

        setQuestions((prev) => {
          const list = prev[physicalFolderId] || [];
          return {
            ...prev,
            [physicalFolderId]: wasEdit
              ? list.map((x) => (x.id === item.id ? item : x))
              : [...list, item],
          };
        });

        setIsQuestionModalOpen(false);
        setNotify({
          type: 'success',
          title: wasEdit ? 'Soal Diperbarui' : 'Soal Ditambahkan',
          message: wasEdit ? 'Perubahan butir soal berhasil disimpan.' : 'Butir soal baru berhasil masuk ke bank soal.',
        });
      } else {
        setNotify({ type: 'error', title: 'Gagal Menyimpan', message: res.error || 'Terjadi bentrok versi dengan guru lain.' });
      }
    } catch (err) {
      setNotify({ type: 'error', title: 'Kesalahan Sistem', message: String(err.message || err) });
    } finally {
      setIsSyncing(false);
      savingRef.current = false;
    }
  };

  // Hapus Soal (Eksekusi setelah konfirmasi custom dialog)
  const executeDeleteQuestion = async (qId) => {
    if (!qId || savingRef.current) return;
    savingRef.current = true;
    setDeletingQuestion(true);
    setIsSyncing(true);

    try {
      const res = await mutateRow({ action: 'delete', sheetName: 'Questions', id: qId });
      setDeletingQuestion(false);
      setConfirmingDeleteQuestionId(null);
      if (res.success) {
        setQuestions((prev) => ({
          ...prev,
          [activeExamFolder]: (prev[activeExamFolder] || []).filter((x) => x.id !== qId),
        }));
        setNotify({ type: 'success', title: 'Soal Dihapus', message: 'Butir soal telah dihapus dari bank soal.' });
      } else {
        setNotify({ type: 'error', title: 'Gagal Menghapus', message: res.error || 'Soal gagal dihapus.' });
      }
    } catch (err) {
      setDeletingQuestion(false);
      setConfirmingDeleteQuestionId(null);
      setNotify({ type: 'error', title: 'Kesalahan', message: String(err) });
    } finally {
      setIsSyncing(false);
      savingRef.current = false;
    }
  };

  // Fitur Reorder / Atur Urutan Soal
  const enterReorderMode = () => {
    setOrderDraft([...currentQuestions]);
    setReorderMode(true);
  };

  const moveOrder = (index, dir) => {
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= orderDraft.length) return;
    const copy = [...orderDraft];
    const temp = copy[index];
    copy[index] = copy[nextIdx];
    copy[nextIdx] = temp;
    setOrderDraft(copy);
  };

  const saveOrder = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSyncing(true);

    try {
      const ids = orderDraft.map((q) => q.id);
      const res = await mutateRow({
        action: 'reorderQuestions',
        sheetName: 'Questions',
        id: activeExamFolder,
        ids,
      });

      if (res.success) {
        setQuestions((prev) => ({
          ...prev,
          [activeExamFolder]: orderDraft,
        }));
        setReorderMode(false);
        setNotify({ type: 'success', title: 'Urutan Disimpan', message: 'Susunan urutan soal berhasil diperbarui.' });
      } else {
        setNotify({ type: 'error', title: 'Gagal Mengatur Urutan', message: res.error || 'Gagal menyimpan urutan.' });
      }
    } catch (err) {
      setNotify({ type: 'error', title: 'Kesalahan', message: String(err) });
    } finally {
      setIsSyncing(false);
      savingRef.current = false;
    }
  };

  // ==========================================
  // GENERATOR CETAK PDF MODULAR (SINGLE & MULTI)
  // Mendukung: Lembar Siswa, Kunci Jawaban, dan Bundel Lengkap (Soal + Kunci)
  // Menjaga struktur halaman tetap terisolasi dengan penomoran independen per mapel
  // ==========================================

  // Helper: Ambil logo sekolah
  const fetchLogoBase64 = async () => {
    try {
      const res = await fetch('/avatars/logo.png');
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result);
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Helper: Cetak Kop Resmi Sekolah
  const drawOfficialHeader = (doc, { margin, PAGE_W, logoData, schoolName, subjectTitle, grade, modeTitle }) => {
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', margin, 12, 22, 22); } catch (e) {}
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(90);
    doc.text("YAYASAN NASHIRUS SUNNAH PERCUT", PAGE_W / 2, 15, { align: "center" });
    doc.setFontSize(14); doc.setTextColor(20);
    doc.text(schoolName, PAGE_W / 2, 22, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90);
    doc.text("Jl. Lembaga Dusun II, Desa Tanjung Rejo, Kec. Percut Sei Tuan", PAGE_W / 2, 27, { align: "center" });
    doc.text("Email: nashirussunnahpercut@gmail.com  |  Deli Serdang, Sumatera Utara", PAGE_W / 2, 31, { align: "center" });
    doc.setDrawColor(20); doc.setLineWidth(0.8); doc.line(margin, 35, PAGE_W - margin, 35);
    doc.setLineWidth(0.3); doc.line(margin, 36.3, PAGE_W - margin, 36.3);

    // Judul Lembar
    let y = 44;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20);
    doc.text(modeTitle, PAGE_W / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`${subjectTitle}  •  Kelas ${grade}`, PAGE_W / 2, y + 6, { align: "center" });
    return y + 14;
  };

  // Helper: Render Lembar Soal Siswa (1 Mata Pelajaran)
  const renderStudentQuestionsSheet = (doc, { subjectTitle, grade, questionsList, logoData, schoolName, isFirstPage }) => {
    if (!isFirstPage) {
      doc.addPage();
    }
    const startPage = doc.getNumberOfPages();
    const PAGE_W = 210;
    const margin = 15;
    const contentW = PAGE_W - (margin * 2);

    let currentY = drawOfficialHeader(doc, {
      margin, PAGE_W, logoData, schoolName, subjectTitle, grade,
      modeTitle: "LEMBAR SOAL UJIAN"
    });

    // Kotak Identitas & Nilai
    const nilaiW = 32;
    const idBoxW = contentW - nilaiW - 3;
    const idBoxH = 22;
    doc.setDrawColor(150); doc.setLineWidth(0.3);
    doc.rect(margin, currentY, idBoxW, idBoxH);
    doc.rect(PAGE_W - margin - nilaiW, currentY, nilaiW, idBoxH);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(90);
    doc.text("NILAI", PAGE_W - margin - nilaiW / 2, currentY + 5, { align: "center" });

    const colL = margin + 4;
    const colR = margin + idBoxW / 2 + 2;
    const rEnd = margin + idBoxW - 4;
    const field = (label, x, yy, endX, val) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(40);
      doc.text(label + ":", x, yy);
      const lw = doc.getTextWidth(label + ": ");
      if (val) {
        doc.setFont("helvetica", "normal"); doc.setTextColor(30);
        doc.text(String(val), x + lw, yy);
      } else {
        doc.setDrawColor(175); doc.setLineWidth(0.2); doc.line(x + lw, yy + 0.8, endX, yy + 0.8);
      }
    };

    let fy = currentY + 5.5;
    field("Nama", colL, fy, colR - 4); field("Hari/Tgl", colR, fy, rEnd);
    fy += 5.5;
    field("Kelas", colL, fy, colR - 4, grade); field("Mata Pelajaran", colR, fy, rEnd, subjectTitle);
    fy += 5.5;
    field("No. Absen", colL, fy, colR - 4); field("Waktu", colR, fy, rEnd);

    currentY += idBoxH + 8;

    const pgQuestions = (questionsList || []).filter((q) => (q.type || 'pg') === 'pg');
    const essayQuestions = (questionsList || []).filter((q) => q.type === 'essay');

    // Bagian Pilihan Ganda
    if (pgQuestions.length > 0) {
      doc.setFillColor(235); doc.rect(margin, currentY - 4, contentW, 6.5, 'F');
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20);
      doc.text("A. PILIHAN GANDA", margin + 2.5, currentY);
      currentY += 8;

      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      pgQuestions.forEach((q, idx) => {
        if (currentY > 260) { doc.addPage(); currentY = 20; }
        const lines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, contentW);
        doc.text(lines, margin, currentY);
        currentY += (lines.length * 5) + 1;

        const opts = [
          `a. ${q.options?.a || '-'}`,
          `b. ${q.options?.b || '-'}`,
          `c. ${q.options?.c || '-'}`,
          `d. ${q.options?.d || '-'}`,
        ];

        doc.text(opts[0], margin + 5, currentY);
        doc.text(opts[1], margin + 90, currentY);
        currentY += 5;
        doc.text(opts[2], margin + 5, currentY);
        doc.text(opts[3], margin + 90, currentY);
        currentY += 8;
      });
    }

    // Bagian Essay
    if (essayQuestions.length > 0) {
      if (currentY > 245) { doc.addPage(); currentY = 20; }
      else currentY += 4;

      doc.setFillColor(235); doc.rect(margin, currentY - 4, contentW, 6.5, 'F');
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20);
      doc.text("B. ESSAI / URAIAN", margin + 2.5, currentY);
      currentY += 8;

      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      const dots = "............................................................................................................................................................";

      essayQuestions.forEach((q, idx) => {
        if (currentY > 250) { doc.addPage(); currentY = 20; }
        const lines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, contentW);
        doc.text(lines, margin, currentY);
        currentY += (lines.length * 5) + 3;

        doc.text(dots, margin, currentY);
        currentY += 8;
        doc.text(dots, margin, currentY);
        currentY += 12;
      });
    }

    const endPage = doc.getNumberOfPages();
    return { startPage, endPage, label: subjectTitle };
  };

  // Helper: Render Lembar Kunci Jawaban (1 Mata Pelajaran)
  const renderSubjectAnswerKeySheet = (doc, { subjectTitle, grade, questionsList, logoData, schoolName, isFirstPage }) => {
    if (!isFirstPage) {
      doc.addPage();
    }
    const startPage = doc.getNumberOfPages();
    const PAGE_W = 210;
    const margin = 15;
    const contentW = PAGE_W - (margin * 2);

    let currentY = drawOfficialHeader(doc, {
      margin, PAGE_W, logoData, schoolName, subjectTitle, grade,
      modeTitle: "LEMBAR KUNCI JAWABAN & RUBRIK (PEGANGAN GURU)"
    });

    const pgs = (questionsList || []).filter((q) => (q.type || 'pg') === 'pg');
    const essays = (questionsList || []).filter((q) => q.type === 'essay');

    if (pgs.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
      doc.text("KUNCI JAWABAN PILIHAN GANDA", margin, currentY);
      currentY += 4;

      const tableBody = [];
      for (let i = 0; i < pgs.length; i += 5) {
        const row = [];
        for (let j = 0; j < 5; j++) {
          const item = pgs[i + j];
          if (item) {
            row.push(`No ${i + j + 1}`);
            row.push(String(item.correctAnswer || '-').toUpperCase());
          } else {
            row.push('');
            row.push('');
          }
        }
        tableBody.push(row);
      }

      doc.autoTable({
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['No', 'Kunci', 'No', 'Kunci', 'No', 'Kunci', 'No', 'Kunci', 'No', 'Kunci']],
        body: tableBody,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9, halign: 'center' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      });

      currentY = doc.lastAutoTable.finalY + 10;
    }

    if (essays.length > 0) {
      if (currentY > 230) { doc.addPage(); currentY = 20; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20);
      doc.text("DAFTAR SOAL ESSAI / URAIAN", margin, currentY);
      currentY += 6;

      essays.forEach((eq, idx) => {
        if (currentY > 260) { doc.addPage(); currentY = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
        doc.text(`Soal Essai ${idx + 1}:`, margin, currentY);
        currentY += 4.5;
        doc.setFont("helvetica", "normal");
        const qLines = doc.splitTextToSize(eq.text, contentW);
        doc.text(qLines, margin, currentY);
        currentY += (qLines.length * 5) + 6;
      });
    }

    const endPage = doc.getNumberOfPages();
    return { startPage, endPage, label: `Kunci ${subjectTitle}` };
  };

  // Helper: Pembubuhan Footer & Nomor Halaman Independen per Mata Pelajaran
  const applyIndependentFooters = (doc, pageSpans, schoolName) => {
    const PAGE_W = 210;
    const margin = 15;
    pageSpans.forEach((span) => {
      const totalPagesInSubj = span.endPage - span.startPage + 1;
      for (let p = span.startPage; p <= span.endPage; p++) {
        doc.setPage(p);
        const pageNumInSubj = p - span.startPage + 1;
        doc.setDrawColor(210);
        doc.setLineWidth(0.2);
        doc.line(margin, 288, PAGE_W - margin, 288);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(140);
        doc.text(schoolName, margin, 292);
        doc.text(
          `${span.label}  •  Halaman ${pageNumInSubj} dari ${totalPagesInSubj}`,
          PAGE_W - margin,
          292,
          { align: "right" }
        );
      }
    });
  };

  // Cetak 1 Mapel Aktif (dari modal single mapel)
  const generateExamPdf = async (mode = 'STUDENT') => {
    const folderQuestions = currentQuestions;
    if (!folderQuestions.length) {
      setNotify({
        type: 'warning',
        title: 'Belum Ada Soal',
        message: 'Tidak ada butir soal dalam mata pelajaran ini untuk dicetak.',
      });
      return;
    }

    try {
      const doc = new jsPDF({ format: 'a4', unit: 'mm' });
      const logoData = await fetchLogoBase64();
      const schoolName = activeGrade === 'TK'
        ? "TAMAN KANAK-KANAK ISLAM IMAM SYAFI'I"
        : "SEKOLAH DASAR ISLAM IMAM SYAFI'I";
      const subjectTitle = activeSubjectObj?.nama || 'Mata Pelajaran';

      const pageSpans = [];
      if (mode === 'STUDENT') {
        const span = renderStudentQuestionsSheet(doc, {
          subjectTitle,
          grade: activeGrade,
          questionsList: folderQuestions,
          logoData,
          schoolName,
          isFirstPage: true,
        });
        pageSpans.push(span);
      } else if (mode === 'ANSWER_KEY') {
        const span = renderSubjectAnswerKeySheet(doc, {
          subjectTitle,
          grade: activeGrade,
          questionsList: folderQuestions,
          logoData,
          schoolName,
          isFirstPage: true,
        });
        pageSpans.push(span);
      }

      applyIndependentFooters(doc, pageSpans, schoolName);

      const prefix = mode === 'ANSWER_KEY' ? 'Kunci_Jawaban' : 'Soal';
      doc.save(`${prefix}_${activeGrade}_${subjectTitle.replace(/\s+/g, '_')}.pdf`);
      setIsPrintModalOpen(false);
    } catch (err) {
      console.error('generateExamPdf error:', err);
      setNotify({
        type: 'error',
        title: 'Gagal Cetak',
        message: 'Gagal membuat dokumen PDF: ' + String(err.message || err),
      });
    }
  };

  // Mapel kelas aktif beserta jumlah soalnya
  const classSubjectsWithCounts = useMemo(() => {
    return currentClassSubjects.map((subj) => {
      const foundFolder = subjectFolders.get(subj.nama.trim().toLowerCase());
      const fId = foundFolder ? String(foundFolder.id) : null;
      const qList = fId ? (questions[fId] || questions[foundFolder.id] || []) : [];
      const pgCount = qList.filter(q => (q.type || 'pg') === 'pg').length;
      const essayCount = qList.filter(q => q.type === 'essay').length;
      return {
        ...subj,
        folderId: fId,
        totalQuestions: qList.length,
        pgCount,
        essayCount,
        questions: qList,
      };
    });
  }, [currentClassSubjects, subjectFolders, questions]);

  // Handler Modal Multi-Export
  const handleOpenMultiExportModal = () => {
    const available = classSubjectsWithCounts
      .filter((s) => s.totalQuestions > 0)
      .map((s) => s.nama);

    if (available.length === 0) {
      setNotify({
        type: 'error',
        title: 'Tidak Ada Soal',
        message: `Belum ada mata pelajaran di Kelas ${activeGrade} yang memiliki butir soal untuk diexport.`,
      });
      return;
    }

    setSelectedSubjectsForExport(available);
    setMultiExportMode('STUDENT');
    setIsMultiExportModalOpen(true);
  };

  const toggleSubjectSelect = (nama) => {
    setSelectedSubjectsForExport((prev) =>
      prev.includes(nama) ? prev.filter((x) => x !== nama) : [...prev, nama]
    );
  };

  const selectAllAvailable = () => {
    const allValid = classSubjectsWithCounts
      .filter((s) => s.totalQuestions > 0)
      .map((s) => s.nama);
    setSelectedSubjectsForExport(allValid);
  };

  const deselectAll = () => {
    setSelectedSubjectsForExport([]);
  };

  // Eksekusi Export Multi-Soal (Bisa Semua / Sebagian / Soal / Kunci / Keduanya)
  const handleExecuteMultiExport = async () => {
    const targets = classSubjectsWithCounts.filter(
      (s) => selectedSubjectsForExport.includes(s.nama) && s.totalQuestions > 0
    );

    if (targets.length === 0) {
      setNotify({
        type: 'warning',
        title: 'Pilih Mapel',
        message: 'Pilih minimal 1 mata pelajaran yang memiliki butir soal untuk diexport.',
      });
      return;
    }

    setIsExportingPdf(true);

    try {
      const doc = new jsPDF({ format: 'a4', unit: 'mm' });
      const logoData = await fetchLogoBase64();
      const schoolName = activeGrade === 'TK'
        ? "TAMAN KANAK-KANAK ISLAM IMAM SYAFI'I"
        : "SEKOLAH DASAR ISLAM IMAM SYAFI'I";

      const pageSpans = [];
      let isFirstPage = true;

      // 1. Render Lembar Soal Siswa (jika mode STUDENT atau BOTH)
      if (multiExportMode === 'STUDENT' || multiExportMode === 'BOTH') {
        for (const subj of targets) {
          const span = renderStudentQuestionsSheet(doc, {
            subjectTitle: subj.nama,
            grade: activeGrade,
            questionsList: subj.questions,
            logoData,
            schoolName,
            isFirstPage,
          });
          pageSpans.push(span);
          isFirstPage = false;
        }
      }

      // 2. Render Lembar Kunci Jawaban Guru (jika mode ANSWER_KEY atau BOTH)
      // Opsi B: Seluruh Kunci Jawaban dikumpulkan di bagian belakang dokumen
      if (multiExportMode === 'ANSWER_KEY' || multiExportMode === 'BOTH') {
        for (const subj of targets) {
          const span = renderSubjectAnswerKeySheet(doc, {
            subjectTitle: subj.nama,
            grade: activeGrade,
            questionsList: subj.questions,
            logoData,
            schoolName,
            isFirstPage,
          });
          pageSpans.push(span);
          isFirstPage = false;
        }
      }

      // 3. Bubuhkan footer & nomor halaman independen per mata pelajaran
      applyIndependentFooters(doc, pageSpans, schoolName);

      // 4. Download file
      let fileName = '';
      if (targets.length === 1) {
        const prefix = multiExportMode === 'ANSWER_KEY'
          ? 'Kunci_Jawaban'
          : (multiExportMode === 'BOTH' ? 'Soal_dan_Kunci' : 'Soal');
        fileName = `${prefix}_${activeGrade}_${targets[0].nama.replace(/\s+/g, '_')}.pdf`;
      } else {
        const typeStr = multiExportMode === 'STUDENT'
          ? 'Bundel_Soal'
          : multiExportMode === 'ANSWER_KEY'
          ? 'Bundel_Kunci_Jawaban'
          : 'Bundel_Lengkap_Soal_dan_Kunci';
        fileName = `${typeStr}_Kelas_${activeGrade.replace(/\s+/g, '_')}_(${targets.length}_Mapel).pdf`;
      }

      doc.save(fileName);
      setIsMultiExportModalOpen(false);
      setNotify({
        type: 'success',
        title: 'Export Berhasil',
        message: `File PDF ${fileName} berhasil diunduh (${targets.length} mata pelajaran).`,
      });
    } catch (err) {
      console.error('Multi-export error:', err);
      setNotify({
        type: 'error',
        title: 'Gagal Export PDF',
        message: String(err.message || err),
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Toast Notifikasi */}
      <AnimatePresence>
        {notify && (
          <motion.div
            initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-2rem)] max-w-md"
          >
            <div className={`flex items-start gap-3 rounded-2xl p-4 shadow-2xl border ${notify.type === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <div className={`shrink-0 mt-0.5 ${notify.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {notify.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              </div>
              <div className="min-w-0 flex-grow">
                <p className={`font-black text-sm ${notify.type === 'success' ? 'text-emerald-800' : 'text-rose-800'}`}>{notify.title}</p>
                {notify.message && <p className={`text-xs font-medium mt-0.5 leading-relaxed ${notify.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{notify.message}</p>}
              </div>
              <button onClick={() => setNotify(null)} className="shrink-0 text-slate-400 hover:text-slate-700"><X size={16} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Utama */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Bank Soal</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              <CheckCircle2 size={13} />
              <span className="text-[10px] font-black uppercase tracking-wider">Tersinkron Master Mapel</span>
            </div>
          </div>
          <p className="text-slate-500 font-medium text-xs mt-1">
            Mata pelajaran otomatis terhubung dengan kurikulum resmi. Kelola bank soal dan cetak lembar ujian.
          </p>
        </div>

        {/* Tab Jenjang Kelas */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto hide-scrollbar w-full sm:w-auto max-w-full">
          {GRADES.map(grade => (
            <button
              key={grade}
              onClick={() => { setActiveGrade(grade); setSearchTerm(''); }}
              className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                activeGrade === grade ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {grade}
            </button>
          ))}
        </div>
      </header>

      {/* Seksi Tab Mata Pelajaran (Otomatis dari MasterSubjects) */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <BookOpen size={14} className="text-secondary" /> Mata Pelajaran — Kelas {activeGrade}
            </h3>
            <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">
              ({currentClassSubjects.length} Terdaftar)
            </span>
          </div>

          {/* Tombol Export Multi-Soal di Header Kelas */}
          <button
            onClick={handleOpenMultiExportModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 text-xs font-black transition-all shadow-sm active:scale-95"
            title="Export Lembar Soal / Kunci beberapa mata pelajaran sekaligus"
          >
            <Layers size={15} />
            <span>Export Multi-Soal ({activeGrade})</span>
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 px-1 -mx-1 hide-scrollbar">
          {currentClassSubjects.map((subj) => {
            const foundFolder = subjectFolders.get(subj.nama.trim().toLowerCase());
            const fId = foundFolder ? String(foundFolder.id) : null;
            const count = fId ? (questions[fId] || questions[foundFolder.id] || []).length : 0;
            const isSelected = activeSubjectObj?.nama?.trim().toLowerCase() === subj.nama?.trim().toLowerCase();

            return (
              <button
                key={subj.id || subj.nama}
                onClick={() => handleSelectSubject(subj)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 shrink-0 transition-all text-left ${
                  isSelected
                    ? 'bg-white border-secondary shadow-lg shadow-secondary/10 -translate-y-0.5'
                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${isSelected ? 'bg-secondary text-white' : 'bg-slate-100 text-slate-400'}`}>
                  <BookOpen size={16} />
                </div>
                <div>
                  <p className={`font-black text-xs leading-tight ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                    {subj.nama}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {count > 0 ? `${count} Butir Soal` : 'Belum Ada Soal'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Seksi Bank Soal Aktif */}
      <main className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-wider mb-1">
              <span>Kelas {activeGrade}</span>
              <span>•</span>
              <span>{activeSubjectObj?.nama}</span>
            </div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 leading-tight">
              Bank Soal: {activeSubjectObj?.nama || 'Pilih Mata Pelajaran'}
            </h3>
            <p className="text-slate-400 text-xs font-medium mt-0.5">
              Total {currentQuestions.length} soal ({keyDistribution.dist ? `${keyDistribution.total} Pilihan Ganda, ${keyDistribution.essayCount} Essai` : ''})
            </p>
          </div>

          {/* Action Bar — Tertata responsif di mobile */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Input Cari */}
            <div className="relative w-full sm:w-auto flex-grow sm:flex-grow-0">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kata kunci soal…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-secondary transition-all w-full sm:w-48 md:w-56"
              />
            </div>

            {/* Tombol Reorder */}
            {currentQuestions.length > 1 && (
              <button
                onClick={reorderMode ? saveOrder : enterReorderMode}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all flex-1 sm:flex-initial ${
                  reorderMode
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <ArrowUpDown size={14} />
                <span>{reorderMode ? 'Simpan' : 'Urutan'}</span>
              </button>
            )}

            {/* Tombol Cetak PDF Single Mapel */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              disabled={!currentQuestions.length}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 flex-1 sm:flex-initial"
            >
              <FileDown size={15} /> <span className="whitespace-nowrap">Cetak PDF</span>
            </button>

            {/* Tombol Export Multi-Soal */}
            <button
              onClick={handleOpenMultiExportModal}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 flex-1 sm:flex-initial"
              title="Export banyak mapel sekaligus"
            >
              <Layers size={14} className="text-secondary" /> <span className="whitespace-nowrap">Multi-Export</span>
            </button>

            {/* Tombol Buat Soal Baru */}
            <button
              onClick={handleOpenNewQuestion}
              className="px-4 py-2 rounded-xl bg-secondary hover:brightness-95 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-secondary/20 transition-all active:scale-95 w-full sm:w-auto"
            >
              <Plus size={16} /> <span>Tambah Soal</span>
            </button>
          </div>
        </div>

        {/* Analisis Sebaran Kunci Jawaban (Next-Level Analysis Widget) */}
        {keyDistribution.total > 0 && !reorderMode && (
          <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">
              Distribusi Kunci Jawaban:
            </span>
            <div className="flex items-center gap-2">
              {['a', 'b', 'c', 'd'].map((k) => (
                <span key={k} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 text-[11px]">
                  <strong className="text-secondary uppercase">{k}</strong>: {keyDistribution.dist[k]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* List Butir Soal */}
        <div className="mt-6 space-y-3.5">
          {reorderMode ? (
            /* Mode Atur Urutan */
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 mb-2">
                Gunakan tombol panah naik/turun untuk memindahkan posisi nomor soal, lalu klik "Simpan Urutan":
              </p>
              {orderDraft.map((q, idx) => (
                <div key={q.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <span className="font-black text-secondary text-sm w-6">#{idx + 1}</span>
                    <p className="text-xs font-bold text-slate-800 truncate">{q.text}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveOrder(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => moveOrder(idx, 1)}
                      disabled={idx === orderDraft.length - 1}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredQuestions.length === 0 ? (
            /* Kondisi Kosong */
            <div className="text-center py-16 text-slate-400 space-y-2">
              <BookOpen size={40} className="mx-auto text-slate-300" />
              <p className="font-bold text-sm text-slate-600">
                {searchTerm ? 'Tidak ada butir soal yang cocok dengan pencarian.' : `Belum ada soal untuk mata pelajaran ${activeSubjectObj?.nama}.`}
              </p>
              <p className="text-xs text-slate-400">
                Klik tombol <b>"Tambah Soal"</b> di atas untuk mulai membuat butir soal ujian.
              </p>
            </div>
          ) : (
            /* Tampilan Normal Butir Soal */
            filteredQuestions.map((q, idx) => {
              const isEssay = (q.type || 'pg') === 'essay';
              return (
                <div
                  key={q.id}
                  className="group p-5 rounded-2xl border border-slate-100 hover:border-slate-200 bg-white hover:shadow-sm transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-secondary/10 text-secondary font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isEssay ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {isEssay ? 'Essai / Uraian' : 'Pilihan Ganda'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {q.text}
                        </p>
                      </div>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDuplicateQuestion(q)}
                        className="p-2 rounded-xl text-slate-400 hover:text-secondary hover:bg-slate-100 transition-all"
                        title="Salin / Duplikat Soal Ini"
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        onClick={() => handleOpenEditQuestion(q)}
                        className="p-2 rounded-xl text-slate-400 hover:text-secondary hover:bg-slate-100 transition-all"
                        title="Edit Soal"
                      >
                        <FileEdit size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteQuestionId(q.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 transition-all"
                        title="Hapus Soal"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Tampilan Pilihan Ganda */}
                  {!isEssay && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-10 text-xs font-medium text-slate-600">
                      {['a', 'b', 'c', 'd'].map((k) => {
                        const isCorrect = String(q.correctAnswer).toLowerCase() === k;
                        return (
                          <div
                            key={k}
                            className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                                : 'bg-slate-50 border-slate-100 text-slate-600'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black uppercase shrink-0 ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {k}
                            </span>
                            <span className="truncate">{q.options[k] || '-'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ======================================================== */}
      {/* MODAL 1: INPUT / EDIT SOAL (KEYBOARD FRIENDLY & INTUITIF) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isQuestionModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-secondary">
                    {activeSubjectObj?.nama} • Kelas {activeGrade}
                  </span>
                  <h3 className="text-xl font-black text-slate-900">
                    {editingQuestion ? 'Edit Butir Soal' : 'Tambah Soal Baru'}
                  </h3>
                </div>
                <button onClick={() => setIsQuestionModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>

              {/* Tipe Soal (Pilihan Ganda vs Essai) */}
              <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setQuestionForm((f) => ({ ...f, type: 'pg' }))}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    questionForm.type === 'pg' ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pilihan Ganda
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionForm((f) => ({ ...f, type: 'essay' }))}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    questionForm.type === 'essay' ? 'bg-white text-secondary shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Soal Essai / Uraian
                </button>
              </div>

              {/* Form Teks Soal */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Teks Pertanyaan
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tuliskan butir soal pertanyaan di sini…"
                    value={questionForm.text}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, text: e.target.value }))}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-semibold text-slate-800 outline-none focus:border-secondary transition-all"
                  />
                </div>

                {/* Form Opsi Pilihan Ganda */}
                {questionForm.type === 'pg' ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Pilihan Jawaban & Kunci
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {['a', 'b', 'c', 'd'].map((k) => {
                        const isCorrect = questionForm.correctAnswer === k;
                        return (
                          <div key={k} className="relative">
                            <div className="flex items-center gap-2 mb-1">
                              <button
                                type="button"
                                onClick={() => setQuestionForm((f) => ({ ...f, correctAnswer: k }))}
                                className={`w-5 h-5 rounded-full text-[10px] font-black uppercase flex items-center justify-center transition-all ${
                                  isCorrect ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                                title="Klik untuk jadikan kunci jawaban"
                              >
                                {k}
                              </button>
                              <span className="text-[11px] font-bold text-slate-500">
                                Pilihan {k.toUpperCase()} {isCorrect && <span className="text-emerald-600 font-black">(KUNCI)</span>}
                              </span>
                            </div>
                            <input
                              type="text"
                              placeholder={`Isi pilihan ${k.toUpperCase()}`}
                              value={questionForm.options[k] || ''}
                              onChange={(e) => setQuestionForm((f) => ({
                                ...f,
                                options: { ...f.options, [k]: e.target.value },
                              }))}
                              className={`w-full bg-slate-50 border-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none transition-all ${
                                isCorrect ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-100 focus:border-secondary'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500 leading-relaxed italic">
                    * Soal essai tidak memerlukan opsi pilihan berganda. Dokumen cetak PDF akan secara otomatis menyediakan garis titik-titik untuk tempat siswa menuliskan jawaban.
                  </div>
                )}
              </div>

              {/* Action Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  disabled={isSyncing}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuestion}
                  disabled={isSyncing}
                  className="px-6 py-2.5 rounded-xl bg-secondary text-white font-black text-xs uppercase tracking-wider hover:brightness-95 shadow-md shadow-secondary/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSyncing ? <><Loader2 size={14} className="animate-spin" /> Menyimpan…</> : 'Simpan Soal'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 2: PILIHAN CETAK PDF (LEMBAR SISWA vs KUNCI JAWABAN) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative space-y-4 sm:space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-base sm:text-lg text-slate-900">Pilih Dokumen PDF</h3>
                <button onClick={() => setIsPrintModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Pilih format dokumen PDF yang ingin diunduh untuk <b>{activeSubjectObj?.nama}</b> ({activeGrade}):
              </p>

              <div className="space-y-2.5 sm:space-y-3">
                <button
                  onClick={() => generateExamPdf('STUDENT')}
                  className="w-full p-3.5 sm:p-4 rounded-2xl border border-slate-200 hover:border-secondary hover:bg-secondary/5 transition-all flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                      <FileDown size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-xs sm:text-sm text-slate-900 group-hover:text-secondary">
                        1. Lembar Soal Siswa
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">
                        Lengkap dengan kop resmi, kotak nilai & nama murid
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-secondary shrink-0" />
                </button>

                <button
                  onClick={() => generateExamPdf('ANSWER_KEY')}
                  className="w-full p-3.5 sm:p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileCheck size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700">
                        2. Lembar Kunci Jawaban (Pegangan Guru)
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">
                        Tabel rekap kunci pilihan ganda untuk koreksi cepat
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-700 shrink-0" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL 3: EXPORT MULTI-SOAL (SEMUA / SEBAGIAN, SOAL / KUNCI) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isMultiExportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl relative space-y-4 sm:space-y-6 max-h-[92vh] flex flex-col"
            >
              {/* Header Modal */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3 sm:pb-4 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 sm:p-2 rounded-xl bg-secondary/10 text-secondary">
                      <Layers size={18} />
                    </div>
                    <h3 className="font-black text-base sm:text-lg text-slate-900">
                      Export Multi-Soal — Kelas {activeGrade}
                    </h3>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                    Gabungkan lembar soal beberapa mata pelajaran menjadi satu dokumen PDF tanpa merusak struktur halaman.
                  </p>
                </div>
                <button
                  onClick={() => !isExportingPdf && setIsMultiExportModalOpen(false)}
                  disabled={isExportingPdf}
                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Konten Scrollable */}
              <div className="space-y-5 sm:space-y-6 overflow-y-auto pr-1 flex-grow">
                {/* 1. Pilihan Mode Dokumen */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    1. Pilih Format Dokumen PDF:
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {/* Mode A: Hanya Soal */}
                    <button
                      type="button"
                      onClick={() => setMultiExportMode('STUDENT')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                        multiExportMode === 'STUDENT'
                          ? 'border-secondary bg-secondary/5 text-secondary shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-xs">Lembar Soal Siswa</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          multiExportMode === 'STUDENT' ? 'border-secondary bg-secondary' : 'border-slate-300'
                        }`}>
                          {multiExportMode === 'STUDENT' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Hanya lembar soal ujian untuk dibagikan ke siswa
                      </p>
                    </button>

                    {/* Mode B: Hanya Kunci */}
                    <button
                      type="button"
                      onClick={() => setMultiExportMode('ANSWER_KEY')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                        multiExportMode === 'ANSWER_KEY'
                          ? 'border-emerald-600 bg-emerald-50/50 text-emerald-800 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-xs">Kunci Jawaban</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          multiExportMode === 'ANSWER_KEY' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                        }`}>
                          {multiExportMode === 'ANSWER_KEY' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Rekap grid kunci pilihan ganda untuk pegangan koreksi guru
                      </p>
                    </button>

                    {/* Mode C: Bundel Lengkap (Soal + Kunci) */}
                    <button
                      type="button"
                      onClick={() => setMultiExportMode('BOTH')}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                        multiExportMode === 'BOTH'
                          ? 'border-amber-600 bg-amber-50/50 text-amber-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-xs">Soal + Kunci Lengkap</span>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          multiExportMode === 'BOTH' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                        }`}>
                          {multiExportMode === 'BOTH' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Lembar soal di depan untuk siswa, rekap kunci di belakang untuk guru
                      </p>
                    </button>
                  </div>
                </div>

                {/* 2. Pemilihan Mata Pelajaran */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      2. Pilih Mata Pelajaran:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllAvailable}
                        className="text-[11px] font-bold text-secondary hover:underline"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300 text-xs">•</span>
                      <button
                        type="button"
                        onClick={deselectAll}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>

                  {/* List Mata Pelajaran */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {classSubjectsWithCounts.map((subj) => {
                      const hasQuestions = subj.totalQuestions > 0;
                      const isChecked = selectedSubjectsForExport.includes(subj.nama);

                      return (
                        <div
                          key={subj.id || subj.nama}
                          onClick={() => hasQuestions && toggleSubjectSelect(subj.nama)}
                          className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                            !hasQuestions
                              ? 'bg-slate-50/70 border-slate-100 opacity-50 cursor-not-allowed'
                              : isChecked
                              ? 'bg-secondary/5 border-secondary text-slate-900 cursor-pointer shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!hasQuestions}
                              onChange={() => hasQuestions && toggleSubjectSelect(subj.nama)}
                              className="rounded border-slate-300 text-secondary focus:ring-secondary w-4 h-4 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-xs truncate">
                                {subj.nama}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {hasQuestions
                                  ? `${subj.pgCount} PG, ${subj.essayCount} Essai`
                                  : '0 Soal (Kosong)'}
                              </p>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                            !hasQuestions
                              ? 'bg-slate-200 text-slate-500'
                              : isChecked
                              ? 'bg-secondary text-white'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {subj.totalQuestions} Soal
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Modal & Tombol Download */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between shrink-0">
                <div className="text-xs">
                  <span className="font-bold text-slate-500">Terpilih: </span>
                  <span className="font-black text-secondary">
                    {selectedSubjectsForExport.length} Mata Pelajaran
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsMultiExportModalOpen(false)}
                    disabled={isExportingPdf}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all disabled:opacity-40"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteMultiExport}
                    disabled={isExportingPdf || selectedSubjectsForExport.length === 0}
                    className="px-5 py-2 rounded-xl bg-secondary text-white font-black text-xs uppercase tracking-wider hover:brightness-95 shadow-md shadow-secondary/20 transition-all flex items-center gap-2 disabled:opacity-40"
                  >
                    {isExportingPdf ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Menyusun Bundel PDF…</span>
                      </>
                    ) : (
                      <>
                        <FileDown size={15} />
                        <span>Download PDF ({selectedSubjectsForExport.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Konfirmasi Hapus Soal */}
      <AnimatePresence>
        {confirmingDeleteQuestionId && (
          <ConfirmDialog
            title="Hapus Butir Soal?"
            message="Apakah Anda yakin ingin menghapus butir soal ini? Tindakan ini tidak dapat dibatalkan."
            confirmLabel="Ya, Hapus"
            cancelLabel="Batal"
            danger
            loading={deletingQuestion}
            onConfirm={() => executeDeleteQuestion(confirmingDeleteQuestionId)}
            onCancel={() => !deletingQuestion && setConfirmingDeleteQuestionId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
