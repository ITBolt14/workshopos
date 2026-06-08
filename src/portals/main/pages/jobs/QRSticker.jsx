// src/portals/main/pages/jobs/QRSticker.jsx
// Print-optimised QR sticker. Opens in new tab.
//
// AUTH STRATEGY FOR NEW TAB:
// This page opens in a new tab where AuthContext is also mounted.
// AuthContext handles INITIAL_SESSION/SIGNED_IN and loads the session
// into Supabase's in-memory state. By the time this component mounts
// and runs its useEffect, the session is already in memory.
// We therefore use getSession() directly — it reliably returns the
// session once AuthContext has processed the auth event.
// We poll briefly to handle the rare case where this component mounts
// before AuthContext has finished processing.

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'

export default function QRSticker() {
  const { id } = useParams()
  const [job,     setJob]     = useState(null)
  const [vehicle, setVehicle] = useState(null)
  const [branch,  setBranch]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Poll getSession() — by the time this component mounts,
      // AuthContext has already processed the auth event and loaded
      // the session into memory. getSession() is reliable here
      // (unlike on raw page load where memory is empty).
      // We poll up to 10 times × 500ms = 5 seconds max.
      let session = null
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase.auth.getSession()
        if (data?.session) { session = data.session; break }
        await new Promise(r => setTimeout(r, 500))
        if (cancelled) return
      }

      if (!session) {
        window.location.href = '/login'
        return
      }

      if (cancelled) return
      await fetchStickerData()
    }

    async function fetchStickerData() {
      const { data: jobData, error: jobErr } = await supabase
        .from('jobs')
        .select('id, job_number, qr_token, check_in_date, branch_id, vehicle_id')
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return

      if (jobErr || !jobData) {
        setError('Job not found or access denied')
        setLoading(false)
        return
      }

      setJob(jobData)

      const [vehicleRes, branchRes] = await Promise.all([
        supabase.from('vehicles')
          .select('registration, make, model, owner_name')
          .eq('id', jobData.vehicle_id).maybeSingle(),
        supabase.from('branches')
          .select('name')
          .eq('id', jobData.branch_id).maybeSingle(),
      ])

      if (cancelled) return

      setVehicle(vehicleRes.data)
      setBranch(branchRes.data)
      setLoading(false)
    }

    init()
    return () => { cancelled = true }
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent
                        rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading sticker…</p>
      </div>
    </div>
  )

  if (error || !job) return (
    <div className="p-8 text-center text-red-500">
      {error || 'Job not found'}
    </div>
  )

  const qrValue = `${window.location.origin}/workshop/scan/${job.qr_token}`

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #sticker-card, #sticker-card * { visibility: visible !important; }
          #sticker-card {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            margin: 0 !important; padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">

        <div className="flex gap-3 mb-6 print:hidden">
          <button onClick={() => window.print()}
            className="btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Sticker
          </button>
          <button onClick={() => window.close()} className="btn-secondary">
            Close
          </button>
        </div>

        <div id="sticker-card" className="bg-white rounded-2xl overflow-hidden shadow-xl w-80">
          <div className="bg-blue-600 px-5 py-3">
            <p className="text-white font-bold text-center text-sm tracking-wide">
              {branch?.name || 'Workshop'}
            </p>
          </div>
          <div className="p-5 text-center">
            <p className="font-mono text-3xl font-bold text-blue-600 leading-none mb-1">
              {job.job_number}
            </p>
            <p className="text-gray-500 text-sm mb-3">
              {vehicle?.make} {vehicle?.model}
            </p>
            <div className="bg-gray-900 rounded-xl px-4 py-3 mb-4">
              <p className="font-mono text-white text-3xl font-black tracking-widest">
                {vehicle?.registration}
              </p>
            </div>
            {vehicle?.owner_name && (
              <p className="text-gray-500 text-sm mb-4">{vehicle.owner_name}</p>
            )}
            <div className="flex justify-center mb-3">
              <QRCodeSVG value={qrValue} size={160} level="M" includeMargin={true} />
            </div>
            <p className="font-mono text-xs text-gray-400 leading-tight">
              {job.job_number} · {vehicle?.registration}
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Checked in:{' '}
              {job.check_in_date
                ? new Date(job.check_in_date).toLocaleDateString('en-ZA', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        </div>

      </div>
    </>
  )
}