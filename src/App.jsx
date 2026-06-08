// src/App.jsx
// Root application component.
// CRITICAL: AuthProvider is outside Routes so it mounts ONCE and never remounts.
// Remounting AuthProvider on every navigation resets loading/profile/branch to null
// which causes the dashboard and all data fetches to hang.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster }        from 'react-hot-toast'
import * as Sentry        from '@sentry/react'
import { AuthProvider }   from './context/AuthContext'
import StagingBanner      from './components/ui/StagingBanner'

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

// SECTION: Error boundary fallback
// Shown when a crash occurs — Sentry captures it automatically.
// In dev mode the actual error message is shown to help with debugging.
function ErrorFallback({ error }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center
                    bg-gray-50 p-8 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center
                      justify-center mb-4">
        <span className="text-red-500 text-2xl font-bold">!</span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">
        Something went wrong
      </h1>
      <p className="text-gray-500 text-sm mb-4 max-w-sm">
        An unexpected error occurred. The team has been notified automatically.
        Please refresh the page to continue.
      </p>
      {import.meta.env.DEV && error?.message && (
        <p className="text-red-400 text-xs font-mono bg-red-50 px-3 py-2
                      rounded-lg mb-4 max-w-sm break-all">
          {error.message}
        </p>
      )}
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm
                   font-medium hover:bg-blue-700 transition-colors"
      >
        Refresh Page
      </button>
    </div>
  )
}

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog={false}>
      <StagingBanner />
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

            {/* QR STICKER — standalone, no shell, opens in new tab */}
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
    </Sentry.ErrorBoundary>
  )
}