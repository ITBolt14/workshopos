// src/hooks/useAuth.js
// Separate file — do NOT merge into AuthContext.jsx.
// Importing AuthContext directly in the same file causes HMR issues.

import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
