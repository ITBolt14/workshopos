// src/components/ui/PasswordInput.jsx
// Reusable password input with show/hide eye toggle.
// Used on: Login, Register, UpdatePassword, and any future auth form.

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordInput({
  label,
  id,
  value,
  onChange,
  placeholder = 'Enter password',
  disabled = false,
  autoComplete = 'current-password',
  className = '',
  error = '',
}) {
  // SECTION: Show/hide toggle state
  const [show, setShow] = useState(false)

  return (
    <div className={className}>
      {/* SECTION: Label */}
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}

      {/* SECTION: Input with eye toggle */}
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`input-field pr-11 ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          disabled={disabled}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                     hover:text-gray-600 transition-colors duration-150
                     disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* SECTION: Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
