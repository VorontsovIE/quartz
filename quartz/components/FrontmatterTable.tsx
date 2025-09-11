// Generated in https://chatgpt.com/share/68c33024-12f8-8001-8de4-dbe5f32d344c
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/frontmatterTable.scss"

interface FieldDef { key: string; label?: string; render?: (v: unknown) => string }
interface Options {
  title?: string
  fields: Array<string | FieldDef>
  hideEmpty?: boolean
}

const defaults: Options = { title: "Meta", fields: [], hideEmpty: true }

export default ((userOpts?: Partial<Options>) => {
  const opts: Options = { ...defaults, ...userOpts }

  function FrontmatterTable({ fileData }: QuartzComponentProps) {
    const fm: Record<string, any> = fileData.frontmatter ?? {}
    const get = (path: string) =>
      path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), fm)

    const rows = opts.fields.map((f, i) => {
      const key   = (typeof f === "string") ? f : f.key
      const label = (typeof f === "string") ? f : (f.label ?? key)
      const raw = get(key)

      const empty = (raw == null) || (raw === "") || (Array.isArray(raw) && raw.length === 0)
      if (empty && opts.hideEmpty) return null

      const val =
        ((typeof f !== "string") && f.render)
          ? f.render(raw)
          : (Array.isArray(raw) ? raw.join(", ") : String(raw))

      return (
        <tr key={i}>
          <th>{label}</th>
          <td>{val}</td>
        </tr>
      )
    }).filter(Boolean)

    if (rows.length === 0) return null

    return (
      <section class="frontmatter-fields">
        {opts.title && <h3>{opts.title}</h3>}
        <table><tbody>{rows}</tbody></table>
      </section>
    )
  }

  FrontmatterTable.css = style

  return FrontmatterTable
}) satisfies QuartzComponentConstructor
