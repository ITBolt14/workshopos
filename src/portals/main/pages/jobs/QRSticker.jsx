// src/portals/main/pages/jobs/QRSticker.jsx
// Print-optimised QR sticker. Opens in new tab.
// On print: only the sticker card is visible, everything else is hidden.

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

  useEffect(() => {
    async function fetchData() {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, job_number, qr_token, check_in_date, branch_id, vehicle_id')
        .eq('id', id)
        .single()

      if (!jobData) { setLoading(false); return }
      setJob(jobData)

      const [vehicleRes, branchRes] = await Promise.all([
        supabase.from('vehicles').select('registration, make, model, owner_name').eq('id', jobData.vehicle_id).single(),
        supabase.from('branches').select('name').eq('id', jobData.branch_id).single(),
      ])

      setVehicle(vehicleRes.data)
      setBranch(branchRes.data)
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading sticker…</div>
  if (!job)    return <div className="p-8 text-center text-red-500">Job not found</div>

  // QR URL uses the scan route — WorkshopScan handles the job lookup by token.
  // Branch is now identified by workshop code at login, not in the URL.
  const qrValue = `${window.location.origin}/workshop/scan/${job.qr_token}`

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #sticker-card, #sticker-card * { visibility: visible !important; }
          #sticker-card {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">

        {/* Print / Close buttons */}
        <div className="flex gap-3 mb-6 print:hidden">
          <button onClick={() => window.print()}
            className="btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Sticker
          </button>
          <button onClick={() => window.close()} className="btn-secondary">
            Close
          </button>
        </div>

        {/* SECTION: Sticker card — this is all that prints */}
        <div id="sticker-card" className="bg-white rounded-2xl overflow-hidden shadow-xl w-80">

          {/* Workshop name header */}
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
