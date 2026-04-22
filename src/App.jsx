import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import TeacherLayout from './components/teacher/TeacherLayout';
import TeacherHome from './components/teacher/TeacherHome';
import TeacherSoal from './components/teacher/TeacherSoal';

// Simple Route Protection
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = sessionStorage.getItem('isTeacherAuthenticated') === 'true';
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        
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
    </BrowserRouter>
  );
}
