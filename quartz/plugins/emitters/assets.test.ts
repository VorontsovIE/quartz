import test, { describe } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Assets } from "./assets"
import type { BuildCtx } from "../../util/ctx"
import type { QuartzConfig } from "../../cfg"
import type { PublishPolicy, PublishMode } from "../../util/publish"

const policy: PublishPolicy = {
  privateHost: "hindbrain.vorontsovie.xyz",
  autoPublishFolders: [],
  autoPublishExceptions: [],
  privateFolders: ["secret"],
}

function makeCtx(vault: string, output: string, buildMode: PublishMode): BuildCtx {
  const cfg: QuartzConfig = {
    configuration: { ignorePatterns: [], publishing: policy },
    plugins: { transformers: [], filters: [], emitters: [] },
  } as unknown as QuartzConfig
  return {
    buildId: "test",
    argv: {
      output,
      directory: vault,
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

function makeFixture(): string {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), "quartz-assets-vault-"))
  fs.mkdirSync(path.join(vault, "public-assets"), { recursive: true })
  fs.mkdirSync(path.join(vault, "secret"), { recursive: true })
  fs.writeFileSync(path.join(vault, "public-assets", "pic.png"), "png")
  fs.writeFileSync(path.join(vault, "secret", "doc.pdf"), "pdf")
  fs.writeFileSync(path.join(vault, "note.md"), "# note")
  return vault
}

async function runEmit(ctx: BuildCtx): Promise<string[]> {
  const emitted: string[] = []
  const emittedFiles = Assets().emit(ctx, [], { css: [], js: [], additionalHead: [] })
  for await (const fp of emittedFiles as AsyncGenerator<string>) {
    emitted.push(fp)
  }
  return emitted
}

describe("Assets emitter", () => {
  test("the public build copies public assets and excludes private-folder assets", async () => {
    const vault = makeFixture()
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "quartz-assets-out-"))
    try {
      await runEmit(makeCtx(vault, output, "public"))
      assert.ok(fs.existsSync(path.join(output, "public-assets", "pic.png")))
      assert.ok(!fs.existsSync(path.join(output, "secret", "doc.pdf")))
      assert.ok(!fs.existsSync(path.join(output, "note.md")))
    } finally {
      fs.rmSync(vault, { recursive: true, force: true })
      fs.rmSync(output, { recursive: true, force: true })
    }
  })

  test("the private build copies private-folder assets and excludes public ones", async () => {
    const vault = makeFixture()
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "quartz-assets-out-"))
    try {
      await runEmit(makeCtx(vault, output, "private"))
      assert.ok(fs.existsSync(path.join(output, "secret", "doc.pdf")))
      assert.ok(!fs.existsSync(path.join(output, "public-assets", "pic.png")))
      assert.ok(!fs.existsSync(path.join(output, "note.md")))
    } finally {
      fs.rmSync(vault, { recursive: true, force: true })
      fs.rmSync(output, { recursive: true, force: true })
    }
  })
})
