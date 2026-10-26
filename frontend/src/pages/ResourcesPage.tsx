import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ItemListView } from '@/components/items/ItemListView'
import { NewItemDialog } from '@/components/items/NewItemDialog'

export default function ResourcesPage() {
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <ItemListView
        type="resource"
        title="Resources"
        emptyTitle="No resources yet"
        emptyDescription="Add your first resource to start collecting reference material."
        newItemLabel="New resource"
        onNew={() => setShowNew(true)}
        basePath="/resources"
      />
      <NewItemDialog
        open={showNew}
        onOpenChange={setShowNew}
        defaultType="resource"
        onCreated={(id) => { setShowNew(false); navigate(`/resources/${id}`) }}
      />
    </>
  )
}
