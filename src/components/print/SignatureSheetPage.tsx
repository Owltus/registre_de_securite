import { A4Page } from "./A4Page"

interface SignatureSheetPageProps {
  title: string
  nombre: number
  chapterName?: string
  establishment?: string
  themed?: boolean
}

/**
 * Feuille de signature — toujours 1 seule page A4.
 * Contient un tableau Date | Nom/Prénom | Signature.
 */
export function SignatureSheetPage({
  title,
  nombre,
  chapterName,
  establishment,
  themed,
}: SignatureSheetPageProps) {
  const rows = Array.from({ length: nombre }, (_, i) => i)

  return (
    <A4Page
      title={title}
      chapterName={chapterName}
      establishment={establishment}
      themed={themed}
    >
      <table className="tracking-table">
        <colgroup>
          <col style={{ width: "20%" }} />
          <col style={{ width: "45%" }} />
          <col style={{ width: "35%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Date</th>
            <th>Nom / Prénom</th>
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
