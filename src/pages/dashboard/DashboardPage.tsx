import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Plus, Printer, List, Archive, Pencil, FileUp, FileDown, Search, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { DEFAULT_REGISTRY_NAME, buildEstablishment, type ChapterRow, type ClasseurRow } from "@/lib/navigation"
import { useQuery } from "@/lib/hooks/useQuery"
import { useMutation } from "@/lib/hooks/useMutation"
import { sqliteAdapter } from "@/lib/db/sqlite"
import { emit, on, CHAPTERS_CHANGED, CLASSEURS_CHANGED } from "@/lib/events"
import { IconPicker } from "@/components/IconPicker"
import { exportClasseurZip, type ExportChapter, exportClasseurJson, selectJsonFile, previewMergeJson, previewMergeJsonFromContent, importClasseurJson, importClasseurJsonFromContent, type MergePreview } from "@/lib/exportMarkdown"
import { MergePreviewDialog } from "@/features/merge/MergePreviewDialog"
import { PrintPreview } from "@/components/print/PrintPreview"
import { ClasseurCoverPage } from "@/components/print/ClasseurCoverPage"
import { TableOfContentsPage } from "@/components/print/TableOfContentsPage"
import { CoverPage } from "@/components/print/CoverPage"
import { DocumentPages } from "@/components/print/DocumentPages"
import { TrackingSheetPage } from "@/components/print/TrackingSheetPage"
import { SignatureSheetPage } from "@/components/print/SignatureSheetPage"
import { IntercalaireSheet } from "@/components/print/IntercalaireSheet"
import { DocumentCard } from "@/pages/chapter/DocumentCard"
import { TrackingSheetCard } from "@/pages/chapter/TrackingSheetCard"
import { SignatureSheetCard } from "@/pages/chapter/SignatureSheetCard"
import { IntercalaireCard } from "@/pages/chapter/IntercalaireCard"
import type { Doc, TrackingSheet, SignatureSheet, Intercalaire, Periodicite } from "@/pages/chapter/types"
import { stripAccents } from "@/lib/utils"

