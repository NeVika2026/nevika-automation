import { addToCart, escapeHtml, fetchJson, formatPrice, productImageMarkup } from "./store.js?v=20260619-2";

function productCard(product) {
  const badges = (product.badges || [])
    .map((badge) => `<span class="product-card__badge">${escapeHtml(badge)}</span>`)
    .join("");
  const cardTitle = product.displayName || product.name;

  return `
    <article class="product-card">
      <a class="product-card__image" href="../product/?id=${product.id}" aria-label="${escapeHtml(product.name)}">
        ${productImageMarkup(product)}
        ${badges ? `<span class="product-card__badges">${badges}</span>` : ""}
      </a>
      <div class="product-card__body">
        <span class="product-card__category">${escapeHtml(product.category)}</span>
        <h2 class="product-card__title" title="${escapeHtml(product.name)}">${escapeHtml(cardTitle)}</h2>
        <p class="product-card__text">${escapeHtml(product.description)}</p>
        <div class="price-row">
          <span class="price-row__retail">${formatPrice(product.retailPrice)}</span>
          ${product.partnerPrice ? `<span class="price-row__partner">Партнёрская: ${formatPrice(product.partnerPrice)}</span>` : ""}
        </div>
        <div class="button-row">
          <button class="button button--primary" type="button" data-add-to-cart="${product.id}">Купить</button>
          <a class="button button--secondary" href="../partners/">Хочу стать партнёром</a>
        </div>
      </div>
    </article>
  `;
}

function getCollectionProducts(products) {
  const collection = document.body.dataset.productCollection;

  if (!collection) {
    return products;
  }

  return products.filter((product) => product.collections?.includes(collection));
}

export async function initCatalogPage() {
  const grid = document.querySelector("[data-products-grid]");
  const toolbar = document.querySelector("[data-catalog-filters]");
  const search = document.querySelector("[data-catalog-search]");

  if (!grid) {
    return;
  }

  const products = getCollectionProducts(await fetchJson("data/products.json"));
  const categories = ["Все", ...new Set(products.map((product) => product.category))];
  let activeCategory = "Все";
  let query = "";

  function renderFilters() {
    if (!toolbar) {
      return;
    }

    toolbar.innerHTML = categories
      .map((category) => `<button class="filter-pill${category === activeCategory ? " is-active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
      .join("");
  }

  function renderProducts() {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const categoryMatch = activeCategory === "Все" || product.category === activeCategory;
      const searchMatch = !normalizedQuery || [product.name, product.displayName, product.brand, product.category, product.description]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
      return categoryMatch && searchMatch;
    });
    grid.innerHTML = filtered.length
      ? filtered.map(productCard).join("")
      : `<div class="empty-state">По выбранным условиям товары не найдены.</div>`;
  }

  renderFilters();
  renderProducts();

  toolbar?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");

    if (!button) {
      return;
    }

    activeCategory = button.dataset.category;
    renderFilters();
    renderProducts();
  });

  search?.addEventListener("input", () => {
    query = search.value;
    renderProducts();
  });

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-to-cart]");

    if (!button) {
      return;
    }

    addToCart(button.dataset.addToCart);
    button.textContent = "В корзине";
  });
}
