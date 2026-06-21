import { escapeHtml, fetchJson } from "./store.js?v=20260619-2";

function promoMarkup(promo, variant) {
  const title = escapeHtml(promo.title);
  const eyebrow = escapeHtml(promo.eyebrow || "Акция FAMALL");
  const subtitle = escapeHtml(promo.subtitle || "");
  const text = escapeHtml(promo.text || "");
  const bonus = escapeHtml(promo.bonus || "Бонус: электронная валюта");
  const note = escapeHtml(promo.note || "Подробные условия участия и начисления бонуса уточняйте у консультанта.");
  const ctaLabel = escapeHtml(promo.ctaLabel || "Уточнить условия");
  const ctaUrl = promo.ctaUrl || "#";
  const variantClass = variant === "partners" ? " referral-promo--partners" : "";

  return `
    <div class="referral-promo referral-promo-2026${variantClass}" data-promo-id="referral-promo-2026">
      <div class="referral-promo__content">
        <p class="referral-promo__eyebrow">${eyebrow}</p>
        <h2 class="referral-promo__title">${title}</h2>
        ${subtitle ? `<p class="referral-promo__subtitle">${subtitle}</p>` : ""}
        <p class="referral-promo__text">${text}</p>
        <span class="referral-promo__bonus">${bonus}</span>
        <p class="referral-promo__note">${note}</p>
        <div class="referral-promo__actions">
          <a class="button btn--max" href="${ctaUrl}" target="_blank" rel="noopener">${ctaLabel}</a>
          <a class="button button--secondary" href="${variant === "home" ? "pages/catalog/" : "../catalog/"}">Смотреть каталог</a>
        </div>
      </div>
      <div class="referral-promo__badge" aria-hidden="true">
        <span>5 000 ₽</span>
        <strong>до 31.07.2026</strong>
      </div>
    </div>
  `;
}

export async function initPromoSlots() {
  const slots = document.querySelectorAll('[data-promo-slot="referral-promo-2026"]');

  if (!slots.length) {
    return;
  }

  const items = await fetchJson("data/news.json");
  const promo = items.find((item) => item.id === "referral-promo-2026");

  if (!promo || promo.active === false) {
    slots.forEach((slot) => {
      slot.hidden = true;
      slot.innerHTML = "";
    });
    return;
  }

  slots.forEach((slot) => {
    const variant = slot.dataset.promoVariant || "home";
    slot.hidden = false;
    slot.innerHTML = promoMarkup(promo, variant);
  });
}
