import { QuartzTransformerPlugin } from "../types"
import {
  FilePath,
  FullSlug,
  RelativeURL,
  SimpleSlug,
  TransformOptions,
  isFolderPath,
  joinSegments,
  pathToRoot,
  stripSlashes,
  simplifySlug,
  splitAnchor,
  slugifyFilePath,
  transformLink,
} from "../../util/path"
import path from "path"
import { visit } from "unist-util-visit"
import isAbsoluteUrl from "is-absolute-url"
import { Root } from "hast"

interface Options {
  /** How to resolve Markdown paths */
  markdownLinkResolution: TransformOptions["strategy"]
  /** Strips folders from a link so that it looks nice */
  prettyLinks: boolean
  openLinksInNewTab: boolean
  lazyLoad: boolean
  externalLinkIcon: boolean
}

const defaultOptions: Options = {
  markdownLinkResolution: "absolute",
  prettyLinks: true,
  openLinksInNewTab: false,
  lazyLoad: false,
  externalLinkIcon: true,
}

export interface ResolvedVaultDest {
  /** Vault-root-relative path of the target (slug for pages, raw path for assets). */
  path: FullSlug
  /** Anchor with a leading `#`, or empty. */
  anchor: string
}

/**
 * Resolves a vault-root-relative link (Obsidian shortest-path style, e.g.
 * `[[tg/schroedinger_jokes/42]]`) against the full vault: pages, assets,
 * and folders. Returns null for links that are already page-relative
 * (`..` segments) or that do not resolve, so they keep the strategy
 * behavior.
 */
export function resolveVaultDest(
  dest: string,
  pageSlugs: Set<FullSlug>,
  folderSlugs: Set<string>,
): ResolvedVaultDest | null {
  const [rawDest, anchor] = splitAnchor(decodeURI(dest))
  if (rawDest.split("/").some((segment) => segment === "..")) {
    return null
  }
  const normalized = stripSlashes(rawDest.replace(/^\.\//, ""))
  if (normalized === "") {
    return null
  }
  const slug = slugifyFilePath(normalized as FilePath)
  if (pageSlugs.has(slug)) {
    return { path: slug, anchor }
  }
  if (folderSlugs.has(slug)) {
    return { path: (slug + "/") as FullSlug, anchor }
  }
  const base = slug.split("/").pop()!
  const basenameMatches = [...pageSlugs].filter((candidate) => {
    const fileName = candidate.split("/").pop()!
    return fileName === base
  })
  if (basenameMatches.length === 1) {
    return { path: basenameMatches[0], anchor }
  }
  return null
}

export const CrawlLinks: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "LinkProcessing",
    htmlPlugins(ctx) {
      const pageSlugs = new Set<FullSlug>(ctx.allSlugs)
      const folderSlugs = new Set<string>()
      for (const slug of ctx.allSlugs) {
        let prefix = ""
        for (const segment of slug.split("/").slice(0, -1)) {
          prefix = prefix ? `${prefix}/${segment}` : segment
          folderSlugs.add(prefix)
        }
      }
      return [
        () => {
          return (tree: Root, file) => {
            const curSlug = simplifySlug(file.data.slug!)
            const outgoing: Set<SimpleSlug> = new Set()

            const transformOptions: TransformOptions = {
              strategy: opts.markdownLinkResolution,
              allSlugs: ctx.allSlugs,
            }

            const rebase = (slug: FullSlug, rawDest: string): RelativeURL => {
              const resolved = resolveVaultDest(rawDest, pageSlugs, folderSlugs)
              if (!resolved) {
                return transformLink(slug, rawDest, transformOptions)
              }
              const tail = isFolderPath(resolved.path) ? "/" : ""
              return (joinSegments(pathToRoot(slug), resolved.path) +
                tail +
                resolved.anchor) as RelativeURL
            }

            visit(tree, "element", (node, _index, _parent) => {
              // rewrite all links
              if (
                node.tagName === "a" &&
                node.properties &&
                typeof node.properties.href === "string"
              ) {
                let dest = node.properties.href as RelativeURL
                const classes = (node.properties.className ?? []) as string[]
                const isExternal = isAbsoluteUrl(dest)
                classes.push(isExternal ? "external" : "internal")

                if (isExternal && opts.externalLinkIcon) {
                  node.children.push({
                    type: "element",
                    tagName: "svg",
                    properties: {
                      "aria-hidden": "true",
                      class: "external-icon",
                      style: "max-width:0.8em;max-height:0.8em",
                      viewBox: "0 0 512 512",
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "path",
                        properties: {
                          d: "M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z",
                        },
                        children: [],
                      },
                    ],
                  })
                }

                // Check if the link has alias text
                if (
                  node.children.length === 1 &&
                  node.children[0].type === "text" &&
                  node.children[0].value !== dest
                ) {
                  // Add the 'alias' class if the text content is not the same as the href
                  classes.push("alias")
                }
                node.properties.className = classes

                if (isExternal && opts.openLinksInNewTab) {
                  node.properties.target = "_blank"
                }

                // don't process external links or intra-document anchors
                const isInternal = !(isAbsoluteUrl(dest) || dest.startsWith("#"))
                if (isInternal) {
                  dest = node.properties.href = rebase(file.data.slug!, dest)

                  // url.resolve is considered legacy
                  // WHATWG equivalent https://nodejs.dev/en/api/v18/url/#urlresolvefrom-to
                  const url = new URL(dest, "https://base.com/" + stripSlashes(curSlug, true))
                  const canonicalDest = url.pathname
                  let [destCanonical, _destAnchor] = splitAnchor(canonicalDest)
                  if (destCanonical.endsWith("/")) {
                    destCanonical += "index"
                  }

                  // need to decodeURIComponent here as WHATWG URL percent-encodes everything
                  const full = decodeURIComponent(stripSlashes(destCanonical, true)) as FullSlug
                  const simple = simplifySlug(full)
                  outgoing.add(simple)
                  node.properties["data-slug"] = full
                }

                // rewrite link internals if prettylinks is on
                if (
                  opts.prettyLinks &&
                  isInternal &&
                  node.children.length === 1 &&
                  node.children[0].type === "text" &&
                  !node.children[0].value.startsWith("#")
                ) {
                  node.children[0].value = path.basename(node.children[0].value)
                }
              }

              // transform all other resources that may use links
              if (
                ["img", "video", "audio", "iframe"].includes(node.tagName) &&
                node.properties &&
                typeof node.properties.src === "string"
              ) {
                if (opts.lazyLoad) {
                  node.properties.loading = "lazy"
                }

                if (!isAbsoluteUrl(node.properties.src)) {
                  const dest = node.properties.src as RelativeURL
                  node.properties.src = rebase(file.data.slug!, dest)
                }
              }
            })

            file.data.links = [...outgoing]
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    links: SimpleSlug[]
  }
}
