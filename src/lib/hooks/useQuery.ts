import { useEffect, useState, useCallback, useRef } from "react"
import { sqliteAdapter } from "@/lib/db/sqlite"

interface UseQueryResult<T> {
  data: T[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useQuery<T = unknown>(
  table: string,
  filters?: Record<string, unknown>
): UseQueryResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const hasFetched = useRef(false)

  // Stabiliser les dépendances : JSON.stringify évite les re-renders
  // causés par un objet filters recréé à chaque render
  const filtersKey = JSON.stringify(filters)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const fetch = useCallback(() => {
    // Ne montrer le loading que lors du chargement initial,
    // pas lors des refetch (pour éviter de détruire le DOM et le scroll)
    if (!hasFetched.current) {
      setLoading(true)
    }
    sqliteAdapter
      .getAll(table, filtersRef.current)
      .then((rows) => {
        setData(rows as T[])
        setError(null)
        hasFetched.current = true
      })
      .catch(setError)
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filtersKey])

  // Reset hasFetched quand la table ou les filtres changent (vraie navigation)
  useEffect(() => {
    hasFetched.current = false
  }, [table, filtersKey])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
