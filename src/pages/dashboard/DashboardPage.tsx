import { useState, useEffect, useMemo, Fragment } from "react"
import { useNavigate, useParams } from "react-router-dom"
import * as Dialog from "@radix-ui/react-dialog"
import { Pencil, X, Plus, Printer, List, FileArchive, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DEFAULT_REGISTRY_NAME, buildEstablishment, type ChapterRow, type ClasseurRow } from "@/lib/navigation"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import { sqliteAdapter } from "@/lib/db/sqlite"
import { emit, on, CHAPTERS_CHANGED, CLASSEURS_CHANGED } from "@/lib/events"
import { IconPicker } from "@/components/IconPicker"
import { exportClasseurZip, type ExportChapter, exportDatabase } from "@/lib/exportMarkdown"
import { PrintPreview } from "@/components/print/PrintPreview"
import { ClasseurCoverPage } from "@/components/print/ClasseurCoverPage"
import { TableOfContentsPage } from "@/components/print/TableOfContentsPage"
import { CoverPage } from "@/components/print/CoverPage"
import { DocumentPages } from "@/components/print/DocumentPages"
import { TrackingSheetPage } from "@/components/print/TrackingSheetPage"
import { SignatureSheetPage } from "@/components/print/SignatureSheetPage"
import { IntercalaireSheet } from "@/components/print/IntercalaireSheet"
import type { Doc, TrackingSheet, SignatureSheet, Intercalaire, Periodicite } from "@/pages/chapter/types"

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

  // Données pour le sommaire et l'impression
  const [printOpen, setPrintOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [allDocs, setAllDocs] = useState<Doc[]>([])
  const [allTrackingSheets, setAllTrackingSheets] = useState<TrackingSheet[]>([])
  const [allSignatureSheets, setAllSignatureSheets] = useState<SignatureSheet[]>([])
  const [allIntercalaires, setAllIntercalaires] = useState<Intercalaire[]>([])
  const [periodicites, setPeriodicites] = useState<Periodicite[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // Clé stable dérivée des IDs de chapitres (évite les re-fires sur changement de référence)
  const chapterIdsKey = sortedChapters.map((c) => c.id).join(",")

  // Charger les contenus au montage pour le sommaire et les exports
  // 5 requêtes simples (une par table) puis filtrage JS côté client
  useEffect(() => {
    if (sortedChapters.length === 0) {
      setDataLoaded(true)
      return
    }
    setDataLoaded(false)

    const chapterIds = new Set(sortedChapters.map((c) => String(c.id)))

    Promise.all([
      sqliteAdapter.getAll("documents"),
      sqliteAdapter.getAll("tracking_sheets"),
      sqliteAdapter.getAll("signature_sheets"),
      sqliteAdapter.getAll("intercalaires"),
      sqliteAdapter.getAll("periodicites"),
    ]).then(([docs, sheets, sigs, gardes, perios]) => {
      setAllDocs((docs as Doc[]).filter((d) => chapterIds.has(String(d.chapter_id))))
      setAllTrackingSheets((sheets as TrackingSheet[]).filter((s) => chapterIds.has(String(s.chapter_id))))
      setAllSignatureSheets((sigs as SignatureSheet[]).filter((s) => chapterIds.has(String(s.chapter_id))))
      setAllIntercalaires((gardes as Intercalaire[]).filter((g) => chapterIds.has(String(g.chapter_id))))
      setPeriodicites(perios as Periodicite[])
      setDataLoaded(true)
    }).catch((err) => {
      console.error("[DashboardPage] Erreur chargement données export :", err)
      setDataLoaded(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIdsKey])

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

  // Construire les entrées du sommaire
  const tocEntries = sortedChapters.map((ch, i) => {
    const chDocs = allDocs.filter((d) => String(d.chapter_id) === String(ch.id))
    const chSheets = allTrackingSheets.filter((s) => String(s.chapter_id) === String(ch.id))
    const chSigs = allSignatureSheets.filter((s) => String(s.chapter_id) === String(ch.id))
    const chGardes = allIntercalaires.filter((g) => String(g.chapter_id) === String(ch.id))
    return {
      chapter: ch,
      number: i + 1,
      items: [
        ...chDocs.map((d) => d.title || "Sans titre"),
        ...chSheets.map((s) => s.title || "Sans titre"),
        ...chSigs.map((s) => s.title || "Sans titre"),
        ...chGardes.map((g) => g.title || "Sans titre"),
      ],
    }
  })

  return (
    <div className="flex flex-col h-full">
      {/* Corps */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        <div className="flex flex-col gap-6 max-w-md w-full">
          {/* Actions */}
          <div className="flex flex-col gap-3">
          <button
            onClick={openEditDialog}
            className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left"
          >
            <Pencil className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Paramètres du classeur</span>
              <span className="text-xs text-muted-foreground">Modifier le nom, l'icône et les informations de l'établissement</span>
            </div>
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left"
          >
            <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Ajouter un chapitre</span>
              <span className="text-xs text-muted-foreground">Créer un nouveau chapitre dans ce classeur</span>
            </div>
          </button>
          <button
            onClick={() => setTocOpen(true)}
            disabled={!dataLoaded}
            className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
          >
            <List className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Afficher le sommaire</span>
              <span className="text-xs text-muted-foreground">Générer un PDF avec la table des matières du classeur</span>
            </div>
          </button>
          <button
            onClick={() => setPrintOpen(true)}
            disabled={!dataLoaded}
            className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
          >
            <Printer className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Exporter le classeur en PDF</span>
              <span className="text-xs text-muted-foreground">Générer un PDF avec l'ensemble des chapitres et documents</span>
            </div>
          </button>
          <button
            disabled={!dataLoaded}
            onClick={() => {
              const data: ExportChapter[] = sortedChapters.map((ch, i) => ({
                label: ch.label,
                sortOrder: i + 1,
                documents: allDocs
                  .filter((d) => String(d.chapter_id) === String(ch.id))
                  .map((d) => ({ title: d.title, content: d.content })),
              }))
              exportClasseurZip(classeurName, data)
            }}
            className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
          >
            <FileArchive className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Exporter le classeur en Markdown</span>
              <span className="text-xs text-muted-foreground">Créer une archive contenant tous les documents</span>
            </div>
          </button>
          <button
            onClick={() => exportDatabase(classeurName, Number(classeurId))}
            className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left"
          >
            <Database className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Exporter le classeur en base de données</span>
              <span className="text-xs text-muted-foreground">Sauvegarder les données du classeur dans un fichier SQLite</span>
            </div>
          </button>
          </div>
        </div>
      </div>

      {/* Aperçu avant impression — tout le classeur */}
      <PrintPreview open={printOpen} onOpenChange={setPrintOpen}>
        <ClasseurCoverPage
          classeurName={classeurName}
          classeurIcon={classeur?.icon}
          etablissement={classeur?.etablissement}
          etablissementComplement={classeur?.etablissement_complement}
        />
        <TableOfContentsPage
          classeurName={classeurName}
          chapters={tocEntries.map((e) => ({ number: e.number, label: e.chapter.label, icon: e.chapter.icon, items: e.items }))}
        />
        {sortedChapters.map((ch) => {
          const chDocs = allDocs.filter((d) => String(d.chapter_id) === String(ch.id))
          const chSheets = allTrackingSheets.filter((s) => String(s.chapter_id) === String(ch.id))
          const chSigs = allSignatureSheets.filter((s) => String(s.chapter_id) === String(ch.id))
          const chGardes = allIntercalaires.filter((g) => String(g.chapter_id) === String(ch.id))

          if (chDocs.length === 0 && chSheets.length === 0 && chSigs.length === 0 && chGardes.length === 0) return null

          return (
            <Fragment key={ch.id}>
              <CoverPage chapterLabel={ch.label} chapterDescription={ch.description} chapterIcon={ch.icon} classeurName={classeurName} />
              {chDocs.map((doc) => (
                <DocumentPages
                  key={`doc-${doc.id}`}
                  title={doc.title || "Sans titre"}
                  subtitle={doc.description ?? ""}
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
                  subtitle={sig.description ?? ""}
                  nombre={sig.nombre}
                  chapterName={ch.label}
                  classeurName={classeurName}
                  establishment={establishment}
                />
              ))}
              {chGardes.map((gp) => (
                <IntercalaireSheet
                  key={`gp-${gp.id}`}
                  title={gp.title || "Sans titre"}
                  description={gp.description}
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
          chapters={tocEntries.map((e) => ({ number: e.number, label: e.chapter.label, icon: e.chapter.icon, items: e.items }))}
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
