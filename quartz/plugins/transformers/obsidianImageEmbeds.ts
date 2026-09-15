import { QuartzTransformerPlugin } from "../types"

// will convert ![[photos/photo@abc.jpg]] → ![](photos/photo@abc.jpg]
// it should fix a bug with @ in a photo filename incorrectly treated in ![[...]] syntax

const imageEmbedRegex =
  /!\[\[([^\[\]|#]+?\.(?:png|jpe?g|gif|bmp|svg|webp))(?:\|([^\[\]]*))?\]\]/gi

export const ObsidianImageEmbeds: QuartzTransformerPlugin = () => {
  return {
    name: "ObsidianImageEmbeds",

    textTransform(_ctx, src) {
      return src.replace(imageEmbedRegex, (_match, path: string, alias?: string) => {
        const value = alias?.trim() ?? ""

        // ![[image.jpg]]
        if (value === "") {
          return `![](${path})`
        }

        // ![[image.jpg|300]]
        const widthOnly = value.match(/^(\d+)$/)
        if (widthOnly) {
          return `<img src="${path}" width="${widthOnly[1]}">`
        }

        // ![[image.jpg|300x200]]
        const dimensions = value.match(/^(\d+)x(\d+)$/)
        if (dimensions) {
          return `<img src="${path}" width="${dimensions[1]}" height="${dimensions[2]}">`
        }

        // ![[image.jpg|some alt text]]
        return `![${value}](${path})`
      })
    },
  }
}
