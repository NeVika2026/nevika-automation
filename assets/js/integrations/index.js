import { crmAdapter } from "./crm.js";
import { paymentAdapter } from "./payment.js";
import { telegramAdapter } from "./telegram.js";

export function initIntegrations() {
  crmAdapter.init();
  paymentAdapter.init();
  telegramAdapter.init();
}
