import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ItemListView } from '@/components/items/ItemListView'
import { NewItemDialog } from '@/components/items/NewItemDialog'

export default function ProjectsPage() {
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <ItemListView
        type="project"
        title="Projects"
        emptyTitle="No projects yet"
        emptyDescription="Create your first project to start tracking progress."
        newItemLabel="New project"
        onNew={() => setShowNew(true)}
        basePath="/projects"
      />
      <NewItemDialog
        open={showNew}
        onOpenChange={setShowNew}
        defaultType="project"
        onCreated={(id) => { setShowNew(false); navigate(`/projects/${id}`) }}
      />
    </>
  )
}
