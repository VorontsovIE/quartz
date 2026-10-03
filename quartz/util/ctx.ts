import { QuartzConfig } from "../cfg"
import { ProcessedContent, QuartzPluginData } from "../plugins/vfile"
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
   * The full, unfiltered parse result. Private builds render folder and tag
   * pages from it so the overlay lists public and private content alike.
   */
  allContent?: ProcessedContent[]
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

export type WorkerSerializableBuildCtx = Omit<BuildCtx, "cfg" | "trie" | "allContent">
