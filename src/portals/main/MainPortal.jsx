// src/portals/main/MainPortal.jsx
// Root of the management portal. App shell: sidebar + topbar + page content.

import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainSidebar   from './components/MainSidebar'
import MainTopBar    from './components/MainTopBar'
import Dashboard     from './pages/Dashboard'
import JobList       from './pages/jobs/JobList'
import CheckInWizard from './pages/jobs/checkin/CheckInWizard'
import JobDetail     from './pages/jobs/detail/JobDetail'
import FloorMonitor  from './pages/monitor/FloorMonitor'
import Users         from './pages/admin/Users'
import StageTemplates from './pages/admin/StageTemplates'
import Settings       from './pages/admin/Settings'
import QRSticker     from './pages/jobs/QRSticker'

// SECTION: App shell
function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <MainSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MainTopBar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}

// SECTION: Routes
export default function MainPortal() {
  return (
    <Routes>
      {/* Sticker outside AppShell — no sidebar/topbar so print works cleanly */}
      <Route path="jobs/:id/sticker" element={<QRSticker />} />

      {/* All other routes inside AppShell */}
      <Route path="*" element={
        <AppShell>
          <Routes>
            <Route index                 element={<Dashboard />} />
            <Route path="jobs"           element={<JobList />} />
            <Route path="jobs/new"       element={<CheckInWizard />} />
            <Route path="jobs/:id"       element={<JobDetail />} />
            <Route path="monitor"        element={<FloorMonitor />} />
            <Route path="admin/users"    element={<Users />} />
            <Route path="admin/stages"   element={<StageTemplates />} />
            <Route path="admin/settings" element={<Settings />} />
            <Route path="*"              element={<Navigate to="/main" replace />} />
          </Routes>
        </AppShell>
      } />
    </Routes>
  )
}
