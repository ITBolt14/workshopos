// src/components/ui/StagingBanner.jsx
// Visible banner shown on staging and development environments only.
// Never shown on production (VITE_ENV=production).
// Prevents confusion between staging and live environments.

export default function StagingBanner() {
  const env = import.meta.env.VITE_ENV || import.meta.env.MODE

  if (env === 'production') return null

  const label = env === 'staging' ? 'STAGING' : 'DEV'
  const bg    = env === 'staging' ? 'bg-amber-500' : 'bg-purple-600'

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] ${bg}
                     text-white text-xs font-bold text-center py-1
                     tracking-widest shadow-md`}>
      ⚠️ {label} ENVIRONMENT — Not for client use
    </div>
  )
}
