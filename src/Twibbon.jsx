import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, Download, RefreshCw, ZoomIn } from 'lucide-react'
import { fetchSchoolData } from './services/gsheet'

// Frame native size + hole geometry (normalized 0..1 of the canvas). Holes were
// punched transparent into the PNGs by scripts/punch — photo drawn behind shows through.
const CANVAS = 1254
const FRAMES = {
  tk: { label: 'TK Qur’an', src: '/twibbon/tk.png', cx: 0.5020, cy: 0.3856, r: 0.3281 },
  sd: { label: 'SD Islam', src: '/twibbon/sd.png', cx: 0.5044, cy: 0.3860, r: 0.3305 },
}

export default function Twibbon() {
  const [jenjang, setJenjang] = useState(null) // 'tk' | 'sd'
  const [photo, setPhoto] = useState(null)      // HTMLImageElement
  const [zoom, setZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(1) // "muat semua" (contain) scale, depends on photo aspect
  const [pan, setPan] = useState({ x: 0, y: 0 }) // in canvas px
  const [preview, setPreview] = useState({ tk: '', sd: '' }) // MPLS design previews from Settings sheet
  const canvasRef = useRef(null)
  const frameImg = useRef(null)
  const drag = useRef(null)

  const cfg = jenjang ? FRAMES[jenjang] : null

  // MPLS design previews from Settings sheet: cache first (instant), then refresh from server
  useEffect(() => {
    const apply = (data) => {
      const rows = data?.Settings || []
      const get = (k) => rows.find((r) => r.key === k)?.value || ''
      setPreview({ tk: get('MPLS TK'), sd: get('MPLS SD') })
    }
    try { const c = JSON.parse(localStorage.getItem('mias_sheet_data')); if (c) apply(c) } catch { }
    fetchSchoolData().then((d) => d && apply(d)).catch(() => { })
  }, [])

  // load the frame PNG whenever jenjang changes
  useEffect(() => {
    if (!cfg) return
    const img = new Image()
    img.onload = () => { frameImg.current = img; draw() }
    img.src = cfg.src
    frameImg.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jenjang])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !cfg) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CANVAS, CANVAS)
    const cx = cfg.cx * CANVAS, cy = cfg.cy * CANVAS, r = cfg.r * CANVAS
    // white backing so "muat semua" (photo smaller than window) has a clean fill, not transparency
    ctx.fillStyle = photo ? '#ffffff' : '#e5e7eb'
    ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.fill()
    if (photo) {
      // base = cover (shortest side → diameter); zoom<1 shrinks toward "muat semua"
      const base = (2 * r) / Math.min(photo.width, photo.height)
      const eff = base * zoom
      const w = photo.width * eff, h = photo.height * eff
      ctx.drawImage(photo, cx - w / 2 + pan.x, cy - h / 2 + pan.y, w, h)
    }
    if (frameImg.current) ctx.drawImage(frameImg.current, 0, 0, CANVAS, CANVAS)
  }, [cfg, photo, zoom, pan])

  useEffect(() => { draw() }, [draw])

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    img.onload = () => {
      // start showing the WHOLE image (contain); base scale = cover, so contain = min/max side
      const cz = Math.min(img.width, img.height) / Math.max(img.width, img.height)
      setPhoto(img); setMinZoom(cz); setZoom(cz); setPan({ x: 0, y: 0 })
    }
    img.src = URL.createObjectURL(file)
  }

  // drag to reposition (pointer events cover mouse + touch)
  const toCanvas = (e) => CANVAS / canvasRef.current.getBoundingClientRect().width
  const onDown = (e) => { if (!photo) return; drag.current = { x: e.clientX, y: e.clientY, pan }; e.currentTarget.setPointerCapture(e.pointerId) }
  const onMove = (e) => {
    if (!drag.current) return
    const k = toCanvas(e)
    setPan({ x: drag.current.pan.x + (e.clientX - drag.current.x) * k, y: drag.current.pan.y + (e.clientY - drag.current.y) * k })
  }
  const onUp = () => { drag.current = null }

  const download = () => {
    canvasRef.current.toBlob((blob) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `twibbon-${jenjang}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <header className="border-b border-primary/10 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-primary/5 text-primary"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display text-xl font-black text-primary">Twibbon MPLS 2026/2027</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Step 1: pilih jenjang */}
        <section className="mb-6">
          <p className="text-sm font-semibold text-primary/70 mb-3">1. Pilih jenjang</p>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(FRAMES).map(([key, f]) => (
              <button key={key} onClick={() => { setJenjang(key); setPhoto(null) }}
                className={`rounded-xl border-2 px-4 py-3 font-bold transition ${jenjang === key ? 'border-secondary bg-secondary/10 text-primary' : 'border-primary/15 hover:border-primary/40 text-primary/80'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* MPLS design previews — shown until a jenjang is picked */}
        {!jenjang && (preview.tk || preview.sd) && (
          <section className="mb-6">
            <div className="grid grid-cols-2 gap-3">
              {[['tk', 'TK Qur’an'], ['sd', 'SD Islam']].map(([key, label]) => preview[key] && (
                <button key={key} onClick={() => { setJenjang(key); setPhoto(null) }}
                  className="rounded-xl overflow-hidden hover:opacity-90 transition">
                  <img src={preview[key]} alt={`Twibbon MPLS ${label}`} loading="lazy"
                    className="w-full h-auto block" />
                </button>
              ))}
            </div>
          </section>
        )}

        {cfg && (
          <>
            {/* Step 2: upload */}
            <section className="mb-6">
              <p className="text-sm font-semibold text-primary/70 mb-3">2. Upload foto</p>
              <label className="inline-flex items-center gap-2 rounded-xl bg-primary text-ivory px-5 py-3 font-bold cursor-pointer hover:bg-primary-light">
                <Upload className="w-5 h-5" />{photo ? 'Ganti Foto' : 'Pilih Foto'}
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
            </section>

            {/* Step 3: preview + atur */}
            <section className="mb-6">
              <p className="text-sm font-semibold text-primary/70 mb-3">3. Atur posisi &amp; ukuran</p>
              <div className="mx-auto w-full max-w-md aspect-square rounded-xl overflow-hidden shadow-3xl bg-white">
                <canvas
                  ref={canvasRef} width={CANVAS} height={CANVAS}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                  className="w-full h-full block touch-none cursor-move"
                />
              </div>

              {photo && (
                <div className="mt-4 max-w-md mx-auto space-y-3">
                  <label className="flex items-center gap-3">
                    <ZoomIn className="w-5 h-5 text-primary/60 shrink-0" />
                    <input type="range" min={minZoom} max="4" step="0.01" value={zoom}
                      onChange={(e) => setZoom(+e.target.value)} className="w-full accent-secondary" />
                  </label>
                  <div className="flex justify-center gap-2">
                    <button onClick={() => { setZoom(minZoom); setPan({ x: 0, y: 0 }) }}
                      className="text-xs font-semibold rounded-full border border-primary/20 px-3 py-1 text-primary/70 hover:bg-primary/5">Muat semua</button>
                    <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
                      className="text-xs font-semibold rounded-full border border-primary/20 px-3 py-1 text-primary/70 hover:bg-primary/5">Isi penuh</button>
                  </div>
                  <p className="text-xs text-center text-primary/50">Geser foto langsung di gambar untuk memindahkan.</p>
                </div>
              )}
            </section>

            {/* Step 4: download */}
            {photo && (
              <section className="flex flex-wrap gap-3">
                <button onClick={download} className="inline-flex items-center gap-2 rounded-xl bg-secondary text-white px-6 py-3 font-bold hover:bg-secondary-light">
                  <Download className="w-5 h-5" /> Download
                </button>
                <button onClick={() => { setPhoto(null); setZoom(1); setMinZoom(1); setPan({ x: 0, y: 0 }) }} className="inline-flex items-center gap-2 rounded-xl border-2 border-primary/15 px-6 py-3 font-bold text-primary/80 hover:border-primary/40">
                  <RefreshCw className="w-5 h-5" /> Reset
                </button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
