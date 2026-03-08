/**
 * Mini event bus pour la communication entre composants non-liés
 * (ex: une page notifie la sidebar qu'un chapitre a été modifié/supprimé).
 */

type Listener = () => void

const listeners: Record<string, Set<Listener>> = {}

export function on(event: string, fn: Listener) {
  if (!listeners[event]) listeners[event] = new Set()
  listeners[event].add(fn)
  return () => { listeners[event].delete(fn) }
}

export function emit(event: string) {
  listeners[event]?.forEach((fn) => fn())
}

/** Événement déclenché quand la liste des chapitres change */
export const CHAPTERS_CHANGED = "chapters:changed"

/** Événement déclenché quand la liste/données des classeurs change */
export const CLASSEURS_CHANGED = "classeurs:changed"
