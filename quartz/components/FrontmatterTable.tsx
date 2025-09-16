// Generated in https://chatgpt.com/share/68c33024-12f8-8001-8de4-dbe5f32d344c
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/frontmatterTable.scss"

interface FieldDef {
  key: string
  label?: string
  isUrl?: boolean
  render?: (v: unknown, ctx: QuartzComponentProps)
    => string | JSX.Element   // ← позволяем возвращать JSX
}
interface Options {
  title?: string
  fields: Array<string | FieldDef>
  hideEmpty?: boolean
  baseUrl?: string
}

export default ((userOpts?: Partial<Options>) => {
  const opts: Options = { title: "Meta", fields: [], hideEmpty: true, ...userOpts }

  function FrontmatterTable(props: QuartzComponentProps) {
    const { fileData, cfg: {baseUrl} } = props
    const fm: Record<string, any> = fileData.frontmatter ?? {}
    const get = (path: string) =>
      path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), fm)

    const rows = opts.fields.map((f, i) => {
      const key   = (typeof f === "string") ? f : f.key
      const label = (typeof f === "string") ? f : (f.label ?? key)
      const raw   = get(key)
      const empty = (raw == null) || (raw === "") || (Array.isArray(raw) && raw.length === 0)
      if (empty && opts.hideEmpty) return null

      // someRenderer — is a more universal way that uses quartz config. But we don't need it now
      // const someRenderer = (url, { cfg }) => <a href={new URL(url, `https://${cfg.baseUrl}`)}>{url}</a>
      const linkByUrl = (url) => <a href={new URL(url, `https://${baseUrl}`)}>{url}</a>
      const val = (()=>{
        if ((typeof f !== "string") && f.render) {
          return f.render(raw, props)  // passes context (cfg, fileData, displayClass, …)
        } else if (Array.isArray(raw)) {
            // return raw.map((val) => someRenderer(val, props)).join(", ")
            return raw.map((val) => f.isUrl ? linkByUrl(val) : val).join(", ")
        } else {
          // return someRenderer(raw, props)
          return f.isUrl ? linkByUrl(raw) : raw
        }
      })()

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
