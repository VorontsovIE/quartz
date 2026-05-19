import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.Comments({
      provider: 'giscus',
      options: {
        // from data-repo
        repo: 'VorontsovIE/brain_giscus',
        // from data-repo-id
        repoId: 'R_kgDOPx99_w',
        // from data-category
        category: 'Announcements',
        // from data-category-id
        categoryId: 'DIC_kwDOPx99_84Cvk21',
        // from data-lang
        lang: 'ru',

        mapping: 'pathname',
      }
    }),
  ],
  footer: Component.Footer({
    links: {
      "Telegram": "https://t.me/VorontsovIE",
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
        { key: "suggested_by",   label: "Предложено" },
        { key: "forwarded_from",   label: "Репост из", isUrl: true },
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
    // Component.PageTitle(),
    Component.DesktopOnly(Component.PageTitle({title: 'Ilya Vorontsov'})),
    Component.MobileOnly(Component.PageTitle({title: 'Ilya Vorontsov'})),
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
