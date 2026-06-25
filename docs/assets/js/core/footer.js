import { getBasePath } from "../modules/store.js?v=20260623-1";
import { FAMALL_LOGIN_URL, FAMALL_WORLD_URL, VK_BLOG_URL } from "./header.js?v=20260623-1";

const FOOTER_SECTIONS = [
  { label: "Каталог", href: "pages/catalog/" },
  { label: "Бренды", href: "pages/brands/" },
  { label: "Купить тетрадь", href: "pages/workbook/" },
  { label: "ИИ-помощник", href: "pages/workbook/#ai-helper" },
  { label: "Новости", href: "pages/news/" },
  { label: "Отзывы", href: "pages/reviews/" },
  { label: "Партнёрам", href: "pages/partners/" },
  { label: "Контакты", href: "pages/contacts/" },
  { label: "Официальный сайт", href: FAMALL_WORLD_URL, external: true },
  { label: "Кабинет дистрибьютора", href: FAMALL_LOGIN_URL, external: true }
];

function footerLinkMarkup(item, basePath) {
  const href = item.external ? item.href : `${basePath}${item.href}`;
  const externalAttrs = item.external ? ' target="_blank" rel="noopener"' : "";

  return `<a href="${href}"${externalAttrs}>${item.label}</a>`;
}

export function buildFooterMarkup(basePath) {
  const year = new Date().getFullYear();
  const sectionLinks = FOOTER_SECTIONS
    .map((item) => footerLinkMarkup(item, basePath))
    .join("");

  return `
    <div class="site-footer__inner">
      <div class="site-footer__brand">
        <img class="site-footer__logo" src="${basePath}assets/images/famall-logo.png?v=20260607" alt="FAMALL">
        <p>© ${year} FAMALL</p>
        <p>ИП Демьяненко Виктория Александровна</p>
        <p>ИНН 861101191064</p>
        <p><a href="mailto:info@famall.online">info@famall.online</a></p>
      </div>
      <nav class="site-footer__sections" aria-label="Разделы сайта">
        <strong>Разделы сайта</strong>
        ${sectionLinks}
      </nav>
      <div class="site-footer__blog">
        <strong>Личный блог Виктории</strong>
        <p>FAMALL • ИИ • бизнес • недвижимость • маркетинг</p>
        <a class="site-footer__vk-button" href="${VK_BLOG_URL}" target="_blank" rel="noopener">Подписаться ВКонтакте</a>
      </div>
    </div>
    <nav class="site-footer__legal" aria-label="Юридическая информация">
      <strong class="site-footer__legal-title">Юридическая информация</strong>
      <a href="${basePath}pages/oferta/">Публичная оферта</a>
      <a href="${basePath}pages/privacy/">Политика конфиденциальности</a>
      <a href="${basePath}pages/consent/">Согласие на обработку персональных данных</a>
      <a href="${basePath}pages/marketing-consent/">Согласие на информационные сообщения</a>
      <a href="${basePath}pages/refund/">Возврат и отмена</a>
      <a href="${basePath}pages/requisites/">Реквизиты</a>
    </nav>
  `;
}

export function renderSiteFooter() {
  const footer = document.querySelector('[data-component="site-footer"]');

  if (!footer) {
    return false;
  }

  footer.className = "site-footer";
  footer.innerHTML = buildFooterMarkup(getBasePath());

  return Boolean(footer.innerHTML.trim());
}
