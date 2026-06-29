// src/portals/main/pages/jobs/detail/TabQuote.jsx
// Handwritten digital quotation — Option C (Hybrid).
// Header pre-fills from job data. Grid is a free-draw stylus canvas.
// Canvas saves as base64 in the job_quotes table — no Storage/CORS issues.
// Future: OCR button to convert handwriting to typed official quote.

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { Save, Trash2, Download, Printer, Pencil, Eraser } from 'lucide-react'
import { supabase } from '../../../../../lib/supabase'
import { useAuth } from '../../../../../hooks/useAuth'

// SECTION: Canvas drawing hook
function useCanvas(canvasRef, tool, colour, lineWidth) {
  const drawing = useRef(false)
  const lastPos  = useRef(null)

  const getPos = useCallback((e, canvas) => {
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    }
  }, [])

  const startDraw = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    drawing.current = true
    lastPos.current = getPos(e, canvas)
  }, [canvasRef, getPos])

  const draw = useCallback((e) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.lineWidth   = lineWidth * 4
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = colour
      ctx.lineWidth   = lineWidth
    }
    ctx.lineCap  = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }, [tool, colour, lineWidth, canvasRef, getPos])

  const stopDraw = useCallback((e) => {
    e?.preventDefault()
    drawing.current = false
    lastPos.current = null
  }, [])

  return { startDraw, draw, stopDraw }
}

// SECTION: Draw grid on canvas
function drawGrid(ctx, w, h) {
  ctx.save()
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth   = 1

  // Header / columns divider
  ctx.beginPath(); ctx.moveTo(0, 120); ctx.lineTo(w, 120); ctx.stroke()
  // Column header row bottom
  ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(w, 150); ctx.stroke()

  // Vertical column dividers
  const descW = w - 40 - 80 - 80 - 60 - 70 - 70 - 80
  const xPositions = [40, 40 + descW, 40 + descW + 80, 40 + descW + 160,
                      40 + descW + 220, 40 + descW + 290, 40 + descW + 360]
  xPositions.forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, h - 100); ctx.stroke()
  })

  // Row lines (25 rows)
  const rowH = (h - 250) / 25
  for (let i = 0; i <= 25; i++) {
    const y = 150 + i * rowH
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // Notes dividers
  ctx.beginPath(); ctx.moveTo(0, h - 100); ctx.lineTo(w, h - 100); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, h - 75);  ctx.lineTo(w, h - 75);  ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, h - 50);  ctx.lineTo(w, h - 50);  ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, h - 25);  ctx.lineTo(w, h - 25);  ctx.stroke()

  ctx.restore()
}

// SECTION: Draw column header labels on canvas
function drawColumnHeaders(ctx, w, h) {
  ctx.save()
  ctx.font      = 'bold 11px sans-serif'
  ctx.fillStyle = '#374151'
  ctx.textAlign = 'center'

  const descW = w - 40 - 80 - 80 - 60 - 70 - 70 - 80
  const headers = [
    { label: 'S/R',         x: 20                                              },
    { label: 'DESCRIPTION', x: 40 + descW / 2                                  },
    { label: 'PARTS',       x: 40 + descW + 40                                 },
    { label: 'LABOUR',      x: 40 + descW + 120                                },
    { label: 'S/A',         x: 40 + descW + 190                                },
    { label: 'C/WELD',      x: 40 + descW + 255                                },
    { label: 'PAINT',       x: 40 + descW + 325                                },
    { label: 'TOTAL',       x: 40 + descW + 400                                },
  ]
  headers.forEach(h2 => ctx.fillText(h2.label, h2.x, 140))

  ctx.textAlign = 'left'
  ctx.fillText('NOTES:', 8, h - 108)
  ctx.restore()
}

// SECTION: Initialise canvas (optionally restore saved drawing)
function initCanvas(canvas, savedDataUrl = null) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (savedDataUrl) {
    // Load from base64 data URI — same origin, no CORS taint
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      drawGrid(ctx, canvas.width, canvas.height)
      drawColumnHeaders(ctx, canvas.width, canvas.height)
    }
    img.src = savedDataUrl
  } else {
    drawGrid(ctx, canvas.width, canvas.height)
    drawColumnHeaders(ctx, canvas.width, canvas.height)
  }
}

// SECTION: Header info display row
function HeaderRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-semibold text-gray-500 w-20 flex-shrink-0">{label}:</span>
      <span className="text-sm font-medium text-gray-800 flex-1 border-b border-gray-200 pb-0.5 min-h-[20px]">
        {value || <span className="text-gray-300">—</span>}
      </span>
    </div>
  )
}

