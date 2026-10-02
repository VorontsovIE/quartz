import sharp from "sharp"
import { joinSegments, QUARTZ, FullSlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import { BuildCtx } from "../../util/ctx"

export const Favicon: QuartzEmitterPlugin = () => ({
  name: "Favicon",
  async *emit({ argv, buildMode }) {
    // Served from the public output via the nginx fallback.
    if (buildMode === "private") return

    const iconPath = joinSegments(QUARTZ, "static", "icon.png")

    const faviconContent = sharp(iconPath).resize(48, 48).toFormat("png")

    yield write({
      ctx: { argv } as BuildCtx,
      slug: "favicon" as FullSlug,
      ext: ".ico",
      content: faviconContent,
    })
  },
  async *partialEmit() {},
})
