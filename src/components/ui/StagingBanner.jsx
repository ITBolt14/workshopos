// src/components/ui/StagingBanner.jsx
// Visible banner shown on staging and development environments only.
// Never shown on production (VITE_ENV=production).
// Uses relative positioning so it pushes content down instead of
// overlapping the trial banner or any other page content.

export default function StagingBanner() {
  const env = import.meta.env.VITE_ENV || import.meta.env.MODE

  if (env === 'production') return null

  const label = env === 'staging' ? 'STAGING' : 'DEV'
  const bg    = env === 'staging' ? 'bg-amber-500' : 'bg-purple-600'

  return (
    <div className={`relative w-full z-50 ${bg} print:hidden
                     text-white text-xs font-bold text-center py-1
                     tracking-widest shadow-md flex-shrink-0`}>
      ⚠️ {label} ENVIRONMENT — Not for client use
    </div>
  )
}
