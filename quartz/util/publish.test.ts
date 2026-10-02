import test, { describe } from "node:test"
import assert from "node:assert"
import {
  BUILD_MODE_ENV,
  contentIndexFetchScript,
  classifyPage,
  collectPublicAggregates,
  folderPrefixesOf,
  getBuildMode,
  isInsideFolder,
  privateAssetUrl,
  shouldCopyAsset,
  tagPrefixesOf,
  type PublishPolicy,
} from "./publish"

const policy: PublishPolicy = {
  privateHost: "hindbrain.vorontsovie.xyz",
  autoPublishFolders: ["chords"],
  autoPublishExceptions: ["chords/lessons"],
  privateFolders: ["journal"],
}

describe("getBuildMode", () => {
  test("defaults to public and accepts both modes", () => {
    assert.equal(getBuildMode(undefined), "public")
    assert.equal(getBuildMode("public"), "public")
    assert.equal(getBuildMode("private"), "private")
  })

  test("rejects unknown modes", () => {
    assert.throws(() => getBuildMode("overlay"), new RegExp(BUILD_MODE_ENV))
  })
})

describe("isInsideFolder", () => {
  test("matches directory boundaries exactly", () => {
    assert.ok(isInsideFolder("chords/Am.md", "chords"))
    assert.ok(isInsideFolder("chords/lessons/Am.md", "chords"))
    assert.ok(!isInsideFolder("chords-old/Am.md", "chords"))
    assert.ok(!isInsideFolder("schords/Am.md", "chords"))
    assert.ok(!isInsideFolder("notes/chords/Am.md", "chords"))
    assert.ok(!isInsideFolder("chords", "chords"))
    assert.ok(isInsideFolder("notes/chords/Am.md", "notes/chords"))
  })

  test("normalizes folder spelling", () => {
    assert.ok(isInsideFolder("chords/Am.md", "/chords/"))
    assert.ok(!isInsideFolder("chords/Am.md", ""))
  })
})

describe("classifyPage", () => {
  const fm = (values: Record<string, unknown>) => values

  test("an ordinary page without flags is neither", () => {
    assert.equal(classifyPage(policy, "notes/plain.md", undefined), "neither")
    assert.equal(classifyPage(policy, "notes/plain.md", {}), "neither")
  })

  test("publish: true makes a page public", () => {
    assert.equal(classifyPage(policy, "notes/plain.md", fm({ publish: true })), "public")
    assert.equal(classifyPage(policy, "notes/plain.md", fm({ publish: "true" })), "public")
  })

  test("publish: false makes a page private", () => {
    assert.equal(classifyPage(policy, "notes/plain.md", fm({ publish: false })), "private")
    assert.equal(classifyPage(policy, "notes/plain.md", fm({ publish: "false" })), "private")
  })

  test("private: true makes a page private", () => {
    assert.equal(classifyPage(policy, "notes/plain.md", fm({ private: true })), "private")
    assert.equal(classifyPage(policy, "notes/plain.md", fm({ private: "true" })), "private")
  })

  test("conflicting flags: private wins over publish", () => {
    assert.equal(
      classifyPage(policy, "notes/plain.md", fm({ private: true, publish: true })),
      "private",
    )
    assert.equal(
      classifyPage(policy, "notes/plain.md", fm({ private: true, publish: false })),
      "private",
    )
  })

  test("notes in auto-publish folders are public", () => {
    assert.equal(classifyPage(policy, "chords/Am.md", undefined), "public")
    assert.equal(classifyPage(policy, "chords/Pink Floyd/Welcome.md", undefined), "public")
  })

  test("notes in exception subfolders require publish: true", () => {
    assert.equal(classifyPage(policy, "chords/lessons/Am.md", undefined), "neither")
    assert.equal(classifyPage(policy, "chords/lessons/Am.md", fm({ publish: true })), "public")
  })

  test("publish: false opts a note out of its auto-publish folder", () => {
    assert.equal(classifyPage(policy, "chords/Am.md", fm({ publish: false })), "private")
  })

  test("auto-publish folder matching stays on directory boundaries", () => {
    assert.equal(classifyPage(policy, "chords-old/Am.md", undefined), "neither")
    assert.equal(classifyPage(policy, "schords/Am.md", undefined), "neither")
  })

  test("notes in private folders are private by default", () => {
    assert.equal(classifyPage(policy, "journal/2026-01-01.md", undefined), "private")
    assert.equal(classifyPage(policy, "journal/deep/2026-01-01.md", undefined), "private")
  })

  test("publish: true opts a private-folder note into the public site", () => {
    assert.equal(classifyPage(policy, "journal/2026-01-01.md", fm({ publish: true })), "public")
  })

  test("private folder policy wins over auto-publish folder policy", () => {
    const both: PublishPolicy = {
      ...policy,
      autoPublishFolders: ["journal"],
      privateFolders: ["journal"],
    }
    assert.equal(classifyPage(both, "journal/2026-01-01.md", undefined), "private")
    assert.equal(classifyPage(both, "journal/2026-01-01.md", fm({ publish: true })), "public")
  })
})

