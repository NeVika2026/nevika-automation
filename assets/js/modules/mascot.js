import { getBasePath } from "./store.js?v=20260619-2";

const MASCOT_CONFIG = {
  enabled: true,
  size: 62,
  speed: 1,
  mobileEnabled: true,
  frequency: 9000,
  showBall: true,
  asset: "assets/mascot/cat/famall-cat.svg",
  hiddenPages: ["catalog", "product", "hits", "new", "sale", "cart"]
};

const STATES = ["idle", "walk", "sit", "chase-ball"];
const STORAGE_KEY = "famall-mascot-hidden";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function nextState(current) {
  const available = STATES.filter((state) => state !== current);
  return available[Math.floor(Math.random() * available.length)];
}

export function initMascot(config = MASCOT_CONFIG) {
  if (!config.enabled || document.querySelector("[data-famall-mascot]")) {
    return;
  }

  if (config.hiddenPages?.includes(document.body.dataset.page)) {
    return;
  }

  if (localStorage.getItem(STORAGE_KEY) === "true") {
    return;
  }

  if (!config.mobileEnabled && window.matchMedia("(max-width: 620px)").matches) {
    return;
  }

  const mascot = document.createElement("aside");
  mascot.className = "famall-mascot is-idle";
  mascot.setAttribute("data-famall-mascot", "");
  mascot.setAttribute("aria-label", "Декоративный маскот FAMALL");
  mascot.style.setProperty("--mascot-size", `${config.size}px`);
  mascot.style.setProperty("--mascot-speed", String(config.speed));
  mascot.innerHTML = `
    <button class="famall-mascot__close" type="button" aria-label="Скрыть маскота">×</button>
    <span class="famall-mascot__ball" aria-hidden="true"></span>
    <img class="famall-mascot__cat" src="${getBasePath()}${config.asset}" alt="" aria-hidden="true">
  `;

  if (!config.showBall) {
    mascot.classList.add("is-ball-hidden");
  }

  document.body.append(mascot);

  mascot.querySelector(".famall-mascot__close").addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    mascot.remove();
  });

  if (prefersReducedMotion()) {
    mascot.classList.add("is-reduced-motion");
    return;
  }

  let currentState = "idle";
  window.setInterval(() => {
    currentState = nextState(currentState);
    mascot.className = `famall-mascot is-${currentState}`;
  }, config.frequency);
}
