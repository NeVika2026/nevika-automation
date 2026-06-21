import { addToCart, escapeHtml, fetchJson, formatPrice, productImageMarkup } from "./store.js?v=20260619-2";

function hitCard(product) {
  const cardTitle = product.displayName || product.name;

  return `
    <article class="hit-card">
      <a class="hit-card__image" href="pages/product/?id=${product.id}" aria-label="${escapeHtml(product.name)}">
        ${productImageMarkup(product)}
      </a>
      <div class="hit-card__body">
        <span>${escapeHtml(product.category)}</span>
        <h3 title="${escapeHtml(product.name)}">${escapeHtml(cardTitle)}</h3>
        <p>${escapeHtml(product.description)}</p>
        <strong>${formatPrice(product.retailPrice)}</strong>
        ${product.partnerPrice ? `<small>Партнёрская: ${formatPrice(product.partnerPrice)}</small>` : ""}
        <button class="hero__button hero__button--primary" type="button" data-home-add="${product.id}">Купить</button>
        <a class="hero__button hero__button--secondary" href="pages/partners/">Хочу стать партнёром</a>
      </div>
    </article>
  `;
}

export async function initHomePage() {
  const grid = document.querySelector("[data-home-hits]");

  if (!grid) {
    return;
  }

  const products = await fetchJson("data/products.json");
  const hits = products.filter((product) => product.collections?.includes("hits"));
  grid.innerHTML = (hits.length ? hits : products).slice(0, 3).map(hitCard).join("");

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-home-add]");

    if (!button) {
      return;
    }

    addToCart(button.dataset.homeAdd);
    button.textContent = "В корзине";
  });
}
