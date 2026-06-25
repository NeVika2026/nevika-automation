import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEWS_PATH = path.resolve(__dirname, "../docs/data/news.json");
const MAX_RSS_ITEMS = 80;
const ITEMS_PER_SOURCE = 6;

const RSS_SOURCES = [
  {
    url: "https://www.vedomosti.ru/rss/rubric/economics",
    source: "Ведомости",
    topic: "economy",
    topicLabel: "Экономика"
  },
  {
    url: "https://www.vedomosti.ru/rss/rubric/finance",
    source: "Ведомости",
    topic: "finance",
    topicLabel: "Финансы"
  },
  {
    url: "https://www.vedomosti.ru/rss/rubric/realty",
    source: "Ведомости",
    topic: "realestate",
    topicLabel: "Недвижимость"
  },
  {
    url: "https://www.vedomosti.ru/rss/rubric/business",
    source: "Ведомости",
    topic: "business",
    topicLabel: "Бизнес"
  },
  {
    url: "https://www.vedomosti.ru/rss/rubric/technology",
    source: "Ведомости",
    topic: "ai",
    topicLabel: "ИИ"
  },
  {
    url: "https://rssexport.rbc.ru/rbcnews/news/30/full.rss",
    source: "РБК",
    topic: "economy",
    topicLabel: "Экономика"
  },
  {
    url: "https://www.banki.ru/xml/news.rss",
    source: "Banki.ru",
    topic: "mortgage",
    topicLabel: "Ипотека"
  },
  {
    url: "https://www.kommersant.ru/RSS/section-business.xml",
    source: "Коммерсантъ",
    topic: "business",
    topicLabel: "Бизнес"
  },
  {
    url: "https://habr.com/ru/rss/hubs/artificial_intelligence/articles/all/",
    source: "Habr",
    topic: "ai",
    topicLabel: "ИИ"
  },
  {
    url: "https://www.cnews.ru/inc/rss/news.xml",
    source: "CNews",
    topic: "ai",
    topicLabel: "ИИ"
  },
  {
    url: "https://vc.ru/rss",
    source: "VC.ru",
    topic: "partners",
    topicLabel: "Партнёрские программы"
  },
  {
    url: "https://incrussia.ru/feed/",
    source: "Inc. Russia",
    topic: "marketing",
    topicLabel: "Маркетинг"
  },
  {
    url: "https://tass.ru/rss/v2.xml",
    source: "ТАСС",
    topic: "economy",
    topicLabel: "Экономика"
  }
];

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "FAMALL-NewsBot/1.0 (+https://famall.online)"
  },
  customFields: {
    item: [
      ["media:content", "media:content", { keepArray: true }],
      ["media:thumbnail", "media:thumbnail", { keepArray: true }],
      ["content:encoded", "content:encoded"]
    ]
  }
});

function stripHtml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImageUrl(value = "") {
  const url = String(value).trim().replace(/&amp;/g, "&");

  if (!url || !/^https?:\/\//i.test(url)) {
    return "";
  }

  return url;
}

function firstImageFromHtml(html = "") {
  const match = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return normalizeImageUrl(match?.[1] || "");
}

function readMediaUrl(mediaEntry) {
  if (!mediaEntry) {
    return "";
  }

  if (Array.isArray(mediaEntry)) {
    for (const entry of mediaEntry) {
      const url = normalizeImageUrl(entry?.$?.url || entry?.url);

      if (url) {
        return url;
      }
    }

    return "";
  }

  return normalizeImageUrl(mediaEntry?.$?.url || mediaEntry?.url);
}

function extractImage(entry) {
  const enclosureUrl = normalizeImageUrl(entry.enclosure?.url);

  if (enclosureUrl) {
    const enclosureType = String(entry.enclosure?.type || "");

    if (!enclosureType || enclosureType.startsWith("image/")) {
      return enclosureUrl;
    }
  }

  const mediaContentUrl = readMediaUrl(entry["media:content"]);

  if (mediaContentUrl) {
    return mediaContentUrl;
  }

  const mediaThumbnailUrl = readMediaUrl(entry["media:thumbnail"]);

  if (mediaThumbnailUrl) {
    return mediaThumbnailUrl;
  }

  const htmlSources = [
    entry["content:encoded"],
    entry.content,
    entry.description,
    entry.summary,
    entry.contentSnippet
  ];

  for (const html of htmlSources) {
    const imageUrl = firstImageFromHtml(html);

    if (imageUrl) {
      return imageUrl;
    }
  }

  return "";
}

function toDateString(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function buildSummary(rawText, title) {
  const cleaned = stripHtml(rawText);

  if (!cleaned) {
    return title;
  }

  const sentences = cleaned
    .split(/(?<=[.!?…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const summary = sentences.slice(0, 2).join(" ");

  if (summary.length <= 240) {
    return summary;
  }

  return `${summary.slice(0, 237).trim()}…`;
}

function buildId(url) {
  return `rss-${createHash("sha1").update(url).digest("hex").slice(0, 12)}`;
}

async function fetchSource(source) {
  const feed = await parser.parseURL(source.url);
  const items = [];

  for (const entry of feed.items.slice(0, ITEMS_PER_SOURCE)) {
    const url = entry.link || entry.guid;

    if (!url || !entry.title) {
      continue;
    }

    const summarySource = entry.contentSnippet || entry.content || entry.summary || entry.description || "";

    items.push({
      id: buildId(url),
      type: "rss",
      date: toDateString(entry.isoDate || entry.pubDate),
      source: source.source,
      topic: source.topic,
      topicLabel: source.topicLabel,
      title: stripHtml(entry.title),
      summary: buildSummary(summarySource, stripHtml(entry.title)),
      url,
      image: extractImage(entry),
      active: true
    });
  }

  return items;
}

function dedupeAndSort(items) {
  const seen = new Set();

  return items
    .filter((item) => {
      if (seen.has(item.url)) {
        return false;
      }

      seen.add(item.url);
      return true;
    })
    .sort((left, right) => right.date.localeCompare(left.date) || right.title.localeCompare(left.title, "ru"))
    .slice(0, MAX_RSS_ITEMS);
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(NEWS_PATH, "utf8"));
  const siteItems = existing.filter((item) => item.type !== "rss");
  const collected = [];

  for (const source of RSS_SOURCES) {
    try {
      const items = await fetchSource(source);
      collected.push(...items);
      console.log(`OK ${source.source}: ${items.length}`);
    } catch (error) {
      console.warn(`SKIP ${source.source} (${source.url}): ${error.message}`);
    }
  }

  const rssItems = dedupeAndSort(collected);
  const nextNews = [...siteItems, ...rssItems];

  fs.writeFileSync(NEWS_PATH, `${JSON.stringify(nextNews, null, 2)}\n`, "utf8");
  console.log(`Saved ${rssItems.length} RSS items to ${NEWS_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
