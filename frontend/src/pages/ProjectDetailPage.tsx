import { useParams } from 'react-router-dom'
import { ItemDetailView } from '@/components/items/ItemDetailView'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <ItemDetailView id={Number(id)} listPath="/projects" listLabel="Projects" />
}
