import {
  escapeHtml,
  fetchJson,
  formatPrice,
  formConsentMarkup,
  getBasePath,
  getCart,
  orderMessengerUrl,
  productImageMarkup,
  removeFromCart,
  saveCart,
  updateCartQuantity
} from "./store.js?v=20260623-1";

function getRows(cart, products) {
  const productMap = new Map(products.map((product) => [product.id, product]));

  return cart
    .map((item) => {
      const product = productMap.get(item.productId);

      if (!product) {
        return null;
      }

      const quantity = Math.max(1, Number(item.quantity) || 1);
      return {
        product,
        quantity,
        lineTotal: product.retailPrice * quantity
      };
    })
    .filter(Boolean);
}

function renderCart(root, products) {
  const rows = getRows(getCart(), products);
  const total = rows.reduce((sum, row) => sum + row.lineTotal, 0);

  if (!rows.length) {
    root.innerHTML = `
      <div class="empty-state">
        Корзина пуста. Добавьте товары из каталога, чтобы отправить состав заказа консультанту.
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="cart-layout">
      <div class="cart-list">
        ${rows.map(({ product, quantity, lineTotal }) => `
          <article class="cart-item">
            <a class="cart-item__image" href="../product/?id=${product.id}" aria-label="${escapeHtml(product.name)}">
              ${productImageMarkup(product)}
            </a>
            <div class="cart-item__content">
              <h2 class="cart-item__title">${escapeHtml(product.name)}</h2>
              <div class="cart-item__price">${formatPrice(product.retailPrice)} за шт.</div>
              <div class="cart-item__line-total">${formatPrice(lineTotal)}</div>
            </div>
            <div class="cart-item__actions">
              <div class="quantity-control" aria-label="Количество товара">
                <button type="button" data-cart-decrease="${product.id}" aria-label="Уменьшить количество">-</button>
                <span>${quantity}</span>
                <button type="button" data-cart-increase="${product.id}" aria-label="Увеличить количество">+</button>
              </div>
              <button class="button button--ghost" type="button" data-cart-remove="${product.id}">Удалить</button>
            </div>
          </article>
        `).join("")}
      </div>
      <aside class="cart-summary" aria-label="Итог заказа">
        <h2>Итого</h2>
        <div class="cart-summary__line">
          <span>Товары</span>
          <strong>${rows.reduce((sum, row) => sum + row.quantity, 0)}</strong>
        </div>
        <div class="cart-summary__line cart-summary__total">
          <span>Сумма</span>
          <strong>${formatPrice(total)}</strong>
        </div>
        <button class="button button--primary" type="button" data-order-choice-toggle>Оформить заказ</button>
        <div class="messenger-choice" data-order-choice hidden>
          <a class="button btn--max" href="${orderMessengerUrl(rows, total, "max")}" target="_blank" rel="noopener">Написать в MAX</a>
          <a class="button button--whatsapp" href="${orderMessengerUrl(rows, total, "whatsapp")}" target="_blank" rel="noopener">Написать в WhatsApp</a>
        </div>
        ${formConsentMarkup(getBasePath())}
        <p class="cart-summary__note">Оплата, наличие и доставка согласуются с консультантом в выбранном мессенджере.</p>
      </aside>
    </div>
  `;
}

export async function initCartPage() {
  const root = document.querySelector("[data-cart-root]");

  if (!root) {
    return;
  }

  const products = await fetchJson("data/products.json");
  const knownProductIds = new Set(products.map((product) => product.id));
  const cleanCart = getCart().filter((item) => knownProductIds.has(item.productId));

  if (cleanCart.length !== getCart().length) {
    saveCart(cleanCart);
  }

  renderCart(root, products);

  root.addEventListener("click", (event) => {
    const orderToggle = event.target.closest("[data-order-choice-toggle]");
    const increase = event.target.closest("[data-cart-increase]");
    const decrease = event.target.closest("[data-cart-decrease]");
    const remove = event.target.closest("[data-cart-remove]");

    if (orderToggle) {
      const choice = root.querySelector("[data-order-choice]");
      choice.hidden = !choice.hidden;
      return;
    }

    const productId = increase?.dataset.cartIncrease || decrease?.dataset.cartDecrease || remove?.dataset.cartRemove;

    if (!productId) {
      return;
    }

    const item = getCart().find((entry) => entry.productId === productId);

    if (remove) {
      removeFromCart(productId);
    } else if (increase && item) {
      updateCartQuantity(productId, item.quantity + 1);
    } else if (decrease && item) {
      updateCartQuantity(productId, item.quantity - 1);
    }

    renderCart(root, products);
  });
}
