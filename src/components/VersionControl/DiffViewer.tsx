
import { Alert } from '@mui/material'

interface DiffViewerProps {
  objectId: string
  baseVersionId: string
  compareVersionId: string
  onClose: () => void
}

export function DiffViewer(_props: DiffViewerProps) {
  return (
    <Alert severity="info">Version comparison is not available in this build.</Alert>
  )
}

export default DiffViewer;
