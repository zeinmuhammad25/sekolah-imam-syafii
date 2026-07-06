import React, { useState, useEffect } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { Calendar, ArrowLeft, Share2, MessageCircle, Link as LinkIcon, Check } from 'lucide-react'
import { fetchSchoolData, formatSheetDate } from './services/gsheet'

// Instant paint from router state (navigating from Home) or localStorage cache;
// undefined = nothing yet (show loading). Always revalidated by a fresh fetch below.
const findCached = (id, stateItem) => {
  if (stateItem) return stateItem
  try {
    const cached = JSON.parse(localStorage.getItem('mias_sheet_data') || '{}')
    return (cached.News || []).find(n => String(n.id) === String(id))
  } catch {
    return undefined
  }
}

export default function NewsDetail() {
  const { id } = useParams()
  const location = useLocation()
  const [item, setItem] = useState(() => findCached(id, location.state?.item))
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    // Stale-while-revalidate: always fetch fresh so newly-added fields (e.g. description) show.
    fetchSchoolData().then(data => {
      const found = (data?.News || []).find(n => String(n.id) === String(id))
      setItem(found || null)
    })
  }, [id])

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  // *bold* dirender oleh WhatsApp
  const waMessage = item
    ? `📢 *${item.title}*\n\n${item.summary || ''}\n\nBaca selengkapnya di website resmi Sekolah Islam Imam Syafi'i 👇`
    : ''

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${waMessage}\n${shareUrl}`)}`, '_blank')
  }
  const shareNative = () => {
    navigator.share({
      title: item.title,
      text: `${item.title}\n\n${item.summary || ''}`,
      url: shareUrl,
    }).catch(() => {})
  }
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (item === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 font-black">Memuat...</div>
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-black text-primary">Warta tidak ditemukan</h1>
        <Link to="/#berita" className="inline-flex items-center gap-2 text-secondary font-black">
          <ArrowLeft size={18} /> Kembali ke Beranda
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-5 md:px-6 py-10 md:py-16 max-w-3xl font-bold">
        <Link to="/#berita" className="inline-flex items-center gap-2 text-secondary font-black mb-8 hover:underline">
          <ArrowLeft size={18} /> Kembali ke Warta
        </Link>

        <div className="flex items-center gap-2 text-[10px] md:text-xs font-black text-secondary mb-3 uppercase tracking-widest">
          <Calendar size={14} /> {formatSheetDate(item.date)}
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-primary leading-tight mb-6">{item.title}</h1>

        {item.image_url && (
          <div className="rounded-2xl md:rounded-[2rem] overflow-hidden mb-8 bg-slate-50">
            <img src={item.image_url} alt={item.title} className="w-full h-auto object-contain" />
          </div>
        )}

        {item.summary && (
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-6 italic">{item.summary}</p>
        )}
        {item.description && (
          <div className="text-slate-700 text-base md:text-lg leading-relaxed whitespace-pre-line font-medium text-justify">
            {item.description}
          </div>
        )}

        {/* Bagikan */}
        <div className="mt-10 pt-8 border-t border-slate-100">
          <div className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Bagikan Warta Ini</div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={shareWhatsApp}
              className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:brightness-95 active:scale-95 transition-all shadow-md"
            >
              <MessageCircle size={16} /> WhatsApp
            </button>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                onClick={shareNative}
                className="inline-flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 active:scale-95 transition-all shadow-md"
              >
                <Share2 size={16} /> Bagikan Lainnya
              </button>
            )}
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 active:scale-95 transition-all"
            >
              {copied ? <><Check size={16} /> Tersalin</> : <><LinkIcon size={16} /> Salin Link</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
