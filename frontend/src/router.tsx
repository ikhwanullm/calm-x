import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import DashboardPage from './pages/DashboardPage'
import InboxPage from './pages/InboxPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import AreasPage from './pages/AreasPage'
import AreaDetailPage from './pages/AreaDetailPage'
import ResourcesPage from './pages/ResourcesPage'
import ResourceDetailPage from './pages/ResourceDetailPage'
import ArchivePage from './pages/ArchivePage'
import TemplatesPage from './pages/TemplatesPage'
import WeeklyReviewPage from './pages/WeeklyReviewPage'
import SettingsPage from './pages/SettingsPage'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/inbox', element: <InboxPage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/projects/:id', element: <ProjectDetailPage /> },
      { path: '/areas', element: <AreasPage /> },
      { path: '/areas/:id', element: <AreaDetailPage /> },
      { path: '/resources', element: <ResourcesPage /> },
      { path: '/resources/:id', element: <ResourceDetailPage /> },
      { path: '/archive', element: <ArchivePage /> },
      { path: '/templates', element: <TemplatesPage /> },
      { path: '/review', element: <WeeklyReviewPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])
