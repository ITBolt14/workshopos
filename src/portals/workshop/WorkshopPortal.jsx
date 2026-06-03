// src/portals/workshop/WorkshopPortal.jsx
// Workshop portal root — completely independent of Supabase auth.
// All auth is PIN-based, stored in localStorage only.
// No supabase.auth calls anywhere in this portal.

import { Routes, Route, Navigate } from 'react-router-dom'
import WorkshopLogin  from './pages/WorkshopLogin'
import WorkshopHome   from './pages/WorkshopHome'
import JobClocking    from './pages/JobClocking'
import WorkshopScan   from './pages/WorkshopScan'
import JobView        from './pages/JobView'

// SECTION: sessionStorage helpers
// CRITICAL: Uses sessionStorage, NOT localStorage.
// localStorage changes fire 'storage' events that Supabase auth listens to
// across tabs, causing the management portal session to reset.
// sessionStorage is tab-isolated — no cross-tab events fire.
const WORKSHOP_USER_KEY = 'workshop_user'

export function getWorkshopUser() {
  try {
    const raw = sessionStorage.getItem(WORKSHOP_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setWorkshopUser(user) {
  if (user) {
    sessionStorage.setItem(WORKSHOP_USER_KEY, JSON.stringify(user))
  } else {
    sessionStorage.removeItem(WORKSHOP_USER_KEY)
  }
}

export function clearWorkshopUser() {
  sessionStorage.removeItem(WORKSHOP_USER_KEY)
}

// SECTION: WorkshopGuard
// Checks localStorage only — never calls supabase.auth
function WorkshopGuard({ children }) {
  const user = getWorkshopUser()
  if (!user) return <Navigate to="/workshop/login" replace />
  return children
}

// SECTION: WorkshopPortal router
export default function WorkshopPortal() {
  return (
    <Routes>
      <Route path="login" element={<WorkshopLogin />} />
      <Route path="scan/:qrToken" element={<WorkshopScan />} />
      <Route path="view/:jobId"   element={
        <WorkshopGuard><JobView /></WorkshopGuard>
      } />
      <Route path="home"  element={
        <WorkshopGuard><WorkshopHome /></WorkshopGuard>
      } />
      <Route path="job/:jobId" element={
        <WorkshopGuard><JobClocking /></WorkshopGuard>
      } />
      {/* Default: redirect to login */}
      <Route path="*" element={<Navigate to="/workshop/login" replace />} />
    </Routes>
  )
}
