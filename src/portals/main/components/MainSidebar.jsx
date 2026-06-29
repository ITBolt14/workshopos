// src/portals/main/components/MainSidebar.jsx
import { useNavigate, NavLink } from 'react-router-dom'
import {
  Wrench, LayoutDashboard, ClipboardList, MonitorCheck,
  Users, FolderKanban, Settings, ChevronLeft, ChevronRight,
  LogOut, BarChart2
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'

// SECTION: Navigation config
const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/main',          icon: LayoutDashboard, label: 'Dashboard',     exact: true,  roles: [] },
      { to: '/main/jobs',     icon: ClipboardList,   label: 'Jobs',          exact: false, roles: [] },
      { to: '/main/monitor',  icon: MonitorCheck,    label: 'Floor Monitor', exact: false, roles: [] },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/main/reports/clocking', icon: BarChart2, label: 'Clocking Reports', exact: false,
        roles: ['super_admin','owner','branch_manager','general_manager','manager'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/main/admin/users',    icon: Users,        label: 'Staff',           exact: false, roles: ['super_admin','owner','branch_manager','general_manager'] },
      { to: '/main/admin/stages',   icon: FolderKanban, label: 'Stage Templates', exact: false, roles: ['super_admin','owner','branch_manager','general_manager'] },
      { to: '/main/admin/settings', icon: Settings,     label: 'Settings',        exact: false, roles: ['super_admin','owner','branch_manager','general_manager'] },
    ],
  },
]

// SECTION: Nav item component
function NavItem({ item, collapsed }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.exact}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
         transition-all duration-150 group relative
         ${isActive
           ? 'bg-brand-600 text-white shadow-sm'
           : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
         }
         ${collapsed ? 'justify-center' : ''}`
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white
                        text-xs rounded-lg opacity-0 group-hover:opacity-100
                        pointer-events-none whitespace-nowrap z-50
                        transition-opacity duration-150 shadow-lg">
          {item.label}
        </div>
      )}
    </NavLink>
  )
}

// SECTION: MainSidebar
export default function MainSidebar({ collapsed, onToggle }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function canSeeItem(item) {
    if (item.roles.length === 0) return true
    return item.roles.includes(profile?.tier1_role)
  }

  return (
    <aside className={`flex flex-col bg-white border-r border-gray-200 h-screen
                       transition-all duration-300 ease-in-out flex-shrink-0
                       ${collapsed ? 'w-16' : 'w-56'}`}>

      {/* SECTION: Logo */}
      <div className={`flex items-center h-16 border-b border-gray-200 flex-shrink-0
                       ${collapsed ? 'justify-center px-2' : 'px-4 gap-3'}`}>
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Wrench className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-display font-bold text-gray-900 text-base truncate">
            WorkshopOS
          </span>
        )}
      </div>

      {/* SECTION: Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_SECTIONS.map(section => {
          const visible = section.items.filter(canSeeItem)
          if (!visible.length) return null
          return (
            <div key={section.label}>
              {!collapsed && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1.5">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visible.map(item => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
              </div>
            </div>
          )
        })}
      </nav>

      {/* SECTION: Bottom actions */}
      <div className="border-t border-gray-200 p-2 space-y-0.5 flex-shrink-0">
        <button
          onClick={handleSignOut}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                      font-medium text-gray-500 hover:bg-red-50 hover:text-red-600
                      transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs
                      font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600
                      transition-all duration-150 ${collapsed ? 'justify-center' : 'justify-end'}`}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><span>Collapse</span><ChevronLeft className="w-4 h-4" /></>
          }
        </button>
      </div>

    </aside>
  )
}