import { escapeHtml, fetchJson } from "./store.js?v=20260619-2";

const HOME_FILTERS = [
  { id: "all", label: "Все" },
  { id: "economy", label: "Экономика" },
  { id: "realestate", label: "Недвижимость" },
  { id: "ai", label: "ИИ" },
  { id: "business", label: "Бизнес" }
];

const TOPIC_GROUPS = {
  economy: ["economy", "finance"],
  realestate: ["realestate", "mortgage"],
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

function matchesFilter(item, filterId) {
  if (filterId === "all") {
    return true;
  }

  return TOPIC_GROUPS[filterId]?.includes(item.topic);
}

function feedCardMarkup(item) {
  return `
    <article class="home-news-card" data-topic="${escapeHtml(item.topic)}">
      <div class="home-news-card__meta">
        <span class="home-news-card__topic">${escapeHtml(item.topicLabel)}</span>
        <span class="home-news-card__source">${escapeHtml(item.source)}</span>
      </div>
      <time class="home-news-card__date" datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time>
      <h3 class="home-news-card__title">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
      </h3>
      <p class="home-news-card__summary">${escapeHtml(item.summary)}</p>
      <a class="home-news-card__link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Читать в источнике</a>
    </article>
  `;
}

function renderFeedGrid(grid, items, filterId) {
  const filtered = items.filter((item) => matchesFilter(item, filterId)).slice(0, 6);

  if (!filtered.length) {
    grid.innerHTML = `<p class="home-news-feed__empty">Пока нет свежих новостей по этой теме. Загляните позже.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(feedCardMarkup).join("");
}

export async function initHomeNewsFeed() {
  const section = document.querySelector("[data-home-news-feed]");

  if (!section) {
    return;
  }

  const grid = section.querySelector("[data-home-news-grid]");
  const filtersRoot = section.querySelector("[data-home-news-filters]");
  const allNews = await fetchJson("data/news.json");
  const rssItems = allNews
    .filter((item) => item.type === "rss" && item.active !== false)
    .sort((left, right) => right.date.localeCompare(left.date));

  if (!grid || !filtersRoot) {
    return;
  }

  let activeFilter = "all";

  filtersRoot.innerHTML = HOME_FILTERS.map((filter, index) => `
    <button
      class="home-news-feed__filter${index === 0 ? " is-active" : ""}"
      type="button"
      data-news-filter="${filter.id}"
      aria-pressed="${index === 0 ? "true" : "false"}"
    >${filter.label}</button>
  `).join("");

  renderFeedGrid(grid, rssItems, activeFilter);

  filtersRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-news-filter]");

    if (!button) {
      return;
    }

    activeFilter = button.dataset.newsFilter;

    filtersRoot.querySelectorAll("[data-news-filter]").forEach((node) => {
      const isActive = node === button;
      node.classList.toggle("is-active", isActive);
      node.setAttribute("aria-pressed", String(isActive));
    });

    renderFeedGrid(grid, rssItems, activeFilter);
  });
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
