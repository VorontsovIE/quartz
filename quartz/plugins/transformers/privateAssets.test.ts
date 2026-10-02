import test, { describe } from "node:test"
import assert from "node:assert"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { toHtml } from "hast-util-to-html"
import { VFile } from "vfile"
import type { Root } from "hast"
import type { BuildCtx } from "../../util/ctx"
import type { QuartzConfig } from "../../cfg"
import type { PublishPolicy } from "../../util/publish"
import { CrawlLinks } from "./links"
import { PrivateAssetPlaceholders } from "./privateAssets"

const policy: PublishPolicy = {
  privateHost: "hindbrain.vorontsovie.xyz",
  autoPublishFolders: [],
  autoPublishExceptions: [],
  privateFolders: ["notes/secret"],
}

function makeCtx(buildMode: "public" | "private"): BuildCtx {
  const cfg: QuartzConfig = {
    configuration: { publishing: policy },
    plugins: { transformers: [], filters: [], emitters: [] },
  } as unknown as QuartzConfig
  return {
    buildId: "test",
    argv: {
      output: "output",
      directory: "content",
      serve: false,
      watch: false,
      verbose: false,
      port: 0,
      wsPort: 0,
    },
    cfg,
    allSlugs: [],
    allFiles: [],
    buildMode,
    incremental: false,
  } as unknown as BuildCtx
}

// Mirrors Quartz's two-stage pipeline (quartz/processors/parse.ts):
// markdown -> mdast, then mdast -> hast with the configured html plugins.
function renderHtml(markdown: string, slug: string, buildMode: "public" | "private"): string {
  const ctx = makeCtx(buildMode)
  const crawl = CrawlLinks({ markdownLinkResolution: "relative" }).htmlPlugins!(ctx)
  const placeholders = PrivateAssetPlaceholders().htmlPlugins!(ctx)
  const setSlug = () => (_tree: unknown, file: VFile) => {
    file.data.slug = slug as never
  }

  const mdProcessor = unified().use(remarkParse)
  const file = new VFile(markdown)
  const mdAst = mdProcessor.runSync(mdProcessor.parse(file), file)

  const htmlProcessor = unified()
    .use(remarkRehype)
    .use(setSlug)
    .use(crawl)
    .use(placeholders) as unknown as {
    runSync: (tree: unknown, file: VFile) => unknown
  }
  return toHtml(htmlProcessor.runSync(mdAst, file) as unknown as Root)
}

describe("private asset placeholders", () => {
  test("replaces a private image with a placeholder link in the public build", () => {
    const html = renderHtml("![alt](notes/secret/pic.png)", "index", "public")
    assert.doesNotMatch(html, /<img/)
    assert.match(
      html,
      /<a[^>]*href="https:\/\/hindbrain\.vorontsovie\.xyz\/notes\/secret\/pic\.png"[^>]*class="[^"]*private-asset-placeholder[^"]*"[^>]*>Закрытое вложение<\/a>/,
    )
  })

  test("resolves relative image paths from nested notes", () => {
    const html = renderHtml("![alt](pic.png)", "notes/secret/x", "public")
    assert.doesNotMatch(html, /<img/)
    assert.match(html, /hindbrain\.vorontsovie\.xyz\/notes\/secret\/pic\.png/)
  })

  test("keeps public images untouched", () => {
    const html = renderHtml("![alt](files/pic.png)", "index", "public")
    assert.match(html, /<img[^>]*src="\.\/files\/pic\.png"/)
    assert.doesNotMatch(html, /private-asset-placeholder/)
  })

  test("replaces links to private files", () => {
    const html = renderHtml("[document](notes/secret/doc.pdf)", "index", "public")
    assert.match(
      html,
      /<a[^>]*href="https:\/\/hindbrain\.vorontsovie\.xyz\/notes\/secret\/doc\.pdf"[^>]*class="[^"]*private-asset-placeholder[^"]*"/,
    )
  })

  test("keeps links to private pages as regular links", () => {
    const html = renderHtml("[page](notes/secret/page.md)", "index", "public")
    assert.doesNotMatch(html, /private-asset-placeholder/)
    assert.match(html, /<a[^>]*href="\.\/notes\/secret\/page"/)
  })

  test("ignores external images", () => {
    const html = renderHtml("![alt](https://example.com/pic.png)", "index", "public")
    assert.match(html, /<img[^>]*src="https:\/\/example\.com\/pic\.png"/)
    assert.doesNotMatch(html, /private-asset-placeholder/)
  })

  test("the private build rewrites nothing", () => {
    const html = renderHtml("![alt](notes/secret/pic.png)", "index", "private")
    assert.match(html, /<img[^>]*src="\.\/notes\/secret\/pic\.png"/)
    assert.doesNotMatch(html, /private-asset-placeholder/)
  })
})
