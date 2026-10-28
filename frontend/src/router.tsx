import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import DashboardPage from './pages/DashboardPage'
import AllTasksPage from './pages/AllTasksPage'
import InboxPage from './pages/InboxPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import AreasPage from './pages/AreasPage'
import AreaDetailPage from './pages/AreaDetailPage'
import ResourcesPage from './pages/ResourcesPage'
import ResourceDetailPage from './pages/ResourceDetailPage'
import ArchivePage from './pages/ArchivePage'
import TemplatesPage from './pages/TemplatesPage'
import TemplateDetailPage from './pages/TemplateDetailPage'
import WeeklyReviewPage from './pages/WeeklyReviewPage'
import SettingsPage from './pages/SettingsPage'
// DEV-only component gallery for visual verification
import DevComponentsPage from './pages/DevComponentsPage'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/inbox', element: <InboxPage /> },
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
    ...(import.meta.env.DEV ? [{ path: '/dev/components', element: <DevComponentsPage /> }] : []),
    ],
  },
  // Weekly review uses a focused full-page layout (no sidebar) — route is
  // outside AppShell per tasks.md Phase 9 note.
  { path: '/review', element: <WeeklyReviewPage /> },
])
