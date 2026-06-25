export function getBasePath() {
  if (window.location.pathname.includes("/pages/")) {
    return "../../";
  }

  if (window.location.pathname.includes("/admin/")) {
    return "../";
  }

  return "";
}

export async function fetchJson(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${getBasePath()}${path}${separator}v=20260619-2`);

  if (!response.ok) {
    throw new Error(`Cannot load ${path}`);
  }

  return response.json();
}

export function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);
}

export const FAMALL_WHATSAPP_URL = "https://wa.me/79955825651";
export const FAMALL_MAX_URL = "https://watbot.ru/w/EreH";
export const FAMALL_REVIEWS_URL = "https://t.me/+uBj5ab9tE145OTEy";
const CART_STORAGE_KEY = "famall-cart";

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function productImageLabel(product) {
  return product.imageLabel || product.sku || "FAMALL";
}

export function productImageMarkup(product) {
  if (isProductImagePlaceholder(product)) {
    return placeholderImageMarkup();
  }

  if (product.image) {
    return `<img src="${getBasePath()}${product.image}" alt="${escapeHtml(product.name)}" loading="lazy">`;
  }

  return placeholderImageMarkup();
}

function placeholderImageMarkup() {
  return `
    <span class="product-image-placeholder" role="img" aria-label="Фото скоро появится">
      <span class="product-image-placeholder__icon" aria-hidden="true"></span>
      <span class="product-image-placeholder__title">Фото скоро появится</span>
      <span class="product-image-placeholder__text">Каталог обновляется</span>
    </span>
  `;
}

export function isProductImagePlaceholder(product) {
  const image = String(product.image || "");
  return (
    !image
    || image.includes("placeholder")
    || image.includes("placeholders/")
    || String(product.imageType || "").includes("placeholder")
    || product.status === "need_image"
  );
}

export function getProductGallery(product) {
  if (isProductImagePlaceholder(product)) {
    return [];
  }

  if (Array.isArray(product.gallery) && product.gallery.length) {
    return product.gallery;
  }

  if (product.image) {
    return [{ type: product.imageType || "source", src: product.image, alt: product.name }];
  }

  return [];
}

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartCount();
}

export function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const item = cart.find((entry) => entry.productId === productId);

  if (item) {
    item.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }

  saveCart(cart);
}

export function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find((entry) => entry.productId === productId);

  if (!item) {
    return;
  }

  item.quantity = quantity;
  saveCart(item.quantity > 0 ? cart : cart.filter((entry) => entry.productId !== productId));
}

export function removeFromCart(productId) {
  saveCart(getCart().filter((entry) => entry.productId !== productId));
}

export function updateCartCount() {
  const total = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((badge) => {
    badge.textContent = String(total);
    badge.hidden = total === 0;
  });
}

export function maxUrl() {
  return FAMALL_MAX_URL;
}

export function whatsappMessageUrl(message) {
  return `${FAMALL_WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}

export function questionUrl(product, messenger = "max") {
  const message = `Здравствуйте. Хочу уточнить информацию о товаре: ${product.name}`;

  return messenger === "whatsapp" ? whatsappMessageUrl(message) : maxUrl(message);
}

export function availabilityUrl(product) {
  return questionUrl(product);
}

function buildOrderMessage(rows, total) {
  const lines = rows.map(({ product, quantity, lineTotal }) => {
    return `- ${product.name} — ${quantity} шт. = ${lineTotal.toLocaleString("ru-RU")} ₽`;
  });
  const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);

  return [
    "Здравствуйте. Хочу оформить заказ FAMALL.",
    "",
    "Товары:",
    ...lines,
    "Количество:",
    `${quantity} шт.`,
    `Итого: ${total.toLocaleString("ru-RU")} ₽`,
    "",
    "Подскажите, пожалуйста, наличие и варианты получения заказа."
  ].join("\n");
}

export function orderMessengerUrl(rows, total, messenger = "max") {
  const message = buildOrderMessage(rows, total);

  return messenger === "whatsapp" ? whatsappMessageUrl(message) : maxUrl(message);
}

export function orderWhatsAppUrl(rows, total) {
  return orderMessengerUrl(rows, total, "whatsapp");
}

export function phoneUrl() {
  return "";
}

export function whatsappUrl() {
  return whatsappMessageUrl("Здравствуйте! Хочу уточнить информацию по FAMALL.");
}

export function formConsentMarkup(basePath = getBasePath()) {
  return `
    <p class="form-consent">
      Нажимая кнопку отправки, я принимаю условия
      <a href="${basePath}pages/oferta/">Публичной оферты</a>,
      <a href="${basePath}pages/privacy/">Политики конфиденциальности</a>
      и даю
      <a href="${basePath}pages/consent/">согласие на обработку персональных данных</a>.
    </p>
  `;
}
