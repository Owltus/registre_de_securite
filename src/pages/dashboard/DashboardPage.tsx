import { useState, useEffect, useMemo, Fragment } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import * as Dialog from "@radix-ui/react-dialog"
import { Pencil, BookOpen, FileText, ClipboardList, PenLine, X, Plus, Printer, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DEFAULT_REGISTRY_NAME, getChapterIcon, buildEstablishment, type ChapterRow, type ClasseurRow } from "@/lib/navigation"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import { sqliteAdapter } from "@/lib/db/sqlite"
import { emit, on, CHAPTERS_CHANGED, CLASSEURS_CHANGED } from "@/lib/events"
import { IconPicker } from "@/components/IconPicker"
import { PrintPreview } from "@/components/print/PrintPreview"
import { ClasseurCoverPage } from "@/components/print/ClasseurCoverPage"
import { TableOfContentsPage } from "@/components/print/TableOfContentsPage"
import { CoverPage } from "@/components/print/CoverPage"
import { DocumentPages } from "@/components/print/DocumentPages"
import { TrackingSheetPage } from "@/components/print/TrackingSheetPage"
import { SignatureSheetPage } from "@/components/print/SignatureSheetPage"
import type { Doc, TrackingSheet, SignatureSheet, Periodicite } from "@/pages/chapter/types"

interface CountRow {
  count: number
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { classeurId } = useParams<{ classeurId: string }>()

  // Charger le classeur
  const classeurFilters = useMemo(() => ({ id: Number(classeurId) }), [classeurId])
  const { data: classeurRows, refetch: refetchClasseur } = useQuery<ClasseurRow>("classeurs", classeurFilters)
  const classeur = classeurRows[0] ?? null
  const classeurName = classeur?.name ?? DEFAULT_REGISTRY_NAME
  const establishment = buildEstablishment(classeur)

  useEffect(() => on(CLASSEURS_CHANGED, refetchClasseur), [refetchClasseur])

  const [editOpen, setEditOpen] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [editIcon, setEditIcon] = useState("BookOpen")
  const [editEtablissement, setEditEtablissement] = useState("")
  const [editComplement, setEditComplement] = useState("")

  // Chapitres filtrés par classeur
  const chapterFilters = useMemo(() => ({ classeur_id: Number(classeurId) }), [classeurId])
  const { data: chapters, refetch: refetchChapters } = useQuery<ChapterRow>("chapters", chapterFilters)
  const { insert } = useMutation("chapters")
  useEffect(() => on(CHAPTERS_CHANGED, refetchChapters), [refetchChapters])

