import { QuartzFilterPlugin } from "../types"
import { classifyPage } from "../../util/publish"

export const ExplicitPublish: QuartzFilterPlugin = () => ({
  name: "ExplicitPublish",
  shouldPublish(ctx, [_tree, vfile]) {
    const decision = classifyPage(
      ctx.cfg.configuration.publishing,
      vfile.data.relativePath!,
      vfile.data.frontmatter,
    )
    return ctx.buildMode === "private" ? decision === "private" : decision === "public"
  },
})
