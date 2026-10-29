import { useEffect, useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Sun,
  Inbox,
  CloudMoon,
  NotebookPen,
  ListFilter,
  FolderKanban,
  AreaChart,
  Library,
  Archive,
  LayoutTemplate,
  CalendarCheck,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Kbd } from "@/components/common"
import { QuickCaptureDialog } from "@/components/capture/QuickCaptureDialog"
import { CommandPalette } from "@/components/search/CommandPalette"
import { ShortcutHelp } from "@/components/search/ShortcutHelp"
import { NewItemDialog } from "@/components/items/NewItemDialog"

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
  { to: "/today", icon: Sun, label: "Today" },
  { to: "/inbox", icon: Inbox, label: "Inbox" },
  { to: "/someday", icon: CloudMoon, label: "Someday" },
  { to: "/meetings", icon: NotebookPen, label: "Meetings" },
  { to: "/tasks", icon: ListFilter, label: "All tasks" },
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

const WIDE_QUERY = "(min-width: 1280px)"
const COLLAPSED_KEY = "calmx.sidebar.collapsed"

/** True on screens >= 1280px (Tailwind `xl`). Treated as wide where matchMedia is missing (tests). */
function useIsWide(): boolean {
  const [wide, setWide] = useState(() => (typeof window.matchMedia === "function" ? window.matchMedia(WIDE_QUERY).matches : true))
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const mq = window.matchMedia(WIDE_QUERY)
    const onChange = () => setWide(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return wide
}

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === "1" } catch { return false }
}

function SidebarNavItem({
  item, inboxCount, expanded, onNavigate,
}: { item: NavItem; inboxCount?: number; expanded: boolean; onNavigate: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={item.label}
      title={item.label}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-control px-3 h-11",
          "text-sm font-medium transition-colors",
          "overflow-hidden",
          expanded ? "w-full justify-start" : "w-11 justify-center",
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
          {expanded && <span className="truncate">{item.label}</span>}
          {item.label === "Inbox" && inboxCount != null && inboxCount > 0 && (
            <>
              {expanded ? (
              <span
                className="flex ml-auto items-center justify-center min-w-5 h-5 px-1 rounded-pill bg-surface-2 text-xs font-semibold tabular-nums"
                aria-label={`${inboxCount} inbox items`}
              >
                {inboxCount > 99 ? "99+" : inboxCount}
              </span>
              ) : (
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent"
                aria-hidden="true"
              />
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

export function AppShell() {
  const [captureOpen, setCaptureOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  const { data: inboxTasks } = useInboxTasks()
  const inboxCount = inboxTasks?.filter((t) => !t.is_complete).length ?? 0
  const navigate = useNavigate()

  // Wide screens: the sidebar pushes the content and the choice is remembered.
  // Narrow screens: it is icons only; opening it overlays the content and closes again after a click.
  const isWide = useIsWide()
  const [collapsedWide, setCollapsedWide] = useState(readCollapsed)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const expanded = isWide ? !collapsedWide : overlayOpen
  const overlay = !isWide && overlayOpen

  function toggleSidebar() {
    if (isWide) {
      const next = !collapsedWide
      setCollapsedWide(next)
      try { localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0") } catch { /* remembering is optional */ }
    } else {
      setOverlayOpen((open) => !open)
    }
  }

  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOverlayOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [overlay])

  useShortcuts({
    Q: () => !paletteOpen && !helpOpen && setCaptureOpen(true),
    "/": () => { setCaptureOpen(false); setPaletteOpen(true) },
    "?": () => { setCaptureOpen(false); setPaletteOpen(false); setHelpOpen(true) },
    "ctrl+k": () => { setCaptureOpen(false); setPaletteOpen(true) },
  })

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar — the wrapper keeps its space in the layout; an open overlay is drawn over the content */}
      <div className={cn("relative shrink-0 transition-[width]", isWide && expanded ? "w-[232px]" : "w-16")}>
        {overlay && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close sidebar"
            className="fixed inset-0 z-20 bg-black/30 cursor-default"
            onClick={() => setOverlayOpen(false)}
          />
        )}
        <aside
          className={cn(
            "absolute inset-y-0 left-0 z-30 flex flex-col bg-surface border-r border-border overflow-y-auto overflow-x-hidden transition-[width]",
            expanded ? "w-[232px]" : "w-16"
          )}
          aria-label="Sidebar"
        >
          <div
            className={cn(
              "flex items-center h-14 border-b border-border shrink-0",
              expanded ? "justify-between px-4" : "justify-center px-3"
            )}
          >
            {expanded && <span className="text-base font-semibold text-text tracking-tight">Calm-X</span>}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={expanded}
              title={expanded ? "Collapse sidebar" : "Expand sidebar"}
              className="inline-flex items-center justify-center w-9 h-9 rounded-control text-muted hover:bg-surface-2 hover:text-text"
            >
              {expanded ? <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden="true" /> : <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          </div>

          <nav aria-label="Main" className="flex flex-col gap-1 p-2 flex-1">
            {PRIMARY_NAV.map((item) => (
              <SidebarNavItem key={item.to} item={item} inboxCount={inboxCount} expanded={expanded} onNavigate={() => setOverlayOpen(false)} />
            ))}
          </nav>

          <div className="border-t border-border p-2 flex flex-col gap-1 mt-auto shrink-0">
            <nav aria-label="Secondary">
              {SECONDARY_NAV.map((item) => (
                <SidebarNavItem key={item.to} item={item} expanded={expanded} onNavigate={() => setOverlayOpen(false)} />
              ))}
            </nav>
          </div>
        </aside>
      </div>

      {/* Main column — fills remaining space, scrolls independently */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 h-9 px-3 rounded-control border border-border bg-bg text-muted text-sm w-full cursor-text text-left"
              aria-label="Open command palette"
            >
              <span className="text-muted text-sm">Search…</span>
              <Kbd className="hidden xl:inline-flex ml-auto text-xs">/</Kbd>
            </button>
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

        {/* Scrollable main content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-[1240px]">
            <Outlet />
          </div>
        </main>
      </div>

      <QuickCaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onQuickCapture={() => { setPaletteOpen(false); setCaptureOpen(true) }}
        onNewProject={() => { setPaletteOpen(false); setNewProjectOpen(true) }}
      />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <NewItemDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        defaultType="project"
        onCreated={(id) => { setNewProjectOpen(false); navigate(`/projects/${id}`) }}
      />

    </div>
  )
}
