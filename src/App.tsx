import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ErrorBoundary } from "@/components/fallback/ErrorBoundary"
import LoadingSpinner from "@/components/fallback/LoadingSpinner"
import { RootLayout } from "@/layouts/RootLayout"

const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"))
const ChapterPage = lazy(() => import("@/pages/chapter/ChapterPage"))
const DocumentDetail = lazy(() => import("@/pages/documents/DocumentDetail"))
const TrackingSheetDetail = lazy(() => import("@/pages/documents/TrackingSheetDetail"))
const SignatureSheetDetail = lazy(() => import("@/pages/documents/SignatureSheetDetail"))
const NotFound = lazy(() => import("@/components/fallback/NotFound"))

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route element={<RootLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="chapitres/:chapterId" element={<ChapterPage />} />
                <Route path="chapitres/:chapterId/documents/:id" element={<DocumentDetail />} />
                <Route path="chapitres/:chapterId/sheets/:id" element={<TrackingSheetDetail />} />
                <Route path="chapitres/:chapterId/signatures/:id" element={<SignatureSheetDetail />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  )
}

export default App
