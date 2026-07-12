import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home'; // eager: landing page harus tampil instan

// Lazy: berita & seluruh panel guru dipecah agar tidak membebani home publik.
// TeacherSoal menarik jspdf/jspdf-autotable (~ratusan KB) — wajib on-demand.
const NewsDetail = lazy(() => import('./NewsDetail'));
const Twibbon = lazy(() => import('./Twibbon'));
const TeacherLayout = lazy(() => import('./components/teacher/TeacherLayout'));
const TeacherHome = lazy(() => import('./components/teacher/TeacherHome'));
const TeacherSoal = lazy(() => import('./components/teacher/TeacherSoal'));

// Simple Route Protection
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = sessionStorage.getItem('isTeacherAuthenticated') === 'true';
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Fallback ringan saat chunk lazy dimuat
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-ivory">
    <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/berita/:id" element={<NewsDetail />} />
          <Route path="/twibbon" element={<Twibbon />} />

          {/* Guru Panel with Layout */}
          <Route
            path="/dashboard-guru"
            element={
              <ProtectedRoute>
                <TeacherLayout>
                  <TeacherHome />
                </TeacherLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-guru/soal"
            element={
              <ProtectedRoute>
                <TeacherLayout>
                  <TeacherSoal />
                </TeacherLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-guru/settings"
            element={
              <ProtectedRoute>
                <TeacherLayout>
                  <div className="p-10 text-center">
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Pengaturan</h2>
                    <p className="text-slate-400">Modul ini sedang dalam tahap pengembangan.</p>
                  </div>
                </TeacherLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallback to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
