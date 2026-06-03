// src/portals/main/pages/admin/Users.jsx
// Staff management — Tier 1 (email/password) and Tier 2 (PIN only) users.
// Tier 1: creates Supabase auth account + sends password reset email.
// Tier 2: profile record only, no auth account, PIN-based workshop access.

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import {
  Plus, Search, X, Edit2, Eye, EyeOff,
  Shield, Wrench, ToggleLeft, ToggleRight,
  KeyRound, Mail, User, ChevronDown
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../hooks/useAuth'

// SECTION: Isolated client for creating new auth users
// Uses a fresh client instance with no session persistence so creating
// a new user via signUp never touches the admin's active session.
function createIsolatedClient() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession:     false,
        autoRefreshToken:   false,
        detectSessionInUrl: false,
        storage: {
          getItem:    () => null,
          setItem:    () => {},
          removeItem: () => {},
        },
      },
    }
  )
}

// SECTION: Role definitions
const TIER1_ROLES = [
  { value: 'owner',            label: 'Owner',            group: 'Full Access'       },
  { value: 'branch_manager',   label: 'Branch Manager',   group: 'Full Access'       },
  { value: 'general_manager',  label: 'General Manager',  group: 'Full Access'       },
  { value: 'manager',          label: 'Manager',          group: 'Operational'       },
  { value: 'reception',        label: 'Reception',        group: 'Operational'       },
  { value: 'towing',           label: 'Towing',           group: 'Operational'       },
  { value: 'debtors',          label: 'Debtors',          group: 'Operational'       },
  { value: 'creditors',        label: 'Creditors',        group: 'Operational'       },
  { value: 'customer_liaison', label: 'Customer Liaison', group: 'Operational'       },
  { value: 'parts_buyer',      label: 'Parts Buyer',      group: 'Operational'       },
  { value: 'parts_receiving',  label: 'Parts Receiving',  group: 'Operational'       },
  { value: 'estimator',        label: 'Estimator',        group: 'Operational'       },
  { value: 'final_costings',   label: 'Final Costings',   group: 'Operational'       },
  { value: 'marketer',         label: 'Marketer',         group: 'Operational'       },
  { value: 'procurement',      label: 'Procurement',      group: 'Operational'       },
  { value: 'hr',               label: 'HR',               group: 'Operational'       },
  { value: 'operations',       label: 'Operations',       group: 'Operational'       },
  { value: 'quality_controller',label:'Quality Controller',group:'Special Dual Access'},
]

const TIER2_ROLES = [
  { value: 'stripper',          label: 'Stripper',           dept: 'panel'      },
  { value: 'assembler',         label: 'Assembler',          dept: 'panel'      },
  { value: 'panelbeater',       label: 'Panelbeater',        dept: 'panel'      },
  { value: 'paint_prep',        label: 'Paint Prep',         dept: 'paint'      },
  { value: 'spraypainter',      label: 'Spraypainter',       dept: 'paint'      },
  { value: 'mechanic',          label: 'Mechanic',           dept: 'mechanical' },
  { value: 'cleaner',           label: 'Cleaner',            dept: 'general'    },
  { value: 'quality_controller',label: 'Quality Controller', dept: 'quality'    },
  { value: 'security',          label: 'Security',           dept: 'general'    },
]

const DEPT_MAP = {
  panel: 'panel', paint: 'paint', mechanical: 'mechanical',
  general: 'general', quality: 'quality',
}

// SECTION: Role badge
function RoleBadge({ role, tier }) {
  const colours = {
    tier1: 'bg-brand-100 text-brand-700',
    tier2: 'bg-purple-100 text-purple-700',
  }
  const label = role?.replace(/_/g, ' ')
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return (
    <span className={`badge ${colours[tier] || colours.tier1} capitalize`}>
      {label}
    </span>
  )
}

