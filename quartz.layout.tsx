import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
//      GitHub: "https://github.com/jackyzha0/quartz",
//      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.FrontmatterTable({
      title: "",
      fields: [
        { key: "source", label: "Источник", isUrl: true},
        { key: "author", label: "Автор" },
        { key: "status", label: "Статус" },
        { key: "draft",  label: "Черновик" },
        { key: "prev",   label: "Предыдущая страница", isUrl: true },
        { key: "next",   label: "Следующая страница", isUrl: true },
        // "aliases",         // массивы аккуратно склеятся через запятую
        // "tags"             // можно и теги дублировать сверху
        // поддерживаются вложенные ключи вида: "meta.editor.name"
      ],
    }),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
    Component.Graph({
      localGraph: {
        depth: 3,
        showTags: false,
      },
      globalGraph: {
        showTags: false,
        includeOrphans: false,
      },
    }),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [],
}