  // Dialog de création de chapitre
  const [createOpen, setCreateOpen] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newIcon, setNewIcon] = useState("FileText")
  const [newDescription, setNewDescription] = useState("")

  const handleCreate = async () => {
    const label = newLabel.trim()
    if (!label) return
    const nextOrder = chapters.length > 0
      ? Math.max(...chapters.map((c) => c.sort_order)) + 1
      : 1
    const newId = await insert({
      label,
      icon: newIcon,
      description: newDescription.trim(),
      sort_order: nextOrder,
      classeur_id: Number(classeurId),
    })
    emit(CHAPTERS_CHANGED)
    refetchChapters()
    setCreateOpen(false)
    setNewLabel("")
    setNewIcon("FileText")
    setNewDescription("")
    navigate(`/classeurs/${classeurId}/chapitres/${newId}`)
  }

  const sortedChapters = [...chapters].sort((a, b) => a.sort_order - b.sort_order)

  // Compteurs filtrés par classeur
  const [docCount, setDocCount] = useState(0)
  const [trackingCount, setTrackingCount] = useState(0)
  const [signatureCount, setSignatureCount] = useState(0)

  useEffect(() => {
    const fetchCounts = async () => {
      const subquery = "SELECT id FROM chapters WHERE classeur_id = $1"
      const [docs] = await sqliteAdapter.query<CountRow>(
        `SELECT COUNT(*) as count FROM documents WHERE chapter_id IN (${subquery})`,
        [Number(classeurId)]
      )
      const [sheets] = await sqliteAdapter.query<CountRow>(
        `SELECT COUNT(*) as count FROM tracking_sheets WHERE chapter_id IN (${subquery})`,
        [Number(classeurId)]
      )
      const [sigs] = await sqliteAdapter.query<CountRow>(
        `SELECT COUNT(*) as count FROM signature_sheets WHERE chapter_id IN (${subquery})`,
        [Number(classeurId)]
      )
      setDocCount(docs?.count ?? 0)
      setTrackingCount(sheets?.count ?? 0)
      setSignatureCount(sigs?.count ?? 0)
    }
    fetchCounts()
  }, [chapters, classeurId])

  // Données pour l'impression globale
  const [printOpen, setPrintOpen] = useState(false)
  const [allDocs, setAllDocs] = useState<Doc[]>([])
  const [allTrackingSheets, setAllTrackingSheets] = useState<TrackingSheet[]>([])
  const [allSignatureSheets, setAllSignatureSheets] = useState<SignatureSheet[]>([])
  const [periodicites, setPeriodicites] = useState<Periodicite[]>([])

  const handlePrintAll = async () => {
    const subquery = "SELECT id FROM chapters WHERE classeur_id = $1"
    const [docs, sheets, sigs, perios] = await Promise.all([
      sqliteAdapter.query<Doc>(`SELECT * FROM documents WHERE chapter_id IN (${subquery}) ORDER BY sort_order`, [Number(classeurId)]),
      sqliteAdapter.query<TrackingSheet>(`SELECT * FROM tracking_sheets WHERE chapter_id IN (${subquery}) ORDER BY sort_order`, [Number(classeurId)]),
      sqliteAdapter.query<SignatureSheet>(`SELECT * FROM signature_sheets WHERE chapter_id IN (${subquery}) ORDER BY sort_order`, [Number(classeurId)]),
      sqliteAdapter.query<Periodicite>("SELECT * FROM periodicites"),
    ])
    setAllDocs(docs)
    setAllTrackingSheets(sheets)
    setAllSignatureSheets(sigs)
    setPeriodicites(perios)
    setPrintOpen(true)
  }

  const [tocOpen, setTocOpen] = useState(false)

  const handlePrintToc = async () => {
    const subquery = "SELECT id FROM chapters WHERE classeur_id = $1"
    const [docs, sheets, sigs] = await Promise.all([
      sqliteAdapter.query<Doc>(`SELECT * FROM documents WHERE chapter_id IN (${subquery}) ORDER BY sort_order`, [Number(classeurId)]),
      sqliteAdapter.query<TrackingSheet>(`SELECT * FROM tracking_sheets WHERE chapter_id IN (${subquery}) ORDER BY sort_order`, [Number(classeurId)]),
      sqliteAdapter.query<SignatureSheet>(`SELECT * FROM signature_sheets WHERE chapter_id IN (${subquery}) ORDER BY sort_order`, [Number(classeurId)]),
    ])
    setAllDocs(docs)
    setAllTrackingSheets(sheets)
    setAllSignatureSheets(sigs)
    setTocOpen(true)
  }

  const openEditDialog = () => {
    setEditValue(classeurName)
    setEditIcon(classeur?.icon ?? "BookOpen")
    setEditEtablissement(classeur?.etablissement ?? "")
    setEditComplement(classeur?.etablissement_complement ?? "")
    setEditOpen(true)
  }

  const saveEdit = async () => {
    const trimmed = editValue.trim()
    if (!trimmed || !classeurId) { setEditOpen(false); return }
    await sqliteAdapter.update("classeurs", classeurId, {
      name: trimmed,
      icon: editIcon,
      etablissement: editEtablissement.trim(),
      etablissement_complement: editComplement.trim(),
    })
    emit(CLASSEURS_CHANGED)
    refetchClasseur()
    setEditOpen(false)
  }

  const stats = [
    { label: "Chapitres", value: chapters.length, icon: BookOpen },
    { label: "Documents", value: docCount, icon: FileText },
    { label: "Fiches de suivi", value: trackingCount, icon: ClipboardList },
    { label: "Fiches de signature", value: signatureCount, icon: PenLine },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <div className="flex-1" />

        <Button variant="outline" size="icon" className="h-9 w-9" onClick={handlePrintToc} aria-label="Imprimer le sommaire" title="Imprimer le sommaire">
          <List className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={handlePrintAll} aria-label="Tout imprimer" title="Tout imprimer">
          <Printer className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={openEditDialog} aria-label="Modifier le classeur" title="Modifier le classeur">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCreateOpen(true)} aria-label="Nouveau chapitre" title="Nouveau chapitre">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto p-6">
       <div className="mx-auto max-w-3xl">

      {/* Grille de statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="rounded-lg border bg-card p-4 flex flex-col items-center gap-2"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          )
        })}
      </div>

      {/* Liste des chapitres */}
      <h2 className="text-lg font-semibold mb-4">Chapitres</h2>
      {sortedChapters.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun chapitre pour l'instant. Créez-en un depuis la sidebar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedChapters.map((ch) => {
            const Icon = getChapterIcon(ch.icon)
            return (
              <Link
                key={ch.id}
                to={`/classeurs/${classeurId}/chapitres/${ch.id}`}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-accent transition-colors"
              >
                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">{ch.label}</span>
              </Link>
            )
          })}
        </div>
      )}

       </div>
      </div>

      {/* Aperçu avant impression — tout le classeur */}
      <PrintPreview open={printOpen} onOpenChange={setPrintOpen}>
        <ClasseurCoverPage classeurName={classeurName} />
        <TableOfContentsPage
          classeurName={classeurName}
          chapters={sortedChapters.map((ch, i) => {
            const chDocs = allDocs.filter((d) => String(d.chapter_id) === String(ch.id))
            const chSheets = allTrackingSheets.filter((s) => String(s.chapter_id) === String(ch.id))
            const chSigs = allSignatureSheets.filter((s) => String(s.chapter_id) === String(ch.id))
            return {
              number: i + 1,
              label: ch.label,
              icon: ch.icon,
              items: [
                ...chDocs.map((d) => d.title || "Sans titre"),
                ...chSheets.map((s) => s.title || "Sans titre"),
                ...chSigs.map((s) => s.title || "Sans titre"),
              ],
            }
          })}
        />
        {sortedChapters.map((ch) => {
          const chDocs = allDocs.filter((d) => String(d.chapter_id) === String(ch.id))
          const chSheets = allTrackingSheets.filter((s) => String(s.chapter_id) === String(ch.id))
          const chSigs = allSignatureSheets.filter((s) => String(s.chapter_id) === String(ch.id))

          if (chDocs.length === 0 && chSheets.length === 0 && chSigs.length === 0) return null

          return (
            <Fragment key={ch.id}>
              <CoverPage chapterLabel={ch.label} chapterDescription={ch.description} classeurName={classeurName} />
              {chDocs.map((doc) => (
                <DocumentPages
                  key={`doc-${doc.id}`}
                  title={doc.title || "Sans titre"}
                  content={doc.content}
                  chapterName={ch.label}
                  classeurName={classeurName}
                  establishment={establishment}
                />
              ))}
              {chSheets.map((sheet) => {
                const perio = periodicites.find((p) => p.id === sheet.periodicite_id)
                return (
                  <TrackingSheetPage
                    key={`sheet-${sheet.id}`}
                    title={sheet.title || "Sans titre"}
                    periodiciteLabel={perio?.label ?? ""}
                    nombre={perio?.nombre ?? 8}
                    chapterName={ch.label}
                    classeurName={classeurName}
                    establishment={establishment}
                  />
                )
              })}
              {chSigs.map((sig) => (
                <SignatureSheetPage
                  key={`sig-${sig.id}`}
                  title={sig.title || "Sans titre"}
                  nombre={sig.nombre}
                  chapterName={ch.label}
                  classeurName={classeurName}
                  establishment={establishment}
                />
              ))}
            </Fragment>
          )
        })}
      </PrintPreview>

      {/* Aperçu sommaire seul */}
      <PrintPreview open={tocOpen} onOpenChange={setTocOpen}>
        <TableOfContentsPage
          classeurName={classeurName}
          chapters={sortedChapters.map((ch, i) => {
            const chDocs = allDocs.filter((d) => String(d.chapter_id) === String(ch.id))
            const chSheets = allTrackingSheets.filter((s) => String(s.chapter_id) === String(ch.id))
            const chSigs = allSignatureSheets.filter((s) => String(s.chapter_id) === String(ch.id))
            return {
              number: i + 1,
              label: ch.label,
              icon: ch.icon,
              items: [
                ...chDocs.map((d) => d.title || "Sans titre"),
                ...chSheets.map((s) => s.title || "Sans titre"),
                ...chSigs.map((s) => s.title || "Sans titre"),
              ],
            }
          })}
        />
      </PrintPreview>

      {/* Dialog de création de chapitre */}
      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none max-h-[85vh]">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <Dialog.Title className="text-lg font-semibold">
                Nouveau chapitre
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Fermer</span>
              </Dialog.Close>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); handleCreate() }}
              className="px-6 py-4 flex flex-col gap-4 overflow-y-auto"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="chapter-label" className="text-sm font-medium">Nom</label>
                <Input
                  id="chapter-label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Nom du chapitre"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Icône</label>
                <IconPicker value={newIcon} onChange={setNewIcon} />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="chapter-desc" className="text-sm font-medium">Description</label>
                <Input
                  id="chapter-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description (optionnel)"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">Annuler</Button>
                </Dialog.Close>
                <Button type="submit" disabled={!newLabel.trim()}>Créer</Button>
              </div>
            </form>

            <Dialog.Description className="sr-only">
              Saisir les informations du nouveau chapitre
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Dialog de modification du nom */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg border bg-background shadow-lg rounded-lg flex flex-col overflow-hidden focus:outline-none max-h-[85vh]">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <Dialog.Title className="text-lg font-semibold">
                Modifier le classeur
              </Dialog.Title>
              <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Fermer</span>
              </Dialog.Close>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); saveEdit() }}
              className="px-6 py-4 flex flex-col gap-4 overflow-y-auto"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="registry-name" className="text-sm font-medium">
                  Nom
                </label>
                <Input
                  id="registry-name"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Nom du classeur"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Icône</label>
                <IconPicker value={editIcon} onChange={setEditIcon} />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="edit-etablissement" className="text-sm font-medium">
                  Établissement
                </label>
                <Input
                  id="edit-etablissement"
                  value={editEtablissement}
                  onChange={(e) => setEditEtablissement(e.target.value)}
                  placeholder="Nom de l'établissement"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="edit-complement" className="text-sm font-medium">
                  Complément
                </label>
                <Input
                  id="edit-complement"
                  value={editComplement}
                  onChange={(e) => setEditComplement(e.target.value)}
                  placeholder="Précision (optionnel)"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">Annuler</Button>
                </Dialog.Close>
                <Button type="submit" disabled={!editValue.trim()}>Enregistrer</Button>
              </div>
            </form>

            <Dialog.Description className="sr-only">
              Modifier les informations du classeur
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
