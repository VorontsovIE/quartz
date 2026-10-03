import { getAllSegmentPrefixes, joinSegments } from "./path"

export type PublishMode = "public" | "private"

/**
 * Publishing rules for the vault. Paths are POSIX-style vault-relative paths.
 */
export interface PublishPolicy {
  /** Hostname of the authenticated private site (nginx virtual host). */
  privateHost: string
  /** Folders whose Markdown notes are published to the public site by default. */
  autoPublishFolders: string[]
  /** Paths beneath auto-publish folders whose notes additionally require publish: true. */
  autoPublishExceptions: string[]
  /** Folders whose Markdown notes and assets are private by default. */
  privateFolders: string[]
}

export type PublishDecision = "public" | "private"

export const BUILD_MODE_ENV = "QUARTZ_BUILD_MODE"

export function getBuildMode(raw: string | undefined): PublishMode {
  if (raw === undefined || raw === "public") return "public"
  if (raw === "private") return "private"
  throw new Error(`Invalid ${BUILD_MODE_ENV} "${raw}": expected "public" or "private"`)
}

export function isTruthyFlag(value: unknown): boolean {
  return value === true || value === "true"
}

export function isFalsyFlag(value: unknown): boolean {
  return value === false || value === "false"
}

export function normalizeFolderPath(folder: string): string {
  return folder
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".")
    .join("/")
}

/**
 * Whether a vault-relative POSIX path lies strictly inside a folder.
 * Matching is on exact directory boundaries: `chords` matches
 * `chords/x.md` but not `chords-old/x.md`, `notes/chords/x.md`, or a file
 * literally named `chords`.
 */
export function isInsideFolder(filePath: string, folder: string): boolean {
  const normalizedFolder = normalizeFolderPath(folder)
  if (normalizedFolder === "") return false
  return normalizeFolderPath(filePath).startsWith(normalizedFolder + "/")
}

/**
 * Decides where a Markdown note is published.
 *
 * Precedence:
 * 1. `private: true` -> private-only, even with `publish: true`.
 * 2. `publish: false` -> private-only.
 * 3. Path inside a private folder -> private by default; `publish: true` makes it public.
 *    (Beats the auto-publish folder policy unless `publish: true` is present.)
 * 4. `publish: true` -> public.
 * 5. Path inside an auto-publish folder and outside its exceptions -> public.
 * 6. Everything else -> private (the private site is the complete view).
 */
export function classifyPage(
  policy: PublishPolicy,
  relativePath: string,
  frontmatter: Record<string, unknown> | undefined,
): PublishDecision {
  const explicitlyPrivate = isTruthyFlag(frontmatter?.private)
  const publishTrue = isTruthyFlag(frontmatter?.publish)
  const publishFalse = isFalsyFlag(frontmatter?.publish)
  const inPrivateFolder = policy.privateFolders.some((folder) =>
    isInsideFolder(relativePath, folder),
  )
  const inAutoPublishFolder = policy.autoPublishFolders.some((folder) =>
    isInsideFolder(relativePath, folder),
  )
  const inAutoPublishException = policy.autoPublishExceptions.some((folder) =>
    isInsideFolder(relativePath, folder),
  )

  if (explicitlyPrivate) return "private"
  if (publishFalse) return "private"
  if (inPrivateFolder) return publishTrue ? "public" : "private"
  if (publishTrue) return "public"
  if (inAutoPublishFolder && !inAutoPublishException) return "public"
  return "private"
}

export interface PublicAggregates {
  folders: Set<string>
  tags: Set<string>
}

/** The folder prefixes of a page slug, as used by the folder page emitter. */
export function folderPrefixesOf(slug: string): string[] {
  const prefixes: string[] = []
  let folder = slug.includes("/") ? slug.slice(0, slug.lastIndexOf("/")) : ""
  while (folder !== "" && folder !== ".") {
    prefixes.push(folder)
    folder = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : ""
  }
  return prefixes
}

/** All hierarchical prefixes of the given tags (`a/b` -> `a`, `a/b`). */
export function tagPrefixesOf(tags: string[] | undefined): string[] {
  return (tags ?? []).flatMap((tag) => getAllSegmentPrefixes(tag))
}

export interface PublishableFile {
  relativePath?: unknown
  slug?: unknown
  frontmatter?: unknown
}

/**
 * Folders and tags that have at least one public page, computed over the
 * full (unfiltered) file list. The private overlay build uses these to skip
 * aggregate pages (folder/tag pages) that would otherwise shadow the public
 * ones on the private host.
 */
export function collectPublicAggregates(
  policy: PublishPolicy,
  files: PublishableFile[],
): PublicAggregates {
  const folders = new Set<string>()
  const tags = new Set<string>()
  for (const file of files) {
    const relativePath = typeof file.relativePath === "string" ? file.relativePath : undefined
    const slug = typeof file.slug === "string" ? file.slug : undefined
    if (!relativePath || !slug) continue
    const frontmatter = (
      file.frontmatter && typeof file.frontmatter === "object" ? file.frontmatter : undefined
    ) as Record<string, unknown> | undefined
    if (classifyPage(policy, relativePath, frontmatter) !== "public") continue
    for (const folder of folderPrefixesOf(slug)) folders.add(folder)
    for (const tag of tagPrefixesOf(frontmatter?.tags as string[] | undefined)) tags.add(tag)
  }
  // The public build always emits the tag index page, so the overlay must
  // never shadow it.
  tags.add("index")
  return { folders, tags }
}

/** Short neutral label shown on public pages instead of a private asset. */
export const PRIVATE_ASSET_PLACEHOLDER_TEXT = "Закрытое вложение"

/**
 * Binary assets have no frontmatter, so their visibility is purely
 * directory-based: an asset inside a configured private folder is private,
 * everything else stays public. An asset intended for a public page must be
 * stored outside private folders.
 */
export function isPrivateAsset(policy: PublishPolicy, vaultRelativePath: string): boolean {
  return policy.privateFolders.some((folder) => isInsideFolder(vaultRelativePath, folder))
}

/** Which build output a non-Markdown asset belongs to. */
export function shouldCopyAsset(
  mode: PublishMode,
  policy: PublishPolicy,
  vaultRelativePath: string,
): boolean {
  const isPrivate = isPrivateAsset(policy, vaultRelativePath)
  return mode === "private" ? isPrivate : !isPrivate
}

/** Absolute URL of an asset on the authenticated private host. */
export function privateAssetUrl(policy: PublishPolicy, vaultRelativePath: string): string {
  return `https://${policy.privateHost}/${normalizeFolderPath(vaultRelativePath)}`
}

/**
 * Inline script that populates the global `fetchData` promise used by Search,
 * Explorer, and Graph. Every host loads the public index; the private host
 * additionally merges the private index served from the overlay.
 */
export function contentIndexFetchScript(baseDir: string, privateHost: string): string {
  const contentIndexPath = joinSegments(baseDir, "static/contentIndex.json")
  const privateIndexPath = joinSegments(baseDir, "static/privateContentIndex.json")
  return [
    "const fetchData = (async () => {",
    `  const data = await fetch("${contentIndexPath}").then((response) => response.json())`,
    `  if (location.hostname === ${JSON.stringify(privateHost)}) {`,
    "    try {",
    `      const privateData = await fetch("${privateIndexPath}").then((response) => response.json())`,
    "      return { ...data, ...privateData }",
    "    } catch {",
    "      return data",
    "    }",
    "  }",
    "  return data",
    "})()",
  ].join("\n")
}