type SearchResult =
  | { kind: "document"; data: Doc; chapterId: string; chapterName: string }
  | { kind: "tracking_sheet"; data: TrackingSheet; chapterId: string; chapterName: string }
  | { kind: "signature_sheet"; data: SignatureSheet; chapterId: string; chapterName: string }
  | { kind: "intercalaire"; data: Intercalaire; chapterId: string; chapterName: string }

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
    try {
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
    } catch {
      toast.error("Erreur lors de la création du chapitre")
    }
  }

  const sortedChapters = useMemo(() => [...chapters].sort((a, b) => a.sort_order - b.sort_order), [chapters])

  // Recherche
  const [searchInput, setSearchInput] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(stripAccents(searchInput.trim())), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

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

  // Map chapterId → ChapterRow pour résoudre les noms
  const chapterMap = useMemo(() => {
    const m = new Map<string, ChapterRow>()
    for (const ch of sortedChapters) m.set(String(ch.id), ch)
    return m
  }, [sortedChapters])

  // Résultats de recherche
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!debouncedQuery || !dataLoaded) return []
    const q = debouncedQuery
    const n = stripAccents // raccourci pour normaliser les champs
    const results: SearchResult[] = []

    for (const doc of allDocs) {
      if (
        n(doc.title ?? "").includes(q) ||
        n(doc.description ?? "").includes(q) ||
        n(doc.content ?? "").includes(q)
      ) {
        const ch = chapterMap.get(String(doc.chapter_id))
        results.push({ kind: "document", data: doc, chapterId: String(doc.chapter_id), chapterName: ch?.label ?? "" })
      }
    }
    for (const s of allTrackingSheets) {
      if (n(s.title ?? "").includes(q)) {
        const ch = chapterMap.get(String(s.chapter_id))
        results.push({ kind: "tracking_sheet", data: s, chapterId: String(s.chapter_id), chapterName: ch?.label ?? "" })
      }
    }
    for (const s of allSignatureSheets) {
      if (
        n(s.title ?? "").includes(q) ||
        n(s.description ?? "").includes(q)
      ) {
        const ch = chapterMap.get(String(s.chapter_id))
        results.push({ kind: "signature_sheet", data: s, chapterId: String(s.chapter_id), chapterName: ch?.label ?? "" })
      }
    }
    for (const g of allIntercalaires) {
      if (
        n(g.title ?? "").includes(q) ||
        n(g.description ?? "").includes(q)
      ) {
        const ch = chapterMap.get(String(g.chapter_id))
        results.push({ kind: "intercalaire", data: g, chapterId: String(g.chapter_id), chapterName: ch?.label ?? "" })
      }
    }
    return results
  }, [debouncedQuery, dataLoaded, allDocs, allTrackingSheets, allSignatureSheets, allIntercalaires, chapterMap])

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
    try {
      await sqliteAdapter.update("classeurs", classeurId, {
        name: trimmed,
        icon: editIcon,
        etablissement: editEtablissement.trim(),
        etablissement_complement: editComplement.trim(),
      })
      emit(CLASSEURS_CHANGED)
      refetchClasseur()
      setEditOpen(false)
      toast.success("Classeur modifié")
    } catch {
      toast.error("Erreur lors de la modification du classeur")
    }
  }

  // Construire les entrées du sommaire
  const tocEntries = useMemo(() => sortedChapters.map((ch, i) => {
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
  }), [sortedChapters, allDocs, allTrackingSheets, allSignatureSheets, allIntercalaires])

  const handleExportMarkdown = async () => {
    if (busy) return
    setBusy("markdown")
    try {
      const data: ExportChapter[] = sortedChapters.map((ch, i) => ({
        label: ch.label,
        sortOrder: i + 1,
        documents: allDocs
          .filter((d) => String(d.chapter_id) === String(ch.id))
          .map((d) => ({ title: d.title, content: d.content })),
      }))
      const path = await exportClasseurZip(classeurName, data)
      if (path) toast.info("Export Markdown terminé")
    } catch {
      toast.error("Erreur lors de l'export Markdown")
    } finally {
      setBusy(null)
    }
  }

  const handleExportJson = async () => {
    if (busy) return
    setBusy("json")
    try {
      const path = await exportClasseurJson(classeurName, Number(classeurId))
      if (path) toast.info("Export JSON terminé")
    } catch {
      toast.error("Erreur lors de l'export JSON")
    } finally {
      setBusy(null)
    }
  }

  // État de chargement pour les boutons export/import
  const [busy, setBusy] = useState<"markdown" | "json" | "import" | null>(null)

  // Merge preview state
  const [mergePreviewOpen, setMergePreviewOpen] = useState(false)
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null)
  const [mergeFilePath, setMergeFilePath] = useState<string | null>(null)
  const [mergeLoading, setMergeLoading] = useState(false)

  // Drag-and-drop .json pour merge
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)
  const [droppedContent, setDroppedContent] = useState<string | null>(null)

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragOver(true)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragOver(false)
  }, [])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)

    const file = Array.from(e.dataTransfer.files).find((f) => f.name.endsWith(".json"))
    if (!file) return

    try {
      const text = await file.text()
      setDroppedContent(text)
      setMergeFilePath(null)
      setMergePreview(null)
      setMergePreviewOpen(true)

      const preview = await previewMergeJsonFromContent(Number(classeurId), text, true)
      setMergePreview(preview)
    } catch {
      toast.error("Erreur lors de la prévisualisation du fichier JSON déposé")
      setMergePreviewOpen(false)
    }
  }, [classeurId])

  const handleImportJson = async () => {
    if (busy) return
    setBusy("import")
    try {
      const path = await selectJsonFile()
      if (!path) { setBusy(null); return }

      setMergeFilePath(path)
      setMergePreview(null)
      setMergePreviewOpen(true)

      const preview = await previewMergeJson(Number(classeurId), path, true)
      setMergePreview(preview)
    } catch {
      toast.error("Erreur lors de la lecture du fichier JSON sélectionné")
      setMergePreviewOpen(false)
    } finally {
      setBusy(null)
    }
  }

  const handleConfirmMerge = async () => {
    if (!mergeFilePath && !droppedContent) return
    setMergeLoading(true)
    try {
      const result = mergeFilePath
        ? await importClasseurJson(Number(classeurId), mergeFilePath, true)
        : await importClasseurJsonFromContent(Number(classeurId), droppedContent!, true)
      const parts: string[] = []
      if (result.inserted > 0) parts.push(`${result.inserted} créé(s)`)
      if (result.updated > 0) parts.push(`${result.updated} mis à jour`)
      if (result.deleted > 0) parts.push(`${result.deleted} supprimé(s)`)
      if (result.unchanged > 0) parts.push(`${result.unchanged} inchangé(s)`)
      if (parts.length === 0) parts.push("aucun changement")
      const hasDeleted = result.deleted > 0
      ;(hasDeleted ? toast.warning : toast.success)(`Import terminé : ${parts.join(", ")}`)
      emit(CHAPTERS_CHANGED)
      emit(CLASSEURS_CHANGED)
      refetchChapters()
      setMergePreviewOpen(false)
      setDroppedContent(null)
    } catch {
      toast.error("Erreur lors de l'import JSON")
    } finally {
      setMergeLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <div className="relative flex-1 min-w-0 ml-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher dans le classeur..."
            className="pl-9 h-9"
            disabled={!dataLoaded}
            aria-label="Rechercher"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={openEditDialog} aria-label="Édition">
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Édition</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {debouncedQuery ? (
          <div className="flex flex-col gap-4 h-full">
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center text-muted-foreground">
                <Search className="h-10 w-10 mb-3 opacity-50" />
                <p className="font-medium">Aucun résultat</p>
                <p className="text-sm mt-1">Aucun élément ne correspond à votre recherche</p>
              </div>
            ) : (
              <>
              <p className="text-sm text-muted-foreground">
                {`${searchResults.length} résultat${searchResults.length > 1 ? "s" : ""}`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {searchResults.map((item) => {
                  const chId = item.chapterId
                  const perio = item.kind === "tracking_sheet"
                    ? periodicites.find((p) => p.id === item.data.periodicite_id)
                    : undefined
                  return (
                    <div key={`${item.kind}-${item.data.id}`} className="flex flex-col gap-1">
                      {item.kind === "document" && (
                        <DocumentCard
                          doc={item.data}
                          chapterId={chId}
                          classeurId={classeurId}
                          chapterName={item.chapterName}
                          classeurName={classeurName}
                          establishment={establishment}
                          sortableDisabled
                        />
                      )}
                      {item.kind === "tracking_sheet" && (
                        <TrackingSheetCard
                          sheet={item.data}
                          chapterId={chId}
                          classeurId={classeurId}
                          chapterName={item.chapterName}
                          classeurName={classeurName}
                          establishment={establishment}
                          periodicite={perio}
                          sortableDisabled
                        />
                      )}
                      {item.kind === "signature_sheet" && (
                        <SignatureSheetCard
                          sheet={item.data}
                          chapterId={chId}
                          classeurId={classeurId}
                          chapterName={item.chapterName}
                          classeurName={classeurName}
                          establishment={establishment}
                          sortableDisabled
                        />
                      )}
                      {item.kind === "intercalaire" && (
                        <IntercalaireCard
                          page={item.data}
                          chapterId={chId}
                          classeurId={classeurId}
                          chapterName={item.chapterName}
                          classeurName={classeurName}
                          establishment={establishment}
                          sortableDisabled
                        />
                      )}
                      <span className="text-xs text-muted-foreground truncate px-1">{item.chapterName}</span>
                    </div>
                  )
                })}
              </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col gap-4 max-w-md w-full">

              {/* Nouveau chapitre */}
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-4 rounded-lg border border-dashed bg-card px-5 py-4 hover:bg-accent transition-colors text-left"
              >
                <Plus className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Nouveau chapitre</span>
                  <span className="text-xs text-muted-foreground">Ajouter un chapitre au classeur</span>
                </div>
              </button>

              {/* Sommaire + PDF */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTocOpen(true)}
                  disabled={!dataLoaded}
                  className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left disabled:opacity-40 disabled:pointer-events-none"
                >
                  <List className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Sommaire</span>
                    <span className="text-xs text-muted-foreground">Table des matières</span>
                  </div>
                </button>
                <button
                  onClick={() => setPrintOpen(true)}
                  disabled={!dataLoaded}
                  className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Printer className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Exporter PDF</span>
                    <span className="text-xs text-muted-foreground">Classeur complet</span>
                  </div>
                </button>
              </div>


              <div className="border-b border-border" />
              <button
                disabled={!dataLoaded || busy !== null}
                onClick={handleExportMarkdown}
                className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left disabled:opacity-40 disabled:pointer-events-none"
              >
                {busy === "markdown" ? <Loader2 className="h-5 w-5 text-muted-foreground shrink-0 animate-spin" /> : <Archive className="h-5 w-5 text-muted-foreground shrink-0" />}
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{busy === "markdown" ? "Export en cours..." : "Exporter en Markdown"}</span>
                  <span className="text-xs text-muted-foreground">Archive ZIP contenant tous les documents</span>
                </div>
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={!dataLoaded || busy !== null}
                  onClick={handleExportJson}
                  className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 hover:bg-accent transition-colors text-left disabled:opacity-40 disabled:pointer-events-none"
                >
                  {busy === "json" ? <Loader2 className="h-5 w-5 text-muted-foreground shrink-0 animate-spin" /> : <FileUp className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{busy === "json" ? "Export en cours..." : "Exporter en JSON"}</span>
                    <span className="text-xs text-muted-foreground">Sauvegarde éditable du classeur</span>
                  </div>
                </button>
                <button
                  disabled={busy !== null}
                  onClick={handleImportJson}
                  onDragEnter={onDragEnter}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`flex items-center gap-4 rounded-lg border px-5 py-4 hover:bg-accent transition-colors text-left disabled:opacity-40 disabled:pointer-events-none ${isDragOver ? "border-primary bg-primary/5" : "bg-card"}`}
                >
                  {busy === "import" ? <Loader2 className="h-5 w-5 text-muted-foreground shrink-0 animate-spin" /> : isDragOver ? <Upload className="h-5 w-5 text-muted-foreground shrink-0" /> : <FileDown className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{busy === "import" ? "Import en cours..." : isDragOver ? "Déposez ici" : "Importer un JSON"}</span>
                    {!isDragOver && busy !== "import" && <span className="text-xs text-muted-foreground">Mettre à jour depuis un export</span>}
                  </div>
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Aperçu avant impression — tout le classeur */}
      <PrintPreview open={printOpen} onOpenChange={setPrintOpen} filename={classeurName}>
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
      <PrintPreview open={tocOpen} onOpenChange={setTocOpen} filename={`${classeurName} — Sommaire`}>
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

      {/* Dialog de prévisualisation du merge */}
      <MergePreviewDialog
        open={mergePreviewOpen}
        onOpenChange={setMergePreviewOpen}
        preview={mergePreview}
        loading={mergeLoading}
        onConfirm={handleConfirmMerge}
      />

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
