import { A4Page } from "./A4Page"

interface TrackingSheetPageProps {
  title: string
  periodiciteLabel: string
  nombre: number
  chapterName?: string
  classeurName?: string
  establishment?: string
  themed?: boolean
}

/**
 * Feuille de suivi — toujours 1 seule page A4.
 * Contient un sous-titre (périodicité) et un tableau Date | Note | Signature.
 */
export function TrackingSheetPage({
  title,
  periodiciteLabel,
  nombre,
  chapterName,
  classeurName,
  establishment,
  themed,
}: TrackingSheetPageProps) {
  const rows = Array.from({ length: nombre }, (_, i) => i)

  return (
    <A4Page
      title={title}
      subtitle={periodiciteLabel}
      chapterName={chapterName}
      classeurName={classeurName}
      establishment={establishment}
      themed={themed}
    >
      <table className="tracking-table">
        <colgroup>
          <col style={{ width: "20%" }} />
          <col style={{ width: "55%" }} />
          <col style={{ width: "25%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Date</th>
            <th>Note</th>
            <th>Signature</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i}>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </A4Page>
  )
}
