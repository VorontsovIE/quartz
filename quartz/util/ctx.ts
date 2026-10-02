import { QuartzConfig } from "../cfg"
import { QuartzPluginData } from "../plugins/vfile"
import { FileTrieNode } from "./fileTrie"
import { FilePath, FullSlug } from "./path"
import { PublishMode } from "./publish"

export interface Argv {
  directory: string
  verbose: boolean
  output: string
  serve: boolean
  watch: boolean
  port: number
  wsPort: number
  remoteDevHost?: string
  concurrency?: number
}

export type BuildTimeTrieData = QuartzPluginData & {
  slug: string
  title: string
  filePath: string
}

export interface BuildCtx {
  buildId: string
  argv: Argv
  cfg: QuartzConfig
  allSlugs: FullSlug[]
  allFiles: FilePath[]
  /** Which site this build produces: the public site or the private overlay. */
  buildMode: PublishMode
  /**
   * Folders and tags that have public pages (computed for private builds).
   * The overlay must not emit aggregate pages for these, because the public
   * copies exist and must win on the private host.
   */
  publicFolders?: Set<string>
  publicTags?: Set<string>
  trie?: FileTrieNode<BuildTimeTrieData>
  incremental: boolean
}

export function trieFromAllFiles(allFiles: QuartzPluginData[]): FileTrieNode<BuildTimeTrieData> {
  const trie = new FileTrieNode<BuildTimeTrieData>([])
  allFiles.forEach((file) => {
    if (file.frontmatter) {
      trie.add({
        ...file,
        slug: file.slug!,
        title: file.frontmatter.title,
        filePath: file.filePath!,
      })
    }
  })

  return trie
}

export type WorkerSerializableBuildCtx = Omit<BuildCtx, "cfg" | "trie">
