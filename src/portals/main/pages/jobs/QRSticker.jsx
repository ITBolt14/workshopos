// src/portals/main/pages/jobs/QRSticker.jsx
// QR sticker page — inside the main portal shell, uses useAuth() like any other page.

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, ArrowLeft } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'

export default function QRSticker() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [job,     setJob]     = useState(null)
  const [vehicle, setVehicle] = useState(null)
  const [branch,  setBranch]  = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, job_number, qr_token, check_in_date, branch_id, vehicle_id')
        .eq('id', id)
        .maybeSingle()

      if (!jobData) { setLoading(false); return }
      setJob(jobData)

      const [vehicleRes, branchRes] = await Promise.all([
        supabase.from('vehicles')
          .select('registration, make, model, owner_name')
          .eq('id', jobData.vehicle_id).maybeSingle(),
        supabase.from('branches')
          .select('name')
          .eq('id', jobData.branch_id).maybeSingle(),
      ])

      setVehicle(vehicleRes.data)
      setBranch(branchRes.data)
      setLoading(false)
    }

    fetchData()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent
                        rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading sticker…</p>
      </div>
    </div>
  )

  if (!job) return (
    <div className="p-8 text-center text-red-500">Job not found</div>
  )

  const qrValue = `${window.location.origin}/workshop/scan/${job.qr_token}`

  return (
    <>
      {/* SECTION: Print styles
          When printing, hide everything on the page EXCEPT #sticker-card.
          Using a class-based approach so the portal shell (sidebar, topbar)
          is also hidden without affecting the sticker card itself. */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .print-hidden { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>

      <div className="bg-gray-100 flex flex-col items-center justify-center p-8">

        {/* SECTION: Action buttons — hidden on print */}
        <div className="flex gap-3 mb-6 print-hidden">
          <button
            onClick={() => navigate(`/main/jobs/${id}`)}
            className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Job
          </button>
          <button
            onClick={() => window.print()}
            className="btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Sticker
          </button>
        </div>

        {/* SECTION: Sticker card — only this prints */}
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
