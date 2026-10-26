import { useParams } from 'react-router-dom'
import { ItemDetailView } from '@/components/items/ItemDetailView'

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <ItemDetailView id={Number(id)} listPath="/resources" listLabel="Resources" />
}
