import {
  addToCart,
  escapeHtml,
  fetchJson,
  formatPrice,
  getBasePath,
  getProductGallery,
  productImageMarkup
} from "./store.js?v=20260623-1";

function imageMarkup(item, product) {
  return `<img src="${getBasePath()}${item.src}" alt="${escapeHtml(item.alt || product.name)}" loading="lazy">`;
}

function characteristicsMarkup(product) {
  const characteristics = product.characteristics?.length
    ? product.characteristics
    : [
        { label: "Артикул", value: product.sku },
        { label: "Бренд", value: product.brand },
        { label: "Категория", value: product.category },
        { label: "Объем", value: product.volume || "уточняется" },
        { label: "PV", value: product.pv },
        { label: "Наличие", value: "В наличии" }
      ];

  return characteristics
    .map((item) => `
      <div class="product-spec">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </div>
    `)
    .join("");
}

export async function initProductPage() {
  const root = document.querySelector("[data-product-detail]");

  if (!root) {
    return;
  }

  const productId = new URLSearchParams(window.location.search).get("id");
  const products = await fetchJson("data/products.json");
  const product = products.find((item) => item.id === productId) || products[0];

  if (!product) {
    root.innerHTML = `<div class="empty-state">Товар не найден.</div>`;
    return;
  }

  document.title = `${product.name} - FAMALL`;
  const gallery = getProductGallery(product);
  const mainImage = gallery[0];
  const imageStatusText = product.imageType === "source"
    ? "Оригинальное фото товара"
    : "Фирменная заглушка до загрузки фото";

  root.innerHTML = `
    <div class="product-gallery">
      <div class="product-gallery__main" data-gallery-main>
        ${mainImage ? imageMarkup(mainImage, product) : productImageMarkup(product)}
      </div>
      <div class="product-gallery__thumbs" data-gallery-thumbs>
        ${gallery.map((item, index) => `
          <button class="product-gallery__thumb${index === 0 ? " is-active" : ""}" type="button" data-gallery-src="${getBasePath()}${item.src}" data-gallery-alt="${escapeHtml(item.alt || product.name)}">
            ${imageMarkup(item, product)}
          </button>
        `).join("")}
      </div>
      <p class="product-gallery__note">${imageStatusText}</p>
    </div>
    <div class="product-detail__content">
      <div class="product-detail__badges">
        <span class="product-detail__category">${escapeHtml(product.category)}</span>
        ${(product.badges || []).map((badge) => `<span class="product-card__badge">${escapeHtml(badge)}</span>`).join("")}
      </div>
      <h1 class="product-detail__title">${escapeHtml(product.name)}</h1>
      <p class="product-detail__text">${escapeHtml(product.description)}</p>
      <div class="price-row">
        <span class="price-row__retail">${formatPrice(product.retailPrice)}</span>
        ${product.partnerPrice ? `<span class="price-row__partner">Партнёрская: ${formatPrice(product.partnerPrice)}</span>` : ""}
      </div>
      <div class="product-actions">
        <button class="button button--primary" type="button" data-buy-product="${product.id}">Купить</button>
        <a class="button button--secondary" href="../partners/">Хочу стать партнёром</a>
      </div>
      <section class="product-info-block">
        <h2>Описание</h2>
        <p>${escapeHtml(product.description)}</p>
      </section>
      <section class="product-info-block">
        <h2>Характеристики</h2>
        <div class="product-specs">
          ${characteristicsMarkup(product)}
        </div>
      </section>
      <div class="product-trust">
        <span>Цена обновляется из PDF-прайса</span>
        <span>Наличие и условия приобретения уточняются у консультанта</span>
      </div>
    </div>
  `;

  root.addEventListener("click", (event) => {
    const thumb = event.target.closest("[data-gallery-src]");

    if (thumb) {
      const main = root.querySelector("[data-gallery-main]");
      root.querySelectorAll(".product-gallery__thumb").forEach((button) => button.classList.remove("is-active"));
      thumb.classList.add("is-active");
      main.innerHTML = `<img src="${thumb.dataset.gallerySrc}" alt="${thumb.dataset.galleryAlt}" loading="lazy">`;
      return;
    }

    const buyButton = event.target.closest("[data-buy-product]");

    if (buyButton) {
      addToCart(buyButton.dataset.buyProduct);
      buyButton.textContent = "В корзине";
    }
  });
}
