import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { ContentIndex } from "./contentIndex"
import { defaultProcessedContent } from "../vfile"
import type { ProcessedContent } from "../vfile"
import type { BuildCtx } from "../../util/ctx"
import type { QuartzConfig } from "../../cfg"
import type { PublishMode } from "../../util/publish"
import type { FilePath, FullSlug } from "../../util/path"

function makeCtx(output: string, buildMode: PublishMode): BuildCtx {
  const cfg: QuartzConfig = {
    configuration: {
      pageTitle: "Test",
      baseUrl: "brain.vorontsovie.xyz",
      locale: "ru-RU",
      defaultDateType: "modified",
      ignorePatterns: [],
      publishing: {
        privateHost: "hindbrain.vorontsovie.xyz",
        autoPublishFolders: [],
        autoPublishExceptions: [],
        privateFolders: ["journal"],
      },
    },
    plugins: { transformers: [], filters: [], emitters: [] },
  } as unknown as QuartzConfig
  return {
    buildId: "test",
    argv: {
      output,
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

function page(relativePath: string, title: string): ProcessedContent {
  return defaultProcessedContent({
    slug: relativePath.replace(/\.md$/, "") as FullSlug,
    relativePath: relativePath as FilePath,
    text: "body",
    frontmatter: { title, tags: [] },
  })
}

async function runEmit(buildMode: PublishMode, content: ProcessedContent[]): Promise<string> {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "quartz-content-index-"))
  const ctx = makeCtx(output, buildMode)
  const emittedFiles = ContentIndex().emit(ctx, content, { css: [], js: [], additionalHead: [] })
  for await (const _fp of emittedFiles as AsyncGenerator<string>) {
    // files are written by the emitter
  }
  return output
}

describe("ContentIndex emitter", () => {
  test("the public build emits the public index and discovery artifacts", async () => {
    const output = await runEmit("public", [page("notes/public.md", "Public")])
    try {
      assert.ok(fs.existsSync(path.join(output, "static", "contentIndex.json")))
      assert.ok(fs.existsSync(path.join(output, "sitemap.xml")))
      assert.ok(fs.existsSync(path.join(output, "index.xml")))
      assert.ok(!fs.existsSync(path.join(output, "static", "privateContentIndex.json")))
      const index = JSON.parse(
        fs.readFileSync(path.join(output, "static", "contentIndex.json"), "utf8"),
      )
      assert.ok(index["notes/public"])
    } finally {
      fs.rmSync(output, { recursive: true, force: true })
    }
  })

  test("the private build emits only the private index", async () => {
    const output = await runEmit("private", [page("journal/private.md", "Private")])
    try {
      const indexPath = path.join(output, "static", "privateContentIndex.json")
      assert.ok(fs.existsSync(indexPath))
      const index = JSON.parse(fs.readFileSync(indexPath, "utf8"))
      assert.ok(index["journal/private"])
      assert.ok(!fs.existsSync(path.join(output, "static", "contentIndex.json")))
      assert.ok(!fs.existsSync(path.join(output, "sitemap.xml")))
      assert.ok(!fs.existsSync(path.join(output, "index.xml")))
    } finally {
      fs.rmSync(output, { recursive: true, force: true })
    }
  })
})
