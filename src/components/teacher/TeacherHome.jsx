import React from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Users, 
  Calendar, 
  FileText, 
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TeacherHome() {
  const [examTypes, setExamTypes] = React.useState({});
  const [questions, setQuestions] = React.useState({});

  React.useEffect(() => {
    try {
      const savedExamTypes = JSON.parse(localStorage.getItem('mias_exam_types') || '{}');
      const savedQuestions = JSON.parse(localStorage.getItem('mias_questions') || '{}');
      setExamTypes(savedExamTypes || {});
      setQuestions(savedQuestions || {});
    } catch (e) {
      console.error("Error loading stats:", e);
    }
  }, []);

  // Hitung Total Soal secara dinamis dari semua kelas
  const totalQuestions = Object.values(questions).reduce((acc, current) => {
    return acc + (Array.isArray(current) ? current.length : 0);
  }, 0);

  // Hitung Total Tipe Ujian (Folder) secara dinamis dari semua kelas
  const totalExamTypes = Object.values(examTypes).reduce((acc, current) => {
    return acc + (Array.isArray(current) ? current.length : 0);
  }, 0);

  const stats = [
    { label: 'Total Soal', value: totalQuestions.toString(), icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Tipe Ujian', value: totalExamTypes.toString(), icon: TrendingUp, color: 'bg-emerald-500' },
  ];

  const modules = [
    {
      title: 'Dashboard Soal',
      description: 'Kelola bank soal digital, kategori kelas, dan ekspor ke format Microsoft Word.',
      path: '/dashboard-guru/soal',
      icon: BookOpen,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      tag: 'Siap Digunakan'
    },
    {
      title: 'Manajemen Siswa',
      description: 'Pantau perkembangan nilai dan kehadiran siswa secara real-time (Segera Hadir).',
      path: '/dashboard-guru',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      tag: 'Segera Hadir'
    },
    {
      title: 'Laporan Akademik',
      description: 'Generate rapor dan laporan bulanan dengan satu klik berbasis data sistem.',
      path: '/dashboard-guru',
      icon: FileText,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      tag: 'Pengembangan'
    }
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-white/10"
          >
            <Sparkles size={12} className="text-amber-400" /> Versi Guru 1.1
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-black mb-4"
          >
            Selamat Datang, <span className="text-secondary italic">Guru Hebat!</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-sm md:text-lg leading-relaxed mb-8"
          >
            Panel administrasi ini dirancang untuk memudahkan pekerjaan harian Anda. Mulai dari bank soal hingga manajemen data, semuanya terintegrasi di satu tempat.
          </motion.p>
          <div className="flex flex-wrap gap-4">
            <Link 
              to="/dashboard-guru/soal"
              className="bg-secondary text-white px-6 py-3.5 rounded-xl font-black text-xs flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-secondary/20"
            >
              Mulai Input Soal <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none hidden md:block">
           <div className="absolute top-1/4 right-0 w-64 h-64 bg-secondary rounded-full blur-[100px]"></div>
           <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-primary rounded-full blur-[60px]"></div>
        </div>
      </section>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + (i * 0.1) }}
            key={stat.label}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-secondary/20 transition-all cursor-default"
          >
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
              <p className="text-3xl font-black text-slate-900 group-hover:text-secondary transition-colors">{stat.value}</p>
            </div>
            <div className={`w-14 h-14 ${stat.color} text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:-translate-y-1 transition-transform`}>
              <stat.icon size={28} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Access Modules */}
      <section>
        <div className="flex items-center justify-between mb-8 px-2">
           <h2 className="text-xl font-black text-slate-900">Modul Administrasi</h2>
           <Link to="/dashboard-guru" className="text-xs font-black text-slate-400 hover:text-secondary transition-colors uppercase tracking-widest">Semua Modul</Link>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {modules.map((mod, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + (i * 0.1) }}
              key={mod.title}
              className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-2xl hover:shadow-slate-200 transition-all flex flex-col group relative overflow-hidden"
            >
              <div className={`w-16 h-16 ${mod.bg} ${mod.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <mod.icon size={32} />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xl font-black text-slate-900 leading-tight">{mod.title}</h3>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed font-medium mb-8 grow">
                {mod.description}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                 <Link 
                   to={mod.path}
                   className={`text-xs font-black flex items-center gap-2 ${mod.tag === 'Siap Digunakan' ? 'text-secondary hover:translate-x-1' : 'text-slate-300 pointer-events-none'} transition-all`}
                 >
                   BUKA MODUL <ArrowRight size={14} />
                 </Link>
                 <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                   mod.tag === 'Siap Digunakan' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                 }`}>
                   {mod.tag}
                 </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
