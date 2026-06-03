// src/portals/main/pages/jobs/detail/TabNotes.jsx

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Send } from 'lucide-react'
import { supabase } from '../../../../../lib/supabase'
import { useAuth } from '../../../../../hooks/useAuth'

export default function TabNotes({ job }) {
  const { profile, branch } = useAuth()
  const [notes,   setNotes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [text,    setText]    = useState('')
  const [saving,  setSaving]  = useState(false)

  // SECTION: Fetch notes with author names
  async function fetchNotes() {
    const { data } = await supabase
      .from('job_notes')
      .select('id, note, created_at, created_by')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })

    if (!data?.length) { setNotes([]); setLoading(false); return }

    const authorIds = [...new Set(data.map(n => n.created_by).filter(Boolean))]
    const authorMap = {}
    if (authorIds.length > 0) {
      const { data: authors } = await supabase
        .rpc('lookup_technician_names', { p_ids: authorIds })
      ;(authors || []).forEach(a => { authorMap[a.id] = a.full_name })
    }

    setNotes(data.map(n => ({ ...n, authorName: authorMap[n.created_by] || 'Staff' })))
    setLoading(false)
  }

  useEffect(() => { fetchNotes() }, [job.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!text.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('job_notes').insert({
      job_id: job.id, branch_id: branch.id,
      note: text.trim(), created_by: profile.id,
    })
    setSaving(false)
    if (error) { toast.error('Failed to save note'); return }
    setText('')
    toast.success('Note added')
    fetchNotes()
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Add note */}
      <div className="card">
        <h3 className="section-heading mb-3">Add Note</h3>
        <div className="flex gap-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add an internal note…"
            rows={3}
            className="input-field resize-none flex-1"
          />
          <button onClick={handleSave} disabled={!text.trim() || saving}
            className="btn-primary flex items-center gap-2 self-end">
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send className="w-4 h-4" />
            }
            Save
          </button>
        </div>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : notes.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">No notes yet</div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="card-tight">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">{note.authorName}</span>
                <span className="text-xs text-gray-400">
                  {new Date(note.created_at).toLocaleString('en-ZA', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{note.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
