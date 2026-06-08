// src/portals/main/pages/jobs/detail/JobDetailHeader.jsx

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Printer, ChevronDown } from 'lucide-react'
import { useState } from 'react'

const STATUS_OPTIONS = [
  { value: 'checked_in',              label: 'Checked In'                  },
  { value: 'awaiting_authorization',  label: 'Awaiting Additional Auth'    },
  { value: 'authorized',              label: 'Authorized'                  },
  { value: 'in_progress',             label: 'In Progress'                 },
  { value: 'quality_check',           label: 'Quality Check'               },
  { value: 'awaiting_parts',          label: 'Awaiting Parts'              },
  { value: 'ready_for_collection',    label: 'Ready for Collection'        },
  { value: 'released',                label: 'Vehicle Released'            },
  { value: 'collected',               label: 'Collected'                   },
  { value: 'on_hold',                 label: 'On Hold'                     },
]

const STATUS_CONFIG = {
  checked_in:             { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  awaiting_authorization: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  authorized:             { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  in_progress:            { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  quality_check:          { bg: 'bg-purple-100', text: 'text-purple-700' },
  awaiting_parts:         { bg: 'bg-orange-100', text: 'text-orange-700' },
  ready_for_collection:   { bg: 'bg-green-100',  text: 'text-green-700'  },
  released:               { bg: 'bg-teal-100',   text: 'text-teal-700'   },
  collected:              { bg: 'bg-gray-100',   text: 'text-gray-600'   },
  on_hold:                { bg: 'bg-red-100',    text: 'text-red-700'    },
}

const PRIORITY_COLOURS = {
  1: 'bg-gray-400', 2: 'bg-blue-400', 3: 'bg-amber-400',
  4: 'bg-orange-500', 5: 'bg-red-500',
}

export default function JobDetailHeader({ job, vehicle, insurer, editMode, onEditToggle, onStatusChange, onRefresh }) {
  const navigate = useNavigate()
  const [statusOpen, setStatusOpen] = useState(false)

  const sc = STATUS_CONFIG[job?.status] || STATUS_CONFIG.checked_in
  const statusLabel = STATUS_OPTIONS.find(s => s.value === job?.status)?.label || job?.status

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">

      {/* SECTION: Top row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/main/jobs')}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       bg-gray-100 hover:bg-gray-200 text-gray-500
                       transition-all duration-150 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-mono text-2xl font-bold text-brand-600">
                {job?.job_number}
              </h1>
              <span className={`badge ${sc.bg} ${sc.text}`}>{statusLabel}</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${PRIORITY_COLOURS[job?.priority] || 'bg-gray-300'}`} />
                <span className="text-xs text-gray-500">Priority {job?.priority}</span>
              </div>
            </div>
            <p className="text-gray-600 font-semibold mt-0.5">
              {vehicle?.make} {vehicle?.model}
              {vehicle?.year ? ` · ${vehicle.year}` : ''}
              {vehicle?.colour ? ` · ${vehicle.colour}` : ''}
            </p>
            {vehicle?.owner_name && (
              <p className="text-gray-400 text-sm">{vehicle.owner_name}</p>
            )}
          </div>
        </div>

        {/* SECTION: Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Change status dropdown */}
          <div className="relative">
            <button
              onClick={() => setStatusOpen(o => !o)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              Change Status <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200
                                rounded-xl shadow-lg z-20 py-1 animate-scale-in">
                  {STATUS_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => { onStatusChange(opt.value); setStatusOpen(false) }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50
                                  transition-colors duration-100
                                  ${job?.status === opt.value ? 'text-brand-600 font-semibold' : 'text-gray-700'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={onEditToggle}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border
                        transition-all duration-150
                        ${editMode
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
          >
            <Edit2 className="w-3.5 h-3.5" />
            {editMode ? 'Editing' : 'Edit'}
          </button>

          <button
            onClick={() => window.location.href = `/main/jobs/${job?.id}/sticker`}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Printer className="w-3.5 h-3.5" /> QR Sticker
          </button>
        </div>
      </div>

    </div>
  )
}
