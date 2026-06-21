import { escapeHtml, fetchJson, getBasePath } from "./store.js?v=20260619-2";

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

export async function initNewsPage() {
  const grid = document.querySelector("[data-news-grid]");

  if (!grid) {
    return;
  }

  const news = (await fetchJson("data/news.json")).filter((item) => item.active !== false);

  grid.innerHTML = news
    .map((item) => {
      const promoClass = item.id === "referral-promo-2026" ? " news-card--promo" : "";
      return `
        <article class="news-card${promoClass}" data-news-id="${escapeHtml(item.id)}">
          <div class="news-card__image">${coverMarkup(item)}</div>
          <div class="news-card__body">
            <span class="news-card__date">${formatDate(item.date)}</span>
            <h2 class="news-card__title">${escapeHtml(item.title)}</h2>
            <p class="news-card__text">${escapeHtml(item.text)}</p>
            <a class="button button--secondary" href="#">Читать</a>
          </div>
        </article>
      `;
    })
    .join("");
}
