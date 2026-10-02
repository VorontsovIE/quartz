import test, { describe } from "node:test"
import assert from "node:assert"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import remarkBreaks from "remark-breaks"
import { toHtml } from "hast-util-to-html"
import { VFile } from "vfile"
import type { Root } from "hast"
import { BuildCtx } from "../../util/ctx"
import { HardLineBreaks } from "./linebreaks"

// Runs the same parse -> Markdown transform -> HTML transform stages that
// Quartz uses (see quartz/processors/parse.ts) with the HardLineBreaks
// transformer from the configured pipeline.
function renderMarkdown(markdown: string): string {
  const markdownPlugins = (HardLineBreaks().markdownPlugins ?? (() => []))({} as BuildCtx)
  const processor = unified().use(remarkParse).use(markdownPlugins).use(remarkRehype)
  const file = new VFile(markdown)
  const ast = processor.parse(file)
  const newAst = processor.runSync(ast, file)
  return toHtml(newAst as unknown as Root)
}

describe("hard line breaks", () => {
  test("a single newline renders as a hard line break", () => {
    const html = renderMarkdown("first line\nsecond line")
    assert.match(html, /first line\s*<br\s*\/?>\s*second line/)
  })

  test("a blank line still separates paragraphs", () => {
    const html = renderMarkdown("para one\n\npara two")
    assert.match(html, /<p>para one<\/p>\s*<p>para two<\/p>/)
    assert.doesNotMatch(html, /<br/)
  })

  test("HardLineBreaks registers remark-breaks", () => {
    const markdownPlugins = (HardLineBreaks().markdownPlugins ?? (() => []))({} as BuildCtx)
    assert.ok(markdownPlugins.includes(remarkBreaks))
  })
})