describe("aggregates", () => {
  test("folderPrefixesOf mirrors folder page generation", () => {
    assert.deepEqual(folderPrefixesOf("chords/Am"), ["chords"])
    assert.deepEqual(folderPrefixesOf("a/b/c"), ["a/b", "a"])
    assert.deepEqual(folderPrefixesOf("index"), [])
  })

  test("tagPrefixesOf expands nested tags", () => {
    assert.deepEqual(tagPrefixesOf(["a/b", "c"]), ["a", "a/b", "c"])
    assert.deepEqual(tagPrefixesOf(undefined), [])
  })

  test("collectPublicAggregates reports folders and tags of public pages only", () => {
    const files = [
      { relativePath: "chords/Am.md", slug: "chords/Am", frontmatter: { tags: ["music/pop"] } },
      { relativePath: "notes/plain.md", slug: "notes/plain", frontmatter: {} },
      {
        relativePath: "notes/published.md",
        slug: "notes/published",
        frontmatter: { publish: true, tags: ["life"] },
      },
      { relativePath: "journal/diary.md", slug: "journal/diary", frontmatter: { tags: ["diary"] } },
    ]
    const aggregates = collectPublicAggregates(policy, files)
    assert.deepEqual([...aggregates.folders].sort(), ["chords", "notes"])
    assert.deepEqual([...aggregates.tags].sort(), ["index", "life", "music", "music/pop"])
    assert.ok(!aggregates.tags.has("diary"))
    assert.ok(!aggregates.folders.has("journal"))
  })
})

describe("asset policy", () => {
  test("assets in private folders go to the private output only", () => {
    assert.equal(shouldCopyAsset("public", policy, "journal/scan.pdf"), false)
    assert.equal(shouldCopyAsset("private", policy, "journal/scan.pdf"), true)
    assert.equal(shouldCopyAsset("public", policy, "files/pic.png"), true)
    assert.equal(shouldCopyAsset("private", policy, "files/pic.png"), false)
  })

  test("privateAssetUrl points at the private host", () => {
    assert.equal(
      privateAssetUrl(policy, "journal/scan.pdf"),
      "https://hindbrain.vorontsovie.xyz/journal/scan.pdf",
    )
  })
})

describe("contentIndexFetchScript", () => {
  test("loads the public index everywhere and merges the private index only on the private host", () => {
    const script = contentIndexFetchScript(".", "hindbrain.vorontsovie.xyz")
    assert.match(script, /fetch\("\.\/static\/contentIndex\.json"\)/)
    assert.match(script, /fetch\("\.\/static\/privateContentIndex\.json"\)/)
    assert.match(script, /location\.hostname === "hindbrain\.vorontsovie\.xyz"/)
    const hostCheck = script.indexOf("location.hostname")
    const privateFetch = script.indexOf("privateContentIndex.json")
    assert.ok(hostCheck !== -1 && hostCheck < privateFetch)
    assert.match(script, /\.\.\.data, \.\.\.privateData/)
  })

  test("uses the base dir for nested pages", () => {
    const script = contentIndexFetchScript("../..", "hindbrain.vorontsovie.xyz")
    assert.match(script, /fetch\("\.\.\/\.\.\/static\/contentIndex\.json"\)/)
  })
})
