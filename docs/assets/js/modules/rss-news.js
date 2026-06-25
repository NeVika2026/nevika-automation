import { escapeHtml } from "./store.js?v=20260619-2";
import { getNewsCoverTheme } from "../pages/home.js?v=20260619-2";

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function rssCoverMarkup(item) {
  const theme = getNewsCoverTheme(item.topic);

  if (item.image) {
    return `
      <div class="news-card__cover news-card__cover--photo">
        <img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.news-card__cover').classList.add('is-fallback'); this.remove();">
        <span class="news-card__tag">${escapeHtml(item.topicLabel)}</span>
      </div>
    `;
  }

  return `
    <div class="news-card__cover news-card__cover--${theme} is-fallback" aria-hidden="true">
      <span class="news-card__tag">${escapeHtml(item.topicLabel)}</span>
    </div>
  `;
}

export function isRssNewsItem(item) {
  return item?.type === "rss";
}

export function rssNewsCardMarkup(item) {
  return `
    <article class="news-card news-card--rss" data-news-id="${escapeHtml(item.id)}">
      ${rssCoverMarkup(item)}
      <div class="news-card__body">
        <div class="news-card__meta">
          <span class="news-card__date">${formatDate(item.date)}</span>
          <span class="news-card__source">${escapeHtml(item.source)}</span>
        </div>
        <h2 class="news-card__title">${escapeHtml(item.title)}</h2>
        <p class="news-card__text">${escapeHtml(item.summary)}</p>
        <a class="button button--secondary" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Читать источник</a>
      </div>
    </article>
  `;
}
