import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import isAbsoluteUrl from "is-absolute-url"
import type { Element, Root } from "hast"
import { getFileExtension, stripSlashes } from "../../util/path"
import {
  PRIVATE_ASSET_PLACEHOLDER_TEXT,
  isPrivateAsset,
  privateAssetUrl,
  type PublishPolicy,
} from "../../util/publish"

const MEDIA_TAGS = ["img", "video", "audio", "iframe"]

/**
 * Resolves a link target that CrawlLinks left relative (see the "relative"
 * markdownLinkResolution strategy) back to a vault-relative POSIX path, using
 * the same base-URL trick CrawlLinks uses for its data-slug computation.
 */
function vaultPathFromHref(href: string, curSlug: string): string | undefined {
  try {
    const url = new URL(href, `https://base.com/${stripSlashes(curSlug, true)}`)
    if (url.origin !== "https://base.com") return undefined
    return stripSlashes(decodeURIComponent(url.pathname))
  } catch {
    return undefined
  }
}

function placeholder(policy: PublishPolicy, vaultPath: string): Element {
  return {
    type: "element",
    tagName: "a",
    properties: {
      href: privateAssetUrl(policy, vaultPath),
      class: ["private-asset-placeholder"],
      target: "_blank",
      rel: "noopener",
    },
    children: [{ type: "text", value: PRIVATE_ASSET_PLACEHOLDER_TEXT }],
  }
}

/**
 * In the public build, references to assets that live in configured private
 * folders are replaced with a short neutral placeholder linking to the
 * authenticated private host, so the public site neither exposes nor embeds
 * the missing asset. The private build serves the assets normally and runs
 * no rewrite.
 */
export const PrivateAssetPlaceholders: QuartzTransformerPlugin = () => ({
  name: "PrivateAssetPlaceholders",
  htmlPlugins(ctx) {
    if (ctx.buildMode !== "public") return []
    const policy = ctx.cfg.configuration.publishing
    return [
      () => {
        return (tree: Root, file) => {
          const curSlug = file.data.slug!
          visit(tree, "element", (node, index, parent) => {
            if (typeof index !== "number" || !parent || !("children" in parent)) return

            if (node.tagName === "a") {
              const href = node.properties?.href
              if (
                typeof href !== "string" ||
                isAbsoluteUrl(href) ||
                href.startsWith("#") ||
                href.endsWith("/")
              ) {
                return
              }
              const target =
                (typeof node.properties["data-slug"] === "string"
                  ? node.properties["data-slug"]
                  : undefined) ?? vaultPathFromHref(href, curSlug)
              // Only file targets (pages have no extension); leave links to
              // private pages to the regular broken-link behavior.
              if (!target || !getFileExtension(target) || target.endsWith(".md")) return
              if (!isPrivateAsset(policy, target)) return
              parent.children[index] = placeholder(policy, target)
            } else if (MEDIA_TAGS.includes(node.tagName)) {
              const src = node.properties?.src
              if (typeof src !== "string" || isAbsoluteUrl(src) || src.startsWith("data:")) return
              const target = vaultPathFromHref(src, curSlug)
              if (!target || !isPrivateAsset(policy, target)) return
              parent.children[index] = placeholder(policy, target)
            }
          })
        }
      },
    ]
  },
})
