import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Clock, MapPin, ShieldCheck, Save, Loader2,
  Navigation, CheckCircle2, AlertTriangle, Info, RefreshCw,
  ExternalLink, Search, Check, Sparkles, Map, Move, CheckSquare
} from 'lucide-react';
import { getAttendanceSettings, updateAttendanceSettings } from '../../services/gsheet';
import { ToastNotification } from './ModalKit';

// Loader Leaflet On-Demand (Tanpa Tambahan Berat Bundle Utama)
function loadLeafletLib() {
  return new Promise((resolve) => {
    if (window.L) return resolve(window.L);

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      document.body.appendChild(script);
    } else {
      const checkTimer = setInterval(() => {
        if (window.L) {
          clearInterval(checkTimer);
          resolve(window.L);
        }
      }, 50);
    }
  });
}

// Komponen Peta Interaktif Geser Pin Marker
function InteractivePinPicker({ lat, lng, radius, onApplyCoords }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentPin, setCurrentPin] = useState({ lat, lng });

  // Inisialisasi Peta
  useEffect(() => {
    let isCancelled = false;

    loadLeafletLib().then((L) => {
      if (isCancelled || !mapContainerRef.current) return;

      // Hancurkan map sebelumnya jika ada
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 18,
        scrollWheelZoom: true,
      });
      mapInstanceRef.current = map;

      // Tile Layer OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Icon Marker Kustom Warna Merah Tegas
      const customIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      // Pin Marker Draggable
      const marker = L.marker([lat, lng], { draggable: true, icon: customIcon }).addTo(map);
      markerRef.current = marker;
      marker.bindPopup('<b>Titik Sekolah</b><br>Tahan & geser pin ini untuk memindahkan lokasi.').openPopup();

      // Lingkaran Radius
      const circle = L.circle([lat, lng], {
        radius: Number(radius) || 100,
        color: '#059669',
        fillColor: '#10b981',
        fillOpacity: 0.18,
        weight: 2,
      }).addTo(map);
      circleRef.current = circle;

      // Event Geser Pin (Dragend)
      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        circle.setLatLng(pos);
        setCurrentPin({ lat: pos.lat, lng: pos.lng });
      });

      // Event Klik di sembarang titik peta
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        setCurrentPin({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      setMapLoaded(true);
      setTimeout(() => map.invalidateSize(), 200);
    });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update posisi saat lat / lng / radius berubah dari luar
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !markerRef.current || !circleRef.current) return;
    const L = window.L;
    if (!L) return;

    markerRef.current.setLatLng([lat, lng]);
    circleRef.current.setLatLng([lat, lng]);
    circleRef.current.setRadius(Number(radius) || 100);
    mapInstanceRef.current.setView([lat, lng], 18);
    setCurrentPin({ lat, lng });
  }, [lat, lng, radius, mapLoaded]);

  const isChanged =
    Number(currentPin.lat.toFixed(6)) !== Number(lat.toFixed(6)) ||
    Number(currentPin.lng.toFixed(6)) !== Number(lng.toFixed(6));

  const handleApply = () => {
    onApplyCoords(Number(currentPin.lat.toFixed(6)), Number(currentPin.lng.toFixed(6)));
  };

  return (
    <div className="space-y-3">
      {/* Wadah Peta */}
      <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-md relative bg-slate-100 z-0">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        {!mapLoaded && (
          <div className="absolute inset-0 bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-bold gap-2">
            <RefreshCw className="animate-spin text-secondary" size={18} />
            <span>Memuat peta interaktif…</span>
          </div>
        )}
      </div>

      {/* Control Bar: Koordinat Hasil Geser & Tombol Konfirmasi OK */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Posisi Pin Merah Saat Ini:
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs font-black text-slate-800">
              {currentPin.lat.toFixed(6)}, {currentPin.lng.toFixed(6)}
            </span>
            {isChanged && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 animate-pulse">
                Titik Berubah (Belum Di-OK)
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1">
            👉 <i>Geser pin merah di peta atau ketuk lokasi gerbang sekolah yang benar.</i>
          </p>
        </div>

        <button
          type="button"
          onClick={handleApply}
          className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md ${
            isChanged
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-600/40 scale-105'
              : 'bg-slate-900 hover:bg-black text-white'
          }`}
        >
          <Check size={15} />
          <span>Gunakan Titik Ini (OK)</span>
        </button>
      </div>
    </div>
  );
}

export default function TeacherAttendanceSettings() {
  const [settings, setSettings] = useState({
    work_start_time: '07:15',
    late_threshold_time: '07:30',
    work_end_time: '15:00',
    school_latitude: 3.662972,
    school_longitude: 98.719222,
    max_distance_meters: 100,
    is_geofence_enabled: 1,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success', title: '' });
  const showToast = (message, type = 'success', title = '') => {
    setToast({ show: true, message, type, title });
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getAttendanceSettings();
      if (res.success && res.settings) {
        setSettings({
          ...res.settings,
          is_geofence_enabled: Number(res.settings.is_geofence_enabled) ? 1 : 0,
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  // Handler Konfirmasi Titik Baru dari Peta Interaktif (Langsung Auto-Save ke DB)
  const handleApplyCoordsFromMap = async (newLat, newLng) => {
    const updatedSettings = {
      ...settings,
      school_latitude: newLat,
      school_longitude: newLng,
    };
    setSettings(updatedSettings);

    // Langsung simpan permanen ke database agar tidak perlu klik simpan lagi di bawah
    const res = await updateAttendanceSettings(updatedSettings);
    if (res.success) {
      showToast(
        `Titik koordinat (${newLat}, ${newLng}) berhasil diterapkan dan langsung tersimpan permanen ke database!`,
        'success',
        'Titik Disimpan Permanen'
      );
    } else {
      showToast(
        `Titik dipasang di form: ${newLat}, ${newLng}. Silakan klik tombol "Simpan Pengaturan Presensi" di bawah.`,
        'warning',
        'Titik Dipasang'
      );
    }
  };

  // Ambil Koordinat Saat Ini (GPS Perangkat)
  const handleCaptureCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      showToast('Perangkat tidak mendukung pendeteksi lokasi GPS.', 'error');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setSettings((prev) => ({
          ...prev,
          school_latitude: lat,
          school_longitude: lng,
        }));
        setGpsLoading(false);
        showToast(`Koordinat GPS Anda: ${lat}, ${lng}`, 'success', 'GPS Berhasil Terdeteksi');
      },
      (err) => {
        setGpsLoading(false);
        showToast('Gagal mendeteksi lokasi GPS: ' + err.message, 'error', 'GPS Error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateAttendanceSettings(settings);
    setSaving(false);

    if (res.success) {
      showToast('Pengaturan presensi berhasil disimpan.', 'success', 'Berhasil Disimpan');
    } else {
      showToast(res.error || 'Gagal menyimpan pengaturan.', 'error', 'Error');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
        <RefreshCw className="animate-spin text-secondary" size={24} />
        <span>Memuat pengaturan presensi…</span>
      </div>
    );
  }

  // URL Google Maps untuk verifikasi
  const googleMapsUrl = `https://www.google.com/maps?q=${settings.school_latitude},${settings.school_longitude}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <ToastNotification
            toast={toast}
            onClose={() => setToast({ show: false, message: '', type: 'success', title: '' })}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-secondary/10 text-secondary">
          <Settings size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Pengaturan Presensi Guru</h2>
          <p className="text-slate-400 font-bold text-xs mt-0.5">
            Konfigurasi Jam Kerja, Geser Pin Peta Interaktif & Radius Sekolah
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Jam Kerja & Toleransi */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center gap-2 font-black text-slate-800 text-sm">
            <Clock size={18} className="text-secondary" />
            <span>Jadwal Jam Kerja & Toleransi</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Jam Masuk Standar:
              </label>
              <input
                type="time"
                required
                value={settings.work_start_time}
                onChange={(e) => setSettings({ ...settings, work_start_time: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-black text-sm rounded-2xl px-4 py-3 focus:outline-none focus:border-secondary transition-all"
              />
              <span className="text-[10px] text-slate-400 font-bold mt-1 block">Waktu hadir resmi</span>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Batas Toleransi:
              </label>
              <input
                type="time"
                required
                value={settings.late_threshold_time}
                onChange={(e) => setSettings({ ...settings, late_threshold_time: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-rose-600 font-black text-sm rounded-2xl px-4 py-3 focus:outline-none focus:border-secondary transition-all"
              />
              <span className="text-[10px] text-rose-500 font-bold mt-1 block">Lewat jam ini = Telat</span>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Jam Pulang:
              </label>
              <input
                type="time"
                required
                value={settings.work_end_time}
                onChange={(e) => setSettings({ ...settings, work_end_time: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-black text-sm rounded-2xl px-4 py-3 focus:outline-none focus:border-secondary transition-all"
              />
              <span className="text-[10px] text-slate-400 font-bold mt-1 block">Waktu absen pulang</span>
            </div>
          </div>
        </div>

        {/* Card 2: Geofencing GPS, Peta Geser Pin & Integrasi Maps */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-slate-800 text-sm">
              <MapPin size={18} className="text-secondary" />
              <span>Titik Koordinat & Radius Sekolah</span>
            </div>

            {/* Toggle Geofencing */}
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-600">Validasi Jarak:</span>
              <input
                type="checkbox"
                checked={settings.is_geofence_enabled === 1}
                onChange={(e) => setSettings({ ...settings, is_geofence_enabled: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 text-secondary rounded focus:ring-secondary cursor-pointer"
              />
              <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                settings.is_geofence_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {settings.is_geofence_enabled ? 'Aktif' : 'Nonaktif'}
              </span>
            </label>
          </div>

          {/* PETA INTERAKTIF GESER PIN SECARA MANUAL */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Move size={15} className="text-secondary" />
                <span>Peta Interaktif (Geser Pin Manual & Tekan OK):</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Lingkaran hijau = Radius {settings.max_distance_meters}m
              </span>
            </div>

            <InteractivePinPicker
              lat={settings.school_latitude}
              lng={settings.school_longitude}
              radius={settings.max_distance_meters}
              onApplyCoords={handleApplyCoordsFromMap}
            />
          </div>

          {/* Form Angka Koordinat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Latitude Titik Sekolah:
              </label>
              <input
                type="number"
                step="any"
                required
                value={settings.school_latitude}
                onChange={(e) => setSettings({ ...settings, school_latitude: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold text-xs rounded-2xl px-4 py-3 focus:outline-none focus:border-secondary transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Longitude Titik Sekolah:
              </label>
              <input
                type="number"
                step="any"
                required
                value={settings.school_longitude}
                onChange={(e) => setSettings({ ...settings, school_longitude: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold text-xs rounded-2xl px-4 py-3 focus:outline-none focus:border-secondary transition-all"
              />
            </div>
          </div>

          {/* Action Row: Ambil GPS Saat Ini & Cek di Maps */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCaptureCurrentLocation}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-secondary/30 bg-secondary/5 text-secondary font-bold text-xs hover:bg-secondary/10 transition-all disabled:opacity-50"
            >
              <Navigation size={13} className={gpsLoading ? 'animate-spin' : ''} />
              <span>{gpsLoading ? 'Mendeteksi Posisi…' : '📍 Ambil Koordinat Saya Sekarang'}</span>
            </button>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all shadow-sm"
            >
              <Map size={13} className="text-secondary" />
              <span>Lihat Titik di Google Maps</span>
              <ExternalLink size={11} className="text-slate-400" />
            </a>
          </div>

          {/* Radius Maksimal */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Batas Radius Maksimal Presensi (Meter):
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="10"
                max="5000"
                required
                value={settings.max_distance_meters}
                onChange={(e) => setSettings({ ...settings, max_distance_meters: parseInt(e.target.value, 10) || 100 })}
                className="w-32 bg-slate-50 border border-slate-200 text-slate-800 font-black text-sm rounded-2xl px-4 py-3 focus:outline-none focus:border-secondary transition-all text-center"
              />
              <span className="text-xs font-black text-slate-600">Meter dari titik koordinat</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 mt-1">
              Rekomendasi: <b>100 meter</b> (mencakup seluruh area gedung sekolah, halaman, & area parkir).
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Menyimpan Pengaturan…</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Simpan Pengaturan Presensi</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
