# Quartz v4

> “[One] who works with the door open gets all kinds of interruptions, but [they] also occasionally gets clues as to what the world is and what might be important.” — Richard Hamming

Quartz is a set of tools that helps you publish your [digital garden](https://jzhao.xyz/posts/networked-thought) and notes as a website for free.
Quartz v4 features a from-the-ground rewrite focusing on end-user extensibility and ease-of-use.

🔗 Read the documentation and get started: https://quartz.jzhao.xyz/

[Join the Discord Community](https://discord.gg/cRFFHYye7t)

## Sponsors

<p align="center">
  <a href="https://github.com/sponsors/jackyzha0">
    <img src="https://cdn.jsdelivr.net/gh/jackyzha0/jackyzha0/sponsorkit/sponsors.svg" />
  </a>
</p>

## This fork

This fork publishes the Obsidian vault at `~/brain/` as two sites:

- `brain.vorontsovie.xyz` — the public site (`~/quartz/public`),
- `hindbrain.vorontsovie.xyz` — an authenticated private site
  (`~/quartz/private`, nginx Basic Auth).

The private host shows the public site plus the private pages: nginx serves
the private overlay first and falls back to the public output for everything
the overlay does not contain, so public pages and shared CSS/JS are stored
once.

### Hard line breaks

Single Markdown newlines render as hard line breaks (`<br>`) because
`quartz.config.ts` enables `Plugin.HardLineBreaks()` (`remark-breaks`).
Blank lines still separate paragraphs as usual.

### Publishing rules

Folder policy lives in `quartz.config.ts` under `configuration.publishing`:

```ts
publishing: {
  // Host of the authenticated private site (must match the nginx virtual host).
  privateHost: "hindbrain.vorontsovie.xyz",
  // Folders whose notes are published to the public site by default.
  autoPublishFolders: ["chords"],
  // Paths under auto-publish folders whose notes additionally need publish: true.
  autoPublishExceptions: [],
  // Folders whose notes (and assets) are private by default.
  privateFolders: [],
},
```

All paths are POSIX-style vault-relative paths and match directory boundaries
exactly: `chords` matches `chords/x.md` but not `chords-old/x.md`, and
`chords` must also be allowed by `configuration.ignorePatterns` for its notes
to be built at all.

- `autoPublishFolders` — notes inside these folders are public without any
  frontmatter flag.
- `autoPublishExceptions` — subpaths beneath auto-publish folders whose notes
  are _not_ auto-public; they require `publish: true` to appear publicly.
- `privateFolders` — notes (and assets) inside these folders are private by
  default. `publish: true` opts a note out of privacy (it goes to both sites).
- `privateHost` — hostname used for private-asset placeholder links and the
  client-side search merge; must match the nginx `server_name`.

There is no default private folder: add vault paths to `privateFolders` when
you want to keep a folder off the public site.

#### Frontmatter flags and precedence

For a Markdown note, the first matching rule wins:

1. `private: true` — private-only, even if `publish: true` is also set.
2. `publish: false` — private-only (hidden from the public site).
3. Path inside a `privateFolders` path — private by default;
   `publish: true` makes it public. When both public- and private-folder
   policies match, the private policy wins unless `publish: true` is present.
4. `publish: true` — public.
5. Path inside an `autoPublishFolders` path and outside any
   `autoPublishExceptions` path — public.
6. Everything else — published nowhere (not on the public site, not on the
   private site).

Both boolean and quoted-string values are recognized
(`publish: true` and `publish: "true"`).

### Assets

Binary files have no frontmatter, so their visibility is purely
directory-based: an asset inside a `privateFolders` path goes to the private
output only; everything else goes to the public output. Put assets intended
for public pages outside private folders.

When a public note references a private asset (image, PDF, audio, …), the
public build rewrites the reference to a short neutral placeholder linking to
the private host (`Закрытое вложение` → `https://hindbrain.vorontsovie.xyz/…`),
so the public site never embeds or exposes the missing asset URL. On the
private host the asset works normally.

### Build and deploy

`publish.sh` is the entry point and runs, in order:

1. `compile.sh` — builds both outputs from `~/brain` with one Quartz repo:
   - `QUARTZ_BUILD_MODE=public` → `~/quartz/public` (public pages, public
     assets, `static/contentIndex.json`, sitemap, RSS, robots/llms/indexnow),
   - `QUARTZ_BUILD_MODE=private` → `~/quartz/private` (private pages, private
     assets, `static/privateContentIndex.json` only — no public pages, no
     shared CSS/JS, no discovery artifacts).
2. `sync.sh` — rsyncs the two outputs to the server:
   `~/quartz/public` → `ilya@vorontsovie.xyz:/srv/brain/public/` and
   `~/quartz/private` → `ilya@vorontsovie.xyz:/srv/brain/private/`.
   `--delete` is scoped to each target subdirectory.
3. `notify_search_engines.sh` — submits the public sitemap via IndexNow.

All scripts use `set -euo pipefail`, so a failed build stops the pipeline
before anything is synced: the site is only updated when both builds
succeed.

### Nginx setup

`nginx-brain.conf` contains both virtual hosts:

- `brain.vorontsovie.xyz` — unchanged public host, root `/srv/brain/public`.
- `hindbrain.vorontsovie.xyz` — protected at server scope with
  `auth_basic` / `auth_basic_user_file /etc/nginx/.htpasswd-hindbrain`,
  `X-Robots-Tag: noindex, nofollow` on every response, root
  `/srv/brain/private` with a named-location fallback (`@public`) to
  `/srv/brain/public`. The `try_files` chain covers exact files, Quartz
  extensionless links (`/note` → `note.html`), and directory/index paths;
  `error_page 403 @public` handles directories that exist in the overlay
  without an index (mixed public/private folders) so the public copy wins.

Because the generated site is static, Basic Auth is the only protection — it
is enforced by nginx at the virtual-host level, not by the site itself.

One-time server steps:

1. DNS: point A/AAAA records for `brain.vorontsovie.xyz` and
   `hindbrain.vorontsovie.xyz` at the server.
2. Install the config: `scp nginx-brain.conf ilya@vorontsovie.xyz:~/` then
   `sudo cp ~/nginx-brain.conf /etc/nginx/conf.d/brain.conf` (adjust the path
   to match how the existing public site is installed),
   `sudo nginx -t && sudo systemctl reload nginx`.
3. Create the credentials (do **not** commit the file):
   `sudo apt install apache2-utils`, then
   `sudo htpasswd -c /etc/nginx/.htpasswd-hindbrain <user>` and
   `sudo chmod 640 /etc/nginx/.htpasswd-hindbrain`.
4. TLS: obtain certificates for both hosts (e.g.
   `sudo certbot --nginx -d brain.vorontsovie.xyz -d hindbrain.vorontsovie.xyz`),
   which adds `listen 443 ssl` server blocks; then add an HTTP→HTTPS
   redirect for port 80 (e.g. `return 301 https://$host$request_uri;` in the
   port-80 blocks).

### Search, explorer, graph on the private host

Every page loads the public index from `static/contentIndex.json`. Only when
the browser's hostname is the configured `privateHost` does the inline
bootstrap additionally fetch `static/privateContentIndex.json` (served from
the overlay) and merge it in, so Search, Explorer, and Graph include public
and private pages on `hindbrain.vorontsovie.xyz`. The public host never
requests the private index.

### Security limitations

- nginx Basic Auth protects the private host with credentials sent in plain
  headers (over TLS in production); there is no per-page authorization
  because the site is static.
- The private host is marked `noindex, nofollow` and emits no sitemap/RSS,
  but the placeholder links on public pages disclose the path of a private
  asset on the private host (not its content).
- A folder containing both public and private notes shows the _public_
  folder page on the private host (the overlay does not shadow it); the
  private notes in that folder are reachable by direct link and via search.
- The search merge happens on full page load; SPA navigation keeps the index
  of the initially loaded page.
