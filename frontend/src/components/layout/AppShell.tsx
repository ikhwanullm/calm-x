import { useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Kbd } from "@/components/common"
import { QuickCaptureDialog } from "@/components/capture/QuickCaptureDialog"
import { useShortcuts } from "@/hooks/useShortcuts"
import { useInboxTasks } from "@/hooks/useTasks"

interface NavItem {
  to: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean | "true"; className?: string }>
  label: string
  end?: boolean
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/inbox", icon: Inbox, label: "Inbox" },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
  { to: "/areas", icon: AreaChart, label: "Areas" },
  { to: "/resources", icon: Library, label: "Resources" },
  { to: "/archive", icon: Archive, label: "Archive" },
]

const SECONDARY_NAV: NavItem[] = [
  { to: "/templates", icon: LayoutTemplate, label: "Templates" },
  { to: "/review", icon: CalendarCheck, label: "Weekly review" },
  { to: "/settings", icon: Settings, label: "Settings" },
]

function SidebarNavItem({ item, inboxCount }: { item: NavItem; inboxCount?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={item.label}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-control px-3 h-11",
          "text-sm font-medium transition-colors",
          "xl:w-full w-11 xl:justify-start justify-center overflow-hidden",
          isActive
            ? "bg-accent-soft text-accent-text"
            : "text-muted hover:bg-surface-2 hover:text-text"
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
          {item.label === "Inbox" && inboxCount != null && inboxCount > 0 && (
            <>
              <span
                className="xl:flex hidden ml-auto items-center justify-center min-w-5 h-5 px-1 rounded-pill bg-surface-2 text-xs font-semibold tabular-nums"
                aria-label={`${inboxCount} inbox items`}
              >
                {inboxCount > 99 ? "99+" : inboxCount}
              </span>
              <span
                className="xl:hidden absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent"
                aria-hidden="true"
              />
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

export function AppShell() {
  const [captureOpen, setCaptureOpen] = useState(false)
  const { data: inboxTasks } = useInboxTasks()
  const inboxCount = inboxTasks?.filter((t) => !t.is_complete).length ?? 0

  useShortcuts({ Q: () => setCaptureOpen(true) })

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar */}
      <aside
        className="flex flex-col bg-surface border-r border-border shrink-0 xl:w-[232px] w-16"
        aria-label="Sidebar"
      >
        <div className="flex items-center xl:justify-start justify-center h-14 px-3 xl:px-4 border-b border-border">
          <span className="xl:block hidden text-base font-semibold text-text tracking-tight">Calm-X</span>
          <span className="xl:hidden block text-base font-semibold text-accent">X</span>
        </div>

        <nav aria-label="Main" className="flex flex-col gap-1 p-2 flex-1">
          {PRIMARY_NAV.map((item) => (
            <SidebarNavItem key={item.to} item={item} inboxCount={inboxCount} />
          ))}
        </nav>

        <div className="border-t border-border p-2 flex flex-col gap-1">
          <nav aria-label="Secondary">
            {SECONDARY_NAV.map((item) => (
              <SidebarNavItem key={item.to} item={item} />
            ))}
          </nav>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div
              className="flex items-center gap-2 h-9 px-3 rounded-control border border-border bg-bg text-muted text-sm w-full cursor-text"
              role="search"
              aria-label="Search (placeholder)"
            >
              <span className="text-muted text-sm">Search…</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCaptureOpen(true)}
            aria-label="Quick capture"
            className="flex items-center gap-2 h-11 px-4 rounded-control bg-accent text-accent-fg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Capture
            <Kbd className="hidden xl:inline-flex">Q</Kbd>
          </button>
        </header>

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-[1240px]">
            <Outlet />
          </div>
        </main>
      </div>

      <QuickCaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
    </div>
  )
}