// SECTION: Main TabQuote component
export default function TabQuote({ job, vehicle, insurer }) {
  const { branch, profile } = useAuth()
  const canvasRef = useRef(null)

  const [tool,      setTool]      = useState('pen')
  const [lineWidth, setLineWidth] = useState(2)
  const [colour,    setColour]    = useState('#1a1a1a')
  const [saving,    setSaving]    = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [savedAt,   setSavedAt]   = useState(null)

  const { startDraw, draw, stopDraw } = useCanvas(canvasRef, tool, colour, lineWidth)

  // SECTION: Load existing quote from database on mount
  useEffect(() => {
    if (!job?.id) { setLoading(false); return }

    supabase
      .from('job_quotes')
      .select('canvas_data, updated_at')
      .eq('job_id', job.id)
      .maybeSingle()
      .then(({ data }) => {
        setLoading(false)
        if (data?.canvas_data) setSavedAt(data.updated_at)
        // Init canvas after DOM is ready
        setTimeout(() => initCanvas(canvasRef.current, data?.canvas_data || null), 80)
      })
  }, [job?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // SECTION: Save canvas to database as base64
  async function handleSave() {
    const canvas = canvasRef.current
    if (!canvas || !job?.id || !branch?.id) return
    setSaving(true)
    try {
      // toDataURL is safe here — canvas only drawn from local base64, never cross-origin URLs
      const canvasData = canvas.toDataURL('image/png')
      const { error } = await supabase
        .from('job_quotes')
        .upsert({
          job_id:      job.id,
          branch_id:   branch.id,
          canvas_data: canvasData,
          created_by:  profile?.id,
          updated_at:  new Date().toISOString(),
        }, { onConflict: 'job_id' })

      if (error) throw error
      setSavedAt(new Date().toISOString())
      toast.success('Quote saved')
    } catch (err) {
      console.error('[TabQuote] Save error:', err)
      toast.error('Failed to save quote')
    }
    setSaving(false)
  }

  // SECTION: Clear canvas
  function handleClear() {
    if (!window.confirm('Clear the canvas? This cannot be undone.')) return
    initCanvas(canvasRef.current, null)
  }

  // SECTION: Download PNG — composite of header + canvas
  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return

    const headerHeight = 160
    const composite    = document.createElement('canvas')
    composite.width    = canvas.width
    composite.height   = canvas.height + headerHeight
    const ctx          = composite.getContext('2d')

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, composite.width, composite.height)

    // Title
    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#111827'
    ctx.textAlign = 'center'
    ctx.fillText('QUOTATION', composite.width / 2, 36)
    ctx.textAlign = 'left'

    // Header fields
    const leftCol = [
      ['NAME',    vehicle?.owner_name  || ''],
      ['TEL',     vehicle?.owner_phone || ''],
      ['VEHICLE', vehicle?.make && vehicle?.model ? `${vehicle.make} ${vehicle.model}` : ''],
      ['REG',     vehicle?.registration || ''],
      ['VIN NO',  vehicle?.vin || ''],
    ]
    const rightCol = [
      ['DATE',     new Date().toLocaleDateString('en-ZA')],
      ['INS',      insurer?.name || ''],
      ['CLAIM NO', job?.claim_number || ''],
      ['MODEL',    vehicle?.model || ''],
      ['EMAIL',    vehicle?.owner_email || ''],
    ]
    leftCol.forEach(([label, val], i) => {
      ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#6b7280'
      ctx.fillText(label + ':', 20, 58 + i * 22)
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#111827'
      ctx.fillText(val, 120, 58 + i * 22)
    })
    rightCol.forEach(([label, val], i) => {
      ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#6b7280'
      ctx.fillText(label + ':', canvas.width / 2 + 20, 58 + i * 22)
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#111827'
      ctx.fillText(val, canvas.width / 2 + 130, 58 + i * 22)
    })

    // Divider
    ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, headerHeight - 10); ctx.lineTo(composite.width, headerHeight - 10); ctx.stroke()

    // Drawing — safe because canvas was only ever drawn from local base64
    ctx.drawImage(canvas, 0, headerHeight)

    const url = composite.toDataURL('image/png')
    const a   = document.createElement('a')
    a.href     = url
    a.download = `${job.job_number}_quote.png`
    a.click()
  }

  // SECTION: Print — opens clean print window with header + canvas image
  function handlePrint() {
    const canvas = canvasRef.current
    if (!canvas) return

    const imgData = canvas.toDataURL('image/png')
    const win     = window.open('', '_blank', 'width=900,height=700')
    if (!win) { toast.error('Pop-ups are blocked — please allow pop-ups for this site and try again'); return }

    const makeRows = (cols) => cols.map(([l, v]) =>
      `<tr>
        <td style="font-weight:600;color:#6b7280;width:90px;padding:3px 0;font-size:12px">${l}</td>
        <td style="border-bottom:1px solid #e5e7eb;padding:3px 8px;font-size:12px">${v || ''}</td>
       </tr>`
    ).join('')

    const leftRows  = makeRows([
      ['NAME',    vehicle?.owner_name  || ''],
      ['TEL',     vehicle?.owner_phone || ''],
      ['VEHICLE', vehicle?.make && vehicle?.model ? `${vehicle.make} ${vehicle.model}` : ''],
      ['REG',     vehicle?.registration || ''],
      ['VIN NO',  vehicle?.vin || ''],
    ])
    const rightRows = makeRows([
      ['DATE',     new Date().toLocaleDateString('en-ZA')],
      ['INS',      insurer?.name || ''],
      ['CLAIM NO', job?.claim_number || ''],
      ['MODEL',    vehicle?.model || ''],
      ['EMAIL',    vehicle?.owner_email || ''],
    ])

    win.document.write(`<!DOCTYPE html><html><head>
      <title>${job.job_number} — Quotation</title>
      <style>
        body { font-family:sans-serif; padding:20px; margin:0; }
        h2   { text-align:center; margin:0 0 16px; font-size:20px; }
        .hdr { display:flex; gap:40px; margin-bottom:16px; }
        table.f { border-collapse:collapse; width:100%; }
        img.cv  { width:100%; border:1px solid #d1d5db; border-radius:4px; display:block; }
        @media print { @page { margin:10mm; } }
      </style>
    </head><body>
      <h2>QUOTATION — ${job.job_number}</h2>
      <div class="hdr">
        <table class="f"><tbody>${leftRows}</tbody></table>
        <table class="f"><tbody>${rightRows}</tbody></table>
      </div>
      <img class="cv" src="${imgData}" />
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">

      {/* SECTION: Header — pre-filled from job data */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-heading">Quotation</h3>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
            Rough Quote — Handwritten
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <HeaderRow label="Name"    value={vehicle?.owner_name} />
            <HeaderRow label="Tel"     value={vehicle?.owner_phone} />
            <HeaderRow label="Vehicle" value={vehicle?.make && vehicle?.model ? `${vehicle.make} ${vehicle.model}` : null} />
            <HeaderRow label="Reg"     value={vehicle?.registration} />
            <HeaderRow label="Vin No"  value={vehicle?.vin} />
          </div>
          <div className="space-y-2">
            <HeaderRow label="Date"     value={new Date().toLocaleDateString('en-ZA')} />
            <HeaderRow label="Ins"      value={insurer?.name} />
            <HeaderRow label="Claim No" value={job?.claim_number} />
            <HeaderRow label="Model"    value={vehicle?.model} />
            <HeaderRow label="Email"    value={vehicle?.owner_email} />
          </div>
        </div>
      </div>

      {/* SECTION: Drawing toolbar */}
      <div className="card py-3">
        <div className="flex items-center gap-4 flex-wrap">

          {/* Tool */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'pen',    icon: Pencil, label: 'Pen'    },
              { key: 'eraser', icon: Eraser, label: 'Eraser' },
            ].map(t => (
              <button key={t.key} onClick={() => setTool(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                  ${tool === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>

          {/* Stroke width */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Size:</span>
            {[1, 2, 3, 5].map(w => (
              <button key={w} onClick={() => setLineWidth(w)}
                className={`rounded-full border-2 transition-all flex-shrink-0
                  ${lineWidth === w ? 'border-brand-600 bg-brand-600' : 'border-gray-300 bg-gray-200'}`}
                style={{ width: w * 4 + 8, height: w * 4 + 8 }}
              />
            ))}
          </div>

          {/* Colour */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Colour:</span>
            {['#1a1a1a', '#1d4ed8', '#dc2626', '#16a34a'].map(c => (
              <button key={c} onClick={() => setColour(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${colour === c ? 'border-brand-600 scale-110' : 'border-white shadow'}`}
                style={{ background: c }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="ml-auto flex gap-2">
            <button onClick={handleClear}
              className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 text-red-600 hover:bg-red-50 hover:border-red-200">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
            <button onClick={handlePrint}
              className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={handleDownload}
              className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex items-center gap-1.5 text-sm py-1.5">
              {saving
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Save className="w-3.5 h-3.5" />
              }
              {saving ? 'Saving…' : 'Save Quote'}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: Canvas — the writable grid */}
      <div className="card p-0 overflow-hidden rounded-xl">
        <canvas
          ref={canvasRef}
          width={1200}
          height={900}
          style={{
            width: '100%', height: 'auto', display: 'block',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            touchAction: 'none',
          }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>

      {savedAt && (
        <p className="text-xs text-gray-400 text-right">
          Last saved {new Date(savedAt).toLocaleString('en-ZA', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      )}

    </div>
  )
}