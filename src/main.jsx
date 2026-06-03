// src/main.jsx
// React entry point.
// StrictMode is intentionally omitted — Supabase auth listeners
// fire twice in StrictMode (React 18 dev) which causes double-fetch
// issues in AuthContext. Removed per project spec.

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(<App />)
