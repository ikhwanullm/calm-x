import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  FolderKanban,
  AreaChart,
  Library,
  Archive,
  LayoutTemplate,
  CalendarCheck,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true'; className?: string }>
  label: string
  end?: boolean
}

const PRIMARY_NAV: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/areas', icon: AreaChart, label: 'Areas' },
  { to: '/resources', icon: Library, label: 'Resources' },
  { to: '/archive', icon: Archive, label: 'Archive' },
]

const SECONDARY_NAV: NavItem[] = [
  { to: '/templates', icon: LayoutTemplate, label: 'Templates' },
  { to: '/review', icon: CalendarCheck, label: 'Weekly review' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function SidebarNavItem({ item, inboxCount }: { item: NavItem; inboxCount?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          // Base: full sidebar style (icon + label visible at ≥1280px)
          'flex items-center gap-3 rounded-control px-3 h-11',
          'text-sm font-medium transition-colors',
          // Icon rail at 768–1279px: center content, hide label
          'xl:w-full w-11 xl:justify-start justify-center overflow-hidden',
          isActive
            ? 'bg-accent-soft text-accent-text'
            : 'text-muted hover:bg-surface-2 hover:text-text'
        )
      }
    >
      {() => (
        <>
          <item.icon
            size={18}
            strokeWidth={1.75}
            aria-hidden="true"
            className="shrink-0"
          />
          <span className="xl:block hidden truncate">{item.label}</span>
          {item.label === 'Inbox' && inboxCount != null && inboxCount > 0 && (
            <span
              className="xl:flex hidden ml-auto items-center justify-center min-w-5 h-5 px-1 rounded-pill bg-surface-2 text-xs font-semibold tabular-nums"
              aria-label={`${inboxCount} inbox items`}
            >
              {inboxCount > 99 ? '99+' : inboxCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

interface AppShellProps {
  inboxCount?: number
}

export function AppShell({ inboxCount }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar */}
      <aside
        className="flex flex-col bg-surface border-r border-border shrink-0 xl:w-[232px] w-16"
        aria-label="Sidebar"
      >
        {/* Logo / Brand */}
        <div className="flex items-center xl:justify-start justify-center h-14 px-3 xl:px-4 border-b border-border">
          <span className="xl:block hidden text-base font-semibold text-text tracking-tight">
            Calm-X
          </span>
          <span className="xl:hidden block text-base font-semibold text-accent">X</span>
        </div>

        {/* Primary nav */}
        <nav aria-label="Main" className="flex flex-col gap-1 p-2 flex-1">
          {PRIMARY_NAV.map((item) => (
            <SidebarNavItem key={item.to} item={item} inboxCount={inboxCount} />
          ))}
        </nav>

        {/* Divider + Secondary nav */}
        <div className="border-t border-border p-2 flex flex-col gap-1">
          {SECONDARY_NAV.map((item) => (
            <SidebarNavItem key={item.to} item={item} />
          ))}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div
              className="flex items-center gap-2 h-9 px-3 rounded-control border border-border bg-bg text-muted text-sm w-full cursor-text"
              role="search"
              aria-label="Search (placeholder)"
            >
              {/* Search — implemented in a later phase */}
              <span className="text-muted text-sm">Search…</span>
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 h-9 px-3 rounded-control bg-accent text-accent-fg text-sm font-medium hover:opacity-90 transition-opacity"
            aria-label="Quick capture"
          >
            {/* Quick Capture — implemented in a later phase */}
            <span>+ Capture</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-[1240px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
