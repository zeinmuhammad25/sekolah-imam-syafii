import React, { useState, useEffect } from 'react'
import { Phone, Mail, Instagram, Facebook, Youtube, Menu, X, ArrowRight, MessageCircle, Calendar, Users, Award, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PPDBForm from './components/PPDBForm'
import TeacherLoginModal from './components/TeacherLoginModal'
import { fetchSchoolData } from './services/gsheet'

// Mock Data
const navigation = [
  { name: 'Beranda', href: '#beranda' },
  { name: 'Profil', href: '#profil' },
  { name: 'Akademik', href: '#akademik' },
  { name: 'Karya Siswa', href: '#galeri' },
]

// 7. Data dari Flyer (Yayasan Nashirus Sunnah Percut)
const flyerContent = {
  foundation: "Yayasan Nashirus Sunnah Percut",
  legal: {
    foundationAHU: "AHU-0020888.AH.01.12. Tahun 2019",
    tk: {
      permit: "503.370/0137/DPMPTSP-DS/P/137F-TK/X/2026",
      npsn: "70015344",
      nss: "002070106748"
    },
    sd: {
      permit: "503.371/0117/DPMPTSP-DS/PF-SD/X/2025",
      npsn: "70059421",
      nss: "102070106321"
    }
  },
  vision: "Mewujudkan pendidikan yang merujuk kepada metode dan konsep manhaj As-Salafush Sholih.",
  mission: [
    "Membekali para santri dengan ilmu agama dan amal sholih.",
    "Membimbing para santri memiliki adab dan akhlak yang baik dan terpuji.",
    "Memperkuat para santri dengan aqidah/tauhid yang kuat sejak dini.",
    "Mengajarkan metode menghafal Al-Qur'an, Hadits dan ilmu matan ilmiah.",
    "Mengajarkan ilmu pengetahuan umum yang berguna untuk dunia dan akhirat."
  ],
  advantages: [
    "Gratis Biaya Pendidikan Sampai Tamat.",
    "Pembelajaran agama & karakter berfokus pada Al-Qur'an & As-Sunnah.",
    "Ilmu Pengetahuan Umum sesuai Kurikulum Merdeka."
  ],
  facilities: [
    { name: "Ruang Kelas Full AC", icon: "❄️" },
    { name: "Halaman Luas", icon: "🌳" },
    { name: "Masjid Full AC", icon: "🕌" },
    { name: "Ekstrakurikuler (Futsal, Taekwondo, dll)", icon: "🏆" }
  ],
  history: "Yayasan Nashirus Sunnah Percut berdiri resmi pada 17 Oktober 2019. Berawal dari pemahaman yang sama di atas prinsip Al-Qur'an dan As-Sunnah sesuai manhaj para Sahabat. Pada 15 Juli 2022, dimulai layanan TK Qur'an Imam Syafi'i, disusul pandirian SD Islam Imam Syafi'i pada 1 Desember 2023.",
  goal: "Menciptakan generasi muslim yang berpegang teguh pada Al-Quran and As-Sunnah di atas manhaj As-Salafush Sholih sehingga mampu menjawab tantangan fitnah syubhat dan syahwat.",
  registration: [
    "Mengisi formulir pendaftaran",
    "Berusia 5 Tahun (TK Qur'an) / 6 Tahun (SD Islam)",
    "Fotokopi Kartu Keluarga & Akta Kelahiran",
    "Pas foto 3x4",
    "Materai 10.000"
  ]
}

// Optimized Image Component with Gray Placeholder & Skeleton Effect
const OptimizedImage = ({ src, alt, className, priority = false }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Grey Placeholder Data URL
  const greyPlaceholder = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZThlYWYyIi8+PC9zdmc+";

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${!isLoaded && !hasError ? 'animate-pulse' : ''} ${className}`}>
      <img
        src={src || greyPlaceholder}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          setHasError(true);
          if (src !== greyPlaceholder) {
            e.target.src = greyPlaceholder;
          }
        }}
        className={`w-full h-full object-cover transition-opacity duration-500 ${(isLoaded || hasError) ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};

// Video sekolah — ganti `id` dengan ID video YouTube (bagian setelah "v=" atau "youtu.be/")
const VIDEOS = [
  { id: 'ilXBHt1-4HQ', title: 'Khitanan Massal Gratis - Sekolah Imam Syafii Percut Sei Tuan' },
  { id: 'JzakBMHatnY', title: 'Pelepasan Siswa Siswi TK Quran Imam Syafii tahun ajaran 25/26' },
  { id: 'qjYM5ILKAKw', title: ' Mengintip Keseruan Kelas 2 SD Islam Imam Syafii Menuju Masa Depan Gemilang' },
];

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPPDBOpen, setIsPPDBOpen] = useState(false);
  const [isTeachersModalOpen, setIsTeachersModalOpen] = useState(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [isTeacherLoginOpen, setIsTeacherLoginOpen] = useState(false);
  const [expandedVideo, setExpandedVideo] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [sheetData, setSheetData] = useState(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)

    const cachedData = localStorage.getItem('mias_sheet_data')
    const dataVersion = localStorage.getItem('mias_data_version')
    
    // Set default local favicon
    const favicon = document.getElementById('favicon');
    if (favicon) favicon.href = '/avatars/logo.png';

    // Jika versi lama (tidak ada gender), hapus cache agar ambil data baru
    if (cachedData && dataVersion !== '1.1') {
      localStorage.removeItem('mias_sheet_data');
    } else if (cachedData) {
      const parsed = JSON.parse(cachedData)
      setSheetData(parsed)
    }

    fetchSchoolData()
      .then(data => {
        if (data) {
          setSheetData(data);
          localStorage.setItem('mias_sheet_data', JSON.stringify(data));
          localStorage.setItem('mias_data_version', '1.1');

          // Turbo Preload Aset Kritis
          const logo = '/avatars/logo.png';
          const hero = '/avatars/hero.jpeg';

          if (logo) {
            const link = document.createElement('link'); link.rel = 'preload'; link.as = 'image'; link.href = logo;
            document.head.appendChild(link);
          }
          if (hero) {
            const link = document.createElement('link'); link.rel = 'preload'; link.as = 'image'; link.href = hero;
            document.head.appendChild(link);
          }
        }
      })
      .catch(err => console.error("Error fetching data:", err));

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top Bar */}
      <div className="bg-slate-950 text-slate-300 py-3 px-6 hidden md:block border-b border-white/5 relative z-[60]">
        <div className="container mx-auto flex justify-between items-center text-[11px] font-bold uppercase tracking-[0.15em]">
          <div className="flex items-center gap-8">
            <a href="tel:+6283125755134" className="flex items-center gap-2 hover:text-secondary-light transition-all flex group">
              <Phone size={10} />
              <span>+62 831-2575-5134</span>
            </a>
            <a href="mailto:admin@sekolahislamimamsyafii.web.id" className="flex items-center gap-2 hover:text-secondary-light transition-all group">
              <Mail size={10} />
              <span className="lowercase font-medium tracking-normal">admin@sekolahislamimamsyafii.web.id</span>
            </a>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <Instagram size={14} className="hover:text-secondary cursor-pointer transition-colors" />
              <Facebook size={14} className="hover:text-secondary cursor-pointer transition-colors" />
              <Youtube size={14} className="hover:text-secondary cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* Running Text */}
      <div className="bg-gradient-to-r from-accent/90 via-accent to-accent/90 text-white py-2.5 text-xs font-black shadow-lg">
        <div className="running-text-container">
          <div className="running-text flex items-center gap-4">
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
            INFO PPDB: {sheetData?.Announcements?.find(a => a.active === 'Yes')?.text || 'PENDAFTARAN SISWA BARU (SD & TK) TAHUN AJARAN 2026/2027 TELAH DIBUKA! GRATIS BIAYA PENDIDIKAN.'}
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 transition-all duration-500 ${scrolled ? 'py-2' : 'py-6 bg-white'}`}>
        <div className="container mx-auto px-4">
          <div className={`flex justify-between items-center px-6 ${scrolled ? 'glass-card py-3 rounded-[2rem] shadow-2xl border border-white' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center text-white font-black text-2xl border-2 border-white overflow-hidden">
                <OptimizedImage
                  src="/avatars/logo.png"
                  alt="Logo"
                  className="w-full h-full"
                  priority={true}
                />
              </div>
              <div className="leading-tight">
                <h1 className="text-lg font-black tracking-tighter text-primary">IMAM SYAFI'I PERCUT</h1>
                <p className="text-[8px] text-slate-400 uppercase tracking-[0.2em] font-black">TK Qur'an & SD Islam</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-6 lg:gap-10">
              {navigation.map((item) => (
                <a key={item.name} href={item.href} className="text-[11px] lg:text-[12px] font-black text-slate-500 hover:text-secondary transition-all relative group uppercase tracking-widest">
                  {item.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-secondary transition-all group-hover:w-full rounded-full" />
                </a>
              ))}
              <button 
                onClick={() => setIsTeacherLoginOpen(true)}
                className="text-[11px] font-black text-slate-400 hover:text-primary transition-all flex items-center gap-2"
              >
                <Lock size={14} /> AKSES GURU
              </button>
              <button onClick={() => setIsPPDBOpen(true)} className="bg-primary hover:bg-secondary text-white px-5 lg:px-6 py-3 rounded-2xl text-[10px] lg:text-[11px] font-black shadow-xl transition-all uppercase tracking-widest">
                DAFTAR PPDB
              </button>
            </nav>

            <button className="md:hidden p-3" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: '100%' }} 
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col"
          >
            <div className="flex justify-between items-center p-8 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center text-white font-black text-xs overflow-hidden border-2 border-white shadow-sm">
                  <OptimizedImage
                    src="/avatars/logo.png"
                    alt="Logo"
                    className="w-full h-full"
                  />
                </div>
                <span className="font-black text-xs tracking-widest text-primary uppercase">Menu Utama</span>
              </div>
              <button 
                onClick={() => setIsMenuOpen(false)} 
                className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-primary active:scale-90 transition-transform"
              >
                <X size={24} />
              </button>
            </div>

            <nav className="flex-grow flex flex-col justify-center px-10 gap-2">
              {navigation.map((item, i) => (
                <motion.a 
                  key={item.name} 
                  href={item.href} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + (i * 0.05) }}
                  className="group flex items-center justify-between py-4 border-b border-slate-50 last:border-0" 
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-xl font-black text-primary group-hover:text-secondary transition-colors flex items-center gap-4">
                    {item.name === 'Beranda' && <Calendar size={18} className="text-secondary/40" />}
                    {item.name === 'Profil' && <Users size={18} className="text-secondary/40" />}
                    {item.name === 'Akademik' && <Award size={18} className="text-secondary/40" />}
                    {item.name === 'Karya Siswa' && <MessageCircle size={18} className="text-secondary/40" />}
                    {item.name}
                  </span>
                  <ArrowRight size={18} className="text-slate-200 group-hover:text-secondary transition-all" />
                </motion.a>
              ))}
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 flex flex-col gap-4"
              >
                <button 
                  onClick={() => { setIsPPDBOpen(true); setIsMenuOpen(false); }} 
                  className="w-full bg-primary text-white py-5 rounded-2xl font-black text-base shadow-2xl shadow-primary/20 flex items-center justify-center gap-3"
                >
                  DAFTAR PPDB <ArrowRight size={20} />
                </button>
                <button 
                  onClick={() => { setIsTeacherLoginOpen(true); setIsMenuOpen(false); }}
                  className="w-full bg-slate-50 text-slate-500 py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3 border border-slate-100"
                >
                  <Lock size={16} /> AKSES ADMINISTRASI GURU
                </button>
              </motion.div>
            </nav>

            <div className="p-12 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Hubungi Kami</p>
              <div className="flex gap-6">
                <Instagram size={20} className="text-primary opacity-50" />
                <Facebook size={20} className="text-primary opacity-50" />
                <Youtube size={20} className="text-primary opacity-50" />
                <Mail size={20} className="text-primary opacity-50" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow">
        {/* Hero Section */}
        <section id="beranda" className="pt-8 pb-16 md:pt-24 md:pb-32 relative overflow-hidden">
          <div className="container mx-auto px-5 md:px-6 grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-primary/5 text-primary text-[9px] md:text-[10px] font-black rounded-full mb-6 uppercase tracking-widest border border-primary/10 leading-none">
                Penerimaan Murid Baru 2027/2028
              </div>
              <h2 className="text-3xl md:text-7xl font-black text-primary leading-[1.1] mb-6 md:mb-8">
                Cerdas, Religius <br className="hidden md:block" />& <span className="text-secondary italic">Berkarakter</span>
              </h2>
              <p className="text-base md:text-lg text-slate-500 mb-8 md:mb-10 max-w-lg leading-relaxed font-medium">
                Pendidikan formal berbasis Al-Qur'an dan As-Sunnah sesuai manhaj As-Salafush Sholih.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button onClick={() => setIsPPDBOpen(true)} className="w-full sm:w-auto bg-primary text-white px-8 py-4 rounded-xl md:rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95">
                  DAFTAR SEKARANG <ArrowRight size={18} />
                </button>
                <div className="w-full sm:w-auto flex items-center justify-center gap-3 px-5 py-3 md:px-6 md:py-4 bg-secondary/5 text-secondary rounded-xl md:rounded-2xl font-black text-[11px] md:text-sm border border-secondary/10 whitespace-nowrap">
                  GRATIS BIAYA PENDIDIKAN
                </div>
              </div>
            </motion.div>

            <div className="relative">
              <div className="relative z-10 p-3 bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
                <OptimizedImage
                  src="/avatars/hero.jpeg"
                  className="w-full aspect-[4/5] rounded-[2.5rem] shadow-inner"
                  alt="Sekolah"
                  priority={true}
                />
              </div>
              <div className="absolute -top-3 -right-3 md:-top-6 md:-right-6 glass-card p-3 md:p-5 rounded-2xl md:rounded-[2rem] z-20 shadow-2xl border border-white/50 md:border-2">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-accent text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                    <Award size={18} />
                  </div>
                  <div>
                    <div className="text-xs md:text-sm font-black text-primary leading-none capitalize">Terakreditasi</div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -right-4 md:-bottom-6 md:-right-6 glass-card p-3 md:p-6 rounded-2xl md:rounded-[2rem] z-20 shadow-2xl border border-white/50 md:border-2">
                <div className="text-xl md:text-2xl font-black text-primary leading-none">TAHFIDZ</div>
                <div className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1">Target 3 Juz (SD)</div>
              </div>
            </div>
          </div>
        </section>

        {/* Keunggulan Section */}
        <section className="py-12 md:py-24 bg-slate-50 border-y border-slate-100">
          <div className="container mx-auto px-5 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {flyerContent.advantages.map((text, i) => (
                <div key={i} className="p-5 md:p-8 bg-white rounded-2xl md:rounded-[2.5rem] shadow-xl border border-white hover:-translate-y-2 transition-all">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-secondary/10 text-secondary rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-6 text-xl md:text-2xl">
                    {i === 0 ? "💰" : i === 1 ? "📖" : "🎓"}
                  </div>
                  <h3 className="text-base md:text-xl font-black text-primary leading-tight">{text}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Profil Section (Reordered as Requested) */}
        <section id="profil" className="py-12 md:py-24 bg-white">
          <div className="container mx-auto px-5 md:px-6">
            <div className="flex flex-col gap-10 md:gap-12">
              {/* 1. Sejarah & Tujuan Kami (Centered) */}
              <div className="max-w-4xl mx-auto text-center px-2">
                <span className="text-secondary font-black uppercase tracking-widest text-[10px] mb-3 block">Tentang Sekolah</span>
                <h2 className="text-3xl md:text-4xl font-black text-primary mb-6">Sejarah & Tujuan Kami</h2>
                <p className="text-slate-500 leading-relaxed font-medium mb-8 text-base md:text-lg">{flyerContent.history}</p>
              </div>

              {/* 2. Visi & Misi (Grid Layout) */}
              <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
                <div className="glass-card p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-l-[8px] md:border-l-[10px] border-secondary shadow-lg">
                  <h3 className="text-xl md:text-2xl font-black text-primary mb-4 md:mb-6 flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-secondary rounded-xl flex items-center justify-center text-white text-base md:text-lg font-black">V</div>
                    Visi Sekolah
                  </h3>
                  <p className="text-lg md:text-xl font-bold text-slate-600 leading-relaxed italic">"{flyerContent.vision}"</p>
                </div>

                <div className="glass-card p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-l-[8px] md:border-l-[10px] border-accent shadow-lg">
                  <h3 className="text-xl md:text-2xl font-black text-primary mb-4 md:mb-6 flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-accent rounded-xl flex items-center justify-center text-white text-base md:text-lg font-black">M</div>
                    Misi Kami
                  </h3>
                  <ul className="space-y-3">
                    {flyerContent.mission.map((m, i) => (
                      <li key={i} className="flex gap-3">
                        <div className="w-4 h-4 bg-accent/10 rounded-full flex items-center justify-center mt-1 shrink-0">
                          <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                        </div>
                        <span className="text-slate-600 font-medium text-xs md:text-sm">{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 3. Tujuan Pendidikan (Card) */}
              <div className="max-w-4xl mx-auto p-6 md:p-10 bg-primary text-white rounded-[2rem] md:rounded-[3rem] shadow-2xl relative overflow-hidden group text-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                <h4 className="text-base md:text-xl font-black mb-6 flex items-center justify-center gap-3">
                  <div className="w-8 md:w-12 h-1 bg-secondary rounded-full" />
                  Tujuan Pendidikan
                  <div className="w-8 md:w-12 h-1 bg-secondary rounded-full" />
                </h4>
                <p className="text-lg md:text-xl text-slate-200 leading-relaxed font-medium mx-auto max-w-2xl">{flyerContent.goal}</p>
              </div>

              {/* 4. Satuan Pendidikan (Logos) */}
              <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto w-full">
                <div className="p-4 md:p-8 bg-slate-50 rounded-2xl md:rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center shadow-sm">
                  <div className="text-4xl md:text-5xl mb-2 md:mb-4">🏫</div>
                  <div className="font-black text-sm md:text-xl text-primary mb-1">TK Qur'an</div>
                  <div className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest">Usia 5 Tahun</div>
                </div>
                <div className="p-4 md:p-8 bg-slate-100 rounded-2xl md:rounded-[2.5rem] border border-slate-200 flex flex-col items-center text-center shadow-sm">
                  <div className="text-4xl md:text-5xl mb-2 md:mb-4">📚</div>
                  <div className="font-black text-sm md:text-xl text-primary mb-1">SD Islam</div>
                  <div className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest">Usia 6 Tahun</div>
                </div>
              </div>

              {/* 5. Syarat Pendaftaran */}
              <div className="p-6 md:p-12 bg-accent/5 border border-accent/20 rounded-[2rem] md:rounded-[3rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 hidden md:block">
                  <Award size={80} className="rotate-12" />
                </div>
                <h4 className="text-sm md:text-lg font-black text-accent uppercase tracking-widest mb-6 md:mb-8">Syarat Pendaftaran</h4>
                <ul className="grid md:grid-cols-2 gap-y-3 gap-x-12">
                  {flyerContent.registration.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-xs md:text-sm font-bold text-slate-700">
                      <div className="w-7 h-7 md:w-8 md:h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-accent shrink-0 border border-accent/10">
                        {i + 1}
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 6. Galeri (Ekspresi Hari Ini) */}
              <div id="galeri" className="pt-8 md:pt-12">
                <div className="text-left mb-8 md:mb-12">
                  <span className="text-secondary font-black uppercase tracking-widest text-xs md:text-sm mb-3 block">Ekspresi Hari Ini</span>
                  <h2 className="text-3xl md:text-4xl font-black text-primary leading-tight">Melihat kreativitas kami di <span className="text-secondary italic underline underline-offset-8">galeri siswa</span></h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[180px] md:auto-rows-[350px]">
                  {(sheetData?.Gallery || [
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                  ]).slice(0, 5).map((item, i) => (
                    <motion.div key={i} className={`rounded-2xl md:rounded-[2rem] overflow-hidden relative group ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                      <OptimizedImage
                        src={(() => {
                          let url = item.image_url;
                          if (url.includes('googleusercontent.com') || url.includes('lh3.google')) {
                            url = url.includes('=s') ? url.replace(/=s\d+/, '=s600') : url + '=s600';
                          } else if (url.includes('drive.google.com')) {
                            const id = url.match(/[-\w]{25,}/);
                            if (id) url = `https://lh3.googleusercontent.com/u/0/d/${id}=s600`;
                          }
                          return url;
                        })()}
                        className="w-full h-full group-hover:scale-110 transition-transform duration-700"
                        alt="Galeri"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/95 p-4 md:p-8 opacity-0 group-hover:opacity-100 transition-all">
                        <div className="text-white">
                          <div className="text-[8px] md:text-[10px] font-black uppercase text-secondary mb-1">{item.category}</div>
                          <div className="font-black text-sm md:text-xl leading-tight">{item.title}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* See All Gallery Button */}
                {(sheetData?.Gallery?.length > 5) && (
                  <div className="mt-12 text-center">
                    <button 
                      onClick={() => setIsGalleryModalOpen(true)}
                      className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-primary to-primary-light text-white px-8 py-3.5 rounded-xl font-black text-[10px] md:text-sm uppercase tracking-[0.2em] shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 active:scale-95 transition-all duration-300"
                    >
                      <span className="relative z-10 flex items-center gap-3">
                        Eksplorasi Galeri <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform duration-500" />
                      </span>
                      <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Video Sekolah */}
        <section className="pt-6 md:pt-8 pb-6 md:pb-8">
          <div className="container mx-auto px-5 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
              {VIDEOS.map((video, i) => (
                <div key={i} className="group">
                  <button
                    onClick={() => setExpandedVideo(video)}
                    className="relative aspect-video w-full rounded-2xl md:rounded-3xl overflow-hidden shadow-xl bg-black"
                    aria-label={`Putar video ${video.title}`}
                  >
                    <OptimizedImage
                      src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                      <span className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                        <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 md:w-7 md:h-7 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                    </span>
                  </button>
                  <h3 className="mt-4 text-center text-sm md:text-base font-black text-primary leading-tight">{video.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Akademik Section (Teachers) */}
        <section id="akademik" className="py-12 md:py-24 bg-slate-50">
          <div className="container mx-auto px-5 md:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-primary mb-10 md:mb-16">Mengenal <span className="text-secondary">Pengajar</span> Kami</h2>
            <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-6 md:gap-10">
              {(sheetData?.Teachers || [
                { name: 'Memuat Guru...', role: 'Staf Pengajar', gender: 'ikhwan', photo_url: '' },
                { name: 'Memuat Guru...', role: 'Staf Pengajar', gender: 'ikhwan', photo_url: '' },
                { name: 'Memuat Guru...', role: 'Staf Pengajar', gender: 'ikhwan', photo_url: '' },
              ]).slice(0, 4).map((staff, i) => (
                <div key={i} className="text-center group">
                  <div className="w-full aspect-[3/4] md:w-64 rounded-2xl md:rounded-[2.5rem] overflow-hidden mb-4 md:mb-6 shadow-xl relative">
                    <OptimizedImage
                      src={staff.photo_url || (
                        (staff.gender || staff.Gender || staff.GENDER || '').toString().toLowerCase().includes('akhwat')
                          ? '/avatars/akhwat.png'
                          : '/avatars/ikhwan.png'
                      )}
                      className={`w-full h-full transition-all duration-500 group-hover:scale-110 ${staff.photo_url ? 'grayscale group-hover:grayscale-0' : 'p-6 md:p-10 opacity-70'}`}
                      alt={staff.name}
                    />
                  </div>
                  <h3 className="text-sm md:text-xl font-black text-primary leading-tight">{staff.name}</h3>
                  <p className="text-[10px] md:text-sm font-bold text-secondary uppercase tracking-widest mt-1">{staff.role}</p>
                </div>
              ))}
            </div>

            {(sheetData?.Teachers?.length > 4 || (!sheetData?.Teachers && 3 > 4)) && (
              <div className="mt-12">
                <button
                  onClick={() => setIsTeachersModalOpen(true)}
                  className="text-primary font-black hover:text-secondary transition-all flex items-center gap-2 mx-auto border-b-2 border-primary/10 pb-1"
                >
                  Lihat Selengkapnya <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Fasilitas & Legalitas Section (Dark) */}
        <section className="py-16 md:py-32 bg-slate-950 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-1/4 left-10 w-96 h-96 bg-secondary rounded-full blur-[100px] md:blur-[150px]" />
            <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-accent rounded-full blur-[100px] md:blur-[150px]" />
          </div>
          <div className="container mx-auto px-5 md:px-6 relative z-10">
            <div className="text-center mb-12 md:mb-20">
              <span className="text-secondary font-black uppercase tracking-widest text-[10px] mb-3 block">Sarana & Prasarana</span>
              <h2 className="text-3xl md:text-5xl font-black mb-4 md:mb-6">Fasilitas Sekolah</h2>
              <p className="text-slate-400 max-w-xl mx-auto text-sm md:text-base">Mendukung kenyamanan belajar di lingkungan bermanhaj salaf.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-16 md:mb-32">
              {flyerContent.facilities.map((f, i) => (
                <div key={i} className="text-center p-6 md:p-10 bg-white/5 border border-white/10 rounded-2xl md:rounded-[3rem] backdrop-blur-md">
                  <div className="text-3xl md:text-5xl mb-4 md:mb-6">{f.icon}</div>
                  <div className="font-black text-sm md:text-lg">{f.name}</div>
                </div>
              ))}
            </div>

            {/* Legalitas Card */}
            <div className="p-6 md:p-12 lg:p-20 bg-white rounded-[2rem] md:rounded-[4rem] text-primary shadow-3xl">
              <div className="text-center mb-10 md:mb-16">
                <h3 className="text-2xl md:text-3xl font-black mb-2 md:mb-4">Legalitas & Identitas</h3>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] md:text-xs">Informasi Resmi Yayasan & Satuan Pendidikan</p>
              </div>
              <div className="grid lg:grid-cols-2 gap-8 md:gap-16">
                <div>
                  <div className="text-xs md:text-sm font-black text-secondary uppercase mb-4">Identitas Yayasan</div>
                  <div className="p-5 md:p-6 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100">
                    <div className="font-black text-base md:text-xl mb-1 md:mb-2">{flyerContent.foundation}</div>
                    <div className="text-xs md:text-sm font-medium text-slate-500 italic">No. AHU: {flyerContent.legal.foundationAHU}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <div className="text-[10px] md:text-xs font-black text-accent uppercase mb-3 md:mb-4">TK Qur'an</div>
                    <div className="space-y-3 md:space-y-4">
                      <div><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">NPSN</span><br /><span className="font-black text-sm md:text-base">{flyerContent.legal.tk.npsn}</span></div>
                      <div><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">Izin Ops</span><br /><span className="text-[10px] md:text-xs font-bold truncate block">{flyerContent.legal.tk.permit}</span></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] md:text-xs font-black text-secondary uppercase mb-3 md:mb-4">SD Islam</div>
                    <div className="space-y-3 md:space-y-4">
                      <div><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">NPSN</span><br /><span className="font-black text-sm md:text-base">{flyerContent.legal.sd.npsn}</span></div>
                      <div><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">Izin Ops</span><br /><span className="text-[10px] md:text-xs font-bold truncate block">{flyerContent.legal.sd.permit}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Warta Terbaru Section */}
        <section id="berita" className="py-12 md:py-24 bg-white">
          <div className="container mx-auto px-5 md:px-6 font-bold">
            <h2 className="text-2xl md:text-3xl font-black text-primary mb-10 md:mb-12 text-center underline decoration-secondary decoration-4 underline-offset-8">Warta Terbaru</h2>
            <div className="grid md:grid-cols-3 gap-8 md:gap-10">
              {[
                { title: 'Penerimaan Siswa Baru TA 2026/2027', date: '20 April 2024', summary: 'Segera daftarkan putra-putri Anda untuk jenjang TK & SD.' },
                { title: 'Program Tahfidz', date: '15 April 2024', summary: 'Mewujudkan generasi penghafal Al-Qur\'an sejak dini.' },
                { title: 'Fasilitas Kelas Nyaman', date: '10 April 2024', summary: 'Dukungan fasilitas belajar terbaik untuk Ananda.' },
              ].map((item, i) => (
                <article key={i} className="group">
                  <div className="aspect-video bg-slate-100 rounded-2xl md:rounded-[2rem] mb-4 md:mb-6 overflow-hidden">
                    <OptimizedImage
                      src="/avatars/hero.jpeg"
                      className="w-full h-full group-hover:scale-110 transition-transform duration-700"
                      alt="News"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-secondary mb-2 md:mb-3 uppercase tracking-widest">
                    <Calendar size={12} /> {item.date}
                  </div>
                  <h3 className="text-lg md:text-xl font-black text-primary group-hover:text-secondary mb-2 md:mb-4 leading-tight">{item.title}</h3>
                  <p className="text-slate-500 text-xs md:text-sm leading-relaxed line-clamp-2">{item.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-slate-400 py-16 md:py-24 px-5 md:px-6 border-t border-white/5">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-4 gap-10 md:gap-16 mb-16 md:mb-20">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-secondary rounded-xl md:rounded-2xl flex items-center justify-center text-white font-black text-xl md:text-2xl border-2 border-white/10 overflow-hidden">
                  <OptimizedImage
                    src="/avatars/logo.png"
                    alt="Logo"
                    className="w-full h-full"
                  />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-white leading-tight">IMAM SYAFI'I PERCUT</h1>
                  <p className="text-[8px] md:text-[10px] tracking-widest uppercase font-black text-slate-500">Sekolah Islam & Penghafal Qur'an</p>
                </div>
              </div>
              <p className="max-w-md text-lg leading-relaxed text-slate-500 font-medium">"{flyerContent.goal}"</p>
            </div>
            <div>
              <h4 className="text-white font-black uppercase text-xs tracking-widest mb-8">Menu Utama</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li><a href="#beranda" className="hover:text-secondary">Beranda</a></li>
                <li><a href="#profil" className="hover:text-secondary">Profil Sekolah</a></li>
                <li><a href="#akademik" className="hover:text-secondary">Akademik</a></li>
                <li><a href="#galeri" className="hover:text-secondary">Galeri Siswa</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-black uppercase text-xs tracking-widest mb-8">Kontak Kami</h4>
              <div className="text-sm font-medium leading-relaxed space-y-4">
                <p>
                  <span className="text-slate-500 block text-[10px] uppercase font-black mb-1">Alamat</span>
                  Jl. Lembaga Dusun II Desa Tanjung Rejo<br />
                  Kec. Percut Sei Tuan, 20371
                </p>
                <p>
                  <span className="text-slate-500 block text-[10px] uppercase font-black mb-1">WhatsApp</span>
                  0831-2575-5134
                </p>
                <div className="space-y-2">
                  <span className="text-slate-500 block text-[10px] uppercase font-black mb-1">Email Resmi</span>
                  admin@sekolahislamimamsyafii.web.id
                </div>
              </div>
            </div>
          </div>
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-600">
            <p>&copy; 2024 {flyerContent.foundation}. Al-Qur'an & As-Sunnah.</p>
            <div className="flex justify-between items-center w-full md:w-auto md:gap-10">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors whitespace-nowrap">Digital Branding Imam Syafi'i</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Teachers Full List Modal */}
      <AnimatePresence>
        {isTeachersModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-white/40 backdrop-blur-2xl p-5 md:p-10 flex items-center justify-center overflow-y-auto"
            onClick={() => setIsTeachersModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-5xl rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-16 relative shadow-3xl max-h-[90vh] overflow-y-auto hide-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsTeachersModalOpen(false)}
                className="absolute top-6 right-6 md:top-10 md:right-10 p-3 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 hover:text-primary transition-all z-10"
              >
                <X size={24} />
              </button>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 mt-8 md:mt-4">
                {(sheetData?.Teachers || []).map((staff, i) => (
                  <div key={i} className="text-center">
                    <div className="w-full aspect-[3/4] rounded-2xl md:rounded-[2rem] overflow-hidden mb-4 shadow-xl border-4 border-slate-50">
                      <OptimizedImage
                        src={staff.photo_url || (
                          (staff.gender || staff.Gender || staff.GENDER || '').toString().toLowerCase().includes('akhwat')
                            ? '/avatars/akhwat.png'
                            : '/avatars/ikhwan.png'
                        )}
                        className={`w-full h-full ${staff.photo_url ? '' : 'p-6 md:p-10 opacity-70'}`}
                        alt={staff.name}
                      />
                    </div>
                    <h3 className="text-xs md:text-lg font-black text-primary leading-tight">{staff.name}</h3>
                    <p className="text-[9px] md:text-xs font-bold text-secondary uppercase tracking-widest mt-1">{staff.role}</p>
                  </div>
                ))}
              </div>

              <div className="mt-12 md:mt-16 text-center">
                <button
                  onClick={() => setIsTeachersModalOpen(false)}
                  className="bg-primary text-white px-10 py-4 rounded-2xl font-black text-xs hover:bg-slate-800 transition-all shadow-xl shadow-primary/20"
                >
                  KEMBALI KE BERANDA
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Video Modal */}
      <AnimatePresence>
        {expandedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm p-4 md:p-10 flex items-center justify-center"
            onClick={() => setExpandedVideo(null)}
          >
            <button
              onClick={() => setExpandedVideo(null)}
              className="absolute top-5 right-5 md:top-8 md:right-8 p-3 bg-white/10 rounded-full hover:bg-white/20 text-white transition-all z-10"
              aria-label="Tutup video"
            >
              <X size={24} />
            </button>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${expandedVideo.id}?autoplay=1&rel=0`}
                title={expandedVideo.title}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PPDBForm isOpen={isPPDBOpen} onClose={() => setIsPPDBOpen(false)} />
      <TeacherLoginModal isOpen={isTeacherLoginOpen} onClose={() => setIsTeacherLoginOpen(false)} />

      <a href="https://wa.me/6283125755134" target="_blank" className="fixed bottom-8 right-8 z-[60] bg-green-500 text-white p-5 rounded-[2rem] shadow-3xl hover:bg-green-600 transition-all hover:scale-110 group flex items-center gap-3">
        <MessageCircle size={28} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-700 font-black whitespace-nowrap text-xs">KONSULTASI PPDB</span>
      </a>
      {/* Gallery Full List Modal */}
      <AnimatePresence>
        {isGalleryModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-white/40 backdrop-blur-2xl p-5 md:p-8 flex items-center justify-center"
            onClick={() => setIsGalleryModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white w-full max-w-7xl rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-12 relative shadow-3xl max-h-[90vh] overflow-y-auto hide-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsGalleryModalOpen(false)}
                className="absolute top-6 right-6 md:top-10 md:right-10 p-3 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 hover:text-primary transition-all z-10 shadow-sm"
              >
                <X size={24} />
              </button>

              <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
                {(sheetData?.Gallery || []).map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group"
                  >
                    <div className="aspect-square rounded-[2rem] overflow-hidden mb-3 relative shadow-md">
                      <OptimizedImage
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                        <span className="text-[10px] font-black text-white bg-secondary px-3 py-1 rounded-full uppercase tracking-widest">{item.category}</span>
                      </div>
                    </div>
                    <h4 className="font-black text-primary text-sm px-2 line-clamp-1">{item.title}</h4>
                  </motion.div>
                ))}
              </div>

              <div className="mt-12 text-center">
                <button
                  onClick={() => setIsGalleryModalOpen(false)}
                  className="bg-primary text-white px-10 py-4 rounded-2xl font-black text-xs hover:bg-slate-800 transition-all shadow-xl shadow-primary/20"
                >
                  TUTUP GALERI
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
