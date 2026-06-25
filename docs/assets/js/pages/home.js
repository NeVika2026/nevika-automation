import { escapeHtml, fetchJson } from "../modules/store.js?v=20260619-2";

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

export function getNewsCoverTheme(topic) {
  if (["economy", "finance"].includes(topic)) {
    return "economy";
  }

  if (["realestate", "mortgage"].includes(topic)) {
    return "realestate";
  }

  if (topic === "ai") {
    return "ai";
  }

  return "business";
}

function coverMarkup(item) {
  const theme = getNewsCoverTheme(item.topic);
  const hasImage = Boolean(item.image);

  if (hasImage) {
    return `
      <div class="home-news-card__cover home-news-card__cover--photo">
        <img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.home-news-card__cover').classList.add('is-fallback'); this.remove();">
        <span class="home-news-card__tag">${escapeHtml(item.topicLabel)}</span>
      </div>
    `;
  }

  return `
    <div class="home-news-card__cover home-news-card__cover--${theme} is-fallback" aria-hidden="true">
      <span class="home-news-card__tag">${escapeHtml(item.topicLabel)}</span>
    </div>
  `;
}

function cardBodyMarkup(item) {
  return `
    <div class="home-news-card__body">
      <div class="home-news-card__meta">
        <time class="home-news-card__date" datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time>
        <span class="home-news-card__source">${escapeHtml(item.source)}</span>
      </div>
      <h3 class="home-news-card__title">
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
      </h3>
      <p class="home-news-card__summary">${escapeHtml(item.summary)}</p>
      <a class="home-news-card__button" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Читать источник</a>
    </div>
  `;
}

function featuredCardMarkup(item) {
  return `
    <article class="home-news-card home-news-card--featured" data-topic="${escapeHtml(item.topic)}">
      ${coverMarkup(item)}
      ${cardBodyMarkup(item)}
    </article>
  `;
}

function cardMarkup(item) {
  return `
    <article class="home-news-card" data-topic="${escapeHtml(item.topic)}">
      ${coverMarkup(item)}
      ${cardBodyMarkup(item)}
    </article>
  `;
}

function renderFeedLayout(layout, items, filterId) {
  const filtered = items.filter((item) => matchesFilter(item, filterId)).slice(0, 6);

  if (!filtered.length) {
    layout.innerHTML = `<p class="home-news-feed__empty">Пока нет свежих новостей по этой теме. Загляните позже.</p>`;
    return;
  }

  const [featured, ...rest] = filtered;

  layout.innerHTML = `
    ${featuredCardMarkup(featured)}
    ${rest.length ? `<div class="home-news-feed__grid">${rest.map(cardMarkup).join("")}</div>` : ""}
  `;
}

export async function initHomeNewsFeed() {
  const section = document.querySelector("[data-home-news-feed]");

  if (!section) {
    return;
  }

  const layout = section.querySelector("[data-home-news-layout]");
  const filtersRoot = section.querySelector("[data-home-news-filters]");
  const allNews = await fetchJson("data/news.json");
  const rssItems = allNews
    .filter((item) => item.type === "rss" && item.active !== false)
    .sort((left, right) => right.date.localeCompare(left.date));

  if (!layout || !filtersRoot) {
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

  renderFeedLayout(layout, rssItems, activeFilter);

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

    renderFeedLayout(layout, rssItems, activeFilter);
  });
}
