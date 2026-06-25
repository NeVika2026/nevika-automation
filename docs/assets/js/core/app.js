import { initCartPage } from "../modules/cart.js?v=20260619-2";
import { initCatalogPage } from "../modules/catalog.js?v=20260619-2";
import { initHomePage } from "../modules/home.js?v=20260619-2";
import { initNewsPage } from "../modules/news.js?v=20260619-2";
import { initProductPage } from "../modules/product.js?v=20260619-2";
import { initPromoSlots } from "../modules/promos.js?v=20260619-2";
import { initHomeNewsFeed } from "../modules/rss-news.js?v=20260619-2";
import { FAMALL_REVIEWS_URL, formConsentMarkup, getBasePath, maxUrl, updateCartCount, whatsappUrl } from "../modules/store.js?v=20260619-2";
import { bindHeaderMenu, buildHeaderMarkup, renderSiteHeader } from "./header.js?v=20260619-2";
import { buildFooterMarkup, renderSiteFooter } from "./footer.js?v=20260619-2";

function applyLayoutFallback() {
  const basePath = getBasePath();
  const currentPage = document.body.dataset.page || "home";
  const header = document.querySelector('[data-component="site-header"]');
  const footer = document.querySelector('[data-component="site-footer"]');

  if (header && !header.querySelector(".site-header__inner")) {
    header.className = "site-header";
    header.innerHTML = buildHeaderMarkup(basePath, currentPage);
    bindHeaderMenu(header);
  }

  if (footer && !footer.querySelector(".site-footer__inner")) {
    footer.className = "site-footer";
    footer.innerHTML = buildFooterMarkup(basePath);
  }
}

function bootstrapLayout() {
  let headerRendered = false;
  let footerRendered = false;

  try {
    headerRendered = renderSiteHeader();
    footerRendered = renderSiteFooter();
  } catch (error) {
    console.error("FAMALL layout render failed:", error);
  }

  if (!headerRendered || !footerRendered) {
    applyLayoutFallback();
  }
}

function injectFormConsent() {
  try {
    const markup = formConsentMarkup(getBasePath());

    document.querySelectorAll("[data-form-consent]").forEach((node) => {
      node.innerHTML = markup;
    });

    document.querySelectorAll("form").forEach((form) => {
      if (form.querySelector(".form-consent")) {
        return;
      }

      form.insertAdjacentHTML("beforeend", markup);
    });
  } catch (error) {
    console.error("FAMALL form consent render failed:", error);
  }
}

function renderFloatingContact() {
  if (document.querySelector("[data-floating-contact]")) {
    return;
  }

  const contact = document.createElement("aside");
  contact.className = "floating-contact";
  contact.setAttribute("data-floating-contact", "");
  contact.setAttribute("aria-label", "Быстрая связь с FAMALL");
  contact.innerHTML = `
    <a class="floating-contact__item floating-contact__item--max btn--max contact-max" href="${maxUrl()}" target="_blank" rel="noopener">MAX</a>
    <a class="floating-contact__item floating-contact__item--whatsapp contact-whatsapp" href="${whatsappUrl()}" target="_blank" rel="noopener">WhatsApp</a>
    <a class="floating-contact__item floating-contact__item--reviews contact-reviews" href="${FAMALL_REVIEWS_URL}" target="_blank" rel="noopener">Отзывы о продукции</a>
  `;
  document.body.append(contact);
}

function bootstrapApp() {
  bootstrapLayout();
  renderFloatingContact();
  injectFormConsent();
  updateCartCount();
  initCatalogPage();
  initHomePage();
  initHomeNewsFeed();
  initProductPage();
  initCartPage();
  initNewsPage();
  initPromoSlots();
}

bootstrapApp();
