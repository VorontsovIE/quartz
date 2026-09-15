import { getDate } from "../../components/Date"
import { escapeHTML } from "../../util/escape"
import { FullSlug, joinSegments, simplifySlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

interface Options {
  indexNowKey: string
  authorDescription: string
}

const defaultOptions: Options = {
  indexNowKey: "b607e69e52de377e133de38253daab17",
  authorDescription:
    "Личный сайт Ильи Воронцова: биоинформатика, программирование, образование, бездомность, культура и личные заметки.",
}

const crawlerGroups = [
  "Googlebot",
  "Google-Extended",
  "bingbot",
  "YandexBot",
  "DuckDuckBot",
  "Baiduspider",
  "Applebot",
  "Applebot-Extended",
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "CCBot",
]

function robotsTxt(baseUrl: string): string {
  const explicitGroups = crawlerGroups
    .map((crawler) => `User-agent: ${crawler}\nAllow: /`)
    .join("\n\n")
  return `${explicitGroups}\n\nUser-agent: *\nAllow: /\n\nSitemap: https://${baseUrl}/sitemap.xml\n`
}

export const SearchDiscovery: QuartzEmitterPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "SearchDiscovery",
    async *emit(ctx, content) {
      const cfg = ctx.cfg.configuration
      if (!cfg.baseUrl) {
        throw new Error("SearchDiscovery requires configuration.baseUrl")
      }

      const pages = content
        .map(([_, file]) => {
          const slug = simplifySlug(file.data.slug!)
          const url = `https://${joinSegments(cfg.baseUrl!, encodeURI(slug))}`
          return {
            title: file.data.frontmatter?.title ?? file.data.slug!,
            description: file.data.description?.trim() ?? "",
            text: file.data.text?.trim() ?? "",
            url,
            date: getDate(cfg, file.data),
          }
        })
        .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))

      const links = pages
        .map(
          ({ title, description, url }) =>
            `- [${title.replaceAll("[", "\\[").replaceAll("]", "\\]")}](${url})${description ? `: ${description.replaceAll("\n", " ")}` : ""}`,
        )
        .join("\n")

      const fullText = pages
        .map(
          ({ title, url, date, text }) =>
            `## ${title}\n\n- URL: ${url}\n${date ? `- Date: ${date.toISOString()}\n` : ""}\n${text}`,
        )
        .join("\n\n---\n\n")

      yield write({
        ctx,
        slug: "robots" as FullSlug,
        ext: ".txt",
        content: robotsTxt(cfg.baseUrl),
      })
      yield write({
        ctx,
        slug: "llms" as FullSlug,
        ext: ".txt",
        content: `# ${cfg.pageTitle}\n\n> ${opts.authorDescription}\n\n## Discovery\n\n- [Sitemap](https://${cfg.baseUrl}/sitemap.xml)\n- [RSS](https://${cfg.baseUrl}/index.xml)\n- [Full text corpus](https://${cfg.baseUrl}/llms-full.txt)\n\n## Pages\n\n${links}\n`,
      })
      yield write({
        ctx,
        slug: "llms-full" as FullSlug,
        ext: ".txt",
        content: `# ${cfg.pageTitle}\n\n> ${opts.authorDescription}\n\n${fullText}\n`,
      })
      yield write({
        ctx,
        slug: opts.indexNowKey as FullSlug,
        ext: ".txt",
        content: `${escapeHTML(opts.indexNowKey)}\n`,
      })
    },
    async *partialEmit() {},
  }
}
