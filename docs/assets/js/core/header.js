import { getBasePath } from "../modules/store.js?v=20260619-2";

export const FAMALL_WORLD_URL = "https://famallworld.com/web";
export const FAMALL_LOGIN_URL = "https://famallworld.com/login";

const NAV_ITEMS = [
  { id: "catalog", label: "Каталог", href: "pages/catalog/" },
  { id: "brands", label: "Бренды", href: "pages/about/", activeOn: ["about", "brands"] },
  { id: "new", label: "Новинки", href: "pages/new/" },
  { id: "hits", label: "Хиты", href: "pages/hits/" },
  { id: "reviews", label: "Отзывы", href: "pages/reviews/" },
  { id: "partners", label: "Партнёрам", href: "pages/partners/" },
  { id: "famall-world", label: "FAMALL World", href: FAMALL_WORLD_URL, external: true },
  { id: "contacts", label: "Контакты", href: "pages/contacts/" }
];

const MOBILE_EXTERNAL_LINKS = [
  { label: "Официальный сайт", href: FAMALL_WORLD_URL },
  { label: "Вход дистрибьютора", href: FAMALL_LOGIN_URL }
];

function isNavActive(item, currentPage) {
  if (item.external) {
    return false;
  }

  if (item.activeOn) {
    return item.activeOn.includes(currentPage);
  }

  return currentPage === item.id;
}

function navLinkMarkup(item, basePath, currentPage, className) {
  const href = item.external ? item.href : `${basePath}${item.href}`;
  const activeClass = isNavActive(item, currentPage) ? " is-active" : "";
  const externalAttrs = item.external ? ' target="_blank" rel="noopener"' : "";

  return `<a class="${className}${activeClass}" href="${href}"${externalAttrs}>${item.label}</a>`;
}

export function buildHeaderMarkup(basePath, currentPage = "home") {
  const navMarkup = NAV_ITEMS
    .map((item) => navLinkMarkup(item, basePath, currentPage, "site-header__link"))
    .join("");

  const mobileNavMarkup = NAV_ITEMS
    .map((item) => navLinkMarkup(item, basePath, currentPage, "site-header__mobile-link"))
    .join("");

  const mobileExternalMarkup = MOBILE_EXTERNAL_LINKS.map((item) => `
    <a class="site-header__mobile-link site-header__mobile-link--external" href="${item.href}" target="_blank" rel="noopener">${item.label}</a>
  `).join("");

  return `
    <div class="site-header__inner">
      <a class="site-header__brand" href="${basePath}index.html" aria-label="FAMALL — на главную">
        <img class="site-header__logo" src="${basePath}assets/images/famall-logo.png?v=20260607" alt="FAMALL">
      </a>
      <nav class="site-header__nav" aria-label="Основная навигация">
        ${navMarkup}
      </nav>
      <div class="site-header__actions">
        <a class="site-header__icon-button site-header__cart" href="${basePath}pages/cart/" aria-label="Корзина">
          Корзина
          <span class="site-header__cart-badge" data-cart-count hidden>0</span>
        </a>
        <button class="site-header__burger" type="button" aria-label="Открыть меню" aria-expanded="false">
          <span class="site-header__burger-line"></span>
          <span class="site-header__burger-line"></span>
          <span class="site-header__burger-line"></span>
        </button>
      </div>
    </div>
    <nav class="site-header__mobile-panel" aria-label="Мобильная навигация">
      ${mobileNavMarkup}
      <div class="site-header__mobile-external">
        ${mobileExternalMarkup}
      </div>
    </nav>
  `;
}

export function bindHeaderMenu(header) {
  const menuButton = header.querySelector(".site-header__burger");

  if (!menuButton || menuButton.dataset.bound === "true") {
    return;
  }

  menuButton.dataset.bound = "true";
  menuButton.addEventListener("click", () => {
    const isOpen = header.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
  });
}

export function renderSiteHeader() {
  const header = document.querySelector('[data-component="site-header"]');

  if (!header) {
    return false;
  }

  const basePath = getBasePath();
  const currentPage = document.body.dataset.page || "home";

  header.className = "site-header";
  header.innerHTML = buildHeaderMarkup(basePath, currentPage);
  bindHeaderMenu(header);

  return Boolean(header.innerHTML.trim());
}
