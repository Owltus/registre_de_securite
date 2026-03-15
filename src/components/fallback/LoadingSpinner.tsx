export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Chargement">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  )
}
