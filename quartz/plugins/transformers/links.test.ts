import assert from "node:assert"
import { describe, test } from "node:test"
import { FullSlug } from "../../util/path"
import { resolveVaultDest } from "./links"

const pageSlugs = new Set<FullSlug>([
  "books",
  "tg/schroedinger_jokes/schroedinger_jokes-1399",
  "tg/schroedinger_jokes/Каминг-аут",
  "Проекты/Завершённые/Эффект-привязки-у-LLM",
  "notes/dup",
  "notes/index",
  "other/dup",
  "files/llm_priming.py",
] as FullSlug[])

const folderSlugs = new Set<string>()
for (const slug of pageSlugs) {
  let prefix = ""
  for (const segment of slug.split("/").slice(0, -1)) {
    prefix = prefix ? `${prefix}/${segment}` : segment
    folderSlugs.add(prefix)
  }
}

describe("resolveVaultDest", () => {
  test("resolves a vault-root-relative page path", () => {
    assert.deepEqual(
      resolveVaultDest("tg/schroedinger_jokes/schroedinger_jokes-1399", pageSlugs, folderSlugs),
      {
        path: "tg/schroedinger_jokes/schroedinger_jokes-1399",
        anchor: "",
      },
    )
  })

  test("strips a leading ./ and keeps the anchor", () => {
    assert.deepEqual(resolveVaultDest("./books#intro", pageSlugs, folderSlugs), {
      path: "books",
      anchor: "#intro",
    })
  })

  test("slugifies spaces the same way the vault slugs are", () => {
    assert.deepEqual(
      resolveVaultDest("Проекты/Завершённые/Эффект привязки у LLM", pageSlugs, folderSlugs),
      {
        path: "Проекты/Завершённые/Эффект-привязки-у-LLM",
        anchor: "",
      },
    )
  })

  test("resolves assets by their raw path", () => {
    assert.deepEqual(resolveVaultDest("files/llm_priming.py", pageSlugs, folderSlugs), {
      path: "files/llm_priming.py",
      anchor: "",
    })
  })

  test("resolves a unique basename (Obsidian shortest path)", () => {
    assert.deepEqual(resolveVaultDest("Каминг-аут", pageSlugs, folderSlugs), {
      path: "tg/schroedinger_jokes/Каминг-аут",
      anchor: "",
    })
  })

  test("resolves a folder by its prefix", () => {
    assert.deepEqual(resolveVaultDest("notes", pageSlugs, folderSlugs), {
      path: "notes/",
      anchor: "",
    })
  })

  test("leaves ambiguous basenames alone", () => {
    assert.equal(resolveVaultDest("dup", pageSlugs, folderSlugs), null)
  })

  test("leaves already page-relative links alone", () => {
    assert.equal(resolveVaultDest("../../notes/dup", pageSlugs, folderSlugs), null)
    assert.equal(resolveVaultDest("./sub/dup", pageSlugs, folderSlugs), null)
  })

  test("returns null for unknown targets", () => {
    assert.equal(resolveVaultDest("no/such/page", pageSlugs, folderSlugs), null)
    assert.equal(resolveVaultDest("./", pageSlugs, folderSlugs), null)
  })
})
