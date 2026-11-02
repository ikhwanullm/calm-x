import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RouteFallback } from './components/layout/RouteFallback'
// The two pages people land on stay in the main bundle; every other page loads when it is first opened.
import DashboardPage from './pages/DashboardPage'
import TodayPage from './pages/TodayPage'

const AllTasksPage = lazy(() => import('./pages/AllTasksPage'))
const InboxPage = lazy(() => import('./pages/InboxPage'))
const SomedayPage = lazy(() => import('./pages/SomedayPage'))
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'))
const MeetingPage = lazy(() => import('./pages/MeetingPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'))
const AreasPage = lazy(() => import('./pages/AreasPage'))
const AreaDetailPage = lazy(() => import('./pages/AreaDetailPage'))
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'))
const ResourceDetailPage = lazy(() => import('./pages/ResourceDetailPage'))
const ArchivePage = lazy(() => import('./pages/ArchivePage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const TemplateDetailPage = lazy(() => import('./pages/TemplateDetailPage'))
const WeeklyReviewPage = lazy(() => import('./pages/WeeklyReviewPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
// DEV-only component gallery for visual verification; the condition keeps it out of the production build
const DevComponentsPage = import.meta.env.DEV ? lazy(() => import('./pages/DevComponentsPage')) : null

export const router = createBrowserRouter([
  {
    // AppShell wraps its <Outlet /> in a Suspense, so the sidebar stays put while a page loads
    element: <AppShell />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/today', element: <TodayPage /> },
      { path: '/inbox', element: <InboxPage /> },
      { path: '/someday', element: <SomedayPage /> },
      { path: '/meetings', element: <MeetingsPage /> },
      { path: '/meetings/:id', element: <MeetingPage /> },
      { path: '/tasks', element: <AllTasksPage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/projects/:id', element: <ProjectDetailPage /> },
      { path: '/areas', element: <AreasPage /> },
      { path: '/areas/:id', element: <AreaDetailPage /> },
      { path: '/resources', element: <ResourcesPage /> },
      { path: '/resources/:id', element: <ResourceDetailPage /> },
      { path: '/archive', element: <ArchivePage /> },
      { path: '/templates', element: <TemplatesPage /> },
      { path: '/templates/:id', element: <TemplateDetailPage /> },
      { path: '/settings', element: <SettingsPage /> },
      ...(DevComponentsPage ? [{ path: '/dev/components', element: <DevComponentsPage /> }] : []),
    ],
  },
  // Weekly review uses a focused full-page layout (no sidebar) — route is
  // outside AppShell per tasks.md Phase 9 note.
  {
    path: '/review',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <WeeklyReviewPage />
      </Suspense>
    ),
  },
])
