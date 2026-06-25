import { escapeHtml, fetchJson, getBasePath } from "./store.js?v=20260623-1";
import { isRssNewsItem, rssNewsCardMarkup } from "./rss-news.js?v=20260623-1";

const TOPIC_FILTER_GROUPS = {
  economy: ["economy", "finance"],
  realty: ["realestate", "mortgage"],
  ai: ["ai"],
  business: ["business", "marketing", "partners"]
};

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function coverMarkup(item) {
  if (item.image) {
    return `<img src="${getBasePath()}${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">`;
  }

  return `
    <div class="news-cover-fallback">
      <span>FAMALL</span>
      <strong>${escapeHtml(item.title)}</strong>
    </div>
  `;
}

function siteNewsCardMarkup(item) {
  const promoClass = item.id === "referral-promo-2026" ? " news-card--promo" : "";

  return `
    <article class="news-card${promoClass}" data-news-id="${escapeHtml(item.id)}">
      <div class="news-card__image">${coverMarkup(item)}</div>
      <div class="news-card__body">
        <span class="news-card__date">${formatDate(item.date)}</span>
        <h2 class="news-card__title">${escapeHtml(item.title)}</h2>
        <p class="news-card__text">${escapeHtml(item.text)}</p>
        <a class="button button--secondary" href="../contacts/">Подробнее</a>
      </div>
    </article>
  `;
}

function getTopicFilter() {
  return new URLSearchParams(window.location.search).get("topic");
}

function matchesTopicFilter(item, topicFilter) {
  if (!topicFilter) {
    return true;
  }

  const topics = TOPIC_FILTER_GROUPS[topicFilter];

  if (!topics) {
    return true;
  }

  if (!isRssNewsItem(item)) {
    return false;
  }

  return topics.includes(item.topic);
}

export async function initNewsPage() {
  const grid = document.querySelector("[data-news-grid]");

  if (!grid) {
    return;
  }

  const topicFilter = getTopicFilter();
  const news = (await fetchJson("data/news.json")).filter((item) => item.active !== false);
  const filtered = news.filter((item) => matchesTopicFilter(item, topicFilter));
  const sorted = [...filtered].sort((left, right) => right.date.localeCompare(left.date));

  if (!sorted.length) {
    grid.innerHTML = `<p class="news-grid__empty">Пока нет материалов по этой теме. Загляните позже или посмотрите <a href="./">все новости</a>.</p>`;
    return;
  }

  grid.innerHTML = sorted
    .map((item) => (isRssNewsItem(item) ? rssNewsCardMarkup(item) : siteNewsCardMarkup(item)))
    .join("");
}
