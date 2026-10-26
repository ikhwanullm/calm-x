import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ItemListView } from '@/components/items/ItemListView'
import { NewItemDialog } from '@/components/items/NewItemDialog'

export default function AreasPage() {
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <ItemListView
        type="area"
        title="Areas"
        emptyTitle="No areas yet"
        emptyDescription="Create your first area to organise responsibilities."
        newItemLabel="New area"
        onNew={() => setShowNew(true)}
        basePath="/areas"
      />
      <NewItemDialog
        open={showNew}
        onOpenChange={setShowNew}
        defaultType="area"
        onCreated={(id) => { setShowNew(false); navigate(`/areas/${id}`) }}
      />
    </>
  )
}
