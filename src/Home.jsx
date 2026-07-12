import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Mail, Instagram, Facebook, Youtube, Menu, X, ArrowRight, MessageCircle, Calendar, Users, Award, Lock, GraduationCap, BookOpen, MapPin, CheckCircle2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PPDBForm from './components/PPDBForm'
import TeacherLoginModal from './components/TeacherLoginModal'
import { fetchSchoolData, formatSheetDate } from './services/gsheet'

// Link that also accepts framer-motion props (for the animated mobile menu)
const MotionLink = motion(Link)

// Mock Data
const navigation = [
  { name: 'Twibbon', href: '/twibbon' },
  { name: 'Profil', href: '#profil' },
  { name: 'Akademik', href: '#akademik' },
  { name: 'Karya Siswa', href: '#galeri' },
]

// Angka kepercayaan di hero — konten statis, tidak perlu dari sheet
const heroStats = [
  { value: '2019', label: 'Tahun Berdiri' },
  { value: '100%', label: 'Gratis Biaya' },
  { value: '3 Juz', label: 'Target Tahfidz SD' },
  { value: '2', label: 'Jenjang TK & SD' },
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
    <div className={`relative overflow-hidden bg-primary/5 ${!isLoaded && !hasError ? 'animate-pulse' : ''} ${className}`}>
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

// Eyebrow + judul seragam untuk tiap section — dipakai berulang di bawah
const SectionHeading = ({ eyebrow, title, subtitle, center = false, light = false }) => (
  <div className={`${center ? 'text-center mx-auto items-center' : 'items-start'} max-w-2xl mb-10 md:mb-16 flex flex-col`}>
    {eyebrow && (
      <span className={`inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.25em] mb-5 ${light ? 'text-secondary-light' : 'text-secondary'}`}>
        <span className="w-8 h-px bg-current opacity-70" /> {eyebrow} <span className={`w-8 h-px bg-current opacity-70 ${center ? '' : 'hidden'}`} />
      </span>
    )}
    <h2 className={`font-display font-semibold text-4xl md:text-5xl leading-[1.08] tracking-tight ${light ? 'text-ivory' : 'text-primary'}`}>{title}</h2>
    {subtitle && <p className={`mt-5 text-base md:text-lg leading-relaxed ${light ? 'text-ivory/70' : 'text-primary/70'}`}>{subtitle}</p>}
  </div>
);

// Ornamen pemisah emas tipis — motif berulang antar-section terang
const SectionDivider = () => (
  <div aria-hidden="true" className="flex items-center justify-center gap-4 max-w-[14rem] mx-auto text-secondary/40 mb-12 md:mb-16">
    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-current" />
    <span className="w-2 h-2 rotate-45 border border-current" />
    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-current" />
  </div>
);

// Kartu warta — dipakai di grid home & modal "semua warta"
const NewsCard = ({ item }) => {
  const Wrapper = item.id ? Link : 'div';
  return (
    <Wrapper {...(item.id ? { to: `/berita/${item.id}`, state: { item } } : {})} className="group flex flex-col h-full bg-white rounded-2xl border border-primary/10 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="w-full aspect-video bg-primary/5 overflow-hidden">
        <OptimizedImage
          src={item.image_url || "/avatars/hero.webp"}
          className="w-full h-full group-hover:scale-105 transition-transform duration-700"
          alt={item.title ? `${item.title} — Sekolah Islam Imam Syafi'i Percut` : "Warta Sekolah Islam Imam Syafi'i Percut"}
        />
      </div>
      <div className="flex flex-col flex-grow p-6">
        <div className="flex items-center gap-2 text-[10px] font-bold text-secondary mb-3 uppercase tracking-[0.15em]">
          <Calendar size={12} /> {formatSheetDate(item.date)}
        </div>
        <h3 className="font-display text-xl font-semibold text-primary group-hover:text-secondary transition-colors mb-2 leading-snug line-clamp-2">{item.title}</h3>
        <p className="text-primary/60 text-sm leading-relaxed line-clamp-2 mb-4">{item.summary}</p>
        {item.id && (
          <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase tracking-[0.15em] group-hover:gap-2.5 transition-all">
            Baca Selengkapnya <ArrowRight size={14} />
          </span>
        )}
      </div>
    </Wrapper>
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
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
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
    if (favicon) favicon.href = '/favicon.ico';

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
          const hero = '/avatars/hero.webp';

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

  // Scroll to Warta section when returning from a news detail page (/#berita)
  useEffect(() => {
    if (window.location.hash === '#berita') {
      document.getElementById('berita')?.scrollIntoView();
    }
  }, [sheetData])

  return (
    <div className="min-h-screen flex flex-col bg-ivory text-ink antialiased">
      {/* Top Bar */}
      <div className="bg-forest text-ivory/60 py-2.5 px-6 hidden md:block relative z-[60]">
        <div className="container mx-auto flex justify-between items-center text-[11px] font-medium tracking-[0.08em]">
          <div className="flex items-center gap-8">
            <a href="tel:+6283125755134" className="flex items-center gap-2 hover:text-secondary-light transition-all">
              <Phone size={11} />
              <span>+62 831-2575-5134</span>
            </a>
            <a href="mailto:admin@sekolahislamimamsyafii.web.id" className="flex items-center gap-2 hover:text-secondary-light transition-all">
              <Mail size={11} />
              <span>admin@sekolahislamimamsyafii.web.id</span>
            </a>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={11} />
            <span>Percut Sei Tuan, Sumatera Utara</span>
          </div>
        </div>
      </div>

      {/* Running Text */}
      <div className="bg-secondary-light text-forest py-2.5 text-xs font-bold">
        <div className="running-text-container">
          <div className="running-text flex items-center gap-4 tracking-wide">
            <span className="inline-block w-1.5 h-1.5 bg-forest rounded-full" />
            INFO PPDB: {sheetData?.Announcements?.find(a => a.active === 'Yes')?.text || 'PENDAFTARAN SISWA BARU (SD & TK) TAHUN AJARAN 2026/2027 TELAH DIBUKA! GRATIS BIAYA PENDIDIKAN.'}
            <span className="inline-block w-1.5 h-1.5 bg-forest rounded-full" />
          </div>
        </div>
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 transition-all duration-500 ${scrolled ? 'py-2' : 'py-5'}`}>
        <div className="container mx-auto px-4">
          <div className={`flex justify-between items-center px-4 md:px-6 transition-all ${scrolled ? 'bg-ivory/90 backdrop-blur-md py-3 rounded-2xl shadow-lg border border-primary/10' : ''}`}>
            <a href="#beranda" className="flex items-center gap-3">
              <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center text-ivory overflow-hidden shrink-0 border border-secondary/30">
                <OptimizedImage
                  src="/avatars/logo.png"
                  alt="Logo Sekolah Islam Imam Syafi'i Percut"
                  className="w-full h-full"
                  priority={true}
                />
              </div>
              <div className="leading-tight">
                <p className="font-display text-lg font-semibold tracking-tight text-primary">Imam Syafi'i Percut</p>
                <p className="text-[8px] text-primary/50 uppercase tracking-[0.25em] font-bold">TK Qur'an & SD Islam</p>
              </div>
            </a>

            <nav className="hidden md:flex items-center gap-6 lg:gap-9">
              {navigation.map((item) => {
                const cls = "text-[12px] font-semibold text-primary/60 hover:text-secondary transition-all relative group uppercase tracking-[0.15em]"
                const inner = <>{item.name}<span className="absolute -bottom-1 left-0 w-0 h-px bg-secondary transition-all group-hover:w-full" /></>
                return item.href.startsWith('/')
                  ? <Link key={item.name} to={item.href} className={cls}>{inner}</Link>
                  : <a key={item.name} href={item.href} className={cls}>{inner}</a>
              })}
              <button
                onClick={() => setIsTeacherLoginOpen(true)}
                className="text-[11px] font-semibold text-primary/40 hover:text-primary transition-all flex items-center gap-1.5"
              >
                <Lock size={13} /> AKSES GURU
              </button>
              <button onClick={() => setIsPPDBOpen(true)} className="bg-primary hover:bg-forest text-ivory px-6 py-3 rounded-xl text-[11px] font-bold shadow-lg shadow-primary/20 transition-all uppercase tracking-[0.15em]">
                Daftar PPDB
              </button>
            </nav>

            <button className="md:hidden p-3 text-primary" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Buka menu">
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
            className="fixed inset-0 z-[100] bg-ivory flex flex-col"
          >
            <div className="flex justify-between items-center p-8 border-b border-primary/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-ivory text-xs overflow-hidden border border-secondary/30">
                  <OptimizedImage
                    src="/avatars/logo.png"
                    alt="Logo Sekolah Islam Imam Syafi'i Percut"
                    className="w-full h-full"
                  />
                </div>
                <span className="font-bold text-xs tracking-[0.2em] text-primary uppercase">Menu Utama</span>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary active:scale-90 transition-transform"
                aria-label="Tutup menu"
              >
                <X size={24} />
              </button>
            </div>

            <nav className="flex-grow flex flex-col justify-center px-10 gap-2">
              {navigation.map((item, i) => {
                const isRoute = item.href.startsWith('/')
                const El = isRoute ? MotionLink : motion.a
                const linkProps = isRoute ? { to: item.href } : { href: item.href }
                return (
                  <El
                    key={item.name}
                    {...linkProps}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + (i * 0.05) }}
                    className="group flex items-center justify-between py-4 border-b border-primary/10 last:border-0"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="font-display text-2xl font-semibold text-primary group-hover:text-secondary transition-colors flex items-center gap-4">
                      {item.name === 'Twibbon' && <Sparkles size={18} className="text-secondary/50" />}
                      {item.name === 'Profil' && <Users size={18} className="text-secondary/50" />}
                      {item.name === 'Akademik' && <GraduationCap size={18} className="text-secondary/50" />}
                      {item.name === 'Karya Siswa' && <BookOpen size={18} className="text-secondary/50" />}
                      {item.name}
                    </span>
                    <ArrowRight size={18} className="text-primary/20 group-hover:text-secondary transition-all" />
                  </El>
                )
              })}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 flex flex-col gap-4"
              >
                <button
                  onClick={() => { setIsPPDBOpen(true); setIsMenuOpen(false); }}
                  className="w-full bg-primary text-ivory py-5 rounded-2xl font-bold text-base shadow-2xl shadow-primary/20 flex items-center justify-center gap-3"
                >
                  DAFTAR PPDB <ArrowRight size={20} />
                </button>
                <button
                  onClick={() => { setIsTeacherLoginOpen(true); setIsMenuOpen(false); }}
                  className="w-full bg-primary/5 text-primary/60 py-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-3 border border-primary/10"
                >
                  <Lock size={16} /> AKSES ADMINISTRASI GURU
                </button>
              </motion.div>
            </nav>

            <div className="p-12 border-t border-primary/10">
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em] mb-4">Hubungi Kami</p>
              <div className="flex gap-6 text-primary/50">
                <Instagram size={20} />
                <Facebook size={20} />
                <Youtube size={20} />
                <Mail size={20} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow">
        {/* Hero Section */}
        <section id="beranda" className="pt-8 pb-16 md:pt-20 md:pb-28 relative overflow-hidden">
          {/* Soft background accents */}
          <div className="absolute inset-0 pointer-events-none -z-10">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute top-40 -right-24 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
          </div>
          <div className="container mx-auto px-5 md:px-6 grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-primary text-[10px] font-bold rounded-full mb-7 uppercase tracking-[0.2em] border border-secondary/30 leading-none shadow-sm">
                <Sparkles size={12} className="text-secondary" /> Penerimaan Murid Baru 2027/2028
              </div>
              <h1 className="font-display font-semibold text-5xl md:text-7xl text-primary leading-[1.02] mb-6 tracking-tight">
                <span className="block font-sans text-sm md:text-base font-bold text-secondary uppercase tracking-[0.25em] mb-5">Sekolah Islam Imam Syafi'i Percut</span>
                Cerdas, Religius <br className="hidden md:block" />& <span className="italic text-secondary">Berkarakter</span>
              </h1>
              <p className="text-base md:text-lg text-primary/70 mb-9 max-w-lg leading-relaxed">
                Pendidikan formal berbasis Al-Qur'an dan As-Sunnah sesuai manhaj As-Salafush Sholih — membina generasi Rabbani sejak dini.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-12">
                <button onClick={() => setIsPPDBOpen(true)} className="w-full sm:w-auto bg-primary text-ivory px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-forest transition-all shadow-xl shadow-primary/20 active:scale-95 tracking-wide">
                  Daftar Sekarang <ArrowRight size={18} />
                </button>
                <div className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-secondary/5 text-primary rounded-xl font-bold text-sm border border-secondary/30 whitespace-nowrap">
                  <CheckCircle2 size={16} className="text-secondary" /> Gratis Biaya Pendidikan
                </div>
              </div>

              {/* Trust stats */}
              <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-lg border-t border-secondary/30 pt-7">
                {heroStats.map((s) => (
                  <div key={s.label}>
                    <div className="font-display text-2xl md:text-4xl font-semibold text-primary leading-none">{s.value}</div>
                    <div className="text-[8px] md:text-[10px] font-bold text-secondary uppercase tracking-[0.15em] mt-2 leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="relative">
              <div className="relative z-10 p-2.5 bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-secondary/30">
                <OptimizedImage
                  src="/avatars/hero.webp"
                  className="w-full aspect-[4/5] rounded-[1.6rem]"
                  alt="Suasana belajar santri di Sekolah Islam Imam Syafi'i Percut"
                  priority={true}
                />
              </div>
              <div className="absolute -top-3 -right-3 md:-top-5 md:-right-5 bg-white p-3 md:p-4 rounded-2xl z-20 shadow-xl border border-secondary/30">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-9 h-9 md:w-10 md:h-10 bg-secondary-light text-forest rounded-xl flex items-center justify-center shadow-sm">
                    <Award size={18} />
                  </div>
                  <div className="font-display text-sm md:text-base font-semibold text-primary leading-none">Terakreditasi</div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 md:-bottom-5 md:-left-5 bg-white p-3 md:p-5 rounded-2xl z-20 shadow-xl border border-secondary/30">
                <div className="font-display text-lg md:text-2xl font-semibold text-primary leading-none">Tahfidz</div>
                <div className="text-[7px] md:text-[9px] font-bold text-secondary uppercase tracking-[0.15em] mt-1.5">Target 3 Juz (SD)</div>
              </div>
            </div>
          </div>
        </section>

        {/* Keunggulan Section */}
        <section className="py-16 md:py-24 bg-white border-y border-primary/10">
          <div className="container mx-auto px-5 md:px-6">
            <SectionDivider />
            <SectionHeading eyebrow="Kenapa Kami" title="Keunggulan Sekolah" center />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
              {flyerContent.advantages.map((text, i) => (
                <div key={i} className="p-8 bg-ivory rounded-2xl border border-primary/10 hover:border-secondary/40 hover:-translate-y-1 transition-all">
                  <div className="w-14 h-14 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center mb-6 text-2xl">
                    {i === 0 ? "💰" : i === 1 ? "📖" : "🎓"}
                  </div>
                  <h3 className="font-display text-xl font-semibold text-primary leading-snug">{text}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Profil Section */}
        <section id="profil" className="py-16 md:py-24 bg-ivory">
          <div className="container mx-auto px-5 md:px-6">
            <SectionDivider />
            <div className="flex flex-col gap-12 md:gap-16">
              {/* 1. Sejarah & Tujuan Kami (Centered) */}
              <SectionHeading eyebrow="Tentang Sekolah" title="Sejarah & Tujuan Kami" subtitle={flyerContent.history} center />

              {/* 2. Visi & Misi (Grid Layout) */}
              <div className="grid lg:grid-cols-2 gap-5 md:gap-6">
                <div className="bg-white p-8 md:p-10 rounded-2xl border-l-4 border-secondary shadow-sm">
                  <h3 className="font-display text-2xl font-semibold text-primary mb-5 flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-secondary-light text-lg font-display font-semibold">V</div>
                    Visi Sekolah
                  </h3>
                  <p className="font-display text-lg md:text-xl text-primary/80 leading-relaxed italic">"{flyerContent.vision}"</p>
                </div>

                <div className="bg-white p-8 md:p-10 rounded-2xl border-l-4 border-primary shadow-sm">
                  <h3 className="font-display text-2xl font-semibold text-primary mb-5 flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary-light rounded-xl flex items-center justify-center text-forest text-lg font-display font-semibold">M</div>
                    Misi Kami
                  </h3>
                  <ul className="space-y-3">
                    {flyerContent.mission.map((m, i) => (
                      <li key={i} className="flex gap-3">
                        <CheckCircle2 size={16} className="text-secondary mt-0.5 shrink-0" />
                        <span className="text-primary/70 text-sm">{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 3. Tujuan Pendidikan (Card) */}
              <div className="max-w-4xl mx-auto p-10 md:p-14 bg-forest text-ivory rounded-3xl shadow-2xl relative overflow-hidden group text-center">
                <div className="absolute top-0 right-0 w-40 h-40 bg-secondary-light/10 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-secondary-light mb-6 flex items-center justify-center gap-3">
                  <div className="w-10 h-px bg-secondary-light/60" />
                  Tujuan Pendidikan
                  <div className="w-10 h-px bg-secondary-light/60" />
                </h3>
                <p className="font-display text-xl md:text-2xl text-ivory/90 leading-relaxed italic mx-auto max-w-2xl">{flyerContent.goal}</p>
              </div>

              {/* 4. Satuan Pendidikan (Logos) */}
              <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto w-full">
                <div className="p-8 bg-white rounded-2xl border border-primary/10 flex flex-col items-center text-center">
                  <div className="text-4xl md:text-5xl mb-3">🏫</div>
                  <div className="font-display text-lg md:text-xl font-semibold text-primary mb-1">TK Qur'an</div>
                  <div className="text-[9px] md:text-[10px] text-secondary font-bold uppercase tracking-[0.15em]">Usia 5 Tahun</div>
                </div>
                <div className="p-8 bg-white rounded-2xl border border-primary/10 flex flex-col items-center text-center">
                  <div className="text-4xl md:text-5xl mb-3">📚</div>
                  <div className="font-display text-lg md:text-xl font-semibold text-primary mb-1">SD Islam</div>
                  <div className="text-[9px] md:text-[10px] text-secondary font-bold uppercase tracking-[0.15em]">Usia 6 Tahun</div>
                </div>
              </div>

              {/* 5. Syarat Pendaftaran */}
              <div className="p-8 md:p-12 bg-white border border-secondary/30 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.06] hidden md:block text-primary">
                  <Award size={80} className="rotate-12" />
                </div>
                <h3 className="text-sm md:text-base font-bold text-secondary uppercase tracking-[0.2em] mb-8">Syarat Pendaftaran</h3>
                <ul className="grid md:grid-cols-2 gap-y-4 gap-x-12">
                  {flyerContent.registration.map((item, i) => (
                    <li key={i} className="flex items-center gap-4 text-sm font-medium text-primary/80">
                      <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary shrink-0 font-display font-semibold">
                        {i + 1}
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 6. Galeri (Ekspresi Hari Ini) */}
              <div id="galeri" className="pt-6 md:pt-8">
                <SectionHeading
                  eyebrow="Ekspresi Hari Ini"
                  title={<>Melihat kreativitas kami di <span className="italic text-secondary">galeri siswa</span></>}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[180px] md:auto-rows-[350px]">
                  {(sheetData?.Gallery || [
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                    { title: 'Pemuatan...', category: 'Galeri', image_url: '' },
                  ]).slice(0, 5).map((item, i) => (
                    <motion.div key={i} className={`rounded-2xl overflow-hidden relative group border border-primary/10 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
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
                        alt={`${item.title || 'Kegiatan'} — galeri Sekolah Islam Imam Syafi'i Percut`}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest/95 to-transparent p-4 md:p-8 opacity-0 group-hover:opacity-100 transition-all">
                        <div className="text-ivory">
                          <div className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-secondary-light mb-1">{item.category}</div>
                          <div className="font-display text-sm md:text-xl font-semibold leading-tight">{item.title}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* See All Gallery Button */}
                {(sheetData?.Gallery?.length > 5) && (
                  <div className="mt-10 text-center">
                    <button
                      onClick={() => setIsGalleryModalOpen(true)}
                      className="group inline-flex items-center gap-3 bg-primary hover:bg-forest text-ivory px-8 py-3.5 rounded-xl font-bold text-[11px] md:text-sm uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
                    >
                      Eksplorasi Galeri <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Video Sekolah — section forest sebagai jeda visual gelap */}
        <section className="py-16 md:py-24 bg-forest text-ivory relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-secondary-light rounded-full blur-[140px]" />
          </div>
          <div className="container mx-auto px-5 md:px-6 relative z-10">
            <SectionHeading eyebrow="Galeri Video" title="Momen di Sekolah Kami" center light />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
              {VIDEOS.map((video, i) => (
                <div key={i} className="group">
                  <button
                    onClick={() => setExpandedVideo(video)}
                    className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-xl bg-ink border border-secondary-light/20"
                    aria-label={`Putar video ${video.title}`}
                  >
                    <OptimizedImage
                      src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-forest/20 group-hover:bg-forest/30 transition-colors">
                      <span className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                        <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 md:w-7 md:h-7 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                    </span>
                  </button>
                  <h3 className="font-display mt-4 text-center text-base md:text-lg font-semibold text-ivory leading-tight">{video.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Akademik Section (Teachers) */}
        <section id="akademik" className="py-16 md:py-24 bg-ivory">
          <div className="container mx-auto px-5 md:px-6">
            <SectionDivider />
            <SectionHeading eyebrow="Tim Pengajar" title={<>Mengenal <span className="italic text-secondary">Pengajar</span> Kami</>} center />
            <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-6 md:gap-10">
              {(sheetData?.Teachers || [
                { name: 'Memuat Guru...', role: 'Staf Pengajar', gender: 'ikhwan', photo_url: '' },
                { name: 'Memuat Guru...', role: 'Staf Pengajar', gender: 'ikhwan', photo_url: '' },
                { name: 'Memuat Guru...', role: 'Staf Pengajar', gender: 'ikhwan', photo_url: '' },
              ]).slice(0, 4).map((staff, i) => (
                <div key={i} className="text-center group">
                  <div className="w-full aspect-[3/4] md:w-64 rounded-2xl overflow-hidden mb-4 shadow-lg relative border border-secondary/20 bg-white">
                    <OptimizedImage
                      src={staff.photo_url || (
                        (staff.gender || staff.Gender || staff.GENDER || '').toString().toLowerCase().includes('akhwat')
                          ? '/avatars/akhwat.webp'
                          : '/avatars/ikhwan.webp'
                      )}
                      className={`w-full h-full transition-all duration-500 group-hover:scale-105 ${staff.photo_url ? 'grayscale group-hover:grayscale-0' : 'p-6 md:p-10 opacity-70'}`}
                      alt={`${staff.name}${staff.role ? ', ' + staff.role : ''} — pengajar Sekolah Islam Imam Syafi'i Percut`}
                    />
                  </div>
                  <h3 className="font-display text-base md:text-xl font-semibold text-primary leading-tight">{staff.name}</h3>
                  <p className="text-[10px] md:text-xs font-bold text-secondary uppercase tracking-[0.15em] mt-1.5">{staff.role}</p>
                </div>
              ))}
            </div>

            {(sheetData?.Teachers?.length > 4 || (!sheetData?.Teachers && 3 > 4)) && (
              <div className="mt-12 text-center">
                <button
                  onClick={() => setIsTeachersModalOpen(true)}
                  className="text-primary font-bold hover:text-secondary transition-all inline-flex items-center gap-2 mx-auto border-b border-secondary/40 pb-1 uppercase tracking-[0.15em] text-xs"
                >
                  Lihat Selengkapnya <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Fasilitas & Legalitas Section (Dark) */}
        <section className="py-20 md:py-32 bg-forest text-ivory relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-1/4 left-10 w-96 h-96 bg-secondary-light rounded-full blur-[120px] md:blur-[150px]" />
            <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-primary-light rounded-full blur-[120px] md:blur-[150px]" />
          </div>
          <div className="container mx-auto px-5 md:px-6 relative z-10">
            <SectionHeading eyebrow="Sarana & Prasarana" title="Fasilitas Sekolah" subtitle="Mendukung kenyamanan belajar di lingkungan bermanhaj salaf." center light />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-16 md:mb-28">
              {flyerContent.facilities.map((f, i) => (
                <div key={i} className="text-center p-8 md:p-10 bg-ivory/5 border border-ivory/10 rounded-2xl backdrop-blur-md hover:border-secondary-light/40 transition-colors">
                  <div className="text-3xl md:text-5xl mb-4 md:mb-6">{f.icon}</div>
                  <div className="font-display text-base md:text-lg font-semibold">{f.name}</div>
                </div>
              ))}
            </div>

            {/* Legalitas Card */}
            <div className="p-8 md:p-12 lg:p-20 bg-ivory rounded-3xl text-primary shadow-3xl">
              <div className="text-center mb-12 md:mb-16">
                <h3 className="font-display text-3xl font-semibold mb-3">Legalitas & Identitas</h3>
                <p className="text-secondary font-bold uppercase tracking-[0.2em] text-[9px] md:text-xs">Informasi Resmi Yayasan & Satuan Pendidikan</p>
              </div>
              <div className="grid lg:grid-cols-2 gap-8 md:gap-16">
                <div>
                  <div className="text-xs md:text-sm font-bold text-secondary uppercase tracking-[0.15em] mb-4">Identitas Yayasan</div>
                  <div className="p-6 bg-white rounded-2xl border border-primary/10">
                    <div className="font-display text-lg md:text-xl font-semibold mb-2">{flyerContent.foundation}</div>
                    <div className="text-xs md:text-sm font-medium text-primary/60 italic">No. AHU: {flyerContent.legal.foundationAHU}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <div className="text-[10px] md:text-xs font-bold text-secondary uppercase tracking-[0.15em] mb-4">TK Qur'an</div>
                    <div className="space-y-4">
                      <div><span className="text-[9px] md:text-[10px] font-bold text-primary/40 uppercase tracking-wide">NPSN</span><br /><span className="font-display font-semibold text-base md:text-lg">{flyerContent.legal.tk.npsn}</span></div>
                      <div><span className="text-[9px] md:text-[10px] font-bold text-primary/40 uppercase tracking-wide">Izin Ops</span><br /><span className="text-[10px] md:text-xs font-medium truncate block">{flyerContent.legal.tk.permit}</span></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] md:text-xs font-bold text-secondary uppercase tracking-[0.15em] mb-4">SD Islam</div>
                    <div className="space-y-4">
                      <div><span className="text-[9px] md:text-[10px] font-bold text-primary/40 uppercase tracking-wide">NPSN</span><br /><span className="font-display font-semibold text-base md:text-lg">{flyerContent.legal.sd.npsn}</span></div>
                      <div><span className="text-[9px] md:text-[10px] font-bold text-primary/40 uppercase tracking-wide">Izin Ops</span><br /><span className="text-[10px] md:text-xs font-medium truncate block">{flyerContent.legal.sd.permit}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Warta Terbaru Section */}
        <section id="berita" className="py-16 md:py-24 bg-ivory">
          <div className="container mx-auto px-5 md:px-6">
            <SectionDivider />
            <SectionHeading eyebrow="Kabar Terkini" title="Warta Terbaru" center />
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {(sheetData?.News?.length ? sheetData.News : [
                { title: 'Penerimaan Siswa Baru TA 2026/2027', date: '20 April 2024', summary: 'Segera daftarkan putra-putri Anda untuk jenjang TK & SD.' },
                { title: 'Program Tahfidz', date: '15 April 2024', summary: 'Mewujudkan generasi penghafal Al-Qur\'an sejak dini.' },
                { title: 'Fasilitas Kelas Nyaman', date: '10 April 2024', summary: 'Dukungan fasilitas belajar terbaik untuk Ananda.' },
              ]).slice(0, 3).map((item, i) => (
                <NewsCard key={i} item={item} />
              ))}
            </div>

            {/* See All News Button — hanya jika warta lebih dari 3 */}
            {(sheetData?.News?.length > 3) && (
              <div className="mt-10 text-center">
                <button
                  onClick={() => setIsNewsModalOpen(true)}
                  className="group inline-flex items-center gap-3 bg-primary hover:bg-forest text-ivory px-8 py-3.5 rounded-xl font-bold text-[11px] md:text-sm uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
                >
                  Eksplorasi Warta <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-forest text-ivory/50 py-16 md:py-24 px-5 md:px-6 border-t border-secondary-light/20">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-4 gap-10 md:gap-16 mb-16 md:mb-20">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-ivory/5 rounded-2xl flex items-center justify-center text-ivory overflow-hidden border border-secondary-light/30">
                  <OptimizedImage
                    src="/avatars/logo.png"
                    alt="Logo Sekolah Islam Imam Syafi'i Percut"
                    className="w-full h-full"
                  />
                </div>
                <div>
                  <p className="font-display text-2xl font-semibold text-ivory leading-tight">Imam Syafi'i Percut</p>
                  <p className="text-[8px] md:text-[10px] tracking-[0.25em] uppercase font-bold text-secondary-light">Sekolah Islam & Penghafal Qur'an</p>
                </div>
              </div>
              <p className="max-w-md font-display text-lg leading-relaxed text-ivory/60 italic">"{flyerContent.goal}"</p>
            </div>
            <div>
              <h4 className="text-ivory font-bold uppercase text-xs tracking-[0.2em] mb-8">Menu Utama</h4>
              <ul className="space-y-4 text-sm font-medium">
                <li><a href="#beranda" className="hover:text-secondary-light transition-colors">Beranda</a></li>
                <li><a href="#profil" className="hover:text-secondary-light transition-colors">Profil Sekolah</a></li>
                <li><a href="#akademik" className="hover:text-secondary-light transition-colors">Akademik</a></li>
                <li><a href="#galeri" className="hover:text-secondary-light transition-colors">Galeri Siswa</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-ivory font-bold uppercase text-xs tracking-[0.2em] mb-8">Kontak Kami</h4>
              <div className="text-sm font-medium leading-relaxed space-y-4">
                <p>
                  <span className="text-secondary-light block text-[10px] uppercase font-bold tracking-[0.15em] mb-1">Alamat</span>
                  Jl. Lembaga Dusun II Desa Tanjung Rejo<br />
                  Kec. Percut Sei Tuan, 20371
                </p>
                <p>
                  <span className="text-secondary-light block text-[10px] uppercase font-bold tracking-[0.15em] mb-1">WhatsApp</span>
                  0831-2575-5134
                </p>
                <div className="space-y-2">
                  <span className="text-secondary-light block text-[10px] uppercase font-bold tracking-[0.15em] mb-1">Email Resmi</span>
                  admin@sekolahislamimamsyafii.web.id
                </div>
              </div>
            </div>
          </div>
          <div className="pt-12 border-t border-ivory/10 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-bold uppercase tracking-[0.15em] text-ivory/40">
            <p>&copy; 2024 {flyerContent.foundation}. Al-Qur'an & As-Sunnah.</p>
            <div className="flex justify-between items-center w-full md:w-auto md:gap-10">
              <a href="#" className="hover:text-secondary-light transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-secondary-light transition-colors whitespace-nowrap">Digital Branding Imam Syafi'i</a>
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
            className="fixed inset-0 z-[110] bg-forest/40 backdrop-blur-2xl p-5 md:p-10 flex items-center justify-center overflow-y-auto"
            onClick={() => setIsTeachersModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-ivory w-full max-w-5xl rounded-3xl md:rounded-[3rem] p-6 md:p-16 relative shadow-3xl max-h-[90vh] overflow-y-auto hide-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsTeachersModalOpen(false)}
                className="absolute top-6 right-6 md:top-10 md:right-10 p-3 bg-primary/5 rounded-full hover:bg-primary/10 text-primary/50 hover:text-primary transition-all z-10"
              >
                <X size={24} />
              </button>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 mt-8 md:mt-4">
                {(sheetData?.Teachers || []).map((staff, i) => (
                  <div key={i} className="text-center">
                    <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden mb-4 shadow-lg border border-secondary/20 bg-white">
                      <OptimizedImage
                        src={staff.photo_url || (
                          (staff.gender || staff.Gender || staff.GENDER || '').toString().toLowerCase().includes('akhwat')
                            ? '/avatars/akhwat.webp'
                            : '/avatars/ikhwan.webp'
                        )}
                        className={`w-full h-full ${staff.photo_url ? '' : 'p-6 md:p-10 opacity-70'}`}
                        alt={`${staff.name}${staff.role ? ', ' + staff.role : ''} — pengajar Sekolah Islam Imam Syafi'i Percut`}
                      />
                    </div>
                    <h3 className="font-display text-sm md:text-lg font-semibold text-primary leading-tight">{staff.name}</h3>
                    <p className="text-[9px] md:text-xs font-bold text-secondary uppercase tracking-[0.15em] mt-1">{staff.role}</p>
                  </div>
                ))}
              </div>

              <div className="mt-12 md:mt-16 text-center">
                <button
                  onClick={() => setIsTeachersModalOpen(false)}
                  className="bg-primary text-ivory px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-[0.15em] hover:bg-forest transition-all shadow-xl shadow-primary/20"
                >
                  Kembali ke Beranda
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
            className="fixed inset-0 z-[120] bg-forest/95 backdrop-blur-sm p-4 md:p-10 flex items-center justify-center"
            onClick={() => setExpandedVideo(null)}
          >
            <button
              onClick={() => setExpandedVideo(null)}
              className="absolute top-5 right-5 md:top-8 md:right-8 p-3 bg-ivory/10 rounded-full hover:bg-ivory/20 text-ivory transition-all z-10"
              aria-label="Tutup video"
            >
              <X size={24} />
            </button>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden shadow-2xl bg-forest"
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

      {/* WhatsApp float — desktop only; di mobile digabung ke sticky bar bawah. Hijau dipertahankan sebagai brand signal WA */}
      <a href="https://wa.me/6283125755134" target="_blank" className="hidden md:flex fixed bottom-8 right-8 z-[60] bg-green-600 text-white p-5 rounded-2xl shadow-3xl hover:bg-green-700 transition-all hover:scale-110 group items-center gap-3">
        <MessageCircle size={28} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-700 font-bold whitespace-nowrap text-xs uppercase tracking-[0.15em]">Konsultasi PPDB</span>
      </a>

      {/* Sticky CTA — mobile only */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-[60] p-3 bg-ivory/95 backdrop-blur-lg border-t border-primary/10 flex gap-3">
        <button onClick={() => setIsPPDBOpen(true)} className="flex-1 bg-primary text-ivory py-3.5 rounded-xl font-bold text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-transform">
          Daftar PPDB <ArrowRight size={16} />
        </button>
        <a href="https://wa.me/6283125755134" target="_blank" aria-label="Konsultasi via WhatsApp" className="w-14 bg-green-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform">
          <MessageCircle size={24} />
        </a>
      </div>
      {/* Spacer agar konten tidak tertutup sticky bar di mobile */}
      <div className="h-20 md:hidden" />

      {/* Gallery Full List Modal */}
      <AnimatePresence>
        {isGalleryModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-forest/40 backdrop-blur-2xl p-5 md:p-8 flex items-center justify-center"
            onClick={() => setIsGalleryModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-ivory w-full max-w-7xl rounded-3xl md:rounded-[3rem] p-6 md:p-12 relative shadow-3xl max-h-[90vh] overflow-y-auto hide-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsGalleryModalOpen(false)}
                className="absolute top-6 right-6 md:top-10 md:right-10 p-3 bg-primary/5 rounded-full hover:bg-primary/10 text-primary/50 hover:text-primary transition-all z-10 shadow-sm"
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
                    <div className="aspect-square rounded-2xl overflow-hidden mb-3 relative shadow-md border border-primary/10">
                      <OptimizedImage
                        src={item.image_url}
                        alt={`${item.title || 'Kegiatan'} — galeri Sekolah Islam Imam Syafi'i Percut`}
                        className="w-full h-full group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-forest/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                        <span className="text-[10px] font-bold text-forest bg-secondary-light px-3 py-1 rounded-full uppercase tracking-[0.15em]">{item.category}</span>
                      </div>
                    </div>
                    <h4 className="font-display font-semibold text-primary text-sm px-2 line-clamp-1">{item.title}</h4>
                  </motion.div>
                ))}
              </div>

              <div className="mt-12 text-center">
                <button
                  onClick={() => setIsGalleryModalOpen(false)}
                  className="bg-primary text-ivory px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-[0.15em] hover:bg-forest transition-all shadow-xl shadow-primary/20"
                >
                  Tutup Galeri
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* News Full List Modal */}
      <AnimatePresence>
        {isNewsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-forest/40 backdrop-blur-2xl p-5 md:p-8 flex items-center justify-center"
            onClick={() => setIsNewsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-ivory w-full max-w-7xl rounded-3xl md:rounded-[3rem] p-6 md:p-12 relative shadow-3xl max-h-[90vh] overflow-y-auto hide-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsNewsModalOpen(false)}
                className="absolute top-6 right-6 md:top-10 md:right-10 p-3 bg-primary/5 rounded-full hover:bg-primary/10 text-primary/50 hover:text-primary transition-all z-10 shadow-sm"
              >
                <X size={24} />
              </button>

              <h3 className="font-display mt-2 mb-10 text-3xl font-semibold text-primary text-center">Semua Warta</h3>

              <div className="grid md:grid-cols-3 gap-8 md:gap-10 mb-12">
                {(sheetData?.News || []).map((item, i) => (
                  <NewsCard key={i} item={item} />
                ))}
              </div>

              <div className="mt-12 text-center">
                <button
                  onClick={() => setIsNewsModalOpen(false)}
                  className="bg-primary text-ivory px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-[0.15em] hover:bg-forest transition-all shadow-xl shadow-primary/20"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
