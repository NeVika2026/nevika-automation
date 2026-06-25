import { escapeHtml } from "./store.js?v=20260623-1";

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

export function isRssNewsItem(item) {
  return item?.type === "rss";
}

export function rssNewsCardMarkup(item) {
  return `
    <article class="news-card news-card--rss" data-news-id="${escapeHtml(item.id)}">
      <div class="news-card__body">
        <div class="news-card__meta">
          <span class="news-card__date">${formatDate(item.date)}</span>
          <span class="news-card__topic">${escapeHtml(item.topicLabel)}</span>
          <span class="news-card__source">${escapeHtml(item.source)}</span>
        </div>
        <h2 class="news-card__title">${escapeHtml(item.title)}</h2>
        <p class="news-card__text">${escapeHtml(item.summary)}</p>
        <a class="button button--secondary" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Читать в источнике</a>
      </div>
    </article>
  `;
}
