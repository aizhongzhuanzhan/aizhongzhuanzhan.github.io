import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://aizhongzhuanzhan.github.io";
const data = JSON.parse(await readFile(path.join(root, "data.json"), "utf8"));
const sites = [...data.sites].sort((a, b) => a.rank - b.rank);
const pageSize = 30;
const totalPages = Math.ceil(sites.length / pageSize);
const topics = [
  "gpt-zhongzhuanzhan",
  "claude-zhongzhuanzhan",
  "codex-zhongzhuanzhan",
  "gemini-zhongzhuanzhan",
  "glm-zhongzhuanzhan",
  "qwen-zhongzhuanzhan",
  "kimi-zhongzhuanzhan",
];

function pagePath(page) {
  return page === 1 ? path.join(root, "index.html") : path.join(root, "page", String(page), "index.html");
}

function pageUrl(page) {
  return page === 1 ? `${origin}/` : `${origin}/page/${page}/`;
}

function jsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, "JSON-LD must be embedded");
  return JSON.parse(match[1]);
}

test("snapshot is limited, unique and mildly shuffled", () => {
  assert.ok(sites.length > 0 && sites.length <= 120);
  assert.deepEqual(sites.map((site) => site.rank), Array.from({ length: sites.length }, (_, index) => index + 1));
  assert.equal(new Set(sites.map((site) => site.url)).size, sites.length);
  sites.forEach((site) => {
    assert.ok(Number.isInteger(site.sourceRank));
    assert.equal(Math.floor((site.rank - 1) / 5), Math.floor((site.sourceRank - 1) / 5));
  });
});

test("every ranking entry is server-rendered exactly once", async () => {
  const ranks = [];
  for (let page = 1; page <= totalPages; page += 1) {
    const html = await readFile(pagePath(page), "utf8");
    assert.doesNotMatch(html, /<script\s+src=/i);
    const current = [...html.matchAll(/<article class="station-card" id="rank-(\d+)"/g)].map((match) => Number(match[1]));
    assert.ok(current.length > 0 && current.length <= pageSize);
    ranks.push(...current);
  }
  assert.deepEqual(ranks, sites.map((site) => site.rank));
});

test("ranking pages have unique complete SEO metadata", async () => {
  const titles = new Set();
  const descriptions = new Set();
  for (let page = 1; page <= totalPages; page += 1) {
    const html = await readFile(pagePath(page), "utf8");
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(title?.startsWith("AI 中转站推荐"));
    assert.ok(description?.includes("中转站"));
    assert.ok(html.includes(`<link rel="canonical" href="${pageUrl(page)}"`));
    assert.ok(html.includes('name="robots" content="index, follow'));
    assert.ok(html.includes('property="og:image"'));
    assert.ok(html.includes('name="twitter:card"'));
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
    const graph = jsonLd(html)["@graph"];
    const list = graph.find((entry) => entry["@type"] === "ItemList");
    assert.equal(list.numberOfItems, sites.length);
    assert.equal(list.itemListElement.length, Math.min(pageSize, sites.length - (page - 1) * pageSize));
    titles.add(title);
    descriptions.add(description);
  }
  assert.equal(titles.size, totalPages);
  assert.equal(descriptions.size, totalPages);
});

test("topic pages are static, canonical and use the limited snapshot", async () => {
  const allowedNames = new Set(sites.map((site) => site.name));
  for (const slug of topics) {
    const html = await readFile(path.join(root, slug, "index.html"), "utf8");
    assert.ok(html.includes(`<link rel="canonical" href="${origin}/${slug}/"`));
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
    assert.doesNotMatch(html, /<script\s+src=/i);
    const list = jsonLd(html)["@graph"].find((entry) => entry["@type"] === "ItemList");
    list.itemListElement.forEach((entry) => assert.ok(allowedNames.has(entry.item.name)));
  }
});

test("sitemap, robots, 404 and assets are coherent", async () => {
  const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
  const expected = [
    ...Array.from({ length: totalPages }, (_, index) => pageUrl(index + 1)),
    ...topics.map((slug) => `${origin}/${slug}/`),
  ];
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]), expected);
  const robots = await readFile(path.join(root, "robots.txt"), "utf8");
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  const notFound = await readFile(path.join(root, "404.html"), "utf8");
  assert.match(notFound, /name="robots" content="noindex, follow"/);
  await access(path.join(root, ".nojekyll"));
  await access(path.join(root, "assets", "favicon.svg"));
  await access(path.join(root, "assets", "og-image.svg"));
  const sourceCss = await readFile(path.join(root, "assets", "styles.css"), "utf8");
  const minifiedCss = await readFile(path.join(root, "assets", "styles.min.css"), "utf8");
  assert.ok(minifiedCss.length < sourceCss.length);
  assert.match(minifiedCss, /@media \(max-width:(?:680|720)px\)/);
});

test("homepage visible FAQ matches structured FAQ", async () => {
  const html = await readFile(path.join(root, "index.html"), "utf8");
  const visible = (html.match(/<details class="faq-item">/g) || []).length;
  const faq = jsonLd(html)["@graph"].find((entry) => entry["@type"] === "FAQPage");
  assert.ok(visible >= 8);
  assert.equal(faq.mainEntity.length, visible);
  assert.ok(html.includes("每 5 名范围内轮换展示"));
});
