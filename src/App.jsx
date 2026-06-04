// src/App.jsx
// Root application component.
// CRITICAL: AuthProvider is outside Routes so it mounts ONCE and never remounts.
// Remounting AuthProvider on every navigation resets loading/profile/branch to null
// which causes the dashboard and all data fetches to hang.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'

// AUTH PAGES
import Login          from './components/auth/Login'
import ResetPassword  from './components/auth/ResetPassword'
import UpdatePassword from './components/auth/UpdatePassword'

// PUBLIC PAGES
import Register     from './pages/Register'
import TrialExpired from './pages/TrialExpired'
import Unauthorized from './pages/Unauthorized'

// PROTECTED LAYOUT
import PortalLayout from './layouts/PortalLayout'

// MAIN PORTAL
import MainPortal from './portals/main/MainPortal'
import QRSticker  from './portals/main/pages/jobs/QRSticker'

// WORKSHOP PORTAL — completely independent, no Supabase auth
import WorkshopPortal from './portals/workshop/WorkshopPortal'

export default function App() {
  return (
    // CRITICAL: AuthProvider wraps the entire BrowserRouter so it never remounts.
    // Previously it was inside the /main/* route element which caused it to
    // remount on every navigation, resetting all auth state to null.
    <AuthProvider>
      <BrowserRouter>

        {/* SECTION: Global Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
              borderRadius: '10px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            },
            success: {
              iconTheme: { primary: '#2563eb', secondary: '#fff' },
            },
          }}
        />

        {/* SECTION: Routes */}
        <Routes>

          {/* ROOT REDIRECT */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* PUBLIC AUTH ROUTES */}
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/trial-expired"   element={<TrialExpired />} />
          <Route path="/unauthorized"    element={<Unauthorized />} />

          {/* QR STICKER — standalone route, no shell, no auth guard needed */}
          {/* Opens in a new tab via window.open from JobDetail */}
          <Route path="/main/jobs/:id/sticker" element={<QRSticker />} />

          {/* MANAGEMENT PORTAL — PortalLayout handles auth guards */}
          <Route
            path="/main/*"
            element={
              <PortalLayout>
                <MainPortal />
              </PortalLayout>
            }
          />

          {/* WORKSHOP PORTAL — completely independent, no Supabase auth */}
          <Route path="/workshop/*" element={<WorkshopPortal />} />

          {/* CATCH-ALL */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