// SECTION: PIN display with masked bullets
function PinDisplay({ pin, onReset }) {
  const [show, setShow] = useState(false)
  if (!pin) return <span className="text-gray-300 text-sm">—</span>
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm text-gray-700">
        {show ? pin : '••••'}
      </span>
      <button onClick={() => setShow(s => !s)}
        className="text-gray-400 hover:text-gray-600 transition-colors">
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button onClick={onReset}
        className="text-xs text-brand-600 hover:text-brand-700 font-medium
                   transition-colors">
        Reset
      </button>
    </div>
  )
}

// SECTION: Staff form modal
function StaffModal({ open, onClose, onSaved, editStaff, workshopRoles, branch }) {
  const [staffType,  setStaffType]  = useState('main')
  const [fullName,   setFullName]   = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [tier1Role,  setTier1Role]  = useState('')
  const [tier2Role,  setTier2Role]  = useState('')
  const [workshopRoleId, setWorkshopRoleId] = useState('')
  const [pin,        setPin]        = useState('')
  const [active,     setActive]     = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [showPin,    setShowPin]    = useState(false)

  const isEdit = !!editStaff

  useEffect(() => {
    if (editStaff) {
      setStaffType(editStaff.tier1_role ? 'main' : 'workshop')
      setFullName(editStaff.full_name || '')
      setEmail(editStaff.email || '')
      setPassword('')
      setTier1Role(editStaff.tier1_role || '')
      setTier2Role(editStaff.tier2_role || '')
      setWorkshopRoleId(editStaff.workshop_role_id || '')
      setPin(editStaff.workshop_pin || '')
      setActive(editStaff.active ?? true)
    } else {
      setStaffType('main')
      setFullName(''); setEmail(''); setPassword('')
      setTier1Role(''); setTier2Role('')
      setWorkshopRoleId(''); setPin('')
      setActive(true)
    }
  }, [editStaff, open])

  async function handleSave() {
    if (!fullName.trim()) { toast.error('Full name is required'); return }
    if (staffType === 'main' && !email.trim()) { toast.error('Email is required'); return }
    if (staffType === 'main' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      toast.error('Please enter a valid email address (e.g. name@domain.co.za)')
      return
    }
    if (staffType === 'main' && !isEdit && !password.trim()) { toast.error('Password is required'); return }
    if (staffType === 'main' && !isEdit && password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (staffType === 'main' && !tier1Role) { toast.error('Role is required'); return }
    if (staffType === 'workshop' && !tier2Role) { toast.error('Workshop role is required'); return }
    if (staffType === 'workshop' && pin && pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits'); return
    }

    setSaving(true)

    try {
      if (isEdit) {
        // Check for duplicate PIN at branch level before saving
        if (pin && pin.length === 4) {
          const { data: pinCheck } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('branch_id', branch.id)
            .eq('workshop_pin', pin)
            .eq('active', true)
            .neq('id', editStaff.id)
            .maybeSingle()

          if (pinCheck) {
            throw new Error(`PIN ${pin} is already assigned to ${pinCheck.full_name}. Each staff member must have a unique PIN.`)
          }
        }

        // Use RPC to update profile (avoids enum casting issues with direct update)
        const { error } = await supabase.rpc('update_staff_profile', {
          p_profile_id:      editStaff.id,
          p_full_name:       fullName.trim(),
          p_active:          active,
          p_workshop_role_id: workshopRoleId || null,
          p_workshop_pin:    pin && pin.length === 4 ? pin : null,
          p_tier1_role:      staffType === 'main' ? tier1Role : null,
          p_tier2_role:      staffType === 'workshop' ? tier2Role : null,
          p_clear_pin:       !pin || pin.length !== 4,
        })

        if (error) throw new Error(error.message)
        toast.success('Staff member updated')

      } else if (staffType === 'main') {
        // Use an isolated Supabase client with no session persistence.
        // This means signUp creates the new user without touching the admin's session.
        const isolatedClient = createIsolatedClient()

        const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
          email:    email.trim().toLowerCase(),
          password: password,
          options:  { data: { full_name: fullName.trim() } },
        })

        if (signUpError) throw new Error(signUpError.message)
        const newUserId = signUpData.user?.id
        if (!newUserId) throw new Error('Failed to create auth account')

        // Create profile using the admin's authenticated client (not isolated one)
        const { error: profileError } = await supabase.rpc('create_main_staff', {
          p_user_id:          newUserId,
          p_branch_id:        branch.id,
          p_full_name:        fullName.trim(),
          p_email:            email.trim().toLowerCase(),
          p_tier1_role:       tier1Role,
          p_workshop_role_id: workshopRoleId || null,
          p_workshop_pin:     pin && pin.length === 4 ? pin : null,
        })

        if (profileError) throw new Error(profileError.message)

        toast.success(`Account created for ${fullName.trim()}. Share the temporary password with them — they can change it after logging in.`)

      } else {
        // Check for duplicate PIN before creating
        if (pin && pin.length === 4) {
          const { data: pinCheck } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('branch_id', branch.id)
            .eq('workshop_pin', pin)
            .eq('active', true)
            .maybeSingle()

          if (pinCheck) {
            throw new Error(`PIN ${pin} is already assigned to ${pinCheck.full_name}. Each staff member must have a unique PIN.`)
          }
        }

        // Workshop-only: create profile via SECURITY DEFINER RPC
        const tier2RoleData = TIER2_ROLES.find(r => r.value === tier2Role)
        const { error } = await supabase.rpc('create_workshop_staff', {
          p_branch_id:        branch.id,
          p_full_name:        fullName.trim(),
          p_tier2_role:       tier2Role,
          p_department_group: tier2RoleData?.dept || null,
          p_workshop_role_id: workshopRoleId || null,
          p_workshop_pin:     pin && pin.length === 4 ? pin : null,
        })

        if (error) throw new Error(error.message)
        toast.success('Workshop staff added')
      }

      onSaved()
      onClose()

    } catch (err) {
      console.error('[Users] Save error:', err)
      toast.error(err.message || 'Failed to save. Please try again.')
    }

    setSaving(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-bold text-gray-900">
            {isEdit ? 'Edit Staff Member' : 'Add Staff Member'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Staff type — only on create */}
          {!isEdit && (
            <div>
              <label className="label">Staff Type</label>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setStaffType('main')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                              border-2 text-sm font-semibold transition-all duration-150
                              ${staffType === 'main'
                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                : 'border-gray-200 text-gray-500'}`}>
                  <Shield className="w-4 h-4" /> Main System
                </button>
                <button type="button"
                  onClick={() => setStaffType('workshop')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                              border-2 text-sm font-semibold transition-all duration-150
                              ${staffType === 'workshop'
                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                : 'border-gray-200 text-gray-500'}`}>
                  <Wrench className="w-4 h-4" /> Workshop Only
                </button>
              </div>
              {staffType === 'main' && (
                <p className="text-xs text-gray-400 mt-2">
                  A password setup email will be sent automatically.
                </p>
              )}
            </div>
          )}

          {/* Full name */}
          <div>
            <label className="label">Full Name <span className="text-red-500">*</span></label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="e.g. John Smith" className="input-field" />
          </div>

          {/* Email — main system only */}
          {staffType === 'main' && (
            <div>
              <label className="label">Email Address <span className="text-red-500">*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="staff@workshop.co.za" className="input-field no-caps"
                disabled={isEdit} />
            </div>
          )}

          {/* Password — new main system users only */}
          {staffType === 'main' && !isEdit && (
            <div>
              <label className="label">
                Temporary Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="input-field pr-10"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Share this password with the staff member. They can change it after logging in via their profile.
              </p>
            </div>
          )}

          {/* Tier 1 role */}
          {staffType === 'main' && (
            <div>
              <label className="label">Role <span className="text-red-500">*</span></label>
              <select value={tier1Role} onChange={e => setTier1Role(e.target.value)} className="input-field">
                <option value="">Select role…</option>
                {['Full Access', 'Operational', 'Special Dual Access'].map(group => (
                  <optgroup key={group} label={group}>
                    {TIER1_ROLES.filter(r => r.group === group).map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {/* Tier 2 role */}
          {staffType === 'workshop' && (
            <div>
              <label className="label">Workshop Role <span className="text-red-500">*</span></label>
              <select value={tier2Role} onChange={e => setTier2Role(e.target.value)} className="input-field">
                <option value="">Select role…</option>
                {TIER2_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Workshop role (display role) */}
          <div>
            <label className="label">Workshop Display Role</label>
            <select value={workshopRoleId} onChange={e => setWorkshopRoleId(e.target.value)} className="input-field">
              <option value="">None</option>
              {workshopRoles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* PIN */}
          <div>
            <label className="label">Workshop PIN (4 digits)</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').substring(0, 4)
                  setPin(val)
                }}
                placeholder="4-digit PIN"
                maxLength={4}
                className="input-field pr-10 font-mono tracking-widest"
              />
              <button type="button" onClick={() => setShowPin(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pin && pin.length !== 4 && (
              <p className="text-xs text-red-500 mt-1">PIN must be exactly 4 digits</p>
            )}
          </div>

          {/* Active toggle — edit only */}
          {isEdit && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700">Account Active</span>
              <button type="button" onClick={() => setActive(a => !a)}
                className={`transition-colors duration-200 ${active ? 'text-green-500' : 'text-gray-300'}`}>
                {active
                  ? <ToggleRight className="w-8 h-8" />
                  : <ToggleLeft  className="w-8 h-8" />
                }
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : null
            }
            {isEdit ? 'Save Changes' : 'Add Staff Member'}
          </button>
        </div>

      </div>
    </div>
  )
}

// SECTION: PIN reset modal
function PinResetModal({ open, staff, onClose, onSaved }) {
  const [pin,     setPin]     = useState('')
  const [showPin, setShowPin] = useState(false)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { if (open) setPin('') }, [open])

  async function handleReset() {
    if (pin.length !== 4) { toast.error('PIN must be exactly 4 digits'); return }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ workshop_pin: pin })
      .eq('id', staff.id)
    setSaving(false)
    if (error) { toast.error('Failed to reset PIN'); return }
    toast.success('PIN updated')
    onSaved()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in p-6">
        <h3 className="font-display font-bold text-gray-900 mb-1">Reset PIN</h3>
        <p className="text-gray-500 text-sm mb-4">{staff?.full_name}</p>
        <div className="relative mb-4">
          <input
            type={showPin ? 'text' : 'password'}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').substring(0, 4))}
            placeholder="New 4-digit PIN"
            className="input-field pr-10 font-mono tracking-widest"
            maxLength={4}
          />
          <button type="button" onClick={() => setShowPin(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleReset} disabled={pin.length !== 4 || saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Reset PIN
          </button>
        </div>
      </div>
    </div>
  )
}

// SECTION: Main Users component
export default function Users() {
  const { branch, profile } = useAuth()
  const branchId = branch?.id || profile?.branch_id

  const [staff,         setStaff]         = useState([])
  const [workshopRoles, setWorkshopRoles] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editStaff,     setEditStaff]     = useState(null)
  const [pinModal,      setPinModal]      = useState(null)

  // SECTION: Fetch staff
  const fetchStaff = useCallback(async () => {
    if (!branchId) return
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, tier1_role, tier2_role, department_group, workshop_pin, workshop_role_id, active, created_at')
      .eq('branch_id', branchId)
      .order('full_name')
    setStaff(data || [])
    setLoading(false)
  }, [branchId])

  // SECTION: Fetch workshop roles once
  useEffect(() => {
    if (!branchId) return
    supabase
      .from('workshop_roles')
      .select('id, name, colour')
      .eq('branch_id', branchId)
      .eq('active', true)
      .order('name')
      .then(({ data }) => setWorkshopRoles(data || []))
  }, [branchId])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  // SECTION: Toggle active
  async function handleToggleActive(member) {
    const { error } = await supabase.rpc('update_staff_profile', {
      p_profile_id:       member.id,
      p_full_name:        member.full_name,
      p_active:           !member.active,
      p_workshop_role_id: member.workshop_role_id || null,
      p_workshop_pin:     member.workshop_pin || null,
      p_tier1_role:       member.tier1_role || null,
      p_tier2_role:       member.tier2_role || null,
      p_clear_pin:        false,
    })

    if (error) { toast.error('Failed to update status: ' + error.message); return }
    toast.success(`${member.full_name} ${member.active ? 'deactivated' : 'activated'}`)
    fetchStaff()
  }

  // SECTION: Filtered staff
  const filtered = staff.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.tier1_role?.includes(q) ||
      s.tier2_role?.includes(q)
    )
  })

  const tier1Staff    = filtered.filter(s => s.tier1_role)
  const tier2Staff    = filtered.filter(s => !s.tier1_role && s.tier2_role)

  // SECTION: Render
  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Staff</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {staff.length} staff member{staff.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button onClick={() => { setEditStaff(null); setModalOpen(true) }}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {/* Search */}
      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or role…"
            className="input-field pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">

          {/* SECTION: Tier 1 — Management staff */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-brand-600" />
              <h2 className="section-heading">Management Staff</h2>
              <span className="badge bg-brand-100 text-brand-700">{tier1Staff.length}</span>
            </div>

            {tier1Staff.length === 0 ? (
              <div className="card text-center py-8 text-gray-400">No management staff found</div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">PIN</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tier1Staff.map(member => (
                      <tr key={member.id} className="hover:bg-gray-50 transition-colors duration-100">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-brand-700 text-xs font-bold">
                                {member.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-semibold text-gray-900">{member.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 hidden md:table-cell">{member.email || '—'}</td>
                        <td className="px-4 py-3.5">
                          <RoleBadge role={member.tier1_role} tier="tier1" />
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <PinDisplay
                            pin={member.workshop_pin}
                            onReset={() => setPinModal(member)}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => handleToggleActive(member)}
                            className={`transition-colors duration-200 ${member.active ? 'text-green-500 hover:text-green-600' : 'text-gray-300 hover:text-gray-400'}`}>
                            {member.active
                              ? <ToggleRight className="w-7 h-7" />
                              : <ToggleLeft  className="w-7 h-7" />
                            }
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => { setEditStaff(member); setModalOpen(true) }}
                            className="text-gray-400 hover:text-brand-600 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION: Tier 2 — Workshop staff */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-purple-600" />
              <h2 className="section-heading">Workshop Staff</h2>
              <span className="badge bg-purple-100 text-purple-700">{tier2Staff.length}</span>
            </div>

            {tier2Staff.length === 0 ? (
              <div className="card text-center py-8 text-gray-400">No workshop staff found</div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">PIN</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tier2Staff.map(member => (
                      <tr key={member.id} className="hover:bg-gray-50 transition-colors duration-100">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-purple-700 text-xs font-bold">
                                {member.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-semibold text-gray-900">{member.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <RoleBadge role={member.tier2_role} tier="tier2" />
                        </td>
                        <td className="px-4 py-3.5">
                          <PinDisplay
                            pin={member.workshop_pin}
                            onReset={() => setPinModal(member)}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => handleToggleActive(member)}
                            className={`transition-colors duration-200 ${member.active ? 'text-green-500 hover:text-green-600' : 'text-gray-300 hover:text-gray-400'}`}>
                            {member.active
                              ? <ToggleRight className="w-7 h-7" />
                              : <ToggleLeft  className="w-7 h-7" />
                            }
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => { setEditStaff(member); setModalOpen(true) }}
                            className="text-gray-400 hover:text-purple-600 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* SECTION: Modals */}
      <StaffModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditStaff(null) }}
        onSaved={fetchStaff}
        editStaff={editStaff}
        workshopRoles={workshopRoles}
        branch={branch || { id: branchId }}
      />

      <PinResetModal
        open={!!pinModal}
        staff={pinModal}
        onClose={() => setPinModal(null)}
        onSaved={fetchStaff}
      />

    </div>
  )
}
