import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home'; // eager: landing page harus tampil instan
import TeacherLoginGate from './components/TeacherLoginGate';

// Lazy: berita & seluruh panel guru dipecah agar tidak membebani home publik.
// TeacherSoal menarik jspdf/jspdf-autotable (~ratusan KB) — wajib on-demand.
const NewsDetail = lazy(() => import('./NewsDetail'));
const Twibbon = lazy(() => import('./Twibbon'));
const ParentPortal = lazy(() => import('./ParentPortal'));
const TeacherLayout = lazy(() => import('./components/teacher/TeacherLayout'));
const TeacherHome = lazy(() => import('./components/teacher/TeacherHome'));
const TeacherSoal = lazy(() => import('./components/teacher/TeacherSoal'));
const TeacherGrades = lazy(() => import('./components/teacher/TeacherGrades'));
const AdminSection = lazy(() => import('./components/teacher/AdminSection'));
const TeacherStudents = lazy(() => import('./components/teacher/TeacherStudents'));
const TeacherSubjects = lazy(() => import('./components/teacher/TeacherSubjects'));
const TeacherEraport = lazy(() => import('./components/teacher/TeacherEraport'));
const TeacherSettings = lazy(() => import('./components/teacher/TeacherSettings'));
const TeacherUsers = lazy(() => import('./components/teacher/TeacherUsers'));
const TeacherAttendance = lazy(() => import('./components/teacher/TeacherAttendance'));
const TeacherAttendanceMembers = lazy(() => import('./components/teacher/TeacherAttendanceMembers'));
const TeacherAttendanceRecap = lazy(() => import('./components/teacher/TeacherAttendanceRecap'));
const TeacherAttendanceSettings = lazy(() => import('./components/teacher/TeacherAttendanceSettings'));
const TeacherStudentAttendance = lazy(() => import('./components/teacher/TeacherStudentAttendance'));
const TeacherStudentAttendanceRecap = lazy(() => import('./components/teacher/TeacherStudentAttendanceRecap'));

// Route Protection dengan Direct Login Gate & Sesi Persisten
const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return (
      localStorage.getItem('isTeacherAuthenticated') === 'true' ||
      sessionStorage.getItem('isTeacherAuthenticated') === 'true'
    );
  });

  if (!isAuthenticated) {
    return <TeacherLoginGate onSuccess={() => setIsAuthenticated(true)} />;
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
          <Route path="/portal-ortu" element={<ParentPortal />} />
          <Route path="/portal-wali" element={<Navigate to="/portal-ortu" replace />} />
          <Route path="/cek-nilai" element={<Navigate to="/portal-ortu" replace />} />

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
            path="/dashboard-guru/nilai"
            element={
              <ProtectedRoute>
                <TeacherLayout>
                  <TeacherGrades />
                </TeacherLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard-guru/galeri"
            element={<ProtectedRoute><TeacherLayout><AdminSection section="gallery" /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/pengajar"
            element={<ProtectedRoute><TeacherLayout><AdminSection section="teachers" /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/warta"
            element={<ProtectedRoute><TeacherLayout><AdminSection section="news" /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/video"
            element={<ProtectedRoute><TeacherLayout><AdminSection section="videos" /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/siswa"
            element={<ProtectedRoute><TeacherLayout><TeacherStudents /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/presensi-siswa"
            element={<ProtectedRoute><TeacherLayout><TeacherStudentAttendance /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/presensi-siswa/rekap"
            element={<ProtectedRoute><TeacherLayout><TeacherStudentAttendanceRecap /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/mapel"
            element={<ProtectedRoute><TeacherLayout><TeacherSubjects /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/eraport"
            element={<ProtectedRoute><TeacherLayout><TeacherEraport /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/absensi"
            element={<ProtectedRoute><TeacherLayout><TeacherAttendance /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/absensi-guru"
            element={<ProtectedRoute><TeacherLayout><TeacherAttendanceMembers /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/absensi-rekap"
            element={<ProtectedRoute><TeacherLayout><TeacherAttendanceRecap /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/absensi-settings"
            element={<ProtectedRoute><TeacherLayout><TeacherAttendanceSettings /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/settings"
            element={<ProtectedRoute><TeacherLayout><TeacherSettings /></TeacherLayout></ProtectedRoute>}
          />
          <Route
            path="/dashboard-guru/users"
            element={<ProtectedRoute><TeacherLayout><TeacherUsers /></TeacherLayout></ProtectedRoute>}
          />

          {/* Fallback to Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
