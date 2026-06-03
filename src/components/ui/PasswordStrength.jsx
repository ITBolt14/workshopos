// src/components/ui/PasswordStrength.jsx
// Live password policy validator — shows strength bar + per-rule feedback.
// Used on Register and UpdatePassword.

import { CheckCircle2, Circle } from 'lucide-react'

// SECTION: Password rules definition
export const PASSWORD_RULES = [
  { id: 'length',    label: 'At least 8 characters',        test: (p) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A–Z)',    test: (p) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter (a–z)',    test: (p) => /[a-z]/.test(p) },
  { id: 'number',    label: 'One number (0–9)',              test: (p) => /[0-9]/.test(p) },
  { id: 'special',   label: 'One special character (!@#$…)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

// Helper: returns how many rules pass for a given password string
export function getPasswordScore(password) {
  return PASSWORD_RULES.filter(r => r.test(password)).length
}

// Helper: returns true only if ALL rules pass
export function isPasswordValid(password) {
  return PASSWORD_RULES.every(r => r.test(password))
}

// SECTION: Strength bar colours
const STRENGTH_CONFIG = [
  { label: '',          barClass: 'bg-gray-200' },
  { label: 'Very weak', barClass: 'bg-red-500'  },
  { label: 'Weak',      barClass: 'bg-orange-400' },
  { label: 'Fair',      barClass: 'bg-yellow-400' },
  { label: 'Good',      barClass: 'bg-blue-500'  },
  { label: 'Strong',    barClass: 'bg-green-500' },
]

export default function PasswordStrength({ password }) {
  if (!password) return null

  const score  = getPasswordScore(password)
  const config = STRENGTH_CONFIG[score]

  return (
    <div className="mt-3 space-y-3 animate-fade-in">

      {/* SECTION: Strength bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Password strength</span>
          <span className={`text-xs font-semibold ${
            score <= 1 ? 'text-red-500' :
            score <= 2 ? 'text-orange-500' :
            score <= 3 ? 'text-yellow-600' :
            score === 4 ? 'text-blue-600' : 'text-green-600'
          }`}>
            {config.label}
          </span>
        </div>
        <div className="flex gap-1">
          {PASSWORD_RULES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < score ? config.barClass : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* SECTION: Per-rule checklist */}
      <div className="space-y-1.5">
        {PASSWORD_RULES.map(rule => {
          const passed = rule.test(password)
          return (
            <div key={rule.id} className="flex items-center gap-2">
              {passed
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                : <Circle       className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              }
              <span className={`text-xs ${passed ? 'text-green-700' : 'text-gray-400'}`}>
                {rule.label}
              </span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
