// src/main.jsx
// React entry point.
// Sentry is initialised BEFORE rendering so all errors are captured from startup.
// StrictMode is intentionally omitted — Supabase auth listeners fire twice in
// StrictMode (React 18 dev) causing double-fetch issues in AuthContext.

import { createRoot }  from 'react-dom/client'
import App             from './App'
import './index.css'
import { initSentry }  from './lib/sentry'

initSentry()

createRoot(document.getElementById('root')).render(<App />)
