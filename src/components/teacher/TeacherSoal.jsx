import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FileEdit, 
  Trash2, 
  FileDown as Download, 
  ChevronRight, 
  LayoutDashboard, 
  BookOpen, 
  FolderPlus,
  AlertCircle,
  FileText,
  CheckCircle2,
  FileDown,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveQuestions, fetchSchoolData } from '../../services/gsheet';
import { jsPDF } from "jspdf";
import "jspdf-autotable";

const GRADES = ['TK', 'SD 1', 'SD 2', 'SD 3', 'SD 4', 'SD 5', 'SD 6'];

export default function TeacherSoal() {
  const [activeGrade, setActiveGrade] = useState('TK');
  const [examTypes, setExamTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('mias_exam_types');
      if (!saved) return {
        'TK': [], 'SD 1': [], 'SD 2': [], 'SD 3': [], 'SD 4': [], 'SD 5': [], 'SD 6': []
      };
      const parsed = JSON.parse(saved);
      // Validate structure
      if (typeof parsed !== 'object' || !parsed['TK']) throw new Error();
      return parsed;
    } catch (e) {
      return {
        'TK': [], 'SD 1': [], 'SD 2': [], 'SD 3': [], 'SD 4': [], 'SD 5': [], 'SD 6': []
      };
    }
  });

  const [activeExamFolder, setActiveExamFolder] = useState(null);
  const [questions, setQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem('mias_questions');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      if (typeof parsed !== 'object') throw new Error();
      return parsed;
    } catch (e) {
      return {};
    }
  });
  
  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    text: '',
    options: { a: '', b: '', c: '', d: '' },
    correctAnswer: 'a',
    weight: 1
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Persist data
  useEffect(() => {
    localStorage.setItem('mias_exam_types', JSON.stringify(examTypes));
  }, [examTypes]);

  useEffect(() => {
    localStorage.setItem('mias_questions', JSON.stringify(questions));
  }, [questions]);

  // Protection for Mobile Back Button: "Trap" the user in the modal
  useEffect(() => {
    if (isQuestionModalOpen || isAddFolderModalOpen) {
      window.history.pushState({ modalOpen: true }, '');
      const handlePopState = () => {
        if (isQuestionModalOpen || isAddFolderModalOpen) {
          // Re-push the state to prevent exiting the page
          window.history.pushState({ modalOpen: true }, '');
          // Note: keyboard will close automatically by OS on first back press
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [isQuestionModalOpen, isAddFolderModalOpen]);

  const [isSyncing, setIsSyncing] = useState(false);
  const GRADE_INDEX = { "TK": 0, "SD 1": 1, "SD 2": 2, "SD 3": 3, "SD 4": 4, "SD 5": 5, "SD 6": 6 };

  // 1. Sync Logic: Simpan PER KELAS ke GSheet
  const syncGradeToCloud = async (targetGrade = activeGrade, currentExamTypes = examTypes, currentQuestions = questions) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // Data yang dikirim hanya untuk satu kelas spesifik agar tidak menindih kelas lain
      const timestamp = Date.now();
      const gradeData = {
        updatedAt: timestamp,
        examTypes: { [targetGrade]: currentExamTypes[targetGrade] },
        questions: {}
      };
      
      // Ambil hanya soal-soal milik folder di kelas tsb
      (currentExamTypes[targetGrade] || []).forEach(folder => {
        if (currentQuestions[folder.id]) {
          gradeData.questions[folder.id] = currentQuestions[folder.id];
        }
      });

      const result = await saveQuestions({
        type: 'QUESTIONS',
        grade: targetGrade,
        data: gradeData
      });

      if (result.success) {
        localStorage.setItem(`last_sync_${targetGrade}`, timestamp.toString());
        console.log(`Sync Grade ${targetGrade} Success at ${timestamp}`);
      }
    } catch (err) {
      console.error("Sync Error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Load Logic: Ambil data dari Cloud (Force Refresh)
  const loadAllData = async (showSilently = false) => {
    if (!showSilently) setIsSyncing(true);
    try {
      const data = await fetchSchoolData(); 
      
      if (data && data.TeacherQuestions) {
        const cloudRows = data.TeacherQuestions;
        let newExamTypes = { 'TK': [], 'SD 1': [], 'SD 2': [], 'SD 3': [], 'SD 4': [], 'SD 5': [], 'SD 6': [] };
        let newQuestions = {};
        let hasDataInCloud = false;

        GRADES.forEach(grade => {
          const index = GRADE_INDEX[grade];
          const gradeCloudData = cloudRows[index];
          
          if (gradeCloudData) {
            // Cek apakah data ada di root atau di dalam properti .data (untuk kompatibilitas)
            const actualData = gradeCloudData.data || gradeCloudData;
            
            if (actualData.examTypes && actualData.examTypes[grade]) {
              hasDataInCloud = true;
              newExamTypes[grade] = actualData.examTypes[grade];
              
              if (actualData.questions) {
                Object.assign(newQuestions, actualData.questions);
              }
              
              if (actualData.updatedAt) {
                localStorage.setItem(`last_sync_${grade}`, actualData.updatedAt.toString());
              }
            }
          }
        });

        // Selalu update state jika ini adalah load pertama (bukan background polling)
        // atau jika memang ada data di cloud
        if (!showSilently || hasDataInCloud) {
          setExamTypes(newExamTypes);
          setQuestions(newQuestions);
          localStorage.setItem('mias_exam_types', JSON.stringify(newExamTypes));
          localStorage.setItem('mias_questions', JSON.stringify(newQuestions));
        }
      }
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      if (!showSilently) setIsSyncing(false);
    }
  };

  // Initial Load & Polling (Cek data setiap 30 detik agar 'Live')
  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => loadAllData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    const folderId = Date.now().toString();
    const updatedExamTypes = {
      ...examTypes,
      [activeGrade]: [...examTypes[activeGrade], { id: folderId, name: newFolderName }]
    };
    setExamTypes(updatedExamTypes);
    setNewFolderName('');
    setIsAddFolderModalOpen(false);
    await syncGradeToCloud(activeGrade, updatedExamTypes, questions);
  };

  const handleDeleteFolder = async (id) => {
    if (confirm('Hapus folder ini dan semua soal di dalamnya?')) {
      const updatedExamTypes = {
        ...examTypes,
        [activeGrade]: examTypes[activeGrade].filter(f => f.id !== id)
      };
      
      const newQuestions = { ...questions };
      delete newQuestions[id];
      
      setExamTypes(updatedExamTypes);
      setQuestions(newQuestions);
      
      if (activeExamFolder === id) setActiveExamFolder(null);
      await syncGradeToCloud(activeGrade, updatedExamTypes, newQuestions);
    }
  };

  const handleSaveQuestion = async () => {
    if (!activeExamFolder) return;
    const folderQuestions = questions[activeExamFolder] || [];
    let updatedQuestions;
    
    if (editingQuestion) {
      updatedQuestions = {
        ...questions,
        [activeExamFolder]: folderQuestions.map(q => q.id === editingQuestion.id ? { ...questionForm, id: q.id } : q)
      };
    } else {
      updatedQuestions = {
        ...questions,
        [activeExamFolder]: [...folderQuestions, { ...questionForm, id: Date.now().toString() }]
      };
    }
    
    setQuestions(updatedQuestions);
    setIsQuestionModalOpen(false);
    setEditingQuestion(null);
    setQuestionForm({ text: '', options: { a: '', b: '', c: '', d: '' }, correctAnswer: 'a', weight: 1 });
    await syncGradeToCloud(activeGrade, examTypes, updatedQuestions);
  };

  const handleDeleteQuestion = async (id) => {
    if (confirm('Hapus soal ini?')) {
      const updatedQuestions = {
        ...questions,
        [activeExamFolder]: questions[activeExamFolder].filter(q => q.id !== id)
      };
      setQuestions(updatedQuestions);
      await syncGradeToCloud(activeGrade, examTypes, updatedQuestions);
    }
  };

  const openEditQuestion = (q) => {
    setEditingQuestion(q);
    setQuestionForm(q);
    setIsQuestionModalOpen(true);
  };

  // PDF Export Logic
  const handleExportPDF = async () => {
    if (!activeExamFolder) return;
    const folder = examTypes[activeGrade].find(f => f.id === activeExamFolder);
    const folderQuestions = questions[activeExamFolder] || [];
    if (folderQuestions.length === 0) { alert('Tidak ada soal untuk diekspor.'); return; }

    const doc = new jsPDF();
    const margin = 20;
    let currentY = 20;

    // 1. Logo & Header (Kop Surat) - Logic based on TK or SD
    const isTK = activeGrade === 'TK';
    const schoolName = isTK ? "TK QURAN IMAM SYAFII PERCUT" : "SD ISLAM IMAM SYAFII PERCUT";
    const schoolEmail = isTK ? "tkquranimamsyafiipst@gmail.com" : "sdislamimamsyafiipst@gmail.com";

    if (!isTK) {
      try {
        const logoUrl = '/avatars/logo.png'; 
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        
        const imgPromise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        
        const logoData = await imgPromise;
        doc.addImage(logoData, 'PNG', margin, 15, 25, 25);
      } catch (e) {
        console.warn("Logo failed to load for PDF:", e);
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(schoolName, 110, 20, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Jl. Lembaga Dusun II Desa Tanjung Rejo, Kec. Percut Sei Tuan", 110, 26, { align: "center" });
    doc.text(`Email: ${schoolEmail} | WA: 0831-2575-5134`, 110, 31, { align: "center" });
    
    // Line Divider
    doc.setLineWidth(0.5);
    doc.line(margin, 42, 210 - margin, 42);
    currentY = 55;

    // 2. Exam Identity
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Mata Pelajaran : ....................`, margin, currentY);
    doc.text(`Kelas : ${activeGrade}`, 140, currentY);
    currentY += 8;
    doc.text(`Ujian : ${folder.name}`, margin, currentY);
    doc.text(`Tanggal : ....................`, 140, currentY);
    
    currentY += 15;

    // 3. Render Questions by Section
    const pgQuestions = folderQuestions.filter(q => (q.type || 'pg') === 'pg');
    const essayQuestions = folderQuestions.filter(q => q.type === 'essay');

    // --- SECTION I: PILIHAN GANDA ---
    if (pgQuestions.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("I. Soal Pilihan Ganda", margin, currentY);
      currentY += 10;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      pgQuestions.forEach((q, index) => {
        if (currentY > 260) { doc.addPage(); currentY = 20; }
        
        const questionLines = doc.splitTextToSize(`${index + 1}. ${q.text}`, 170);
        doc.text(questionLines, margin, currentY);
        currentY += (questionLines.length * 6);

        const options = [
          `a. ${q.options.a}`, 
          `b. ${q.options.b}`, 
          `c. ${q.options.c}`, 
          `d. ${q.options.d}`
        ];

        doc.text(options[0], margin + 5, currentY);
        doc.text(options[1], margin + 90, currentY);
        currentY += 6;
        doc.text(options[2], margin + 5, currentY);
        doc.text(options[3], margin + 90, currentY);
        currentY += 10;
      });
    }

    // --- SECTION II: ESSAI ---
    if (essayQuestions.length > 0) {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      else { currentY += 10; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("II. Soal Essai", margin, currentY);
      currentY += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      essayQuestions.forEach((q, index) => {
        if (currentY > 260) { doc.addPage(); currentY = 20; }
        
        const fullDottedLine = "..........................................................................................................................................................................";
        
        // Step 1: Calculate how many lines the question text occupies without dots
        const originalTextWrapped = doc.splitTextToSize(`${index + 1}. ${q.text}`, 170);
        const textLineCount = originalTextWrapped.length;

        // Step 2: Create a combined version with long dots appended
        const combinedText = `${index + 1}. ${q.text} ${fullDottedLine}`;
        const combinedWrapped = doc.splitTextToSize(combinedText, 170);
        
        // Step 3: Take only the lines required to show all text + fill the last line with dots
        const questionWithFill = combinedWrapped.slice(0, textLineCount);
        doc.text(questionWithFill, margin, currentY);
        currentY += (questionWithFill.length * 6) + 4; // Add 4 units gap after text

        // Step 4: Add EXACTLY 2 full dotted lines with extra padding for writing
        doc.text(fullDottedLine, margin, currentY);
        currentY += 10; // Increased spacing for handwriting
        doc.text(fullDottedLine, margin, currentY);
        currentY += 15; // final spacing before next question
      });
    }

    doc.save(`Soal_${activeGrade}_${folder.name}.pdf`);
  };

  const filteredQuestions = (questions[activeExamFolder] || []).filter(q => q.text.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Soal</h2>
            {!isSyncing && (
              <button 
                onClick={() => syncGradeToCloud(activeGrade)}
                className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full hover:bg-emerald-100 transition-colors"
                title="Klik untuk sinkronisasi manual sekarang"
              >
                <CheckCircle2 size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest">Tersinkron</span>
              </button>
            )}
            {isSyncing && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full animate-pulse">
                <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-bounce"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Sinking...</span>
              </div>
            )}
          </div>
          <p className="text-slate-500 font-medium mt-1">Kelola bank soal digital dan cetak dokumen ujian.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto hide-scrollbar">
          {GRADES.map(grade => (
            <button
              key={grade}
              onClick={() => { setActiveGrade(grade); setActiveExamFolder(null); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                activeGrade === grade ? 'bg-secondary text-white shadow-lg shadow-secondary/20' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {grade}
            </button>
          ))}
        </div>
      </header>

      {/* Folder Section */}
      <section>
        <div className="flex items-center justify-between mb-3 px-2">
          <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Daftar Folder Ujian - {activeGrade}</h3>
          <button 
            onClick={() => setIsAddFolderModalOpen(true)}
            className="text-[10px] md:text-xs font-black text-secondary flex items-center gap-2 hover:translate-x-1 transition-all"
          >
            <FolderPlus size={14} className="hidden md:block" /> TAMBAH TIPE UJIAN
          </button>
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-2 -mx-2 hide-scrollbar">
          {examTypes[activeGrade].map(folder => (
            <div
              key={folder.id}
              onClick={() => setActiveExamFolder(folder.id)}
              className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-xl md:rounded-2xl border-2 shrink-0 transition-all cursor-pointer ${
                activeExamFolder === folder.id 
                ? 'bg-white border-secondary shadow-xl shadow-secondary/10 -translate-y-1' 
                : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
              }`}
            >
              <div className={`p-2 md:p-2.5 rounded-lg md:rounded-xl ${activeExamFolder === folder.id ? 'bg-secondary/10 text-secondary' : 'bg-slate-50 text-slate-400'}`}>
                <FileText size={16} className="md:w-5 md:h-5" />
              </div>
              <div className="text-left flex-grow">
                <p className={`text-xs md:text-sm font-black ${activeExamFolder === folder.id ? 'text-slate-900' : 'text-slate-500'}`}>{folder.name}</p>
                <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{(questions[folder.id] || []).length} Soal</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                className="ml-2 md:ml-3 p-1 text-slate-200 hover:text-rose-500 transition-colors"
                title="Hapus Folder"
              >
                <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
              </button>
            </div>
          ))}
          {examTypes[activeGrade].length === 0 && (
            <div className="py-6 md:py-8 border-2 border-dashed border-slate-200 rounded-2xl md:rounded-3xl w-full text-center flex flex-col items-center gap-2">
              <AlertCircle size={20} className="text-slate-300 md:w-6 md:h-6" />
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Belum ada folder</p>
            </div>
          )}
        </div>
      </section>

      {/* Questions Area */}
      {activeExamFolder ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
          <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-10">
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Cari pertanyaan..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl md:rounded-2xl py-2.5 md:py-4 pl-11 md:pl-14 pr-4 md:pr-6 text-xs md:text-sm font-bold focus:ring-2 focus:ring-secondary/20 transition-all placeholder:text-slate-300"
                />
              </div>
              
              <div className="flex items-center gap-2 md:gap-3">
                <button 
                  onClick={handleExportPDF}
                  className="flex-grow md:flex-none p-2.5 md:p-4 bg-rose-50 text-rose-600 rounded-xl md:rounded-2xl hover:bg-rose-100 transition-all border border-rose-100 flex items-center justify-center gap-2 font-black text-[10px] md:text-xs"
                >
                  <FileDown size={16} /> EXPORT PDF
                </button>
                <button 
                  onClick={() => { setEditingQuestion(null); setQuestionForm({ text: '', options: { a: '', b: '', c: '', d: '' }, correctAnswer: 'a', weight: 1 }); setIsQuestionModalOpen(true); }}
                  className="flex-grow md:flex-none bg-secondary text-white px-4 md:px-8 py-2.5 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-secondary/20"
                >
                  <Plus size={16} /> TAMBAH SOAL
                </button>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full text-left min-w-[600px] md:min-w-0">
                <thead>
                  <tr className="text-[9px] md:text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] border-b border-slate-50">
                    <th className="pb-4 md:pb-6 px-4">#</th>
                    <th className="pb-4 md:pb-6">Detail Soal</th>
                    <th className="pb-4 md:pb-6 text-center">Kunci</th>
                    <th className="pb-4 md:pb-6 text-center">Bobot</th>
                    <th className="pb-4 md:pb-6 text-right px-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredQuestions.map((q, i) => (
                    <tr key={q.id} className="group hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 md:py-6 px-4 text-xs md:text-sm font-black text-slate-300">{i + 1}</td>
                      <td className="py-4 md:py-6 pr-4 md:pr-6">
                        <div className="flex items-center gap-2 mb-2 md:mb-3">
                          {q.type === 'essay' && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-black rounded uppercase tracking-wider border border-amber-100 flex-shrink-0">
                              ESSAI
                            </span>
                          )}
                          <p className="text-xs md:text-sm font-bold text-slate-700 leading-relaxed line-clamp-2">{q.text}</p>
                        </div>
                        
                        {q.type !== 'essay' && (
                          <div className="grid grid-cols-2 gap-x-4 md:gap-x-6 gap-y-1">
                            {['a', 'b', 'c', 'd'].map(opt => (
                              <span key={opt} className={`text-[8px] md:text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 md:gap-2 ${q.correctAnswer === opt ? 'text-secondary' : 'text-slate-400'}`}>
                                <span className={`w-3.5 h-3.5 md:w-4 md:h-4 rounded flex items-center justify-center text-[7px] md:text-[8px] ${q.correctAnswer === opt ? 'bg-secondary text-white' : 'bg-slate-100 text-slate-400'}`}>{opt}</span>
                                {q.options[opt]}
                              </span>
                            ))}
                          </div>
                        )}
                        {q.type === 'essay' && (
                          <p className="text-[10px] text-slate-400 italic">Jawaban Essay Mandiri</p>
                        )}
                      </td>
                      <td className="py-4 md:py-6 text-center">
                        <span className={`inline-flex w-7 h-7 md:w-8 md:h-8 ${q.type === 'essay' ? 'bg-slate-100 text-slate-400' : 'bg-secondary/10 text-secondary'} rounded-lg md:rounded-xl items-center justify-center font-black text-xs uppercase`}>
                          {q.type === 'essay' ? '-' : q.correctAnswer}
                        </span>
                      </td>
                      <td className="py-4 md:py-6 text-center">
                        <span className="text-[10px] md:text-xs font-black text-slate-400 bg-slate-50 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg">{q.weight}</span>
                      </td>
                      <td className="py-4 md:py-6 text-right px-4">
                        <div className="flex items-center justify-end gap-1.5 md:gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditQuestion(q)} className="p-2 md:p-2.5 bg-slate-50 text-slate-400 hover:text-secondary rounded-lg md:rounded-xl transition-all"><FileEdit size={14} className="md:w-4 md:h-4" /></button>
                          <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 md:p-2.5 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-lg md:rounded-xl transition-all"><Trash2 size={14} className="md:w-4 md:h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-100 flex flex-col items-center">
           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
             <BookOpen size={40} />
           </div>
           <h4 className="text-lg font-black text-slate-900 mb-2">Pilih Tipe Ujian</h4>
           <p className="text-slate-400 text-sm max-w-xs font-medium">Klik salah satu folder ujian di atas untuk mulai mengelola bank soal.</p>
        </div>
      )}

      {/* Modals with Back-Button Protection & Scroll Fixes */}
      <AnimatePresence>
        {isAddFolderModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] bg-slate-950/40 backdrop-blur-sm flex items-start md:items-center justify-center p-6 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-3xl my-auto relative"
            >
              <button 
                onClick={() => setIsAddFolderModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 transition-colors"
              >
                <X size={24} />
              </button>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Buat Tipe Ujian</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">Tipe ujian akan menjadi folder di kelas {activeGrade}.</p>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-2">Nama Folder</label>
                  <input autoFocus type="text" placeholder="Contoh: PTS Ganjil 2026" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:border-secondary transition-all outline-none" />
                </div>
                <div className="flex gap-4 pt-2">
                  <button onClick={() => setIsAddFolderModalOpen(false)} className="flex-grow py-4 rounded-2xl font-black text-xs text-slate-400 hover:bg-slate-50">BATAL</button>
                  <button onClick={handleAddFolder} className="flex-grow py-4 bg-secondary text-white rounded-2xl font-black text-xs shadow-xl shadow-secondary/20">SIMPAN FOLDER</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isQuestionModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              className="bg-white w-full max-w-3xl rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 shadow-3xl relative my-10 md:my-8"
            >
              {/* Close Button X */}
              <button 
                onClick={() => setIsQuestionModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 transition-colors"
              >
                <X size={24} />
              </button>

              {/* Toggle Tipe Soal */}
              <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8 w-fit">
                {['pg', 'essay'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setQuestionForm({...questionForm, type: type})}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      (questionForm.type || 'pg') === type 
                      ? 'bg-white text-secondary shadow-sm ring-1 ring-slate-100' 
                      : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {type === 'pg' ? 'Pilihan Ganda' : 'Soal Essai'}
                  </button>
                ))}
              </div>

              <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">{editingQuestion ? 'Edit Soal' : 'Soal Baru'}</h3>
              
              <div className="space-y-8 mt-10">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-3">Isi Pertanyaan {(questionForm.type || 'pg') === 'essay' && '(Essai)'}</label>
                  <textarea rows="4" value={questionForm.text} onChange={(e) => setQuestionForm({...questionForm, text: e.target.value})} placeholder="Tuliskan pertanyaan ujian..." className="w-full bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 text-sm font-bold focus:border-secondary transition-all outline-none resize-none" />
                </div>

                {(questionForm.type || 'pg') === 'pg' ? (
                  <>
                    <div className="grid md:grid-cols-2 gap-6">
                      {['a', 'b', 'c', 'd'].map(opt => (
                        <div key={opt}>
                          <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-2">Pilihan {opt.toUpperCase()}</label>
                          <input type="text" value={questionForm.options[opt]} onChange={(e) => setQuestionForm({...questionForm, options: { ...questionForm.options, [opt]: e.target.value }})} placeholder={`Jawaban ${opt}`} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:border-secondary transition-all outline-none" />
                        </div>
                      ))}
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 pt-4">
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-3">Kunci Jawaban</label>
                        <div className="flex gap-3">
                          {['a', 'b', 'c', 'd'].map(opt => (
                            <button key={opt} onClick={() => setQuestionForm({...questionForm, correctAnswer: opt})} className={`w-12 h-12 rounded-xl font-black text-xs transition-all ${questionForm.correctAnswer === opt ? 'bg-secondary text-white shadow-lg shadow-secondary/20 scale-110' : 'bg-slate-50 text-slate-400'}`}>{opt.toUpperCase()}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-3">Bobot Nilai</label>
                        <input type="number" value={questionForm.weight} onChange={(e) => setQuestionForm({...questionForm, weight: parseInt(e.target.value) || 1})} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:border-secondary transition-all" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-3">Bobot Nilai Essai</label>
                    <input type="number" value={questionForm.weight} onChange={(e) => setQuestionForm({...questionForm, weight: parseInt(e.target.value) || 1})} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:border-secondary transition-all" />
                    <p className="mt-4 text-[11px] text-slate-400 italic">* Soal tipe essai tidak memerlukan pilihan jawaban. Siswa akan menjawab langsung pada dokumen cetak.</p>
                  </div>
                )}

                <div className="flex gap-4 pt-10 border-t border-slate-50">
                  <button onClick={() => setIsQuestionModalOpen(false)} className="flex-grow py-5 rounded-2xl font-black text-xs text-slate-400 hover:bg-slate-50">BATAL</button>
                  <button onClick={handleSaveQuestion} className="flex-grow py-5 bg-primary text-white rounded-2xl font-black text-xs shadow-xl shadow-primary/20 hover:bg-slate-800 transition-all">SIMPAN DATA SOAL</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
