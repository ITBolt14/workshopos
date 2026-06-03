// src/hooks/useBranch.js
// Convenience hook for accessing branch data from AuthContext.
// Components that only need branch data use this instead of the full useAuth.

import { useAuth } from './useAuth'

export function useBranch() {
  const { branch, loading } = useAuth()
  return { branch, loading }
}
