const host = "brain.vorontsovie.xyz"
const key = "b607e69e52de377e133de38253daab17"
const sitemapUrl = `https://${host}/sitemap.xml`
const keyLocation = `https://${host}/${key}.txt`

const sitemapResponse = await fetch(sitemapUrl)
if (!sitemapResponse.ok) {
  throw new Error(`Could not fetch ${sitemapUrl}: HTTP ${sitemapResponse.status}`)
}

const sitemap = await sitemapResponse.text()
const urlList = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
  match[1]
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'"),
)

if (urlList.length === 0) {
  throw new Error(`No URLs found in ${sitemapUrl}`)
}
if (urlList.length > 10_000) {
  throw new Error(`IndexNow accepts at most 10,000 URLs per request; found ${urlList.length}`)
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation, urlList }),
})

if (![200, 202].includes(response.status)) {
  throw new Error(
    `IndexNow rejected the submission: HTTP ${response.status} ${await response.text()}`,
  )
}

console.log(`IndexNow accepted ${urlList.length} URLs (HTTP ${response.status}).`)
