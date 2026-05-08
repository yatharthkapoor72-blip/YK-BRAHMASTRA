const STORAGE_KEY = "yk-pay-smart-v1";
const AUTH_STORAGE_KEY = "yk-pay-smart-role";
const APP_NAME = "YK BRAHMASTRA";
const OWNER_PASSWORD = "Yatharth@98761";
const FINANCE_PASSWORD = "FINANCE@YK";
const STORE_PASSWORD = "STORE@YK";
const QUALITY_PASSWORD = "QUALITY@YK";
const BALANCE_ADJUSTMENT_PASSWORD = "Yatharth@98761";
const DATA_RETENTION_DAYS = 730;
const DAYBOOK_RETENTION_DAYS = 180;
const CRUX_RETENTION_DAYS = 30;

const amountFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const viewTitles = {
  dashboard: "Dashboard",
  store: "Store Desk",
  approvals: "Approval Requests",
  vendors: "Vendors",
  purchases: "Purchases",
  "purchase-predictor": "Purchase Predictor",
  "make-payment": "Make Payment",
  "payment-in": "Payment In",
  debt: "Debt",
  scheduled: "Scheduled Payments",
  expected: "Expected Payments",
  reports: "Reports",
  pdc: "PDC Register",
  cashbank: "Banks & Cash",
  salaries: "Salaries",
  daybook: "Daybook",
  crux: "Crux of the Day",
  expenses: "Expenses",
  receipts: "Payment Receipts",
  settings: "Settings & Data",
};

const pdcStatuses = ["Pending", "Deposited", "Cleared", "Bounced", "Cancelled"];
const forecastStatuses = ["Open", "Received", "Delayed", "Cancelled"];
const roleAllowedViews = {
  finance: new Set(["vendors", "purchases", "purchase-predictor", "make-payment", "scheduled", "reports", "pdc", "salaries", "expenses", "approvals"]),
  store: new Set(["store"]),
  quality: new Set(["approvals"]),
};
const financeAllowedViews = roleAllowedViews.finance;
const financeReportGroups = new Set(["Vendor Payments", "Purchases", "Purchase Forecasts", "Expenses", "Scheduled Expenses", "Post-Dated Cheques", "Salaries"]);
const reportTypeOptions = ["All Transactions", "Vendor Payments", "Purchases", "Purchase Forecasts", "Expenses", "Scheduled Expenses", "Post-Dated Cheques", "Salaries", "Debt", "Debt Accruals", "Debt Payments", "Payments In", "Receipts"];
const arrayKeys = [
  "accounts",
  "vendors",
  "purchaseCategories",
  "purchases",
  "purchasePredictorItems",
  "purchasePredictorVendors",
  "purchasePredictions",
  "stockItems",
  "storeMovements",
  "vendorPayments",
  "paymentIns",
  "debts",
  "debtAccruals",
  "debtPayments",
  "expenses",
  "expensePayments",
  "expenseCategories",
  "transfers",
  "withdrawals",
  "balanceAdjustments",
  "pdcs",
  "salaryEntries",
  "forecasts",
  "receipts",
  "dayCloses",
];

let state = loadState();
let currentView = "dashboard";
let currentRole = getStoredRole();

document.addEventListener("DOMContentLoaded", () => {
  bindLogin();
  bindNavigation();
  bindForms();
  bindActions();
  if (!currentRole) {
    lockApp();
    return;
  }
  unlockApp();
  setInitialDates();
  applyRoleAccess();
  switchView(canAccessView(currentView) ? currentView : getDefaultViewForRole());
});

function defaultState() {
  return {
    settings: {
      businessName: APP_NAME,
      openingCash: 0,
      receiptPrefix: "RCP",
      lowBalanceAlert: 10000,
      businessDate: todayInput(),
      expectedMonthlySalary: 0,
      syncUrl: "",
      syncToken: "",
      lastSyncAt: "",
    },
    accounts: [],
    vendors: [],
    purchaseCategories: [],
    purchases: [],
    purchasePredictorItems: [],
    purchasePredictorVendors: [],
    purchasePredictions: [],
    stockItems: [],
    storeMovements: [],
    vendorPayments: [],
    paymentIns: [],
    debts: [],
    debtAccruals: [],
    debtPayments: [],
    expenses: [],
    expensePayments: [],
    expenseCategories: [],
    transfers: [],
    withdrawals: [],
    balanceAdjustments: [],
    pdcs: [],
    salaryEntries: [],
    forecasts: [],
    receipts: [],
    dayCloses: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return applyRetention(normalizeState(JSON.parse(raw)));
  } catch (error) {
    console.error(error);
    return defaultState();
  }
}

function normalizeState(value) {
  const fallback = defaultState();
  const merged = {
    ...fallback,
    ...value,
    settings: { ...fallback.settings, ...(value?.settings || {}) },
  };

  arrayKeys.forEach((key) => {
    if (!Array.isArray(merged[key])) merged[key] = [];
  });

  if (!merged.settings.businessName || merged.settings.businessName === "Your Business" || merged.settings.businessName === "YK PAY SMART") {
    merged.settings.businessName = APP_NAME;
  }

  merged.stockItems = merged.stockItems.map((item) => ({
    ...item,
    name: item.name || "Item",
    unit: item.unit || "unit",
  }));

  merged.storeMovements = merged.storeMovements.map((movement) => ({
    ...movement,
    type: movement.type || "IN",
    date: movement.date || todayInput(),
    vendorId: movement.vendorId || "",
    itemId: movement.itemId || "",
    itemName: movement.itemName || stockItemName(movement.itemId, merged) || "Item",
    billNo: movement.billNo || "",
    specifiedQty: numberValue(movement.specifiedQty),
    receivedQty: numberValue(movement.receivedQty),
    outQty: numberValue(movement.outQty),
    approvedQty: numberValue(movement.approvedQty),
    rejectedQty: numberValue(movement.rejectedQty),
    status: movement.status || (movement.type === "OUT" ? "Stock Out" : "Pending Quality"),
    financeStatus: movement.financeStatus || (movement.purchaseId ? "Booked" : "Pending Finance"),
    qualityNotes: movement.qualityNotes || "",
    purchaseId: movement.purchaseId || "",
  }));

  merged.expenses = merged.expenses.map((expense) => {
    const isUnpaidFlow = expense.expenseType === "Unpaid" || expense.status === "Booked" || Boolean(expense.expensePaymentId) || Boolean(expense.dueDate && expense.dueDate !== expense.date);
    return {
      ...expense,
      expenseType: isUnpaidFlow ? "Unpaid" : "Immediate",
      dueDate: expense.dueDate || expense.date || todayInput(),
      paidDate: expense.status === "Paid" ? expense.paidDate || expense.date || todayInput() : expense.paidDate || "",
      mode: expense.mode || "",
      accountId: expense.accountId || "",
      notes: expense.notes || "",
    };
  });

  const noActivity = arrayKeys
    .filter((key) => key !== "accounts")
    .every((key) => !merged[key].length);
  if (
    noActivity &&
    merged.accounts.length === 1 &&
    merged.accounts[0].id === "bank-main" &&
    merged.accounts[0].name === "Main Bank Account" &&
    numberValue(merged.accounts[0].openingBalance) === 0
  ) {
    merged.accounts = [];
  }

  return merged;
}

function saveState() {
  state = applyRetention(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyRetention(nextState) {
  if (!nextState?.settings) return nextState;
  const anchorDate = nextState.settings.businessDate || todayInput();
  const dataCutoff = addDays(anchorDate, -DATA_RETENTION_DAYS + 1);
  const cruxCutoff = addDays(anchorDate, -CRUX_RETENTION_DAYS + 1);
  const keepByDate = (item) => {
    const date = getRecordDate(item);
    return !date || date >= dataCutoff;
  };
  [
    "purchases",
    "purchasePredictions",
    "storeMovements",
    "vendorPayments",
    "paymentIns",
    "debtAccruals",
    "debtPayments",
    "expenses",
    "expensePayments",
    "transfers",
    "withdrawals",
    "balanceAdjustments",
    "pdcs",
    "salaryEntries",
    "forecasts",
    "receipts",
  ].forEach((key) => {
    if (Array.isArray(nextState[key])) nextState[key] = nextState[key].filter(keepByDate);
  });
  if (Array.isArray(nextState.dayCloses)) {
    nextState.dayCloses = nextState.dayCloses.filter((item) => item.date >= cruxCutoff && item.date <= anchorDate);
  }
  return nextState;
}

function getRecordDate(item) {
  return item?.date || item?.paidDate || item?.dueDate || item?.createdAt?.slice?.(0, 10) || "";
}

function getStoredRole() {
  try {
    const role = sessionStorage.getItem(AUTH_STORAGE_KEY) || "";
    return ["owner", "finance", "store", "quality"].includes(role) ? role : "";
  } catch (error) {
    return "";
  }
}

function storeRole(role) {
  currentRole = role;
  try {
    if (role) sessionStorage.setItem(AUTH_STORAGE_KEY, role);
    else sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    // Session storage can be unavailable in strict browser modes; the in-memory role still works.
  }
}

function isOwnerRole() {
  return currentRole === "owner";
}

function isFinanceRole() {
  return currentRole === "finance";
}

function isStoreRole() {
  return currentRole === "store";
}

function isQualityRole() {
  return currentRole === "quality";
}

function getDefaultViewForRole() {
  if (isFinanceRole()) return "purchase-predictor";
  if (isStoreRole()) return "store";
  if (isQualityRole()) return "approvals";
  return "dashboard";
}

function canAccessView(view) {
  if (!currentRole) return false;
  if (isOwnerRole()) return true;
  return Boolean(roleAllowedViews[currentRole]?.has(view));
}

function requireOwnerAction(message = "This action is restricted to owner login.") {
  if (isOwnerRole()) return true;
  showToast(message);
  return false;
}

function bindLogin() {
  const form = qs("[data-login-form]");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const password = form.elements.password.value;
    let role = "";
    if (password === OWNER_PASSWORD) role = "owner";
    if (password === FINANCE_PASSWORD) role = "finance";
    if (password === STORE_PASSWORD) role = "store";
    if (password === QUALITY_PASSWORD) role = "quality";
    if (!role) {
      const error = qs("[data-login-error]");
      if (error) error.textContent = "Incorrect password.";
      form.elements.password.value = "";
      form.elements.password.focus();
      return;
    }
    storeRole(role);
    const error = qs("[data-login-error]");
    if (error) error.textContent = "";
    form.reset();
    unlockApp();
    setInitialDates();
    applyRoleAccess();
    switchView(getDefaultViewForRole());
  });
}

function lockApp() {
  document.body.classList.add("locked");
  document.body.dataset.role = "";
  const password = qs('[data-login-form] [name="password"]');
  if (password) password.focus();
}

function unlockApp() {
  document.body.classList.remove("locked");
  document.body.dataset.role = currentRole;
}

function logout() {
  clearSensitiveDom();
  storeRole("");
  currentView = "dashboard";
  qsa(".view").forEach((section) => section.classList.remove("active"));
  lockApp();
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function addSubmit(id, handler) {
  const form = document.getElementById(id);
  if (form) form.addEventListener("submit", handler);
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function parseInputDate(dateInput) {
  const [year, month, day] = String(dateInput || todayInput()).split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function dateToInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateInput, days) {
  const date = parseInputDate(dateInput);
  date.setDate(date.getDate() + days);
  return dateToInput(date);
}

function isSameMonth(dateInput, monthDate = state.settings.businessDate) {
  if (!dateInput || !monthDate) return false;
  return dateInput.slice(0, 7) === monthDate.slice(0, 7);
}

function monthKey(dateInput = state.settings.businessDate) {
  return String(dateInput || state.settings.businessDate).slice(0, 7);
}

function addMonths(monthInput, count) {
  const [year, month] = String(monthInput || monthKey()).split("-").map(Number);
  const date = new Date(year || 1970, (month || 1) - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthEndInput(monthInput) {
  const [year, month] = String(monthInput || monthKey()).split("-").map(Number);
  return dateToInput(new Date(year || 1970, month || 1, 0));
}

function monthDayInput(monthInput, day) {
  const [year, month] = String(monthInput || monthKey()).split("-").map(Number);
  return dateToInput(new Date(year || 1970, (month || 1) - 1, Math.min(day, daysInMonth(`${monthInput}-01`))));
}

function formatDate(dateInput) {
  if (!dateInput) return "";
  return dateFormat.format(new Date(`${dateInput}T00:00:00`));
}

function isInputDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && dateToInput(parseInputDate(value)) === value;
}

function formatAmount(value) {
  return `INR ${amountFormat.format(Number(value || 0))}`;
}

function amountInWords(value) {
  const amount = Math.abs(numberValue(value));
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const rupeeWords = `${numberToIndianWords(rupees)} rupees`;
  return paise ? `${rupeeWords} and ${numberToIndianWords(paise)} paise` : rupeeWords;
}

function numberToIndianWords(value) {
  const number = Math.floor(numberValue(value));
  if (number === 0) return "zero";

  const parts = [];
  const crore = Math.floor(number / 10000000);
  const lakh = Math.floor((number % 10000000) / 100000);
  const thousand = Math.floor((number % 100000) / 1000);
  const rest = number % 1000;

  if (crore) parts.push(`${wordsBelowThousand(crore)} crore`);
  if (lakh) parts.push(`${wordsBelowThousand(lakh)} lakh`);
  if (thousand) parts.push(`${wordsBelowThousand(thousand)} thousand`);
  if (rest) parts.push(wordsBelowThousand(rest));

  return parts.join(" ");
}

function wordsBelowThousand(value) {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  let number = Math.floor(numberValue(value));
  const words = [];

  if (number >= 100) {
    words.push(`${ones[Math.floor(number / 100)]} hundred`);
    number %= 100;
  }
  if (number >= 20) {
    words.push(tens[Math.floor(number / 10)]);
    number %= 10;
  }
  if (number >= 10) {
    words.push(teens[number - 10]);
    number = 0;
  }
  if (number > 0) words.push(ones[number]);
  return words.join(" ");
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setInitialDates() {
  const date = state.settings?.businessDate || todayInput();
  qsa('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = date;
  });
  const daybookDate = qs("[data-daybook-date]");
  if (daybookDate && !daybookDate.value) daybookDate.value = date;
}

function bindNavigation() {
  qsa("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewTarget));
  });
}

function switchView(view) {
  if (!currentRole) {
    lockApp();
    return;
  }
  if (!canAccessView(view)) view = getDefaultViewForRole();
  currentView = view;
  qsa(".view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
  qsa(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.viewTarget === view));
  const title = qs("[data-view-title]");
  if (title) title.textContent = viewTitles[view] || "Dashboard";
  render();
}

function applyRoleAccess() {
  qsa("[data-view-target]").forEach((button) => {
    const target = button.dataset.viewTarget;
    if (!target) return;
    button.hidden = !canAccessView(target);
  });
  const overdues = qs("[data-overdues-dropdown]");
  if (overdues) overdues.hidden = !isOwnerRole();
  qsa('[data-action="export-json"],[data-action="clear-data"],[data-action="download-crux-html"],[data-action="print-crux"]').forEach((node) => {
    node.hidden = !isOwnerRole();
  });
  qsa("#view-salaries .panel").forEach((panel, index) => {
    if (!isFinanceRole()) {
      panel.hidden = false;
      return;
    }
    panel.hidden = index !== 1 && index !== 4;
  });
  const salarySchedule = qs("[data-salary-schedule]");
  if (salarySchedule) salarySchedule.hidden = isFinanceRole();
  const pdcDirection = qs('#pdc-form [name="direction"]');
  if (pdcDirection) {
    qsa('option[value="receivable"]', pdcDirection).forEach((option) => {
      option.hidden = isFinanceRole();
    });
    if (isFinanceRole() && pdcDirection.value === "receivable") pdcDirection.value = "payable";
  }
  const qualityPanel = qs("[data-quality-approval-table]")?.closest(".panel");
  if (qualityPanel) qualityPanel.hidden = isFinanceRole();
  const financePanel = qs("[data-finance-approval-table]")?.closest(".panel");
  if (financePanel) financePanel.hidden = isQualityRole();
  renderReportTypeOptions();
}

function bindForms() {
  addSubmit("vendor-form", handleVendorSubmit);
  addSubmit("stock-item-form", handleStockItemSubmit);
  addSubmit("store-in-form", handleStoreInSubmit);
  addSubmit("store-out-form", handleStoreOutSubmit);
  addSubmit("purchase-category-form", handlePurchaseCategorySubmit);
  addSubmit("purchase-form", handlePurchaseSubmit);
  addSubmit("predictor-item-form", handlePredictorItemSubmit);
  addSubmit("predictor-vendor-form", handlePredictorVendorSubmit);
  addSubmit("purchase-prediction-form", handlePurchasePredictionSubmit);
  addSubmit("vendor-payment-form", handleVendorPaymentSubmit);
  addSubmit("payment-in-form", handlePaymentInSubmit);
  addSubmit("debt-form", handleDebtSubmit);
  addSubmit("pdc-form", handlePdcSubmit);
  addSubmit("account-form", handleAccountSubmit);
  addSubmit("transfer-form", handleTransferSubmit);
  addSubmit("withdrawal-form", handleWithdrawalSubmit);
  addSubmit("balance-adjustment-form", handleBalanceAdjustmentSubmit);
  addSubmit("salary-settings-form", handleSalarySettingsSubmit);
  addSubmit("salary-book-form", handleSalaryBookSubmit);
  addSubmit("salary-advance-form", handleSalaryAdvanceSubmit);
  addSubmit("salary-pay-form", handleSalaryPaySubmit);
  addSubmit("expense-category-form", handleExpenseCategorySubmit);
  addSubmit("expense-form", handleExpenseSubmit);
  addSubmit("booked-expense-form", handleBookedExpenseSubmit);
  addSubmit("receipt-form", handleReceiptSubmit);
  addSubmit("forecast-form", handleForecastSubmit);
  addSubmit("settings-form", handleSettingsSubmit);

  document.addEventListener("change", (event) => {
    const pdcSelect = event.target.closest("[data-pdc-status]");
    if (pdcSelect) return updatePdcStatus(pdcSelect.dataset.pdcStatus, pdcSelect.value);

    const forecastSelect = event.target.closest("[data-forecast-status]");
    if (forecastSelect) return updateForecastStatus(forecastSelect.dataset.forecastStatus, forecastSelect.value);

    if (event.target.matches('#debt-form [name="repaymentTerms"], #debt-form [name="entryType"]')) return renderDebtFormState();
    if (event.target.matches('#purchase-prediction-form [name="itemId"]')) return renderPurchasePredictor();
    if (event.target.matches('#purchase-prediction-form select, #purchase-prediction-form input')) return renderPurchasePredictionPreview();
    if (event.target.matches('#predictor-vendor-form [name="itemId"]')) return renderPurchasePredictor();
    if (event.target.matches("[data-make-payment-vendor]")) return renderMakePayment();
    if (event.target.matches("[data-payable-checkbox]")) return renderPaymentSelectionSummary();
    if (event.target.matches("[data-unpaid-expense-category-filter]")) return renderUnpaidExpensePayment();
    if (event.target.matches("[data-unpaid-expense-checkbox]")) return renderUnpaidExpenseSelectionSummary();
    if (event.target.matches("[data-report-type],[data-report-start],[data-report-end]")) return renderReports();
    if (event.target.matches("[data-daybook-date]")) return renderDaybook();
    if (event.target.matches("[data-crux-date]")) return renderCrux();
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches('#purchase-prediction-form input, #purchase-prediction-form select')) {
      return renderPurchasePredictionPreview();
    }
  });

  document.addEventListener("click", (event) => {
    const receiptButton = event.target.closest("[data-print-receipt-id]");
    if (receiptButton) return printReceipt(receiptButton.dataset.printReceiptId, "receipts");

    const vendorReceiptButton = event.target.closest("[data-print-vendor-payment-id]");
    if (vendorReceiptButton) return printVendorPayment(vendorReceiptButton.dataset.printVendorPaymentId);

    const pdcReceiptButton = event.target.closest("[data-print-pdc-id]");
    if (pdcReceiptButton) return printPdcReceipt(pdcReceiptButton.dataset.printPdcId);

    const expenseReceiptButton = event.target.closest("[data-print-expense-payment-id]");
    if (expenseReceiptButton) return printExpensePayment(expenseReceiptButton.dataset.printExpensePaymentId);

    const forecastReceivedButton = event.target.closest("[data-forecast-received]");
    if (forecastReceivedButton) return markForecastReceived(forecastReceivedButton.dataset.forecastReceived);

    const forecastDelayedButton = event.target.closest("[data-forecast-delayed]");
    if (forecastDelayedButton) return markForecastDelayed(forecastDelayedButton.dataset.forecastDelayed);

    const forecastCancelledButton = event.target.closest("[data-forecast-cancelled]");
    if (forecastCancelledButton) return updateForecastStatus(forecastCancelledButton.dataset.forecastCancelled, "Cancelled");

    const overdueViewButton = event.target.closest("[data-overdue-view]");
    if (overdueViewButton) {
      const dropdown = qs("[data-overdues-dropdown]");
      if (dropdown) dropdown.open = false;
      return switchView(overdueViewButton.dataset.overdueView);
    }

    const debtInterestButton = event.target.closest("[data-pay-overdue-debt-interest]");
    if (debtInterestButton) return payOverdueDebtInterest(debtInterestButton.dataset.payOverdueDebtInterest);

    const payExpenseButton = event.target.closest("[data-pay-booked-expense]");
    if (payExpenseButton) return payBookedExpense(payExpenseButton.dataset.payBookedExpense);

    const editExpenseButton = event.target.closest("[data-edit-booked-expense]");
    if (editExpenseButton) return editBookedExpense(editExpenseButton.dataset.editBookedExpense);

    const reduceExpenseButton = event.target.closest("[data-reduce-booked-expense]");
    if (reduceExpenseButton) return reduceBookedExpense(reduceExpenseButton.dataset.reduceBookedExpense);

    const qualityApproveButton = event.target.closest("[data-quality-approve]");
    if (qualityApproveButton) return approveStoreMovement(qualityApproveButton.dataset.qualityApprove);

    const bookApprovedPurchaseButton = event.target.closest("[data-book-approved-purchase]");
    if (bookApprovedPurchaseButton) return bookApprovedStorePurchase(bookApprovedPurchaseButton.dataset.bookApprovedPurchase);

    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) return deleteRecord(deleteButton.dataset.delete, deleteButton.dataset.id);

    const dailyEditButton = event.target.closest("[data-edit-day-action]");
    if (dailyEditButton) return editDailyAction(dailyEditButton.dataset.collection, dailyEditButton.dataset.id);
  });
}

function bindActions() {
  qsa("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "logout") logout();
      if (action === "export-json") exportJson();
      if (action === "clear-data") clearData();
      if (action === "export-daybook") exportDaybookCsv();
      if (action === "print-daybook") printDaybook();
      if (action === "close-business-day") closeBusinessDay();
      if (action === "clear-report-filters") clearReportFilters();
      if (action === "export-report") exportReportCsv();
      if (action === "print-report") printReport();
      if (action === "print-crux") printCruxReport();
      if (action === "download-crux-html") downloadCruxReportHtml();
      if (action === "pay-selected-expenses") paySelectedUnpaidExpenses();
      if (action === "sync-pull") pullRemoteSync();
      if (action === "sync-push") pushRemoteSync();
    });
  });

  const importInput = qs("[data-import-json]");
  if (importInput) importInput.addEventListener("change", importJson);
}

function formData(form) {
  return Object.fromEntries(new FormData(form));
}

function resetForm(form) {
  form.reset();
  setInitialDates();
  renderDebtFormState();
  renderPurchasePredictor();
  renderStore();
}

function requireAmount(value, label = "amount") {
  const amount = numberValue(value);
  if (amount <= 0) {
    showToast(`Enter a ${label} above zero.`);
    return 0;
  }
  return amount;
}

function isBankAccount(id) {
  return state.accounts.some((account) => account.id === id);
}

function requireUsableAccount(id, label = "account") {
  if (id === "cash" || isBankAccount(id)) return true;
  showToast(`Choose a valid ${label}.`);
  return false;
}

function getAccountBalanceAt(accountId, date = state.settings.businessDate) {
  const balances = computeBalances({ throughDate: date });
  return accountId === "cash" ? balances.cash : numberValue(balances.bankBalances[accountId]);
}

function ensureSufficientFunds(accountId, amount, date, label = "Payment") {
  const available = getAccountBalanceAt(accountId, date);
  if (numberValue(amount) <= available + 0.01) return true;
  if (isFinanceRole()) {
    showToast(`${label} blocked. Appropriate funds are not available.`);
    return false;
  }
  showToast(`${label} blocked. ${accountName(accountId)} has ${formatAmount(available)}, but this needs ${formatAmount(amount)}.`);
  return false;
}

function requireFinanceSalaryBeforeFutureDate(date, label = "entry") {
  if (!isFinanceRole()) return true;
  const targetDate = date || state.settings.businessDate;
  if (!isInputDate(targetDate) || targetDate <= state.settings.businessDate) return true;
  if (getSalaryBookedForDate(state.settings.businessDate) > 0) return true;
  showToast(`Book salary expense for ${formatDate(state.settings.businessDate)} before making a ${label} for ${formatDate(targetDate)}.`);
  switchView("salaries");
  return false;
}

function handleVendorSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  state.vendors.push({
    id: uid("vendor"),
    name: data.name.trim(),
    terms: Math.max(0, Math.round(numberValue(data.terms))),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Vendor added.");
  resetForm(event.currentTarget);
}

function handleStockItemSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const name = data.name.trim();
  if (!name) return showToast("Enter item name.");
  if (state.stockItems.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    return showToast("This store item already exists.");
  }
  state.stockItems.push({
    id: uid("stockitem"),
    name,
    unit: data.unit.trim() || "unit",
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Store item added.");
  resetForm(event.currentTarget);
}

function handleStoreInSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const vendor = state.vendors.find((item) => item.id === data.vendorId);
  const item = state.stockItems.find((entry) => entry.id === data.itemId);
  if (!vendor) return showToast("Ask admin to add this vendor first.");
  if (!item) return showToast("Add or choose an item first.");
  const specifiedQty = requireAmount(data.specifiedQty, "specified quantity");
  const receivedQty = requireAmount(data.receivedQty, "received quantity");
  if (!specifiedQty || !receivedQty) return;
  state.storeMovements.unshift({
    id: uid("store"),
    type: "IN",
    date: data.date || state.settings.businessDate,
    vendorId: vendor.id,
    itemId: item.id,
    itemName: item.name,
    billNo: data.billNo.trim(),
    specifiedQty,
    receivedQty,
    approvedQty: 0,
    rejectedQty: 0,
    status: "Pending Quality",
    financeStatus: "Pending Finance",
    qualityNotes: "",
    purchaseId: "",
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Material inward recorded and sent to quality.");
  resetForm(event.currentTarget);
}

function handleStoreOutSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const item = state.stockItems.find((entry) => entry.id === data.itemId);
  if (!item) return showToast("Add or choose an item first.");
  const outQty = requireAmount(data.outQty, "out quantity");
  if (!outQty) return;
  state.storeMovements.unshift({
    id: uid("store"),
    type: "OUT",
    date: data.date || state.settings.businessDate,
    vendorId: "",
    itemId: item.id,
    itemName: item.name,
    billNo: data.reference.trim(),
    specifiedQty: 0,
    receivedQty: 0,
    outQty,
    approvedQty: 0,
    rejectedQty: 0,
    status: "Stock Out",
    financeStatus: "No Finance",
    qualityNotes: data.notes.trim(),
    purchaseId: "",
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Material outward recorded.");
  resetForm(event.currentTarget);
}

function handlePurchaseCategorySubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  addUniqueCategory("purchaseCategories", data.name);
  saveAndRender("Purchase category added.");
  resetForm(event.currentTarget);
}

function handleExpenseCategorySubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  addUniqueCategory("expenseCategories", data.name);
  saveAndRender("Expense category added.");
  resetForm(event.currentTarget);
}

function addUniqueCategory(key, name) {
  const clean = name.trim();
  if (!clean) return;
  if (!state[key].some((item) => item.toLowerCase() === clean.toLowerCase())) {
    state[key].push(clean);
  }
}

function handlePurchaseSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!requireFinanceSalaryBeforeFutureDate(data.date, "purchase entry")) return;
  const vendor = state.vendors.find((item) => item.id === data.vendorId);
  if (!vendor) return showToast("Add or choose a vendor first.");
  if (!data.category) return showToast("Add or choose a purchase category first.");
  const amount = requireAmount(data.amount);
  if (!amount) return;

  state.purchases.unshift({
    id: uid("purchase"),
    vendorId: data.vendorId,
    invoiceNo: data.invoiceNo.trim(),
    date: data.date,
    dueDate: addDays(data.date, numberValue(vendor.terms)),
    amount,
    category: data.category,
    description: data.description.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Purchase invoice booked.");
  resetForm(event.currentTarget);
}

function handlePredictorItemSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const rate = requireAmount(data.rate, "purchase rate");
  if (!rate) return;
  const taxedSupply = data.taxedSupply === "Yes";
  const taxRate = taxedSupply ? numberValue(data.taxRate) : 0;
  if (taxRate < 0) return showToast("Tax rate cannot be negative.");
  state.purchasePredictorItems.push({
    id: uid("predictitem"),
    name: data.name.trim(),
    unit: data.unit.trim() || "unit",
    baseRate: rate,
    taxedSupply,
    taxRate,
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Predictor item added.");
  resetForm(event.currentTarget);
}

function handlePredictorVendorSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!state.purchasePredictorItems.some((item) => item.id === data.itemId)) return showToast("Add or choose an item first.");
  const rate = requireAmount(data.rate, "vendor rate");
  if (!rate) return;
  const terms = Math.max(0, Math.round(numberValue(data.terms)));
  state.purchasePredictorVendors.push({
    id: uid("predictvendor"),
    itemId: data.itemId,
    vendorName: data.vendorName.trim(),
    rate,
    terms,
    notes: data.notes.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Vendor rate added.");
  resetForm(event.currentTarget);
}

function handlePurchasePredictionSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!requireFinanceSalaryBeforeFutureDate(data.date, "purchase forecast")) return;
  const quantity = requireAmount(data.quantity, "quantity");
  if (!quantity) return;
  if (!requireUsableAccount(data.accountId, "paying account")) return;
  const plan = buildPurchasePredictionPlan({
    itemId: data.itemId,
    vendorOptionId: data.vendorOptionId,
    date: data.date,
    quantity,
    accountId: data.accountId,
  });
  if (!plan) return;
  state.purchasePredictions.unshift({
    id: uid("prediction"),
    ...plan,
    status: "Planned",
    notes: data.notes.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Purchase forecast scenario added.");
  resetForm(event.currentTarget);
}

function handleVendorPaymentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formData(form);
  if (!requireFinanceSalaryBeforeFutureDate(data.date, "vendor payment")) return;
  const selectedIds = qsa("[data-payable-checkbox]:checked").map((input) => input.value);
  if (!selectedIds.length) return showToast("Select at least one invoice.");

  const invoices = selectedIds
    .map((id) => state.purchases.find((purchase) => purchase.id === id))
    .filter(Boolean);
  const payable = invoices.reduce((sum, purchase) => sum + getPurchaseOpenAmount(purchase.id), 0);
  const amount = requireAmount(data.amount);
  if (!amount) return;
  if (amount > payable + 0.01) return showToast("Amount cannot exceed selected outstanding total.");
  if (!requireUsableAccount(data.accountId, "paying account")) return;
  if ((data.mode === "Cheque" || data.isPdc) && data.accountId === "cash") {
    return showToast("Cheque payments must use a bank account.");
  }
  if (data.isPdc && !data.pdcDate) return showToast("Choose a PDC due date.");
  if (!data.isPdc && !ensureSufficientFunds(data.accountId, amount, data.date, "Vendor payment")) return;

  const allocations = allocateAmount(invoices, amount);
  const vendor = state.vendors.find((item) => item.id === data.vendorId);
  const payment = {
    id: uid("vendorpay"),
    receiptNo: nextReceiptNo("PAY"),
    date: data.date,
    vendorId: data.vendorId,
    amount,
    mode: data.isPdc ? "Cheque" : data.mode,
    accountId: data.accountId,
    reference: data.reference.trim(),
    isPdc: Boolean(data.isPdc),
    pdcDate: data.pdcDate || "",
    pdcId: "",
    status: data.isPdc ? "Pending PDC" : "Paid",
    allocations,
    remarks: data.remarks.trim(),
    createdAt: new Date().toISOString(),
  };

  let pdcRiskMessage = "";
  if (payment.isPdc) {
    const pdc = {
      id: uid("pdc"),
      direction: "payable",
      partyName: vendor?.name || "Vendor",
      chequeNo: payment.reference || "Not recorded",
      bankName: accountName(payment.accountId),
      dueDate: payment.pdcDate,
      amount,
      accountId: payment.accountId,
      status: "Pending",
      notes: `Vendor payment ${payment.receiptNo}`,
      linkedType: "vendorPayment",
      linkedId: payment.id,
      createdAt: new Date().toISOString(),
    };
    if (!confirmPdcIssue(pdc)) return;
    pdcRiskMessage = isFinanceRole() ? `${pdc.riskAtIssue}: projection checked.` : `${pdc.riskAtIssue}: projected bank ${formatAmount(pdc.projectedBalanceAtIssue)}.`;
    payment.pdcId = pdc.id;
    state.pdcs.unshift(pdc);
  }

  state.vendorPayments.unshift(payment);
  saveAndRender(payment.isPdc ? `PDC payment committed. ${pdcRiskMessage}` : "Vendor payment recorded.");
  resetForm(form);
}

function allocateAmount(invoices, amount) {
  let remaining = amount;
  const allocations = [];
  invoices.forEach((invoice) => {
    const open = getPurchaseOpenAmount(invoice.id);
    const allocated = Math.min(open, remaining);
    if (allocated > 0) allocations.push({ purchaseId: invoice.id, amount: roundMoney(allocated) });
    remaining = roundMoney(remaining - allocated);
  });
  return allocations;
}

function handlePaymentInSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  const amount = requireAmount(data.amount);
  if (!amount || !requireUsableAccount(data.accountId, "receiving account")) return;
  state.paymentIns.unshift({
    id: uid("payin"),
    date: state.settings.businessDate,
    source: data.source,
    party: data.party.trim(),
    accountId: data.accountId,
    amount,
    remarks: data.remarks.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Incoming payment recorded.");
  resetForm(event.currentTarget);
}

function handleDebtSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  const amount = requireAmount(data.amount);
  if (!amount) return;
  if (data.entryType === "New Debt" && !requireUsableAccount(data.accountId, "receiving account")) return;
  const monthlyEmiAmount = numberValue(data.monthlyEmiAmount);
  const repaymentDay = Math.round(numberValue(data.repaymentDay));
  const emiTenureMonths = Math.round(numberValue(data.emiTenureMonths));
  const needsRepaymentDay = ["Monthly EMI", "Monthly Interest"].includes(data.repaymentTerms);
  if (needsRepaymentDay && (repaymentDay < 1 || repaymentDay > 31)) {
    return showToast("Enter the repayment day between 1 and 31.");
  }
  if (data.repaymentTerms === "Monthly EMI") {
    if (monthlyEmiAmount <= 0) return showToast("Enter the fixed monthly EMI amount.");
    if (emiTenureMonths < 1) return showToast("Enter the EMI tenure in months.");
  }
  state.debts.unshift({
    id: uid("debt"),
    date: state.settings.businessDate,
    entryType: data.entryType,
    debtType: data.debtType,
    originalDate: data.entryType === "Old Debt" ? data.originalDate : state.settings.businessDate,
    lender: data.lender.trim(),
    amount,
    accountId: data.entryType === "New Debt" ? data.accountId : "",
    interestRate: numberValue(data.interestRate),
    repaymentTerms: data.repaymentTerms,
    monthlyEmiAmount: data.repaymentTerms === "Monthly EMI" ? monthlyEmiAmount : 0,
    repaymentDay: needsRepaymentDay ? repaymentDay : 0,
    emiTenureMonths: data.repaymentTerms === "Monthly EMI" ? emiTenureMonths : 0,
    interestType: data.interestType,
    dueDate: data.dueDate,
    remarks: data.remarks.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Debt record saved.");
  resetForm(event.currentTarget);
}

function handlePdcSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!requireFinanceSalaryBeforeFutureDate(data.dueDate, "PDC")) return;
  const amount = requireAmount(data.amount, "PDC amount");
  if (!amount || !isBankAccount(data.accountId)) return showToast("Choose a bank account for this PDC.");
  if (isFinanceRole() && data.direction !== "payable") return showToast("Finance login can issue payable PDCs only.");
  const pdc = {
    id: uid("pdc"),
    direction: data.direction,
    partyName: data.partyName.trim(),
    chequeNo: data.chequeNo.trim(),
    bankName: data.bankName.trim(),
    dueDate: data.dueDate,
    amount,
    accountId: data.accountId,
    status: data.status,
    notes: data.notes.trim(),
    linkedType: "manual",
    linkedId: "",
    createdAt: new Date().toISOString(),
  };
  if (pdc.direction === "payable" && pdc.status === "Cleared" && !ensureSufficientFunds(pdc.accountId, pdc.amount, pdc.dueDate, "PDC clearing")) return;
  if (!confirmPdcIssue(pdc)) return;
  state.pdcs.unshift(pdc);
  saveAndRender(pdc.direction === "payable" ? `PDC added. ${pdc.riskAtIssue}${isFinanceRole() ? "." : `: projected bank ${formatAmount(pdc.projectedBalanceAtIssue)}.`}` : "PDC added.");
  resetForm(event.currentTarget);
}

function handleAccountSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  state.accounts.push({
    id: uid("bank"),
    name: data.name.trim(),
    openingBalance: numberValue(data.openingBalance),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Bank account added.");
  resetForm(event.currentTarget);
}

function handleTransferSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  const amount = requireAmount(data.amount, "transfer amount");
  if (!amount) return;
  if (!requireUsableAccount(data.from, "source account") || !requireUsableAccount(data.to, "destination account")) return;
  if (data.from === data.to) return showToast("Choose different source and destination.");
  if (!ensureSufficientFunds(data.from, amount, data.date, "Transfer")) return;
  state.transfers.unshift({
    id: uid("transfer"),
    date: data.date,
    from: data.from,
    to: data.to,
    amount,
    notes: data.notes.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Transfer recorded.");
  resetForm(event.currentTarget);
}

function handleWithdrawalSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  const amount = requireAmount(data.amount, "withdrawal amount");
  if (!amount || !requireUsableAccount(data.accountId, "withdrawal account")) return;
  if (!ensureSufficientFunds(data.accountId, amount, data.date, "Withdrawal")) return;
  state.withdrawals.unshift({
    id: uid("withdrawal"),
    date: data.date,
    accountId: data.accountId,
    amount,
    purpose: data.purpose.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Withdrawal recorded.");
  resetForm(event.currentTarget);
}

function handleBalanceAdjustmentSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  if (data.password !== BALANCE_ADJUSTMENT_PASSWORD) {
    return showToast("Secret password is incorrect. Adjustment blocked.");
  }
  if (!isBankAccount(data.accountId)) return showToast("Choose a valid bank account.");

  const enteredAmount = numberValue(data.amount);
  if (!Number.isFinite(enteredAmount)) return showToast("Enter a valid adjustment amount.");

  const currentBalance = computeBalances({ throughDate: data.date }).bankBalances[data.accountId] || 0;
  const adjustmentAmount =
    data.adjustmentType === "set" ? roundMoney(enteredAmount - currentBalance) : roundMoney(enteredAmount);

  if (adjustmentAmount === 0) return showToast("No adjustment needed for this amount.");

  state.balanceAdjustments.unshift({
    id: uid("adjustment"),
    date: data.date,
    accountId: data.accountId,
    adjustmentType: data.adjustmentType,
    enteredAmount,
    previousBalance: currentBalance,
    amount: adjustmentAmount,
    reason: data.reason.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Bank balance adjustment recorded.");
  resetForm(event.currentTarget);
}

function handleSalarySettingsSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  state.settings.expectedMonthlySalary = numberValue(data.expectedMonthlySalary);
  saveAndRender("Expected salary updated.");
}

function handleSalaryBookSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!requireFinanceSalaryBeforeFutureDate(data.date, "salary booking")) return;
  const amount = requireAmount(data.amount, "salary amount");
  if (!amount) return;
  state.salaryEntries.unshift({
    id: uid("salary"),
    type: "Booked",
    date: data.date,
    salaryMonth: monthKey(data.date),
    amount,
    accountId: "",
    source: "manual",
    remarks: data.remarks.trim() || "Manual salary expense booking",
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Salary expense booked.");
  resetForm(event.currentTarget);
}

function handleSalaryAdvanceSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  const amount = requireAmount(data.amount, "advance payment");
  if (!amount || !requireUsableAccount(data.accountId, "paying account")) return;
  const advanceDue = getSalaryAdvanceDueForMonth(data.salaryMonth);
  if (amount > advanceDue + 0.01) return showToast(`Advance payment cannot exceed scheduled advance due: ${formatAmount(advanceDue)}.`);
  if (!ensureSufficientFunds(data.accountId, amount, data.date, "Salary advance")) return;
  state.salaryEntries.unshift({
    id: uid("salary"),
    type: "Advance Paid",
    date: data.date,
    salaryMonth: data.salaryMonth,
    amount,
    accountId: data.accountId,
    remarks: data.remarks.trim() || `Advance for ${data.salaryMonth}`,
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Salary advance paid.");
  resetForm(event.currentTarget);
}

function handleSalaryPaySubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  const amount = requireAmount(data.amount, "salary payment");
  if (!amount || !requireUsableAccount(data.accountId, "paying account")) return;
  const payable = getSalaryPayableForMonth(data.salaryMonth);
  if (amount > payable + 0.01) return showToast("Salary payment cannot exceed current salary payable.");
  if (!ensureSufficientFunds(data.accountId, amount, data.date, "Salary payment")) return;
  state.salaryEntries.unshift({
    id: uid("salary"),
    type: "Salary Paid",
    date: data.date,
    salaryMonth: data.salaryMonth,
    amount,
    accountId: data.accountId,
    remarks: data.remarks.trim() || `Salary cleared for ${data.salaryMonth}`,
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Salary paid.");
  resetForm(event.currentTarget);
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!requireFinanceSalaryBeforeFutureDate(data.date, "expense entry")) return;
  const amount = requireAmount(data.amount, "expense amount");
  if (!amount) return;
  if (!data.category) return showToast("Add or choose an expense category first.");
  if (!requireUsableAccount(data.accountId, "paid account")) return;
  if (!ensureSufficientFunds(data.accountId, amount, data.date, "Expense payment")) return;
  state.expenses.unshift({
    id: uid("expense"),
    expenseType: "Immediate",
    date: data.date,
    dueDate: data.date,
    paidDate: data.date,
    category: data.category,
    paidTo: data.paidTo.trim(),
    amount,
    status: "Paid",
    mode: data.mode,
    accountId: data.accountId,
    notes: data.notes.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Expense recorded.");
  resetForm(event.currentTarget);
}

function handleBookedExpenseSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  if (!requireFinanceSalaryBeforeFutureDate(data.date, "scheduled expense")) return;
  const amount = requireAmount(data.amount, "booked expense");
  if (!amount) return;
  if (!data.category) return showToast("Add or choose an expense category first.");
  state.expenses.unshift({
    id: uid("expense"),
    expenseType: "Unpaid",
    date: data.date,
    dueDate: data.dueDate || data.date,
    paidDate: "",
    category: data.category,
    paidTo: data.paidTo.trim(),
    amount,
    status: "Booked",
    mode: "",
    accountId: "",
    notes: data.notes.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Expense payable booked.");
  resetForm(event.currentTarget);
}

function handleReceiptSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  const amount = requireAmount(data.amount, "receipt amount");
  if (!amount || !requireUsableAccount(data.accountId, "receiving account")) return;
  state.receipts.unshift({
    id: uid("receipt"),
    receiptNo: nextReceiptNo("RCP"),
    date: data.date,
    customer: data.customer.trim(),
    amount,
    mode: data.mode,
    accountId: data.accountId,
    invoice: data.invoice.trim(),
    notes: data.notes.trim(),
    createdAt: new Date().toISOString(),
  });
  saveAndRender("Receipt created.");
  resetForm(event.currentTarget);
}

function handleForecastSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  const amount = requireAmount(data.amount, "expected amount");
  if (!amount) return;
  if (!requireUsableAccount(data.accountId, "expected receiving account")) return;
  const forecast = {
    id: uid("forecast"),
    direction: "in",
    paymentType: data.paymentType,
    date: data.date,
    party: data.party.trim(),
    amount,
    mode: data.mode,
    accountId: data.accountId,
    delayDays: Math.max(0, Math.round(numberValue(data.delayDays))),
    confidence: numberValue(data.confidence),
    status: data.status === "Received" ? "Open" : data.status,
    notes: data.notes.trim(),
    createdAt: new Date().toISOString(),
  };
  state.forecasts.unshift(forecast);
  if (data.status === "Received") {
    markForecastReceived(forecast.id);
    resetForm(event.currentTarget);
    return;
  }
  saveAndRender("Expected payment logged.");
  resetForm(event.currentTarget);
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  if (!requireOwnerAction()) return;
  const data = formData(event.currentTarget);
  state.settings = {
    ...state.settings,
    businessName: data.businessName.trim() || APP_NAME,
    openingCash: numberValue(data.openingCash),
    receiptPrefix: data.receiptPrefix.trim() || "RCP",
    lowBalanceAlert: numberValue(data.lowBalanceAlert),
    syncUrl: data.syncUrl.trim(),
    syncToken: data.syncToken.trim(),
  };
  saveAndRender("Settings saved.");
}

function updatePdcStatus(id, status) {
  const pdc = state.pdcs.find((item) => item.id === id);
  if (!pdc) return;
  if (status === "Cleared" && pdc.direction === "payable" && !ensureSufficientFunds(pdc.accountId, pdc.amount, pdc.dueDate, "PDC clearing")) {
    renderPdc();
    return;
  }
  pdc.status = status;
  if (pdc.linkedType === "vendorPayment") {
    const payment = state.vendorPayments.find((item) => item.id === pdc.linkedId);
    if (payment) payment.status = status === "Cleared" ? "Paid" : `${status} PDC`;
  }
  saveAndRender("PDC status updated.");
}

function updateForecastStatus(id, status) {
  if (!requireOwnerAction()) return;
  const item = state.forecasts.find((forecast) => forecast.id === id);
  if (!item) return;
  if (status === "Received") return markForecastReceived(id);
  if (status === "Delayed") return markForecastDelayed(id);
  item.status = status;
  saveAndRender("Expected payment status updated.");
}

function markForecastReceived(id) {
  if (!requireOwnerAction()) return;
  const item = state.forecasts.find((forecast) => forecast.id === id);
  if (!item) return;
  if (item.status === "Received") return showToast("This expected payment is already marked received.");
  const accountId = getForecastAccountId(item);
  if (!requireUsableAccount(accountId, "receiving account for this expected payment")) {
    renderExpected();
    return;
  }
  const paymentInId = uid("payin");
  state.paymentIns.unshift({
    id: paymentInId,
    date: state.settings.businessDate,
    source: item.paymentType || "Expected Payment",
    party: item.party,
    accountId,
    amount: item.amount,
    remarks: item.notes ? `Expected payment received - ${item.notes}` : "Expected payment received",
    createdAt: new Date().toISOString(),
  });
  item.status = "Received";
  item.receivedDate = state.settings.businessDate;
  item.paymentInId = paymentInId;
  saveAndRender("Expected payment marked received and added to money in.");
}

function markForecastDelayed(id) {
  if (!requireOwnerAction()) return;
  const item = state.forecasts.find((forecast) => forecast.id === id);
  if (!item) return;
  item.status = "Delayed";
  item.lastCheckedDate = state.settings.businessDate;
  saveAndRender("Expected payment marked delayed.");
}

function payBookedExpense(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;
  const select = qs(`[data-pay-booked-account="${id}"]`);
  const accountId = select?.value || "";
  if (!requireUsableAccount(accountId, "paying account")) return;
  payExpenseDues([id], accountId, state.settings.businessDate);
}

function payOverdueDebtInterest(id) {
  if (!requireOwnerAction()) return;
  const debt = state.debts.find((item) => item.id === id);
  if (!debt) return showToast("Debt record not found.");
  const dueDate = getCurrentRepaymentDate(debt, state.settings.businessDate);
  if (!dueDate || dueDate > state.settings.businessDate) return showToast("No debt payment is due yet.");
  const amount = getDebtDueOpenAmount(debt, dueDate);
  if (amount <= 0) return showToast("This debt payment is already recorded.");
  const select = qsa("[data-overdue-debt-account]").find((item) => item.dataset.overdueDebtAccount === id);
  const accountId = select?.value || "";
  if (!requireUsableAccount(accountId, "paying account")) return;
  const paymentType = getDebtPaymentType(debt);
  if (!ensureSufficientFunds(accountId, amount, state.settings.businessDate, paymentType)) return;
  state.debtPayments.unshift({
    id: uid("debtpay"),
    debtId: debt.id,
    date: state.settings.businessDate,
    dueDate,
    lender: debt.lender,
    repaymentTerms: debt.repaymentTerms,
    paymentType,
    accountId,
    amount,
    remarks: `${paymentType} due ${formatDate(dueDate)}`,
    createdAt: new Date().toISOString(),
  });
  const dropdown = qs("[data-overdues-dropdown]");
  if (dropdown) dropdown.open = false;
  saveAndRender(`${paymentType} recorded and balances recalculated.`);
}

function paySelectedUnpaidExpenses() {
  const ids = qsa("[data-unpaid-expense-checkbox]:checked").map((input) => input.value);
  const accountId = qs("[data-unpaid-expense-account]")?.value || "";
  const payDate = qs("[data-unpaid-expense-pay-date]")?.value || state.settings.businessDate;
  if (!ids.length) return showToast("Select at least one unpaid expense to pay.");
  if (!isInputDate(payDate)) return showToast("Choose a valid payment date.");
  if (!requireFinanceSalaryBeforeFutureDate(payDate, "unpaid expense payment")) return;
  if (!requireUsableAccount(accountId, "paying account")) return;
  payExpenseDues(ids, accountId, payDate);
}

function payExpenseDues(ids, accountId, payDate) {
  if (!requireFinanceSalaryBeforeFutureDate(payDate, "unpaid expense payment")) return;
  const expenses = ids
    .map((id) => state.expenses.find((expense) => expense.id === id && expense.status === "Booked"))
    .filter(Boolean);
  if (!expenses.length) return showToast("No unpaid expense dues selected.");
  const total = roundMoney(expenses.reduce((sum, expense) => sum + numberValue(expense.amount), 0));
  if (!ensureSufficientFunds(accountId, total, payDate, "Unpaid expense payment")) return;

  const parties = uniqueValues(expenses.map((expense) => expense.paidTo));
  const categories = uniqueValues(expenses.map((expense) => expense.category));
  if (parties.length > 1 && !confirm("Selected dues belong to multiple parties. The receipt will show 'Multiple parties'. Continue?")) return;
  if (categories.length > 1 && !confirm("Selected dues belong to multiple categories. Continue with one combined receipt?")) return;

  const paymentId = uid("exppay");
  const receiptNo = nextReceiptNo("EXP");
  const payment = {
    id: paymentId,
    receiptNo,
    date: payDate,
    paidTo: parties.length === 1 ? parties[0] : "Multiple parties",
    category: categories.length === 1 ? categories[0] : "Multiple categories",
    accountId,
    amount: total,
    expenseIds: expenses.map((expense) => expense.id),
    createdAt: new Date().toISOString(),
  };
  state.expensePayments.unshift(payment);
  expenses.forEach((expense) => {
    expense.status = "Paid";
    expense.paidDate = payDate;
    expense.accountId = accountId;
    expense.mode = accountId === "cash" ? "Cash" : "Bank Transfer";
    expense.expensePaymentId = paymentId;
    expense.receiptNo = receiptNo;
  });
  saveState();
  render();
  printExpensePayment(paymentId);
  showToast(`Expense dues paid and receipt ${receiptNo} created.`);
}

function approveStoreMovement(id) {
  if (!isOwnerRole() && !isQualityRole()) return showToast("Only quality login can approve store inward entries.");
  const movement = state.storeMovements.find((item) => item.id === id && item.type === "IN");
  if (!movement) return showToast("Approval request not found.");
  const approvedInput = qs(`[data-quality-approved="${id}"]`);
  const notesInput = qs(`[data-quality-notes="${id}"]`);
  const approvedQty = roundMoney(numberValue(approvedInput?.value));
  if (approvedQty < 0) return showToast("Approved quantity cannot be negative.");
  if (approvedQty > numberValue(movement.receivedQty) + 0.0001) return showToast("Approved quantity cannot exceed received quantity.");
  movement.approvedQty = approvedQty;
  movement.rejectedQty = roundMoney(numberValue(movement.receivedQty) - approvedQty);
  movement.status = approvedQty > 0 ? "Quality Approved" : "Rejected";
  movement.qualityNotes = notesInput?.value?.trim() || "";
  movement.qualityDate = state.settings.businessDate;
  movement.financeStatus = approvedQty > 0 ? "Pending Finance" : "No Finance";
  saveAndRender(approvedQty > 0 ? "Quality approval recorded for finance." : "Material rejected by quality.");
}

function bookApprovedStorePurchase(id) {
  if (!isOwnerRole() && !isFinanceRole()) return showToast("Only finance login can book approved purchases.");
  const movement = state.storeMovements.find((item) => item.id === id && item.type === "IN");
  if (!movement) return showToast("Approval request not found.");
  if (movement.status !== "Quality Approved") return showToast("Quality approval is required before booking purchase.");
  if (movement.purchaseId) return showToast("This approval is already booked as a purchase.");
  const amount = requireAmount(qs(`[data-approval-amount="${id}"]`)?.value, "invoice amount");
  const category = qs(`[data-approval-category="${id}"]`)?.value || "";
  const date = qs(`[data-approval-date="${id}"]`)?.value || state.settings.businessDate;
  if (!amount) return;
  if (!category) return showToast("Choose purchase category.");
  if (!isInputDate(date)) return showToast("Choose a valid invoice date.");
  if (!requireFinanceSalaryBeforeFutureDate(date, "approved purchase booking")) return;
  const vendor = state.vendors.find((item) => item.id === movement.vendorId);
  if (!vendor) return showToast("Linked vendor is missing.");
  const purchase = {
    id: uid("purchase"),
    vendorId: movement.vendorId,
    invoiceNo: movement.billNo || `STORE-${movement.id.slice(-6)}`,
    date,
    dueDate: addDays(date, numberValue(vendor.terms)),
    amount,
    category,
    description: "",
    source: "storeApproval",
    storeMovementId: movement.id,
    approvedQty: movement.approvedQty,
    createdAt: new Date().toISOString(),
  };
  state.purchases.unshift(purchase);
  movement.purchaseId = purchase.id;
  movement.financeStatus = "Booked";
  saveAndRender("Approved material booked as purchase liability.");
}

function editBookedExpense(id) {
  const expense = state.expenses.find((item) => item.id === id && item.status === "Booked");
  if (!expense) return showToast("Only unpaid booked expenses can be edited here.");
  const amountText = prompt("Correct amount", String(expense.amount));
  if (amountText === null) return;
  const amount = numberValue(amountText);
  if (amount <= 0) return showToast("Correct amount must be above zero.");
  const date = prompt("Expense date (YYYY-MM-DD)", expense.date || state.settings.businessDate);
  if (date === null) return;
  const dueDate = prompt("Due date (YYYY-MM-DD)", expense.dueDate || expense.date || state.settings.businessDate);
  if (dueDate === null) return;
  if (!isInputDate(date) || !isInputDate(dueDate)) return showToast("Use date format YYYY-MM-DD.");
  const paidTo = prompt("Payable to", expense.paidTo || "");
  if (paidTo === null) return;
  const category = prompt("Category", expense.category || "");
  if (category === null) return;
  const notes = prompt("Notes", expense.notes || "");
  if (notes === null) return;
  expense.amount = roundMoney(amount);
  expense.date = date;
  expense.dueDate = dueDate;
  expense.paidTo = paidTo.trim() || expense.paidTo;
  expense.category = category.trim() || expense.category;
  addUniqueCategory("expenseCategories", expense.category);
  expense.notes = notes.trim();
  saveAndRender("Booked expense corrected. Daybook and projections recalculated.");
}

function reduceBookedExpense(id) {
  const expense = state.expenses.find((item) => item.id === id && item.status === "Booked");
  if (!expense) return showToast("Only unpaid booked expenses can be reduced here.");
  const reduceText = prompt("Amount to reduce from this unpaid expense", String(expense.amount));
  if (reduceText === null) return;
  const reduction = roundMoney(numberValue(reduceText));
  if (reduction <= 0) return showToast("Reduction amount must be above zero.");
  if (reduction >= numberValue(expense.amount)) {
    if (!confirm("This reduction removes the full unpaid entry. Continue?")) return;
    state.expenses = state.expenses.filter((item) => item.id !== id);
    saveAndRender("Unpaid expense removed. Old daybook recalculated.");
    return;
  }
  expense.amount = roundMoney(numberValue(expense.amount) - reduction);
  const note = `Reduced by ${formatAmount(reduction)} on ${formatDate(state.settings.businessDate)}`;
  expense.notes = expense.notes ? `${expense.notes}; ${note}` : note;
  saveAndRender("Unpaid expense reduced. Daybook and projections recalculated.");
}

function editDailyAction(collection, id) {
  if (!state[collection]) return showToast("This source record cannot be edited here.");
  const item = state[collection].find((entry) => entry.id === id);
  if (!item) return showToast("Source record not found.");
  const originalItem = JSON.parse(JSON.stringify(item));
  if (collection === "balanceAdjustments") {
    const password = prompt("Secret password required to edit a balance adjustment");
    if (password !== BALANCE_ADJUSTMENT_PASSWORD) return showToast("Secret password is incorrect. Edit blocked.");
  }

  const dateKey = getEditableDateKey(collection, item);
  if (dateKey) {
    const nextDate = promptForDate("Transaction date (YYYY-MM-DD)", item[dateKey] || state.settings.businessDate);
    if (nextDate === null) return;
    item[dateKey] = nextDate;
    if (collection === "expenses" && item.expenseType === "Immediate") {
      item.date = nextDate;
      item.paidDate = nextDate;
      item.dueDate = nextDate;
    }
  }

  if (collection === "purchasePredictions") {
    const quantity = promptForAmount("Quantity", item.quantity);
    if (quantity === null) return restoreEditedItem(item, originalItem);
    const plan = buildPurchasePredictionPlan({ itemId: item.itemId, vendorOptionId: item.vendorOptionId, date: item.date, quantity, accountId: item.accountId });
    if (!plan) return restoreEditedItem(item, originalItem);
    Object.assign(item, plan);
  } else if (collection === "vendorPayments") {
    const amount = promptForAmount("Payment amount", item.amount);
    if (amount === null) return restoreEditedItem(item, originalItem);
    updateVendorPaymentAmount(item, amount);
    item.reference = promptForText("Cheque / UTR / reference", item.reference || "");
    item.remarks = promptForText("Remarks", item.remarks || "");
  } else if (collection === "balanceAdjustments") {
    const amount = promptForAmount("Adjustment amount. Use minus for reduction", item.amount, { allowNegative: true, allowZero: true });
    if (amount === null) return restoreEditedItem(item, originalItem);
    item.amount = amount;
    item.reason = promptForText("Reason", item.reason || "");
  } else if (collection === "transfers") {
    const amount = promptForAmount("Transfer amount", item.amount);
    if (amount === null) return restoreEditedItem(item, originalItem);
    item.amount = amount;
    item.notes = promptForText("Notes", item.notes || "");
  } else if (collection === "pdcs") {
    const amount = promptForAmount("PDC amount", item.amount);
    if (amount === null) return restoreEditedItem(item, originalItem);
    item.amount = amount;
    item.partyName = promptForText("Party name", item.partyName || "");
    item.chequeNo = promptForText("Cheque number", item.chequeNo || "");
    item.notes = promptForText("Notes", item.notes || "");
  } else {
    if (!editCommonDailyActionFields(collection, item)) return restoreEditedItem(item, originalItem);
  }

  saveAndRender("Day action corrected. Balances, daybook, and Crux recalculated.");
}

function restoreEditedItem(item, originalItem) {
  Object.keys(item).forEach((key) => delete item[key]);
  Object.assign(item, originalItem);
}

function editCommonDailyActionFields(collection, item) {
  if ("amount" in item) {
    const amount = promptForAmount("Amount", item.amount);
    if (amount === null) return false;
    item.amount = amount;
  }
  if (collection === "purchases") {
    item.invoiceNo = promptForText("Invoice number", item.invoiceNo || "");
    item.category = promptForText("Category", item.category || "");
    item.description = promptForText("Items / description", item.description || "");
    const dueDate = promptForDate("Due date (YYYY-MM-DD)", item.dueDate || getPurchasePaymentDate(item));
    if (dueDate !== null) item.dueDate = dueDate;
    addUniqueCategory("purchaseCategories", item.category);
  }
  if (collection === "expenses") {
    item.category = promptForText("Category", item.category || "");
    item.paidTo = promptForText("Paid to / payable to", item.paidTo || "");
    item.notes = promptForText("Notes", item.notes || "");
    if (item.expenseType === "Unpaid") {
      const dueDate = promptForDate("Due date (YYYY-MM-DD)", item.dueDate || item.date);
      if (dueDate !== null) item.dueDate = dueDate;
    }
    addUniqueCategory("expenseCategories", item.category);
  }
  if (collection === "paymentIns") {
    item.source = promptForText("Source", item.source || "");
    item.party = promptForText("Party name", item.party || "");
    item.remarks = promptForText("Remarks", item.remarks || "");
  }
  if (collection === "receipts") {
    item.customer = promptForText("Customer", item.customer || "");
    item.invoice = promptForText("Invoice / order", item.invoice || "");
    item.notes = promptForText("Notes", item.notes || "");
  }
  if (collection === "debts") {
    item.lender = promptForText("Lender name", item.lender || "");
    item.remarks = promptForText("Remarks", item.remarks || "");
  }
  if (collection === "debtAccruals") {
    item.lender = promptForText("Lender name", item.lender || "");
    item.category = promptForText("Category", item.category || "");
  }
  if (collection === "debtPayments") {
    item.lender = promptForText("Lender name", item.lender || "");
    item.remarks = promptForText("Remarks", item.remarks || "");
  }
  if (collection === "salaryEntries") {
    item.remarks = promptForText("Remarks", item.remarks || "");
  }
  if (collection === "withdrawals") {
    item.purpose = promptForText("Purpose", item.purpose || "");
  }
  if (collection === "forecasts") {
    item.party = promptForText("Party name", item.party || "");
    item.paymentType = promptForText("Payment type", item.paymentType || "");
    item.remarks = promptForText("Remarks", item.remarks || "");
  }
  return true;
}

function getEditableDateKey(collection, item) {
  if (collection === "pdcs") return "dueDate";
  if (collection === "purchasePredictions") return "date";
  if (collection === "expenses" && item.expenseType === "Unpaid" && item.status === "Paid" && item.paidDate === getSelectedCruxDate()) return "paidDate";
  return "date" in item ? "date" : "";
}

function updateVendorPaymentAmount(payment, amount) {
  const oldTotal = numberValue(payment.amount);
  payment.amount = amount;
  if (payment.allocations?.length && oldTotal > 0) {
    let allocatedTotal = 0;
    payment.allocations = payment.allocations.map((allocation, index) => {
      const nextAmount = index === payment.allocations.length - 1 ? roundMoney(amount - allocatedTotal) : roundMoney((numberValue(allocation.amount) / oldTotal) * amount);
      allocatedTotal = roundMoney(allocatedTotal + nextAmount);
      return { ...allocation, amount: nextAmount };
    });
  }
  if (payment.pdcId) {
    const pdc = state.pdcs.find((entry) => entry.id === payment.pdcId);
    if (pdc) pdc.amount = amount;
  }
}

function promptForDate(label, current) {
  const value = prompt(label, current || state.settings.businessDate);
  if (value === null) return null;
  if (!isInputDate(value)) {
    showToast("Use date format YYYY-MM-DD.");
    return null;
  }
  return value;
}

function promptForAmount(label, current, options = {}) {
  const value = prompt(label, String(current ?? 0));
  if (value === null) return null;
  const amount = roundMoney(numberValue(value));
  if (!options.allowNegative && amount < 0) {
    showToast("Amount cannot be negative.");
    return null;
  }
  if (!options.allowZero && amount <= 0) {
    showToast("Amount must be above zero.");
    return null;
  }
  return amount;
}

function promptForText(label, current) {
  const value = prompt(label, current || "");
  return value === null ? current || "" : value.trim();
}

function deleteRecord(collection, id) {
  const labels = {
    accounts: "bank account",
    vendors: "vendor",
    purchaseCategories: "purchase category",
    purchases: "purchase invoice",
    purchasePredictorItems: "predictor item",
    purchasePredictorVendors: "predictor vendor rate",
    purchasePredictions: "purchase forecast scenario",
    stockItems: "store item",
    storeMovements: "store movement",
    vendorPayments: "vendor payment",
    paymentIns: "incoming payment",
    debts: "debt",
    debtAccruals: "debt cost entry",
    debtPayments: "debt payment",
    expenses: "expense",
    expensePayments: "expense payment receipt",
    expenseCategories: "expense category",
    transfers: "transfer",
    withdrawals: "withdrawal",
    balanceAdjustments: "bank balance adjustment",
    pdcs: "PDC",
    salaryEntries: "salary entry",
    forecasts: "expected payment",
    receipts: "receipt",
  };

  if (!state[collection]) return;
  if (!canDelete(collection, id)) return;
  if (!confirm(`Delete this ${labels[collection] || "record"}? Balances will recalculate automatically.`)) return;

  if (collection === "vendorPayments") {
    const payment = state.vendorPayments.find((item) => item.id === id);
    if (payment?.pdcId) state.pdcs = state.pdcs.filter((pdc) => pdc.id !== payment.pdcId);
  }
  if (collection === "pdcs") {
    const pdc = state.pdcs.find((item) => item.id === id);
    if (pdc?.linkedType === "vendorPayment") {
      const payment = state.vendorPayments.find((item) => item.id === pdc.linkedId);
      if (payment) {
        payment.pdcId = "";
        payment.status = "PDC Deleted";
      }
    }
  }
  if (collection === "debts") {
    state.debtAccruals = state.debtAccruals.filter((item) => item.debtId !== id);
    state.debtPayments = state.debtPayments.filter((item) => item.debtId !== id);
  }
  if (collection === "expenses") {
    const expense = state.expenses.find((item) => item.id === id);
    const payment = expense?.expensePaymentId ? state.expensePayments.find((item) => item.id === expense.expensePaymentId) : null;
    if (payment) {
      payment.expenseIds = (payment.expenseIds || []).filter((expenseId) => expenseId !== id);
      payment.amount = payment.expenseIds.reduce((sum, expenseId) => {
        const linked = state.expenses.find((item) => item.id === expenseId);
        return sum + numberValue(linked?.amount);
      }, 0);
      if (!payment.expenseIds.length) {
        state.expensePayments = state.expensePayments.filter((item) => item.id !== payment.id);
      }
    }
  }
  if (collection === "purchases") {
    state.storeMovements.forEach((movement) => {
      if (movement.purchaseId === id) {
        movement.purchaseId = "";
        movement.financeStatus = movement.status === "Quality Approved" ? "Pending Finance" : movement.financeStatus;
      }
    });
  }

  if (collection === "purchaseCategories" || collection === "expenseCategories") {
    state[collection] = state[collection].filter((item) => item !== id);
  } else {
    state[collection] = state[collection].filter((item) => item.id !== id);
  }
  saveAndRender("Record deleted and balances recalculated.");
}

function canDelete(collection, id) {
  if (collection === "vendors" && state.purchases.some((purchase) => purchase.vendorId === id)) {
    showToast("Delete this vendor's purchases before deleting the vendor.");
    return false;
  }
  if (collection === "purchases" && state.vendorPayments.some((payment) => payment.allocations?.some((allocation) => allocation.purchaseId === id))) {
    showToast("Delete linked vendor payments before deleting this invoice.");
    return false;
  }
  if (collection === "stockItems" && state.storeMovements.some((movement) => movement.itemId === id)) {
    showToast("Delete this item's store movements before deleting the item.");
    return false;
  }
  if (collection === "storeMovements") {
    const movement = state.storeMovements.find((item) => item.id === id);
    if (movement?.purchaseId) {
      showToast("Delete the linked purchase invoice before deleting this store movement.");
      return false;
    }
  }
  if (collection === "purchasePredictorItems" && state.purchasePredictorVendors.some((vendor) => vendor.itemId === id)) {
    showToast("Delete this item's vendor rates before deleting the item.");
    return false;
  }
  if (collection === "purchasePredictorItems" && state.purchasePredictions.some((prediction) => prediction.itemId === id)) {
    showToast("Delete this item's forecast scenarios before deleting the item.");
    return false;
  }
  if (collection === "purchasePredictorVendors" && state.purchasePredictions.some((prediction) => prediction.vendorOptionId === id)) {
    showToast("Delete linked forecast scenarios before deleting this vendor rate.");
    return false;
  }
  if (collection === "accounts" && isAccountInUse(id)) {
    showToast("This account has transactions. Delete those records before removing the account.");
    return false;
  }
  return true;
}

function isAccountInUse(id) {
  return [
    ...state.receipts.map((item) => item.accountId),
    ...state.paymentIns.map((item) => item.accountId),
    ...state.vendorPayments.map((item) => item.accountId),
    ...state.expenses.map((item) => item.accountId),
    ...state.expensePayments.map((item) => item.accountId),
    ...state.purchasePredictions.map((item) => item.accountId),
    ...state.withdrawals.map((item) => item.accountId),
    ...state.balanceAdjustments.map((item) => item.accountId),
    ...state.pdcs.map((item) => item.accountId),
    ...state.debts.map((item) => item.accountId),
    ...state.debtPayments.map((item) => item.accountId),
    ...state.salaryEntries.map((item) => item.accountId),
    ...state.transfers.flatMap((item) => [item.from, item.to]),
  ].includes(id);
}

function saveAndRender(message) {
  saveState();
  render();
  showToast(message);
}

function render() {
  if (!currentRole) return;
  applyRoleAccess();
  renderBrand();
  renderSelectors();
  if (isOwnerRole()) {
    renderOverdues();
    renderDebtFormState();
    renderDashboard();
  } else {
    clearSensitiveDom();
  }
  renderStore();
  renderApprovals();
  renderVendors();
  renderPurchases();
  renderPurchasePredictor();
  renderMakePayment();
  renderScheduled();
  if (isOwnerRole()) {
    renderPaymentIns();
    renderDebts();
    renderExpected();
  }
  renderReports();
  renderPdc();
  if (isOwnerRole()) renderCashBank();
  renderSalaries();
  if (isOwnerRole()) {
    renderDaybook();
    renderCrux();
  }
  renderExpenses();
  if (isOwnerRole()) {
    renderReceipts();
    renderSettings();
  }
}

function clearSensitiveDom() {
  [
    "[data-overdues-list]",
    "[data-dashboard-metrics]",
    "[data-dashboard-pdcs]",
    "[data-dashboard-due]",
    "[data-recent-activity]",
    "[data-payment-ins-table]",
    "[data-debts-table]",
    "[data-expected-alerts]",
    "[data-forecast-table]",
    "[data-projection-table]",
    "[data-cashbank-metrics]",
    "[data-ledger-table]",
    "[data-daybook-summary]",
    "[data-daybook-table]",
    "[data-crux-summary]",
    "[data-crux-charts]",
    "[data-crux-briefing]",
    "[data-crux-daybook-table]",
    "[data-crux-actions-table]",
    "[data-receipts-table]",
  ].forEach((selector) => setHtml(selector, ""));
}

function renderBrand() {
  qsa("[data-business-name]").forEach((node) => {
    node.textContent = state.settings.businessName;
  });
  qsa("[data-business-date-label]").forEach((node) => {
    node.textContent = formatDate(state.settings.businessDate);
  });
}

function renderOverdues() {
  const items = getOverdueItems();
  const count = qs("[data-overdue-count]");
  const list = qs("[data-overdues-list]");
  if (count) {
    count.textContent = items.length;
    count.classList.toggle("bad", items.some((item) => item.tone === "bad"));
  }
  if (!list) return;
  list.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="alert-item ${item.tone || ""}">
              <div class="alert-title">${escapeHtml(item.title)}</div>
              <div class="alert-detail">${escapeHtml(item.detail)}</div>
              <div class="overdue-meta">
                <span>${escapeHtml(formatDate(item.date))}</span>
                <strong>${escapeHtml(formatAmount(item.amount))}</strong>
              </div>
              ${item.action || `<button class="ghost-button" data-overdue-view="${escapeHtml(item.view)}" type="button">Open</button>`}
            </article>
          `
        )
        .join("")
    : `<div class="empty-state">No overdue items right now.</div>`;
}

function renderSelectors() {
  const bankOptions = optionList(state.accounts, "Add a bank first");
  const moneyOptions = [
    { id: "cash", name: "Cash in hand" },
    ...state.accounts.map((account) => ({ id: account.id, name: account.name })),
  ]
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
    .join("");

  qsa("[data-bank-account-select]").forEach((select) => preserveSelect(select, bankOptions));
  qsa("[data-money-source-select],[data-money-target-select]").forEach((select) => preserveSelect(select, moneyOptions));
  qsa("[data-debt-account-select]").forEach((select) =>
    preserveSelect(select, `<option value="">No balance impact for old debt</option>${moneyOptions}`)
  );
  qsa("[data-vendor-select],[data-make-payment-vendor]").forEach((select) => preserveSelect(select, optionList(state.vendors, "Add a vendor first")));
  qsa("[data-purchase-category-select]").forEach((select) => preserveSelect(select, stringOptions(state.purchaseCategories, "Add a category first")));
  qsa("[data-expense-category-select]").forEach((select) => preserveSelect(select, stringOptions(state.expenseCategories, "Add a category first")));
  qsa("[data-stock-item-select]").forEach((select) => preserveSelect(select, optionList(state.stockItems, "Add an item first")));
}

function preserveSelect(select, html) {
  const current = select.value;
  select.innerHTML = html;
  if (qsa("option", select).some((option) => option.value === current)) select.value = current;
}

function renderStore() {
  renderStockItems();
  renderStoreInwardLog();
  renderStoreOutwardLog();
}

function renderStockItems() {
  const node = qs("[data-stock-items-table]");
  if (!node) return;
  node.innerHTML = state.stockItems.length
    ? state.stockItems
        .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.unit || "unit")}</td><td><button class="danger-button" data-delete="stockItems" data-id="${item.id}" type="button">x</button></td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="empty-state">No store items added yet.</td></tr>`;
}

function renderStoreInwardLog() {
  const node = qs("[data-store-in-table]");
  if (!node) return;
  const rows = state.storeMovements.filter((item) => item.type === "IN").sort(sortNewest);
  node.innerHTML = rows.length
    ? rows
        .map((item) => {
          const diff = roundMoney(numberValue(item.specifiedQty) - numberValue(item.receivedQty));
          const approved = item.status === "Pending Quality" ? "-" : formatQuantity(item.approvedQty);
          return `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${escapeHtml(vendorName(item.vendorId))}</td><td>${escapeHtml(item.billNo || "No bill")}</td><td>${escapeHtml(stockItemName(item.itemId))}</td><td class="amount-cell">${escapeHtml(formatQuantity(item.specifiedQty))}</td><td class="amount-cell">${escapeHtml(formatQuantity(item.receivedQty))}</td><td class="amount-cell ${diff ? "tone-warn" : ""}">${escapeHtml(formatQuantity(diff))}</td><td class="amount-cell">${escapeHtml(approved)}</td><td>${statusPill(item.status)}</td><td>${statusPill(item.financeStatus || "Pending Finance")}</td><td><button class="danger-button" data-delete="storeMovements" data-id="${item.id}" type="button">x</button></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="11" class="empty-state">No inward entries yet.</td></tr>`;
}

function renderStoreOutwardLog() {
  const node = qs("[data-store-out-table]");
  if (!node) return;
  const rows = state.storeMovements.filter((item) => item.type === "OUT").sort(sortNewest);
  node.innerHTML = rows.length
    ? rows
        .map((item) => `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${escapeHtml(stockItemName(item.itemId))}</td><td>${escapeHtml(item.billNo || "General issue")}</td><td class="amount-cell">${escapeHtml(formatQuantity(item.outQty))}</td><td>${escapeHtml(item.qualityNotes || "")}</td><td><button class="danger-button" data-delete="storeMovements" data-id="${item.id}" type="button">x</button></td></tr>`)
        .join("")
    : `<tr><td colspan="6" class="empty-state">No outward entries yet.</td></tr>`;
}

function renderApprovals() {
  renderQualityApprovalRequests();
  renderFinanceApprovalRequests();
}

function renderQualityApprovalRequests() {
  const node = qs("[data-quality-approval-table]");
  if (!node) return;
  const rows = state.storeMovements.filter((item) => item.type === "IN" && item.status === "Pending Quality").sort(sortNewest);
  node.innerHTML = rows.length
    ? rows
        .map((item) => `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${escapeHtml(vendorName(item.vendorId))}</td><td>${escapeHtml(item.billNo || "No bill")}</td><td>${escapeHtml(stockItemName(item.itemId))}</td><td class="amount-cell">${escapeHtml(formatQuantity(item.specifiedQty))}</td><td class="amount-cell">${escapeHtml(formatQuantity(item.receivedQty))}</td><td><input class="table-input" data-quality-approved="${item.id}" type="number" min="0" step="0.001" value="${escapeHtml(item.receivedQty)}" /></td><td><input class="table-input" data-quality-notes="${item.id}" placeholder="Notes" /></td><td><button class="primary-button" data-quality-approve="${item.id}" type="button">Approve</button></td></tr>`)
        .join("")
    : `<tr><td colspan="9" class="empty-state">No quality approvals pending.</td></tr>`;
}

function renderFinanceApprovalRequests() {
  const node = qs("[data-finance-approval-table]");
  if (!node) return;
  const rows = state.storeMovements.filter((item) => item.type === "IN" && item.status !== "Pending Quality").sort(sortNewest);
  const categoryOptions = stringOptions(state.purchaseCategories, "Choose category");
  node.innerHTML = rows.length
    ? rows
        .map((item) => {
          const qtyDiff = roundMoney(numberValue(item.specifiedQty) - numberValue(item.approvedQty));
          const canBook = item.status === "Quality Approved" && !item.purchaseId;
          const action = canBook
            ? `<div class="approval-book-grid"><input data-approval-date="${item.id}" type="date" value="${escapeHtml(item.date)}" /><select data-approval-category="${item.id}">${categoryOptions}</select><input data-approval-amount="${item.id}" type="number" min="0" step="0.01" placeholder="Invoice amount" /><button class="primary-button" data-book-approved-purchase="${item.id}" type="button">Book Purchase</button></div>`
            : item.purchaseId
              ? `<span class="fineprint">Booked in purchases</span>`
              : `<span class="fineprint">No finance booking required</span>`;
          return `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${escapeHtml(vendorName(item.vendorId))}</td><td>${escapeHtml(item.billNo || "No bill")}</td><td>${escapeHtml(stockItemName(item.itemId))}</td><td class="amount-cell">${escapeHtml(formatQuantity(item.specifiedQty))}</td><td class="amount-cell">${escapeHtml(formatQuantity(item.receivedQty))}</td><td class="amount-cell">${escapeHtml(formatQuantity(item.approvedQty))}</td><td class="amount-cell ${numberValue(item.rejectedQty) ? "tone-bad" : ""}">${escapeHtml(formatQuantity(item.rejectedQty))}</td><td class="amount-cell ${qtyDiff ? "tone-warn" : ""}">${escapeHtml(formatQuantity(qtyDiff))}</td><td>${statusPill(item.status)}</td><td>${escapeHtml(item.qualityNotes || "")}</td><td>${action}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="12" class="empty-state">No store approvals reached finance yet.</td></tr>`;
}

function optionList(items, placeholder) {
  const options = items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  return `<option value="">${escapeHtml(placeholder)}</option>${options}`;
}

function stringOptions(items, placeholder) {
  const options = items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  return `<option value="">${escapeHtml(placeholder)}</option>${options}`;
}

function renderDebtFormState() {
  const form = qs("#debt-form");
  if (!form) return;
  const repaymentTerms = form.elements.repaymentTerms?.value || "";
  const entryType = form.elements.entryType?.value || "New Debt";
  const isEmi = repaymentTerms === "Monthly EMI";
  const needsRepaymentDay = ["Monthly EMI", "Monthly Interest"].includes(repaymentTerms);
  qsa("[data-emi-field]", form).forEach((field) => {
    field.hidden = !isEmi;
    qsa("input, select, textarea", field).forEach((input) => {
      input.disabled = !isEmi;
    });
  });
  qsa("[data-repayment-day-field]", form).forEach((field) => {
    field.hidden = !needsRepaymentDay;
    qsa("input, select, textarea", field).forEach((input) => {
      input.disabled = !needsRepaymentDay;
      input.required = needsRepaymentDay;
    });
  });
  const account = form.elements.accountId;
  if (account) {
    account.required = entryType === "New Debt";
    const emptyOption = account.querySelector('option[value=""]');
    if (emptyOption) emptyOption.textContent = entryType === "New Debt" ? "Choose receiving account" : "No balance impact for old debt";
  }
  const preview = qs("[data-debt-accrual-preview]", form);
  if (preview) {
    preview.textContent =
      entryType === "New Debt"
        ? "New debt increases the selected cash or bank balance. Daily interest or EMI cost is booked when the day is closed."
        : "Old debt is saved as a liability only. It will not change present cash or bank balance, but daily interest or EMI cost can still be booked at day close.";
  }
}

function renderMetricGrid(selector, metrics) {
  const node = qs(selector);
  if (!node) return;
  node.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric">
          <div class="metric-label"><span>${escapeHtml(metric.label)}</span><span>${escapeHtml(metric.badge || "")}</span></div>
          <div class="metric-value ${metric.valueTone || ""}">${escapeHtml(metric.value)}</div>
          <div class="metric-note">${escapeHtml(metric.note || "")}</div>
        </article>
      `
    )
    .join("");
}

function renderDashboard() {
  const balances = computeBalances();
  const purchasesBooked = state.purchases.filter((item) => isSameMonth(item.date)).reduce((sum, item) => sum + numberValue(item.amount), 0);
  const billsPaid = getLedgerEntries()
    .filter((item) => item.type === "Vendor Payment" && isSameMonth(item.date))
    .reduce((sum, item) => sum + numberValue(item.out), 0);
  const salariesBooked = state.salaryEntries
    .filter((item) => item.type === "Booked" && isSameMonth(item.date))
    .reduce((sum, item) => sum + numberValue(item.amount), 0);
  const operatingExpenses = state.expenses
    .filter((item) => isSameMonth(item.date))
    .reduce((sum, item) => sum + numberValue(item.amount), 0);
  const debtCosts = state.debtAccruals
    .filter((item) => isSameMonth(item.date))
    .reduce((sum, item) => sum + numberValue(item.amount), 0);
  const expensesIncurred = operatingExpenses + debtCosts;

  renderMetricGrid("[data-dashboard-metrics]", [
    { label: "Purchases booked", value: formatAmount(purchasesBooked), note: "Invoices booked this month" },
    { label: "Bills paid", value: formatAmount(billsPaid), note: "Vendor payments cleared this month" },
    { label: "Salaries booked", value: formatAmount(salariesBooked), note: `Payable balance ${formatAmount(getSalaryPayable())}` },
    { label: "Expenses incurred", value: formatAmount(expensesIncurred), note: "Operating expenses plus daily debt costs" },
    { label: "Cash in hand", value: formatAmount(balances.cash), note: "Live cash position", valueTone: balances.cash < 0 ? "tone-bad" : "" },
    { label: "Bank total", value: formatAmount(balances.bankTotal), note: `${state.accounts.length} bank account${state.accounts.length === 1 ? "" : "s"}`, valueTone: balances.bankTotal < 0 ? "tone-bad" : "" },
    { label: "Statement balance", value: formatAmount(balances.liquidity), note: "Cash plus cleared bank funds", valueTone: balances.liquidity < 0 ? "tone-bad" : "tone-good" },
    { label: "PDC commitments", value: formatAmount(getPendingPdcNet()), note: "Pending receivable minus payable PDCs" },
  ]);

  renderDashboardAlerts();
  renderRecentActivity();
}

function renderDashboardAlerts() {
  const today = state.settings.businessDate;
  const monthEnd = `${today.slice(0, 7)}-31`;
  const pdcs = state.pdcs
    .filter((pdc) => ["Pending", "Deposited"].includes(pdc.status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  const pdcNode = qs("[data-dashboard-pdcs]");
  pdcNode.innerHTML = pdcs.length
    ? pdcs.map((pdc) => {
        const risk = assessPdcRisk(pdc);
        const tone = risk.severity === "bad" || pdc.dueDate < today ? "bad" : risk.severity === "warn" ? "warn" : "";
        return alertHtml(`${pdc.direction === "receivable" ? "Receive" : "Pay"} ${formatAmount(pdc.amount)}`, `${pdc.partyName} - ${pdc.chequeNo} due ${formatDate(pdc.dueDate)}. ${risk.detail}`, tone);
      }).join("")
    : `<div class="empty-state">No pending PDC commitments.</div>`;

  const dueItems = [
    ...state.purchases
      .filter((purchase) => getPurchaseOpenAmount(purchase.id) > 0 && getPurchasePaymentDate(purchase) <= monthEnd)
      .map((purchase) => ({ date: getPurchasePaymentDate(purchase), title: "Purchase payment provision", detail: `${vendorName(purchase.vendorId)} - Invoice ${purchase.invoiceNo} matured ${formatDate(purchase.dueDate)} - ${formatAmount(getPurchaseOpenAmount(purchase.id))}` })),
    ...state.expenses
      .filter((expense) => expense.status === "Booked" && expense.dueDate <= monthEnd)
      .map((expense) => ({ date: expense.dueDate, title: "Booked expense due", detail: `${expense.paidTo} - ${formatAmount(expense.amount)}` })),
    ...getSalaryScheduleItems()
      .filter((item) => item.date <= monthEnd)
      .map((item) => ({ date: item.date, title: item.type, detail: `${item.party} - ${formatAmount(item.amount)}` })),
    ...state.debts
      .filter((debt) => debt.dueDate && debt.dueDate <= monthEnd)
      .map((debt) => ({ date: debt.dueDate, title: "Debt reminder", detail: `${debt.lender} - ${debt.repaymentTerms}` })),
    ...state.forecasts
      .filter((item) => ["Open", "Delayed"].includes(item.status) && item.date <= today)
      .map((item) => ({ date: item.date, title: today > getExpectedReceiptDate(item) ? "Expected payment overdue" : "Confirm expected payment", detail: `${item.party} - ${formatAmount(item.amount)} - latest ${formatDate(getExpectedReceiptDate(item))}` })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const dueNode = qs("[data-dashboard-due]");
  dueNode.innerHTML = dueItems.length
    ? dueItems.slice(0, 7).map((item) => alertHtml(item.title, `${formatDate(item.date)} - ${item.detail}`, item.date < today ? "bad" : "warn")).join("")
    : `<div class="empty-state">No upcoming dues found.</div>`;
}

function alertHtml(title, detail, tone = "") {
  return `<article class="alert-item ${tone}"><div class="alert-title">${escapeHtml(title)}</div><div class="alert-detail">${escapeHtml(detail)}</div></article>`;
}

function getOverdueItems() {
  const today = state.settings.businessDate;
  const dueTitle = (overdueText, dueText, date) => (date < today ? overdueText : dueText);
  const dueTone = (date) => (date < today ? "bad" : "warn");
  const items = [];

  state.purchases
    .filter((purchase) => getPurchaseOpenAmount(purchase.id) > 0 && getPurchasePaymentDate(purchase) <= today)
    .forEach((purchase) => {
      const amount = getPurchaseOpenAmount(purchase.id);
      const paymentDate = getPurchasePaymentDate(purchase);
      items.push({
        date: paymentDate,
        title: dueTitle("Overdue purchase payment", "Purchase payment provision due today", paymentDate),
        detail: `${vendorName(purchase.vendorId)} - Invoice ${purchase.invoiceNo} matured ${formatDate(purchase.dueDate)} - ${getPurchaseStatus(purchase.id)}`,
        amount,
        tone: dueTone(paymentDate),
        view: "purchases",
      });
    });

  state.expenses
    .filter((expense) => expense.status === "Booked" && expense.dueDate <= today)
    .forEach((expense) => {
      items.push({
        date: expense.dueDate,
        title: dueTitle("Overdue booked expense", "Booked expense due today", expense.dueDate),
        detail: `${expense.paidTo} - ${expense.category}`,
        amount: expense.amount,
        tone: dueTone(expense.dueDate),
        view: "scheduled",
      });
    });

  const previousMonth = addMonths(monthKey(today), -1);
  const salaryClearingDate = monthDayInput(monthKey(today), 15);
  const salaryPayable = getSalaryPayableForMonth(previousMonth);
  if (salaryPayable > 0 && salaryClearingDate <= today) {
    items.push({
      date: salaryClearingDate,
      title: dueTitle("Overdue salary clearing", "Salary clearing due today", salaryClearingDate),
      detail: `${previousMonth} salary balance is still unpaid.`,
      amount: salaryPayable,
      tone: dueTone(salaryClearingDate),
      view: "salaries",
    });
  }

  state.debts
    .filter((debt) => isDebtActiveOnDate(debt, today))
    .forEach((debt) => {
      const dueDate = getCurrentRepaymentDate(debt, today);
      if (!dueDate || dueDate > today) return;
      const amount = getDebtDueOpenAmount(debt, dueDate);
      if (amount <= 0) return;
      const paymentType = getDebtPaymentType(debt);
      items.push({
        date: dueDate,
        title: dueTitle(`Overdue ${paymentType.toLowerCase()}`, `${paymentType} due today`, dueDate),
        detail: `${debt.lender} - ${debt.repaymentTerms}`,
        amount,
        tone: dueTone(dueDate),
        view: "debt",
        action: `<div class="inline-actions"><select class="inline-select" data-overdue-debt-account="${escapeHtml(debt.id)}">${moneySelectOptions()}</select><button class="secondary-button" data-pay-overdue-debt-interest="${escapeHtml(debt.id)}" type="button">Pay ${escapeHtml(paymentType.replace(" Payment", ""))}</button><button class="ghost-button" data-overdue-view="debt" type="button">Open</button></div>`,
      });
    });

  state.pdcs
    .filter((pdc) => ["Pending", "Deposited"].includes(pdc.status) && pdc.dueDate <= today)
    .forEach((pdc) => {
      const risk = assessPdcRisk(pdc);
      items.push({
        date: pdc.dueDate,
        title: dueTitle(pdc.direction === "payable" ? "Overdue PDC payable" : "Overdue PDC receivable", pdc.direction === "payable" ? "PDC payable due today" : "PDC receivable due today", pdc.dueDate),
        detail: `${pdc.partyName} - ${pdc.chequeNo}. ${risk.detail}`,
        amount: pdc.amount,
        tone: pdc.dueDate < today || risk.severity === "bad" ? "bad" : "warn",
        view: "pdc",
      });
    });

  state.forecasts
    .filter((item) => ["Open", "Delayed"].includes(item.status) && getExpectedReceiptDate(item) <= today)
    .forEach((item) => {
      const dueDate = getExpectedReceiptDate(item);
      items.push({
        date: dueDate,
        title: dueTitle("Expected receipt overdue", "Expected receipt due today", dueDate),
        detail: `${item.party} - ${item.paymentType || "Expected payment"}`,
        amount: item.amount,
        tone: dueTone(dueDate),
        view: "expected",
      });
    });

  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.tone === "bad" ? -1 : 1));
}

function renderRecentActivity() {
  const rows = getLedgerEntries().sort(sortNewest).slice(0, 12);
  const node = qs("[data-recent-activity]");
  node.innerHTML = rows.length
    ? rows.map((row) => `<tr><td>${escapeHtml(formatDate(row.date))}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.party)}</td><td>${escapeHtml(row.details)}</td><td class="amount-cell tone-good">${row.in ? escapeHtml(formatAmount(row.in)) : ""}</td><td class="amount-cell tone-bad">${row.out ? escapeHtml(formatAmount(row.out)) : ""}</td></tr>`).join("")
    : `<tr><td colspan="6" class="empty-state">No activity recorded yet.</td></tr>`;
}

function renderVendors() {
  const node = qs("[data-vendors-table]");
  if (!node) return;
  node.innerHTML = state.vendors.length
    ? state.vendors
        .map((vendor) => {
          const purchases = state.purchases.filter((item) => item.vendorId === vendor.id);
          const outstanding = purchases.reduce((sum, item) => sum + getPurchaseOpenAmount(item.id), 0);
          const matured = purchases.filter((item) => getPurchaseOpenAmount(item.id) > 0 && item.dueDate <= state.settings.businessDate).length;
          return `<tr><td>${escapeHtml(vendor.name)}</td><td>${vendor.terms} days</td><td>${purchases.length}</td><td>${matured}</td><td class="amount-cell">${escapeHtml(formatAmount(outstanding))}</td><td><button class="danger-button" data-delete="vendors" data-id="${vendor.id}" type="button">x</button></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty-state">No vendors added yet.</td></tr>`;
}

function renderPurchases() {
  renderCategories("[data-purchase-categories]", state.purchaseCategories, "purchaseCategories");
  const node = qs("[data-purchases-table]");
  if (!node) return;
  node.innerHTML = state.purchases.length
    ? state.purchases
        .map((purchase) => {
          const paid = getPurchasePaidAmount(purchase.id);
          const status = getPurchaseStatus(purchase.id);
          return `<tr><td>${escapeHtml(purchase.invoiceNo)}</td><td>${escapeHtml(vendorName(purchase.vendorId))}</td><td>${escapeHtml(formatDate(purchase.date))}</td><td>${escapeHtml(formatDate(purchase.dueDate))}</td><td>${escapeHtml(purchase.category)}</td><td class="amount-cell">${escapeHtml(formatAmount(purchase.amount))}</td><td class="amount-cell">${escapeHtml(formatAmount(paid))}</td><td>${statusPill(status)}</td><td><button class="danger-button" data-delete="purchases" data-id="${purchase.id}" type="button">x</button></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="9" class="empty-state">No purchase invoices booked yet.</td></tr>`;
}

function renderPurchasePredictor() {
  renderPredictorItemSelectors();
  renderPredictorVendorSelectors();
  renderPredictorItemsTable();
  renderPredictorVendorsTable();
  renderPurchasePredictionPreview();
  renderPurchasePredictionsTable();
}

function renderPredictorItemSelectors() {
  const options = optionList(state.purchasePredictorItems, "Add an item first");
  qsa("[data-predictor-item-select]").forEach((select) => preserveSelect(select, options));
}

function renderPredictorVendorSelectors() {
  const form = qs("#purchase-prediction-form");
  const selectedItemId = form?.elements.itemId?.value || "";
  const vendors = state.purchasePredictorVendors.filter((vendor) => !selectedItemId || vendor.itemId === selectedItemId);
  const options = vendors.length
    ? `<option value="">Choose vendor rate</option>${vendors.map((vendor) => `<option value="${vendor.id}">${escapeHtml(vendor.vendorName)} - ${formatAmount(vendor.rate)} - ${vendor.terms} days</option>`).join("")}`
    : `<option value="">Add vendor rate first</option>`;
  qsa("[data-predictor-vendor-select]").forEach((select) => preserveSelect(select, options));
}

function renderPredictorItemsTable() {
  const node = qs("[data-predictor-items-table]");
  if (!node) return;
  node.innerHTML = state.purchasePredictorItems.length
    ? state.purchasePredictorItems
        .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.unit || "unit")}</td><td class="amount-cell">${escapeHtml(formatAmount(item.baseRate))}</td><td>${escapeHtml(getPredictorTaxLabel(item))}</td><td><button class="danger-button" data-delete="purchasePredictorItems" data-id="${item.id}" type="button">x</button></td></tr>`)
        .join("")
    : `<tr><td colspan="5" class="empty-state">No predictor items added yet.</td></tr>`;
}

function renderPredictorVendorsTable() {
  const node = qs("[data-predictor-vendors-table]");
  if (!node) return;
  const rows = [...state.purchasePredictorVendors].sort((a, b) => predictorItemName(a.itemId).localeCompare(predictorItemName(b.itemId)) || a.vendorName.localeCompare(b.vendorName));
  node.innerHTML = rows.length
    ? rows
        .map((vendor) => `<tr><td>${escapeHtml(predictorItemName(vendor.itemId))}</td><td>${escapeHtml(vendor.vendorName)}</td><td class="amount-cell">${escapeHtml(formatAmount(vendor.rate))}</td><td>${vendor.terms} days</td><td><button class="danger-button" data-delete="purchasePredictorVendors" data-id="${vendor.id}" type="button">x</button></td></tr>`)
        .join("")
    : `<tr><td colspan="5" class="empty-state">No vendor rates added yet.</td></tr>`;
}

function renderPurchasePredictionPreview() {
  const form = qs("#purchase-prediction-form");
  const metricsNode = qs("[data-prediction-preview]");
  const optionsNode = qs("[data-prediction-vendor-options]");
  if (!form || !metricsNode || !optionsNode) return;
  renderPredictorVendorSelectors();
  const data = formData(form);
  const quantity = numberValue(data.quantity);
  const candidate = quantity > 0
    ? buildPurchasePredictionPlan({
        itemId: data.itemId,
        vendorOptionId: data.vendorOptionId,
        date: data.date || state.settings.businessDate,
        quantity,
        accountId: data.accountId,
        silent: true,
      })
    : null;

  if (candidate) {
    const risk = assessPurchasePrediction(candidate, { extraPurchasePredictions: [candidate] });
    const projectionValue = isFinanceRole()
      ? risk.shortfall > 0
        ? "Funds not available"
        : "Funds available"
      : formatAmount(risk.accountProjected);
    renderMetricGrid("[data-prediction-preview]", [
      { label: "Gross purchase", value: formatAmount(candidate.grossAmount), note: `${candidate.quantity} ${candidate.unit} before tax` },
      { label: "Tax", value: formatAmount(candidate.taxAmount), note: candidate.taxRate ? `${candidate.taxRate}%` : "Not taxed" },
      { label: "Payment provision", value: formatDate(candidate.paymentDate), note: `Maturity ${formatDate(candidate.maturityDate)}` },
      { label: isFinanceRole() ? "Funds check" : "Projected account", value: projectionValue, note: isFinanceRole() ? "Based on scheduled commitments" : accountName(candidate.accountId), valueTone: risk.shortfall > 0 ? "tone-bad" : "tone-good" },
    ]);
  } else {
    renderMetricGrid("[data-prediction-preview]", [
      { label: "Gross purchase", value: formatAmount(0), note: "Select item, vendor, and quantity" },
      { label: "Tax", value: formatAmount(0), note: "Taxed supply setting" },
      { label: "Payment provision", value: "-", note: "10th, 20th, or month end" },
      { label: isFinanceRole() ? "Funds check" : "Projected account", value: "-", note: "Waiting for forecast" },
    ]);
  }

  renderPredictorVendorComparison();
}

function renderPredictorVendorComparison() {
  const form = qs("#purchase-prediction-form");
  const node = qs("[data-prediction-vendor-options]");
  if (!form || !node) return;
  const data = formData(form);
  const quantity = numberValue(data.quantity);
  const accountId = data.accountId;
  const vendors = state.purchasePredictorVendors.filter((vendor) => vendor.itemId === data.itemId);
  node.innerHTML = vendors.length && quantity > 0 && requireAccountSilently(accountId)
    ? vendors
        .map((vendor) => {
          const plan = buildPurchasePredictionPlan({
            itemId: data.itemId,
            vendorOptionId: vendor.id,
            date: data.date || state.settings.businessDate,
            quantity,
            accountId,
          });
          const risk = assessPurchasePrediction(plan, { extraPurchasePredictions: [plan] });
          const unitTotal = getPredictionUnitTotal(plan);
          const projectedCell = isFinanceRole() ? (risk.shortfall > 0 ? "Funds not available" : "Funds available") : formatAmount(risk.accountProjected);
          const status = isFinanceRole() ? (risk.shortfall > 0 ? "Funds Not Available" : "Funds Available") : (risk.shortfall > 0 ? "Shortfall" : "Projected Safe");
          return `<tr><td>${escapeHtml(vendor.vendorName)}</td><td>${vendor.terms} days</td><td class="amount-cell">${escapeHtml(formatAmount(unitTotal))}</td><td>${escapeHtml(formatDate(plan.paymentDate))}</td><td class="amount-cell ${risk.shortfall > 0 ? "tone-bad" : "tone-good"}">${escapeHtml(projectedCell)}</td><td class="amount-cell">${escapeHtml(formatQuantity(risk.safeQuantity))}</td><td>${statusPill(status)}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="empty-state">Select item, quantity, and paying account to compare vendors.</td></tr>`;
}

function renderPurchasePredictionsTable() {
  const node = qs("[data-purchase-predictions-table]");
  if (!node) return;
  const rows = [...state.purchasePredictions].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.date.localeCompare(b.date));
  node.innerHTML = rows.length
    ? rows
        .map((prediction) => {
          const risk = assessPurchasePrediction(prediction);
          const projectedCell = isFinanceRole() ? (risk.shortfall > 0 ? "Funds not available" : "Funds available") : formatAmount(risk.accountProjected);
          const status = isFinanceRole() ? (risk.shortfall > 0 ? "Funds Not Available" : "Funds Available") : (risk.shortfall > 0 ? "Shortfall" : prediction.status);
          return `<tr><td>${escapeHtml(formatDate(prediction.date))}</td><td>${escapeHtml(formatDate(prediction.paymentDate))}</td><td>${escapeHtml(prediction.itemName)}</td><td>${escapeHtml(prediction.vendorName)}</td><td>${escapeHtml(formatQuantity(prediction.quantity))} ${escapeHtml(prediction.unit)}</td><td class="amount-cell">${escapeHtml(formatAmount(prediction.totalAmount))}</td><td class="amount-cell ${risk.shortfall > 0 ? "tone-bad" : "tone-good"}">${escapeHtml(projectedCell)}</td><td>${statusPill(status)}</td><td><button class="danger-button" data-delete="purchasePredictions" data-id="${prediction.id}" type="button">x</button></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="9" class="empty-state">No purchase forecast scenarios added yet.</td></tr>`;
}

function renderCategories(selector, items, collection) {
  const node = qs(selector);
  if (!node) return;
  node.innerHTML = items.length
    ? items.map((name) => `<span class="category-chip">${escapeHtml(name)} <button class="chip-delete" data-delete="${collection}" data-id="${escapeHtml(name)}" type="button">x</button></span>`).join("")
    : `<span class="category-chip">No categories yet</span>`;
}

function renderMakePayment() {
  const vendorSelect = qs("[data-make-payment-vendor]");
  const node = qs("[data-payable-invoices]");
  if (!vendorSelect || !node) return;
  const vendorId = vendorSelect.value;
  const invoices = state.purchases.filter((purchase) => purchase.vendorId === vendorId && getPurchaseOpenAmount(purchase.id) > 0);
  node.innerHTML = invoices.length
    ? invoices.map((purchase) => `<tr><td><input data-payable-checkbox type="checkbox" value="${purchase.id}" /></td><td>${escapeHtml(purchase.invoiceNo)}</td><td>${escapeHtml(formatDate(purchase.date))}</td><td>${escapeHtml(formatDate(purchase.dueDate))}</td><td class="amount-cell">${escapeHtml(formatAmount(getPurchaseOpenAmount(purchase.id)))}</td></tr>`).join("")
    : `<tr><td colspan="5" class="empty-state">${vendorId ? "No open invoices for this vendor." : "Choose a vendor to see unpaid invoices."}</td></tr>`;
  renderPaymentSelectionSummary();
}

function renderPaymentSelectionSummary() {
  const selectedIds = qsa("[data-payable-checkbox]:checked").map((input) => input.value);
  const total = selectedIds.reduce((sum, id) => sum + getPurchaseOpenAmount(id), 0);
  renderMetricGrid("[data-payment-selection-summary]", [
    { label: "Selected invoices", value: String(selectedIds.length), note: "Ready for payment" },
    { label: "Selected total", value: formatAmount(total), note: "Maximum payable amount" },
  ]);
}

function renderPaymentIns() {
  const node = qs("[data-payment-ins-table]");
  if (!node) return;
  node.innerHTML = state.paymentIns.length
    ? state.paymentIns.map((item) => `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${escapeHtml(item.source)}</td><td>${escapeHtml(item.party || "Not specified")}</td><td>${escapeHtml(accountName(item.accountId))}</td><td class="amount-cell">${escapeHtml(formatAmount(item.amount))}</td><td><button class="danger-button" data-delete="paymentIns" data-id="${item.id}" type="button">x</button></td></tr>`).join("")
    : `<tr><td colspan="6" class="empty-state">No incoming payments recorded yet.</td></tr>`;
}

function renderDebts() {
  const node = qs("[data-debts-table]");
  if (!node) return;
  node.innerHTML = state.debts.length
    ? state.debts.map((debt) => {
        const dailyBook = getDebtDailyAccrual(debt, state.settings.businessDate);
        const dueLabel = debt.repaymentDay ? `Day ${debt.repaymentDay}` : debt.dueDate ? formatDate(debt.dueDate) : "Not set";
        return `<tr><td>${escapeHtml(debt.lender)}</td><td>${statusPill(debt.entryType)}<br><span class="alert-detail">${escapeHtml(debt.debtType)}</span></td><td>${escapeHtml(debt.repaymentTerms)}</td><td class="amount-cell">${escapeHtml(formatAmount(debt.amount))}</td><td>${escapeHtml(getDebtPaymentLabel(debt))}</td><td class="amount-cell">${dailyBook ? escapeHtml(formatAmount(dailyBook)) : ""}</td><td>${escapeHtml(dueLabel)}</td><td><button class="danger-button" data-delete="debts" data-id="${debt.id}" type="button">x</button></td></tr>`;
      }).join("")
    : `<tr><td colspan="8" class="empty-state">No debt accounts recorded yet.</td></tr>`;
}

function renderScheduled() {
  const pending = getScheduledItems();
  const node = qs("[data-scheduled-table]");
  if (node) {
    node.innerHTML = pending.length
      ? pending.map((item) => `<tr><td>${escapeHtml(item.date ? formatDate(item.date) : "-")}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.party)}</td><td class="amount-cell">${escapeHtml(formatAmount(item.amount))}</td><td>${statusPill(item.status)}</td><td>${item.action || ""}</td></tr>`).join("")
      : `<tr><td colspan="6" class="empty-state">No scheduled payments pending.</td></tr>`;
  }
  const history = qs("[data-scheduled-history]");
  if (history) {
    const rows = [
      ...state.expenses.map((expense) => ({ date: expense.date, type: "Expense", details: `${expense.category} - ${expense.paidTo}`, amount: expense.amount, status: expense.status })),
      ...state.salaryEntries.map((entry) => ({ date: entry.date, type: "Salary", details: entry.remarks || entry.type, amount: entry.amount, status: entry.type })),
      ...state.debtPayments.map((payment) => ({ date: payment.date, type: "Debt Payment", details: `${payment.lender} - ${payment.paymentType || "Debt payment"}`, amount: payment.amount, status: "Paid" })),
    ].sort(sortNewest);
    history.innerHTML = rows.length
      ? rows.map((row) => `<tr><td>${escapeHtml(formatDate(row.date))}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.details)}</td><td class="amount-cell">${escapeHtml(formatAmount(row.amount))}</td><td>${statusPill(row.status)}</td></tr>`).join("")
      : `<tr><td colspan="5" class="empty-state">No scheduled history yet.</td></tr>`;
  }
}

function getScheduledItems() {
  const accountOptions = moneySelectOptions();
  const bookedExpenses = state.expenses
    .filter((expense) => expense.status === "Booked")
    .map((expense) => ({
      date: expense.dueDate,
      type: "Booked Expense",
      party: `${expense.category} - ${expense.paidTo}`,
      amount: expense.amount,
      status: "Pending",
      action: `<select class="inline-select" data-pay-booked-account="${expense.id}">${accountOptions}</select><button class="secondary-button" data-pay-booked-expense="${expense.id}" type="button">Pay</button>`,
    }));
  const salary = isFinanceRole() ? [] : getSalaryScheduleItems().map((item) => ({ ...item, action: "Use Salaries screen" }));
  const debts = isFinanceRole() ? [] : state.debts
    .filter((debt) => isDebtActiveOnDate(debt, state.settings.businessDate))
    .map((debt) => {
      const date = getNextRepaymentDate(debt);
      return {
        date,
        type: debt.repaymentTerms === "Monthly EMI" ? "Debt EMI Reminder" : "Debt Interest Reminder",
        party: debt.lender,
        amount: date ? getDebtDueOpenAmount(debt, date) : 0,
        status: "Reminder",
        action: "Pay from Overdues when due",
      };
    })
    .filter((item) => item.date && item.amount > 0);
  return [...bookedExpenses, ...salary, ...debts].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

function getSalaryScheduleItems(date = state.settings.businessDate) {
  const currentMonth = monthKey(date);
  const previousMonth = addMonths(currentMonth, -1);
  const items = [];
  const salaryClearingDate = monthDayInput(currentMonth, 15);
  const previousPayable = getSalaryPayableForMonth(previousMonth);
  if (previousPayable > 0) {
    items.push({
      date: salaryClearingDate,
      type: salaryClearingDate < date ? "Salary Clearing Overdue" : "Salary Clearing Due",
      party: `${previousMonth} salary balance`,
      amount: previousPayable,
      status: salaryClearingDate < date ? "Overdue" : "Pending",
    });
  }

  const advanceDate = monthEndInput(currentMonth);
  const advanceDue = getSalaryAdvanceDueForMonth(currentMonth);
  if (advanceDue > 0 && advanceDate >= date) {
    items.push({
      date: advanceDate,
      type: "Salary Advance Scheduled",
      party: `${currentMonth} advance`,
      amount: advanceDue,
      status: "Scheduled",
    });
  }
  return items;
}

function renderExpected() {
  renderExpectedAlerts();
  renderForecastTable();
  renderProjectionTable();
}

function renderExpectedAlerts() {
  const panel = qs("[data-expected-alert-panel]");
  const node = qs("[data-expected-alerts]");
  if (!panel || !node) return;
  const today = state.settings.businessDate;
  const rows = state.forecasts
    .filter((item) => ["Open", "Delayed"].includes(item.status) && item.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  panel.hidden = !rows.length;
  node.innerHTML = rows
    .map((item) => {
      const latest = getExpectedReceiptDate(item);
      const overdue = today > latest;
      const title = overdue ? "Receipt delay window crossed" : "Expected receipt due";
      const detail = overdue
        ? `${item.party} was expected by ${formatDate(latest)}. Do not rely on it for PDC passing until received.`
        : `${item.party} expected ${formatAmount(item.amount)} by ${formatDate(item.date)}. Confirm if received or delayed.`;
      return `<article class="alert-item ${overdue ? "bad" : "warn"}"><div class="alert-title">${escapeHtml(title)}</div><div class="alert-detail">${escapeHtml(detail)}</div><div class="inline-actions"><button class="secondary-button" data-forecast-received="${item.id}" type="button">Mark received</button><button class="ghost-button" data-forecast-delayed="${item.id}" type="button">Not received</button></div></article>`;
    })
    .join("");
}

function renderForecastTable() {
  const node = qs("[data-forecast-table]");
  if (!node) return;
  const rows = [...state.forecasts].sort((a, b) => a.date.localeCompare(b.date));
  node.innerHTML = rows.length
    ? rows.map((item) => {
        const action = item.status === "Received"
          ? ""
          : `<button class="secondary-button" data-forecast-received="${item.id}" type="button">Received</button><button class="ghost-button" data-forecast-delayed="${item.id}" type="button">Delay</button><button class="danger-button" data-forecast-cancelled="${item.id}" type="button">Cancel</button>`;
        return `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${escapeHtml(formatDate(getExpectedReceiptDate(item)))}</td><td>${escapeHtml(item.paymentType || "Expected")}</td><td>${escapeHtml(item.party)}</td><td>${escapeHtml(accountName(getForecastAccountId(item)))}</td><td class="amount-cell">${escapeHtml(formatAmount(item.amount))}</td><td><select class="status-select" data-forecast-status="${item.id}">${forecastStatuses.map((option) => `<option ${option === item.status ? "selected" : ""}>${option}</option>`).join("")}</select></td><td><div class="inline-actions">${action}<button class="danger-button" data-delete="forecasts" data-id="${item.id}" type="button">x</button></div></td></tr>`;
      }).join("")
    : `<tr><td colspan="8" class="empty-state">No expected payments logged yet.</td></tr>`;
}

function renderProjectionTable() {
  const node = qs("[data-projection-table]");
  if (!node) return;
  node.innerHTML = buildProjection(30)
    .map((row) => `<tr><td>${escapeHtml(formatDate(row.date))}</td><td class="amount-cell tone-good">${row.in ? escapeHtml(formatAmount(row.in)) : ""}</td><td class="amount-cell tone-bad">${row.out ? escapeHtml(formatAmount(row.out)) : ""}</td><td class="amount-cell ${row.balance < 0 ? "tone-bad" : ""}">${escapeHtml(formatAmount(row.balance))}</td><td>${escapeHtml(row.notes || "No planned movement")}</td></tr>`)
    .join("");
}

function renderReports() {
  renderReportTypeOptions();
  const node = qs("[data-reports-table]");
  if (!node) return;
  const rows = getFilteredReportRows();
  node.innerHTML = rows.length
    ? rows.map((row) => `<tr><td>${escapeHtml(formatDate(row.date))}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.party)}</td><td>${statusPill(row.status)}</td><td>${escapeHtml(row.account)}</td><td>${escapeHtml(row.reference)}</td><td class="amount-cell">${escapeHtml(formatAmount(row.amount))}</td><td>${row.printAction || ""}<button class="danger-button" data-delete="${row.collection}" data-id="${row.id}" type="button">x</button></td></tr>`).join("")
    : `<tr><td colspan="8" class="empty-state">No report rows match the selected filters.</td></tr>`;
}

function renderReportTypeOptions() {
  const select = qs("[data-report-type]");
  if (!select) return;
  const allowed = isFinanceRole() ? reportTypeOptions.filter((option) => option === "All Transactions" || financeReportGroups.has(option)) : reportTypeOptions;
  const current = allowed.includes(select.value) ? select.value : "All Transactions";
  select.innerHTML = allowed.map((option) => `<option>${escapeHtml(option)}</option>`).join("");
  select.value = current;
}

function renderPdc() {
  const node = qs("[data-pdc-table]");
  if (!node) return;
  const rows = [...state.pdcs].filter((pdc) => !isFinanceRole() || pdc.direction === "payable").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  node.innerHTML = rows.length
    ? rows.map((pdc) => {
        const risk = assessPdcRisk(pdc);
        return `<tr><td>${escapeHtml(formatDate(pdc.dueDate))}</td><td>${statusPill(pdc.direction === "receivable" ? "Receivable" : "Payable")}</td><td>${escapeHtml(pdc.partyName)}</td><td>${escapeHtml(pdc.chequeNo)}<br><span class="alert-detail">${escapeHtml(pdc.bankName)}</span></td><td>${escapeHtml(accountName(pdc.accountId))}</td><td class="amount-cell">${escapeHtml(formatAmount(pdc.amount))}</td><td>${statusPill(risk.label)}<br><span class="alert-detail">${escapeHtml(risk.detail)}</span></td><td><select class="status-select" data-pdc-status="${pdc.id}">${pdcStatuses.map((option) => `<option ${option === pdc.status ? "selected" : ""}>${option}</option>`).join("")}</select><button class="danger-button" data-delete="pdcs" data-id="${pdc.id}" type="button">x</button></td><td><button class="ghost-button" data-print-pdc-id="${pdc.id}" type="button">Print</button></td></tr>`;
      }).join("")
    : `<tr><td colspan="9" class="empty-state">No post-dated cheques recorded.</td></tr>`;
}

function renderCashBank() {
  const balances = computeBalances();
  const metrics = [
    { label: "Cash in hand", value: formatAmount(balances.cash), note: "Cleared cash balance", valueTone: balances.cash < 0 ? "tone-bad" : "" },
    { label: "Bank total", value: formatAmount(balances.bankTotal), note: "All bank balances", valueTone: balances.bankTotal < 0 ? "tone-bad" : "" },
    { label: "Statement balance", value: formatAmount(balances.liquidity), note: "Cash plus cleared bank funds", valueTone: balances.liquidity < 0 ? "tone-bad" : "tone-good" },
    { label: "Projected balance", value: formatAmount(buildProjection(30).at(-1)?.balance || balances.liquidity), note: "30-day forecast with commitments" },
    ...state.accounts.map((account) => ({ label: account.name, value: formatAmount(balances.bankBalances[account.id] || 0), note: "Current bank balance", valueTone: (balances.bankBalances[account.id] || 0) < 0 ? "tone-bad" : "" })),
  ];
  renderMetricGrid("[data-cashbank-metrics]", metrics);

  const node = qs("[data-ledger-table]");
  if (!node) return;
  const rows = getLedgerEntries().sort(sortNewest);
  node.innerHTML = rows.length
    ? rows.map((row) => `<tr><td>${escapeHtml(formatDate(row.date))}</td><td>${escapeHtml(accountName(row.accountId))}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.details)}</td><td class="amount-cell tone-good">${row.in ? escapeHtml(formatAmount(row.in)) : ""}</td><td class="amount-cell tone-bad">${row.out ? escapeHtml(formatAmount(row.out)) : ""}</td></tr>`).join("")
    : `<tr><td colspan="6" class="empty-state">No ledger movement yet.</td></tr>`;
}

function renderSalaries() {
  const currentMonth = monthKey(state.settings.businessDate);
  const previousMonth = addMonths(currentMonth, -1);
  const advanceDue = getSalaryAdvanceDueForMonth(currentMonth);
  const previousSalaryDue = getSalaryPayableForMonth(previousMonth);
  if (isOwnerRole()) {
    renderMetricGrid("[data-salary-metrics]", [
      { label: "Expected monthly", value: formatAmount(state.settings.expectedMonthlySalary), note: "Forecast only" },
      { label: "Booked this month", value: formatAmount(getSalaryBookedThisMonth()), note: "Incurred expense booked" },
      { label: "Advance paid", value: formatAmount(getSalaryAdvancePaidThisMonth()), note: "Cash or bank paid out" },
      { label: "Salary paid", value: formatAmount(getSalaryPaidThisMonth()), note: "Cash or bank paid out" },
      { label: "Balance payable", value: formatAmount(getSalaryPayable()), note: "Booked minus advances and salary paid", valueTone: getSalaryPayable() > 0 ? "tone-warn" : "tone-good" },
    ]);
    renderMetricGrid("[data-salary-schedule]", [
      { label: "Advance schedule", value: formatAmount(advanceDue), note: `50% due at month end ${formatDate(monthEndInput(currentMonth))}` },
      { label: "Salary clearing", value: formatAmount(previousSalaryDue), note: `Previous month due on ${formatDate(monthDayInput(currentMonth, 15))}`, valueTone: previousSalaryDue > 0 ? "tone-warn" : "tone-good" },
      { label: "Suggested daily booking", value: formatAmount(getDailyExpectedSalary(state.settings.businessDate)), note: "Rough guide only; book manually before day close" },
      { label: "Current month payable", value: formatAmount(getSalaryPayableForMonth(currentMonth)), note: "Current month booked minus advance paid" },
    ]);
  } else {
    setHtml("[data-salary-metrics]", "");
    setHtml("[data-salary-schedule]", "");
  }

  const form = qs("#salary-settings-form");
  if (form) form.elements.expectedMonthlySalary.value = state.settings.expectedMonthlySalary;
  const advanceForm = qs("#salary-advance-form");
  if (advanceForm) {
    advanceForm.elements.salaryMonth.value = currentMonth;
    if (!numberValue(advanceForm.elements.amount.value)) advanceForm.elements.amount.value = advanceDue || roundMoney(numberValue(state.settings.expectedMonthlySalary) / 2) || "";
  }
  const payForm = qs("#salary-pay-form");
  if (payForm) {
    payForm.elements.salaryMonth.value = previousMonth;
    if (!numberValue(payForm.elements.amount.value)) payForm.elements.amount.value = previousSalaryDue || "";
  }

  const node = qs("[data-salary-table]");
  if (!node) return;
  const rows = isFinanceRole() ? state.salaryEntries.filter((entry) => entry.type === "Booked") : state.salaryEntries;
  node.innerHTML = rows.length
    ? rows.map((entry) => `<tr><td>${escapeHtml(formatDate(entry.date))}</td><td>${escapeHtml(entry.type)}</td><td>${escapeHtml(entry.accountId ? accountName(entry.accountId) : "Payable")}</td><td class="amount-cell">${escapeHtml(formatAmount(entry.amount))}</td><td>${escapeHtml(`${entry.salaryMonth ? `${entry.salaryMonth} - ` : ""}${entry.remarks || ""}`)}</td><td><button class="danger-button" data-delete="salaryEntries" data-id="${entry.id}" type="button">x</button></td></tr>`).join("")
    : `<tr><td colspan="6" class="empty-state">No salary entries yet.</td></tr>`;
}

function renderDaybook() {
  const selectedDate = qs("[data-daybook-date]")?.value || state.settings.businessDate;
  if (!isDaybookRetained(selectedDate)) {
    renderMetricGrid("[data-daybook-summary]", [
      { label: "Daybook expired", value: "180 days", note: "Older daily daybooks are automatically removed" },
    ]);
    setHtml("[data-daybook-table]", `<tr><td colspan="6" class="empty-state">This daybook is older than 180 days and is no longer available.</td></tr>`);
    return;
  }
  const opening = computeBalances({ beforeDate: selectedDate });
  const closing = computeBalances({ throughDate: selectedDate });
  const entries = getDaybookEntries(selectedDate);
  const moneyIn = entries.reduce((sum, item) => sum + numberValue(item.in), 0);
  const moneyOut = entries.reduce((sum, item) => sum + numberValue(item.out), 0);
  const commitments = entries.reduce((sum, item) => sum + numberValue(item.commitment), 0);
  const debtCosts = entries.filter((item) => item.type.includes("Debt")).reduce((sum, item) => sum + numberValue(item.commitment), 0);

  renderMetricGrid("[data-daybook-summary]", [
    { label: "Opening liquidity", value: formatAmount(opening.liquidity), note: `Before ${formatDate(selectedDate)}` },
    { label: "Payments in", value: formatAmount(moneyIn), note: "Cleared incoming movements", valueTone: "tone-good" },
    { label: "Payments out", value: formatAmount(moneyOut), note: "Cleared outgoing movements only", valueTone: moneyOut > 0 ? "tone-warn" : "" },
    { label: "Commitments booked", value: formatAmount(commitments), note: "Purchases, booked expenses, salary payable, PDC notes, and debt costs", valueTone: commitments > 0 ? "tone-warn" : "" },
    { label: "Debt cost booked", value: formatAmount(debtCosts), note: "Daily interest or EMI cost, no cash debit", valueTone: debtCosts > 0 ? "tone-warn" : "" },
    { label: "Closing liquidity", value: formatAmount(closing.liquidity), note: `Cash ${formatAmount(closing.cash)} - bank ${formatAmount(closing.bankTotal)}`, valueTone: closing.liquidity < 0 ? "tone-bad" : "tone-good" },
  ]);

  const node = qs("[data-daybook-table]");
  if (!node) return;
  node.innerHTML = entries.length
    ? entries.map((entry) => `<tr><td>${escapeHtml(entry.type)}</td><td>${escapeHtml(entry.party)}</td><td>${escapeHtml(entry.details)}</td><td class="amount-cell tone-good">${entry.in ? escapeHtml(formatAmount(entry.in)) : ""}</td><td class="amount-cell tone-bad">${entry.out ? escapeHtml(formatAmount(entry.out)) : ""}</td><td class="amount-cell tone-warn">${entry.commitment ? escapeHtml(formatAmount(entry.commitment)) : ""}</td></tr>`).join("")
    : `<tr><td colspan="6" class="empty-state">No transactions on this date.</td></tr>`;
}

function isDaybookRetained(date) {
  return date >= addDays(state.settings.businessDate, -DAYBOOK_RETENTION_DAYS + 1);
}

function renderCrux() {
  const select = qs("[data-crux-date]");
  if (!select) return;
  const closedDays = getClosedDays();
  if (!closedDays.length) {
    select.innerHTML = `<option value="">Close a day first</option>`;
    renderMetricGrid("[data-crux-summary]", [
      { label: "No closed days", value: "-", note: "Use Close Business Day from Banks & Cash" },
      { label: "Storage", value: "30 days", note: "Closed day reports are kept for the latest 30 days" },
    ]);
    setHtml("[data-crux-charts]", `<div class="empty-state">Close a business day to generate the graphical briefing.</div>`);
    setHtml("[data-crux-briefing]", `<div class="empty-state">No closed-day briefing yet.</div>`);
    setHtml("[data-crux-daybook-table]", `<tr><td colspan="6" class="empty-state">No daybook page yet.</td></tr>`);
    setHtml("[data-crux-actions-table]", `<tr><td colspan="6" class="empty-state">No actions to edit yet.</td></tr>`);
    return;
  }

  const current = closedDays.some((item) => item.date === select.value) ? select.value : closedDays[0].date;
  select.innerHTML = closedDays.map((item) => `<option value="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date))}</option>`).join("");
  select.value = current;
  const crux = getDailyCrux(current);

  renderMetricGrid("[data-crux-summary]", [
    { label: "Opening liquidity", value: formatAmount(crux.opening.liquidity), note: `Before ${formatDate(current)}` },
    { label: "Money in", value: formatAmount(crux.moneyIn), note: "Cleared incoming entries", valueTone: crux.moneyIn > 0 ? "tone-good" : "" },
    { label: "Money out", value: formatAmount(crux.moneyOut), note: "Cleared outgoing entries", valueTone: crux.moneyOut > 0 ? "tone-warn" : "" },
    { label: "Purchases booked", value: formatAmount(crux.purchasesBooked), note: "Purchase invoices recorded" },
    { label: "Salaries booked", value: formatAmount(crux.salariesBooked), note: "Salary expense incurred" },
    { label: "Expenses booked", value: formatAmount(crux.expensesBooked), note: "Immediate plus unpaid expenses" },
    { label: "Debt cost booked", value: formatAmount(crux.debtCosts), note: "Interest or EMI accrual, no cash debit" },
    { label: "Closing liquidity", value: formatAmount(crux.closing.liquidity), note: `Cash ${formatAmount(crux.closing.cash)} - bank ${formatAmount(crux.closing.bankTotal)}`, valueTone: crux.closing.liquidity < 0 ? "tone-bad" : "tone-good" },
  ]);

  setHtml("[data-crux-charts]", renderCruxCharts(crux));
  setHtml(
    "[data-crux-briefing]",
    getCruxBriefingLines(crux).map((line) => `<article class="briefing-item">${escapeHtml(line)}</article>`).join("")
  );
  setHtml(
    "[data-crux-daybook-table]",
    crux.daybook.length
      ? crux.daybook.map((entry) => `<tr><td>${escapeHtml(entry.type)}</td><td>${escapeHtml(entry.party)}</td><td>${escapeHtml(entry.details)}</td><td class="amount-cell tone-good">${entry.in ? escapeHtml(formatAmount(entry.in)) : ""}</td><td class="amount-cell tone-bad">${entry.out ? escapeHtml(formatAmount(entry.out)) : ""}</td><td class="amount-cell tone-warn">${entry.commitment ? escapeHtml(formatAmount(entry.commitment)) : ""}</td></tr>`).join("")
      : `<tr><td colspan="6" class="empty-state">No daybook entries on this date.</td></tr>`
  );
  setHtml(
    "[data-crux-actions-table]",
    crux.actions.length
      ? crux.actions.map((row) => `<tr><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.party)}</td><td>${escapeHtml(row.details)}</td><td class="amount-cell">${escapeHtml(formatAmount(row.amount))}</td><td>${escapeHtml(row.effect)}</td><td><button class="ghost-button" data-edit-day-action data-collection="${escapeHtml(row.collection)}" data-id="${escapeHtml(row.id)}" type="button">Edit</button><button class="danger-button" data-delete="${escapeHtml(row.collection)}" data-id="${escapeHtml(row.id)}" type="button">x</button></td></tr>`).join("")
      : `<tr><td colspan="6" class="empty-state">No source actions on this date.</td></tr>`
  );
}

function setHtml(selector, html) {
  const node = qs(selector);
  if (node) node.innerHTML = html;
}

function renderExpenses() {
  renderCategories("[data-expense-categories]", state.expenseCategories, "expenseCategories");
  renderUnpaidExpensePayment();
  const node = qs("[data-expenses-table]");
  if (!node) return;
  const rows = [
    ...state.expenses.map((expense) => ({
      ...expense,
      id: expense.id,
      collection: "expenses",
      date: expense.date,
      dueOrPaidDate: expense.status === "Paid" ? expense.paidDate || expense.date : expense.dueDate || expense.date,
      category: expense.category,
      paidTo: expense.paidTo,
      status: expense.status,
      account: expense.accountId ? accountName(expense.accountId) : "Payable",
      amount: expense.amount,
    })),
    ...state.debtAccruals.map((item) => ({
      id: item.id,
      collection: "debtAccruals",
      date: item.date,
      dueOrPaidDate: item.date,
      category: item.category,
      paidTo: item.lender,
      status: "Accrued",
      account: "No cash debit",
      amount: item.amount,
    })),
  ].sort(sortNewest);
  node.innerHTML = rows.length
    ? rows.map((expense) => `<tr><td>${escapeHtml(formatDate(expense.date))}</td><td>${escapeHtml(formatDate(expense.dueOrPaidDate))}</td><td>${escapeHtml(expense.category)}</td><td>${escapeHtml(expense.paidTo)}</td><td>${statusPill(expense.status)}</td><td>${escapeHtml(expense.account)}</td><td class="amount-cell">${escapeHtml(formatAmount(expense.amount))}</td><td>${renderExpenseActions(expense)}</td></tr>`).join("")
    : `<tr><td colspan="8" class="empty-state">No expenses recorded yet.</td></tr>`;
}

function renderExpenseActions(expense) {
  if (expense.collection === "expenses" && expense.status === "Booked") {
    return `<div class="inline-actions"><button class="ghost-button" data-edit-booked-expense="${expense.id}" type="button">Edit</button><button class="secondary-button" data-reduce-booked-expense="${expense.id}" type="button">Reduce</button><button class="danger-button" data-delete="expenses" data-id="${expense.id}" type="button">x</button></div>`;
  }
  if (expense.collection === "expenses" && expense.expensePaymentId) {
    return `<div class="inline-actions"><button class="ghost-button" data-print-expense-payment-id="${expense.expensePaymentId}" type="button">Print</button><button class="danger-button" data-delete="expenses" data-id="${expense.id}" type="button">x</button></div>`;
  }
  return `<button class="danger-button" data-delete="${expense.collection}" data-id="${expense.id}" type="button">x</button>`;
}

function renderUnpaidExpensePayment() {
  const categorySelect = qs("[data-unpaid-expense-category-filter]");
  const table = qs("[data-unpaid-expense-table]");
  if (!categorySelect || !table) return;

  const currentCategory = categorySelect.value;
  const categories = uniqueValues([
    ...state.expenseCategories,
    ...state.expenses.filter((expense) => expense.status === "Booked").map((expense) => expense.category),
  ]);
  categorySelect.innerHTML = `<option value="">All unpaid categories</option>${categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("")}`;
  if (categories.includes(currentCategory)) categorySelect.value = currentCategory;

  const payDate = qs("[data-unpaid-expense-pay-date]");
  if (payDate && !payDate.value) payDate.value = state.settings.businessDate;

  const selectedCategory = categorySelect.value;
  const rows = getOpenBookedExpenses(selectedCategory);
  table.innerHTML = rows.length
    ? rows
        .map(
          (expense) => `
            <tr>
              <td><input data-unpaid-expense-checkbox type="checkbox" value="${expense.id}" /></td>
              <td>${escapeHtml(formatDate(expense.date))}</td>
              <td>${escapeHtml(formatDate(expense.dueDate || expense.date))}</td>
              <td>${escapeHtml(expense.category)}</td>
              <td>${escapeHtml(expense.paidTo)}</td>
              <td>${escapeHtml(expense.notes || "")}</td>
              <td class="amount-cell">${escapeHtml(formatAmount(expense.amount))}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="7" class="empty-state">No unpaid expenses for this filter.</td></tr>`;
  renderUnpaidExpenseSelectionSummary();
}

function renderUnpaidExpenseSelectionSummary() {
  const ids = qsa("[data-unpaid-expense-checkbox]:checked").map((input) => input.value);
  const selected = ids
    .map((id) => state.expenses.find((expense) => expense.id === id && expense.status === "Booked"))
    .filter(Boolean);
  const allOpen = getOpenBookedExpenses(qs("[data-unpaid-expense-category-filter]")?.value || "");
  const total = selected.reduce((sum, expense) => sum + numberValue(expense.amount), 0);
  const dueNow = allOpen
    .filter((expense) => (expense.dueDate || expense.date) <= state.settings.businessDate)
    .reduce((sum, expense) => sum + numberValue(expense.amount), 0);
  renderMetricGrid("[data-unpaid-expense-summary]", [
    { label: "Open dues in view", value: String(allOpen.length), note: "Unpaid expense entries" },
    { label: "Due now", value: formatAmount(dueNow), note: "Due date crossed or today", valueTone: dueNow > 0 ? "tone-warn" : "tone-good" },
    { label: "Selected", value: String(selected.length), note: "Ready to pay" },
    { label: "Selected total", value: formatAmount(total), note: "Will debit selected account", valueTone: total > 0 ? "tone-warn" : "" },
  ]);
}

function getOpenBookedExpenses(category = "") {
  return state.expenses
    .filter((expense) => expense.status === "Booked")
    .filter((expense) => !category || expense.category === category)
    .sort((a, b) => (a.dueDate || a.date || "").localeCompare(b.dueDate || b.date || "") || (a.date || "").localeCompare(b.date || ""));
}

function renderReceipts() {
  const node = qs("[data-receipts-table]");
  if (!node) return;
  node.innerHTML = state.receipts.length
    ? state.receipts.map((receipt) => `<tr><td>${escapeHtml(receipt.receiptNo)}</td><td>${escapeHtml(formatDate(receipt.date))}</td><td>${escapeHtml(receipt.customer)}</td><td>${escapeHtml(receipt.mode)}</td><td class="amount-cell">${escapeHtml(formatAmount(receipt.amount))}</td><td><button class="ghost-button" data-print-receipt-id="${receipt.id}" type="button">Print</button><button class="danger-button" data-delete="receipts" data-id="${receipt.id}" type="button">x</button></td></tr>`).join("")
    : `<tr><td colspan="6" class="empty-state">No receipts generated yet.</td></tr>`;
}

function renderSettings() {
  const form = qs("#settings-form");
  if (!form) return;
  form.elements.businessName.value = state.settings.businessName;
  form.elements.openingCash.value = state.settings.openingCash;
  form.elements.receiptPrefix.value = state.settings.receiptPrefix;
  form.elements.lowBalanceAlert.value = state.settings.lowBalanceAlert;
  form.elements.syncUrl.value = state.settings.syncUrl || "";
  form.elements.syncToken.value = state.settings.syncToken || "";
}

function computeBalances(options = {}) {
  const bankBalances = Object.fromEntries(state.accounts.map((account) => [account.id, numberValue(account.openingBalance)]));
  let cash = numberValue(state.settings.openingCash);
  getLedgerEntries(options).forEach((entry) => {
    const impact = numberValue(entry.in) - numberValue(entry.out);
    if (entry.accountId === "cash") {
      cash += impact;
    } else if (entry.accountId) {
      bankBalances[entry.accountId] = numberValue(bankBalances[entry.accountId]) + impact;
    }
  });
  const bankTotal = Object.values(bankBalances).reduce((sum, value) => sum + numberValue(value), 0);
  return { cash, bankBalances, bankTotal, liquidity: cash + bankTotal };
}

function getLedgerEntries(options = {}) {
  const throughDate = options.throughDate || null;
  const beforeDate = options.beforeDate || null;
  const include = (date) => {
    if (!date) return true;
    if (throughDate && date > throughDate) return false;
    if (beforeDate && date >= beforeDate) return false;
    return true;
  };
  const entries = [];
  const add = (entry) => {
    if (include(entry.date)) entries.push({ createdAt: entry.createdAt || "", ...entry });
  };

  state.receipts.forEach((receipt) => add({ id: receipt.id, collection: "receipts", date: receipt.date, accountId: receipt.accountId, type: "Receipt", party: receipt.customer, details: receipt.invoice || receipt.notes || receipt.receiptNo, reference: receipt.receiptNo, in: receipt.amount, out: 0, createdAt: receipt.createdAt }));
  state.paymentIns.forEach((item) => add({ id: item.id, collection: "paymentIns", date: item.date, accountId: item.accountId, type: "Payment In", party: item.party || item.source, details: item.source, reference: "", in: item.amount, out: 0, createdAt: item.createdAt }));
  state.vendorPayments.filter((payment) => !payment.isPdc).forEach((payment) => add({ id: payment.id, collection: "vendorPayments", date: payment.date, accountId: payment.accountId, type: "Vendor Payment", party: vendorName(payment.vendorId), details: payment.remarks || "Vendor invoice payment", reference: payment.reference || payment.receiptNo, in: 0, out: payment.amount, createdAt: payment.createdAt }));
  state.expenses.filter((expense) => expense.status === "Paid").forEach((expense) => add({ id: expense.id, collection: "expenses", date: expense.paidDate || expense.date, accountId: expense.accountId, type: "Expense", party: expense.paidTo, details: `${expense.category}${expense.mode ? ` via ${expense.mode}` : ""}`, reference: expense.receiptNo || "", in: 0, out: expense.amount, createdAt: expense.createdAt }));
  state.transfers.forEach((transfer) => {
    add({ id: transfer.id, collection: "transfers", date: transfer.date, accountId: transfer.from, type: "Transfer", party: accountName(transfer.to), details: `To ${accountName(transfer.to)}${transfer.notes ? ` - ${transfer.notes}` : ""}`, reference: "", in: 0, out: transfer.amount, createdAt: transfer.createdAt });
    add({ id: transfer.id, collection: "transfers", date: transfer.date, accountId: transfer.to, type: "Transfer", party: accountName(transfer.from), details: `From ${accountName(transfer.from)}${transfer.notes ? ` - ${transfer.notes}` : ""}`, reference: "", in: transfer.amount, out: 0, createdAt: transfer.createdAt });
  });
  state.withdrawals.forEach((item) => add({ id: item.id, collection: "withdrawals", date: item.date, accountId: item.accountId, type: "Personal Withdrawal", party: item.purpose, details: "Owner withdrawal", reference: "", in: 0, out: item.amount, createdAt: item.createdAt }));
  state.balanceAdjustments.forEach((item) =>
    add({
      id: item.id,
      collection: "balanceAdjustments",
      date: item.date,
      accountId: item.accountId,
      type: "Bank Adjustment",
      party: accountName(item.accountId),
      details: item.reason || "Authorized balance adjustment",
      reference: item.adjustmentType === "set" ? `Set to ${formatAmount(item.enteredAmount)}` : "Manual adjustment",
      in: item.amount > 0 ? item.amount : 0,
      out: item.amount < 0 ? Math.abs(item.amount) : 0,
      createdAt: item.createdAt,
    })
  );
  state.pdcs.filter((pdc) => pdc.status === "Cleared").forEach((pdc) => add({ id: pdc.id, collection: "pdcs", date: pdc.dueDate, accountId: pdc.accountId, type: "PDC Cleared", party: pdc.partyName, details: pdc.chequeNo, reference: pdc.chequeNo, in: pdc.direction === "receivable" ? pdc.amount : 0, out: pdc.direction === "payable" ? pdc.amount : 0, createdAt: pdc.createdAt }));
  state.debts.filter((debt) => debt.entryType === "New Debt").forEach((debt) => add({ id: debt.id, collection: "debts", date: debt.date, accountId: debt.accountId, type: "Debt Received", party: debt.lender, details: debt.debtType, reference: debt.repaymentTerms, in: debt.amount, out: 0, createdAt: debt.createdAt }));
  state.debtPayments.forEach((payment) => add({ id: payment.id, collection: "debtPayments", date: payment.date, accountId: payment.accountId, type: payment.paymentType || "Debt Payment", party: payment.lender, details: payment.remarks || `${payment.repaymentTerms} due ${formatDate(payment.dueDate)}`, reference: payment.repaymentTerms, in: 0, out: payment.amount, createdAt: payment.createdAt }));
  state.salaryEntries.filter((entry) => ["Advance Paid", "Salary Paid", "Paid"].includes(entry.type)).forEach((entry) => add({ id: entry.id, collection: "salaryEntries", date: entry.date, accountId: entry.accountId, type: entry.type === "Advance Paid" ? "Salary Advance" : "Salary Paid", party: "Salary", details: entry.remarks || "Salary payment", reference: entry.salaryMonth || "", in: 0, out: entry.amount, createdAt: entry.createdAt }));
  return entries;
}

function getDaybookEntries(date) {
  const ledger = getLedgerEntries({ throughDate: date }).filter((entry) => entry.date === date);
  const booked = [
    ...state.purchases.filter((purchase) => purchase.date === date).map((purchase) => ({ type: "Purchase Booked", party: vendorName(purchase.vendorId), details: `${purchase.invoiceNo} - ${purchase.category}`, in: 0, out: 0, commitment: purchase.amount })),
    ...state.expenses.filter((expense) => expense.expenseType === "Unpaid" && expense.date === date).map((expense) => ({ type: "Expense Booked", party: expense.paidTo, details: `${expense.category} - ${expense.status === "Paid" ? "paid later" : "unpaid"}`, in: 0, out: 0, commitment: expense.amount })),
    ...state.debtAccruals.filter((item) => item.date === date).map((item) => ({ type: item.category, party: item.lender, details: `${item.repaymentTerms} - no cash debit`, in: 0, out: 0, commitment: item.amount })),
    ...state.salaryEntries.filter((entry) => entry.type === "Booked" && entry.date === date).map((entry) => ({ type: "Salary Booked", party: "Salary", details: entry.remarks || "Salary payable", in: 0, out: 0, commitment: entry.amount })),
    ...state.vendorPayments.filter((payment) => payment.isPdc && payment.date === date).map((payment) => ({ type: "PDC Issued", party: vendorName(payment.vendorId), details: payment.reference || payment.receiptNo, in: 0, out: 0, commitment: payment.amount })),
  ];
  return [
    ...ledger.map((entry) => ({ type: entry.type, party: entry.party, details: entry.details, in: entry.in, out: entry.out, commitment: 0 })),
    ...booked,
  ];
}

function getClosedDays() {
  const byDate = new Map();
  state.dayCloses
    .slice()
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))
    .forEach((item) => byDate.set(item.date, item));
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function getDailyCrux(date) {
  const daybook = getDaybookEntries(date);
  const opening = computeBalances({ beforeDate: date });
  const closing = computeBalances({ throughDate: date });
  const ledger = getLedgerEntries({ throughDate: date }).filter((entry) => entry.date === date);
  const sum = (items, key = "amount") => roundMoney(items.reduce((total, item) => total + numberValue(item[key]), 0));
  const purchasesBooked = sum(state.purchases.filter((item) => item.date === date));
  const salariesBooked = sum(state.salaryEntries.filter((item) => item.type === "Booked" && item.date === date));
  const salariesPaid = sum(state.salaryEntries.filter((item) => ["Advance Paid", "Salary Paid", "Paid"].includes(item.type) && item.date === date));
  const immediateExpenses = sum(state.expenses.filter((item) => item.expenseType === "Immediate" && item.date === date));
  const unpaidExpenses = sum(state.expenses.filter((item) => item.expenseType === "Unpaid" && item.date === date));
  const expensePayments = sum(state.expenses.filter((item) => item.status === "Paid" && (item.paidDate || item.date) === date));
  const debtCosts = sum(state.debtAccruals.filter((item) => item.date === date));
  const debtPayments = sum(state.debtPayments.filter((item) => item.date === date));
  const pdcCommitments = sum(state.vendorPayments.filter((item) => item.isPdc && item.date === date));
  const purchaseForecasts = sum(state.purchasePredictions.filter((item) => item.paymentDate === date), "totalAmount");
  const vendorPayments = ledger.filter((item) => item.type === "Vendor Payment").reduce((total, item) => total + numberValue(item.out), 0);
  const receipts = ledger.filter((item) => item.type === "Receipt").reduce((total, item) => total + numberValue(item.in), 0);
  const paymentIns = ledger.filter((item) => item.type === "Payment In").reduce((total, item) => total + numberValue(item.in), 0);
  const moneyIn = daybook.reduce((total, item) => total + numberValue(item.in), 0);
  const moneyOut = daybook.reduce((total, item) => total + numberValue(item.out), 0);
  const commitments = daybook.reduce((total, item) => total + numberValue(item.commitment), 0);
  return {
    date,
    opening,
    closing,
    daybook,
    actions: getDailyActionRows(date),
    moneyIn: roundMoney(moneyIn),
    moneyOut: roundMoney(moneyOut),
    commitments: roundMoney(commitments),
    netCleared: roundMoney(moneyIn - moneyOut),
    purchasesBooked,
    salariesBooked,
    salariesPaid,
    immediateExpenses,
    unpaidExpenses,
    expensePayments,
    expensesBooked: roundMoney(immediateExpenses + unpaidExpenses),
    debtCosts,
    debtPayments,
    pdcCommitments,
    purchaseForecasts,
    vendorPayments: roundMoney(vendorPayments),
    receipts: roundMoney(receipts),
    paymentIns: roundMoney(paymentIns),
  };
}

function getDailyActionRows(date) {
  const rows = [];
  const push = (row) => rows.push({ amount: 0, details: "", effect: "", ...row });
  state.purchases.filter((item) => item.date === date).forEach((item) => push({ collection: "purchases", id: item.id, type: "Purchase booked", party: vendorName(item.vendorId), details: `${item.invoiceNo} - ${item.category}`, amount: item.amount, effect: "Commitment booked" }));
  state.purchasePredictions.filter((item) => item.paymentDate === date || item.date === date).forEach((item) => push({ collection: "purchasePredictions", id: item.id, type: "Purchase forecast", party: item.vendorName, details: `${item.itemName} - ${formatQuantity(item.quantity)} ${item.unit}`, amount: item.totalAmount, effect: item.paymentDate === date ? "Forecast payment" : "Forecast created" }));
  state.vendorPayments.filter((item) => item.date === date).forEach((item) => push({ collection: "vendorPayments", id: item.id, type: item.isPdc ? "PDC issued" : "Vendor payment", party: vendorName(item.vendorId), details: item.reference || item.receiptNo, amount: item.amount, effect: item.isPdc ? "Cheque commitment" : "Money out" }));
  state.paymentIns.filter((item) => item.date === date).forEach((item) => push({ collection: "paymentIns", id: item.id, type: "Payment in", party: item.party || item.source, details: item.remarks || item.source, amount: item.amount, effect: "Money in" }));
  state.receipts.filter((item) => item.date === date).forEach((item) => push({ collection: "receipts", id: item.id, type: "Receipt", party: item.customer, details: item.receiptNo, amount: item.amount, effect: "Money in" }));
  state.debts.filter((item) => item.date === date).forEach((item) => push({ collection: "debts", id: item.id, type: "Debt record", party: item.lender, details: `${item.entryType} - ${item.repaymentTerms}`, amount: item.amount, effect: item.entryType === "New Debt" ? "Money in" : "Record only" }));
  state.debtAccruals.filter((item) => item.date === date).forEach((item) => push({ collection: "debtAccruals", id: item.id, type: item.category, party: item.lender, details: item.repaymentTerms, amount: item.amount, effect: "Non-cash cost" }));
  state.debtPayments.filter((item) => item.date === date).forEach((item) => push({ collection: "debtPayments", id: item.id, type: item.paymentType || "Debt payment", party: item.lender, details: item.remarks || item.repaymentTerms, amount: item.amount, effect: "Money out" }));
  state.expenses.forEach((item) => {
    if (item.expenseType === "Immediate" && item.date === date) {
      push({ collection: "expenses", id: item.id, type: "Immediate expense", party: item.paidTo, details: item.category, amount: item.amount, effect: "Money out" });
      return;
    }
    if (item.expenseType === "Unpaid" && item.date === date) {
      push({ collection: "expenses", id: item.id, type: "Unpaid expense booked", party: item.paidTo, details: item.category, amount: item.amount, effect: "Commitment booked" });
    }
    if (item.expenseType === "Unpaid" && item.status === "Paid" && item.paidDate === date && item.date !== date) {
      push({ collection: "expenses", id: item.id, type: "Unpaid expense paid", party: item.paidTo, details: item.receiptNo || item.category, amount: item.amount, effect: "Money out" });
    }
  });
  state.salaryEntries.filter((item) => item.date === date).forEach((item) => push({ collection: "salaryEntries", id: item.id, type: "Salary", party: "Salary", details: item.remarks || item.type, amount: item.amount, effect: item.type === "Booked" ? "Commitment booked" : "Money out" }));
  state.withdrawals.filter((item) => item.date === date).forEach((item) => push({ collection: "withdrawals", id: item.id, type: "Withdrawal", party: item.purpose, details: accountName(item.accountId), amount: item.amount, effect: "Money out" }));
  state.transfers.filter((item) => item.date === date).forEach((item) => push({ collection: "transfers", id: item.id, type: "Transfer", party: `${accountName(item.from)} to ${accountName(item.to)}`, details: item.notes, amount: item.amount, effect: "Internal movement" }));
  state.balanceAdjustments.filter((item) => item.date === date).forEach((item) => push({ collection: "balanceAdjustments", id: item.id, type: "Balance adjustment", party: accountName(item.accountId), details: item.reason, amount: Math.abs(numberValue(item.amount)), effect: item.amount >= 0 ? "Money in" : "Money out" }));
  state.pdcs.filter((item) => item.dueDate === date).forEach((item) => push({ collection: "pdcs", id: item.id, type: "PDC due", party: item.partyName, details: `${item.chequeNo} - ${item.status}`, amount: item.amount, effect: item.direction === "receivable" ? "Expected in" : "Expected out" }));
  state.forecasts.filter((item) => item.date === date || item.receivedDate === date).forEach((item) => push({ collection: "forecasts", id: item.id, type: "Expected payment", party: item.party, details: `${item.paymentType || "Expected"} - ${item.status}`, amount: item.amount, effect: item.receivedDate === date ? "Money in" : "Forecast" }));
  return rows.sort((a, b) => a.type.localeCompare(b.type) || a.party.localeCompare(b.party));
}

function getCruxBriefingLines(crux) {
  const lines = [
    `${formatDate(crux.date)} opened with ${formatAmount(crux.opening.liquidity)} liquidity and closed at ${formatAmount(crux.closing.liquidity)}.`,
    `Cleared movement was ${formatAmount(crux.moneyIn)} in and ${formatAmount(crux.moneyOut)} out, giving a net cleared movement of ${formatAmount(crux.netCleared)}.`,
    `Booked commitments totalled ${formatAmount(crux.commitments)}, including purchases ${formatAmount(crux.purchasesBooked)}, salary booking ${formatAmount(crux.salariesBooked)}, unpaid expenses ${formatAmount(crux.unpaidExpenses)}, PDC commitments ${formatAmount(crux.pdcCommitments)}, and debt cost ${formatAmount(crux.debtCosts)}.`,
  ];
  if (crux.receipts || crux.paymentIns) lines.push(`Incoming funds were split between receipts ${formatAmount(crux.receipts)} and payment-in entries ${formatAmount(crux.paymentIns)}.`);
  if (crux.vendorPayments || crux.expensePayments || crux.debtPayments || crux.salariesPaid) lines.push(`Outgoing payments included vendor payments ${formatAmount(crux.vendorPayments)}, expenses paid ${formatAmount(crux.expensePayments)}, salaries paid ${formatAmount(crux.salariesPaid)}, and debt payments ${formatAmount(crux.debtPayments)}.`);
  if (!crux.daybook.length) lines.push("No operational entry was recorded in the daybook for this closed day.");
  return lines;
}

function renderCruxCharts(crux) {
  const flowSegments = [
    { label: "Money in", value: crux.moneyIn, color: "#22c55e" },
    { label: "Money out", value: crux.moneyOut, color: "#ef4444" },
    { label: "Commitments", value: crux.commitments, color: "#f59e0b" },
  ].filter((item) => item.value > 0);
  const activitySegments = [
    { label: "Purchases", value: crux.purchasesBooked, color: "#60a5fa" },
    { label: "Vendor paid", value: crux.vendorPayments, color: "#38bdf8" },
    { label: "Salaries", value: crux.salariesBooked + crux.salariesPaid, color: "#a78bfa" },
    { label: "Expenses", value: crux.immediateExpenses + crux.unpaidExpenses + crux.expensePayments, color: "#fb7185" },
    { label: "Debt", value: crux.debtCosts + crux.debtPayments, color: "#fbbf24" },
    { label: "PDCs", value: crux.pdcCommitments, color: "#14b8a6" },
  ].filter((item) => item.value > 0);
  return `
    <div class="crux-chart-stack">
      ${renderDonutChart(flowSegments, "Flow mix")}
      ${renderBarChart(activitySegments)}
    </div>
  `;
}

function renderDonutChart(segments, title) {
  const total = roundMoney(segments.reduce((sum, item) => sum + numberValue(item.value), 0));
  if (total <= 0) return `<div class="empty-state">No value to chart for this day.</div>`;
  let angle = 0;
  const stops = segments.map((item) => {
    const size = (numberValue(item.value) / total) * 360;
    const start = angle;
    angle += size;
    return `${item.color} ${start}deg ${angle}deg`;
  });
  return `
    <div class="donut-row">
      <div class="donut-chart" style="background: conic-gradient(${stops.join(", ")});"><div><strong>${escapeHtml(formatAmount(total))}</strong><span>${escapeHtml(title)}</span></div></div>
      <div class="chart-legend">
        ${segments.map((item) => `<div><span style="background:${item.color}"></span><strong>${escapeHtml(item.label)}</strong><em>${escapeHtml(formatAmount(item.value))}</em></div>`).join("")}
      </div>
    </div>
  `;
}

function renderBarChart(segments) {
  if (!segments.length) return `<div class="empty-state">No activity categories to chart.</div>`;
  const max = Math.max(...segments.map((item) => numberValue(item.value)), 1);
  return `
    <div class="crux-bars">
      ${segments.map((item) => `<div class="crux-bar-row"><span>${escapeHtml(item.label)}</span><div class="crux-bar-track"><div style="width:${Math.max(3, (numberValue(item.value) / max) * 100)}%;background:${item.color}"></div></div><strong>${escapeHtml(formatAmount(item.value))}</strong></div>`).join("")}
    </div>
  `;
}

function getExpectedReceiptDate(item) {
  return addDays(item.date, Math.max(0, Math.round(numberValue(item.delayDays))));
}

function isForecastCountable(item) {
  return ["Open", "Delayed"].includes(item.status) && state.settings.businessDate <= getExpectedReceiptDate(item);
}

function getForecastAccountId(item) {
  if (item.accountId && requireAccountSilently(item.accountId)) return item.accountId;
  if (item.mode === "Cash") return "cash";
  if (state.accounts.length === 1) return state.accounts[0].id;
  return "";
}

function requireAccountSilently(id) {
  return id === "cash" || isBankAccount(id);
}

function getProjectionEventsForDate(date, options = {}) {
  const extraPdcs = options.extraPdcs || [];
  const extraPurchasePredictions = options.extraPurchasePredictions || [];
  const useConfidence = options.useConfidence !== false;
  const events = { in: 0, out: 0, notes: [] };
  state.forecasts.filter((item) => isForecastCountable(item) && getExpectedReceiptDate(item) === date).forEach((item) => {
    const amount = useConfidence ? numberValue(item.amount) * (numberValue(item.confidence) / 100) : numberValue(item.amount);
    events.in += amount;
    events.notes.push(`${item.paymentType || "Expected"} from ${item.party}${item.delayDays ? `, latest after ${item.delayDays} day(s)` : ""}`);
  });
  [...state.pdcs, ...extraPdcs].filter((pdc) => ["Pending", "Deposited"].includes(pdc.status) && pdc.dueDate === date).forEach((pdc) => {
    if (pdc.direction === "receivable") events.in += numberValue(pdc.amount);
    if (pdc.direction === "payable") events.out += numberValue(pdc.amount);
    events.notes.push(`PDC ${pdc.direction}: ${pdc.partyName}`);
  });
  state.purchases.filter((purchase) => getPurchaseOpenAmount(purchase.id) > 0 && getPurchasePaymentDate(purchase) === date).forEach((purchase) => {
    events.out += getPurchaseOpenAmount(purchase.id);
    events.notes.push(`Invoice provision: ${vendorName(purchase.vendorId)} ${purchase.invoiceNo}, matured ${formatDate(purchase.dueDate)}`);
  });
  getOpenPurchasePredictions(extraPurchasePredictions).filter((prediction) => prediction.paymentDate === date).forEach((prediction) => {
    events.out += numberValue(prediction.totalAmount);
    events.notes.push(`Planned purchase: ${prediction.itemName} from ${prediction.vendorName}`);
  });
  state.expenses.filter((expense) => expense.status === "Booked" && expense.dueDate === date).forEach((expense) => {
    events.out += numberValue(expense.amount);
    events.notes.push(`Booked expense: ${expense.paidTo}`);
  });
  const salaryEvent = getSalaryProjectionForDate(date);
  if (salaryEvent.amount > 0) {
    events.out += salaryEvent.amount;
    events.notes.push(salaryEvent.note);
  }
  state.debts.filter((debt) => getNextRepaymentDate(debt) === date).forEach((debt) => {
    const amount = getDebtDueOpenAmount(debt, date);
    if (amount <= 0) return;
    events.out += amount;
    events.notes.push(`${debt.repaymentTerms}: ${debt.lender}`);
  });
  return { in: roundMoney(events.in), out: roundMoney(events.out), notes: events.notes };
}

function getSalaryProjectionForDate(date) {
  if (date < state.settings.businessDate) return { amount: 0, note: "" };
  const projectionMonth = monthKey(date);
  const advanceDate = monthEndInput(projectionMonth);
  if (date === advanceDate) {
    const advanceDue = getSalaryAdvanceDueForMonth(projectionMonth);
    if (advanceDue > 0) {
      return { amount: advanceDue, note: `Salary advance scheduled for ${projectionMonth}` };
    }
  }

  const clearingDate = monthDayInput(projectionMonth, 15);
  if (date === clearingDate) {
    const previousMonth = addMonths(projectionMonth, -1);
    const payable = getSalaryPayableForMonth(previousMonth);
    if (payable > 0) {
      return { amount: payable, note: `${previousMonth} salary clearing due` };
    }
  }

  return { amount: 0, note: "" };
}

function buildProjection(days, options = {}) {
  let running = computeBalances().liquidity;
  const rows = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(state.settings.businessDate, offset);
    const events = getProjectionEventsForDate(date, options);
    running += events.in - events.out;
    rows.push({ date, in: events.in, out: events.out, balance: running, notes: events.notes.join("; ") });
  }
  return rows;
}

function daysBetween(startDate, endDate) {
  const start = parseInputDate(startDate);
  const end = parseInputDate(endDate);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function getProjectedAccountBalance(accountId, targetDate, options = {}) {
  if (!requireAccountSilently(accountId)) return 0;
  const today = state.settings.businessDate;
  if (targetDate < today) return getAccountBalanceAt(accountId, targetDate);
  let balance = getAccountBalanceAt(accountId, today);

  getLedgerEntries()
    .filter((entry) => entry.date > today && entry.date <= targetDate && entry.accountId === accountId)
    .forEach((entry) => {
      balance += numberValue(entry.in) - numberValue(entry.out);
    });

  state.forecasts
    .filter((item) => isForecastCountable(item) && getExpectedReceiptDate(item) >= today && getExpectedReceiptDate(item) <= targetDate && getForecastAccountId(item) === accountId)
    .forEach((item) => {
      balance += numberValue(item.amount);
    });

  [...state.pdcs, ...(options.extraPdcs || [])]
    .filter((pdc) => ["Pending", "Deposited"].includes(pdc.status) && pdc.dueDate >= today && pdc.dueDate <= targetDate && pdc.accountId === accountId)
    .forEach((pdc) => {
      balance += pdc.direction === "receivable" ? numberValue(pdc.amount) : -numberValue(pdc.amount);
    });

  state.purchases
    .filter((purchase) => getPurchaseOpenAmount(purchase.id) > 0 && getPurchasePaymentDate(purchase) >= today && getPurchasePaymentDate(purchase) <= targetDate)
    .forEach((purchase) => {
      balance -= getPurchaseOpenAmount(purchase.id);
    });

  getOpenPurchasePredictions(options.extraPurchasePredictions || [])
    .filter((prediction) => prediction.paymentDate >= today && prediction.paymentDate <= targetDate && prediction.accountId === accountId)
    .forEach((prediction) => {
      balance -= numberValue(prediction.totalAmount);
    });

  for (let date = today; date <= targetDate; date = addDays(date, 1)) {
    const salaryEvent = getSalaryProjectionForDate(date);
    if (salaryEvent.amount > 0) balance -= salaryEvent.amount;
  }

  return roundMoney(balance);
}

function getProjectedLiquidity(targetDate, options = {}) {
  const days = daysBetween(state.settings.businessDate, targetDate) + 1;
  return buildProjection(days, options).at(-1)?.balance ?? computeBalances().liquidity;
}

function assessPdcRisk(pdc, options = {}) {
  if (pdc.direction === "receivable") {
    return { label: "Receivable", severity: "", projected: getProjectedAccountBalance(pdc.accountId, pdc.dueDate), detail: isFinanceRole() ? "Incoming cheque recorded." : "Incoming cheque; it does not create payout risk." };
  }
  const projected = getProjectedAccountBalance(pdc.accountId, pdc.dueDate, options);
  const liquidity = getProjectedLiquidity(pdc.dueDate, options);
  const shortfall = roundMoney(Math.max(0, -projected));
  if (shortfall <= 0) {
    return {
      label: "Projected Safe",
      severity: "",
      projected,
      detail: isFinanceRole() ? "Appropriate funds are expected to be available on the cheque date." : `${accountName(pdc.accountId)} projected after cheque: ${formatAmount(projected)}. Overall projection: ${formatAmount(liquidity)}.`,
    };
  }
  const cashProjected = getProjectedAccountBalance("cash", pdc.dueDate);
  if (cashProjected >= shortfall) {
    return {
      label: "Deposit Cash",
      severity: "warn",
      projected,
      detail: isFinanceRole() ? "Appropriate funds may not be available in the selected account. Cash deposit may be required before cheque clearing." : `Shortfall ${formatAmount(shortfall)} on due date. Cash projected ${formatAmount(cashProjected)}; deposit cash before cheque clearing.`,
    };
  }
  return {
    label: "Call Back PDC",
    severity: "bad",
    projected,
    detail: isFinanceRole() ? "Appropriate funds are not expected to be available. Call back or replace this PDC unless funds improve." : `Projected shortfall ${formatAmount(shortfall)} and cash projected ${formatAmount(cashProjected)}. Call back or replace this PDC unless funds improve.`,
  };
}

function confirmPdcIssue(pdc) {
  if (pdc.direction !== "payable" || !["Pending", "Deposited"].includes(pdc.status)) return true;
  const risk = assessPdcRisk(pdc, { extraPdcs: [pdc], useConfidence: false });
  pdc.projectedBalanceAtIssue = risk.projected;
  pdc.riskAtIssue = risk.label;
  pdc.riskDetailAtIssue = risk.detail;
  if (risk.severity === "") {
    if (isFinanceRole()) {
      showToast("PDC projection: appropriate funds are expected on the due date.");
      return true;
    }
    showToast(`PDC projection: ${accountName(pdc.accountId)} should be ${formatAmount(risk.projected)} on due date.`);
    return true;
  }
  if (isFinanceRole()) return confirm(`${risk.label}\n\n${risk.detail}\n\nDo you still want to issue this PDC?`);
  return confirm(`${risk.label}\n\n${risk.detail}\n\nExpected receipts are counted only on their latest possible date after delay days.\n\nDo you still want to issue this PDC?`);
}

function getFilteredReportRows() {
  const type = qs("[data-report-type]")?.value || "All Transactions";
  const start = qs("[data-report-start]")?.value || "";
  const end = qs("[data-report-end]")?.value || "";
  return getReportRows()
    .filter((row) => !isFinanceRole() || isFinanceReportRowAllowed(row))
    .filter((row) => type === "All Transactions" || row.typeGroup === type)
    .filter((row) => !start || row.date >= start)
    .filter((row) => !end || row.date <= end)
    .sort(sortNewest);
}

function isFinanceReportRowAllowed(row) {
  if (!financeReportGroups.has(row.typeGroup)) return false;
  if (row.collection === "withdrawals") return false;
  if (row.collection === "salaryEntries" && row.status !== "Booked") return false;
  if (row.collection === "pdcs") {
    const pdc = state.pdcs.find((item) => item.id === row.id);
    if (pdc?.direction !== "payable") return false;
  }
  return true;
}

function getReportRows() {
  const rows = [];
  const push = (row) => rows.push({ status: "", account: "", reference: "", printAction: "", ...row });
  state.purchases.forEach((purchase) => push({ id: purchase.id, collection: "purchases", date: purchase.date, type: "Purchase Invoice", typeGroup: "Purchases", party: vendorName(purchase.vendorId), status: getPurchaseStatus(purchase.id), account: "Payable", reference: purchase.invoiceNo, amount: purchase.amount }));
  state.purchasePredictions.forEach((prediction) => push({ id: prediction.id, collection: "purchasePredictions", date: prediction.paymentDate, type: "Purchase Forecast", typeGroup: "Purchase Forecasts", party: prediction.vendorName, status: prediction.status, account: accountName(prediction.accountId), reference: prediction.itemName, amount: prediction.totalAmount }));
  state.vendorPayments.forEach((payment) => push({ id: payment.id, collection: "vendorPayments", date: payment.date, type: "Vendor Payment", typeGroup: "Vendor Payments", party: vendorName(payment.vendorId), status: payment.status, account: accountName(payment.accountId), reference: payment.reference || payment.receiptNo, amount: payment.amount, printAction: `<button class="ghost-button" data-print-vendor-payment-id="${payment.id}" type="button">Print</button>` }));
  state.expenses.forEach((expense) => push({ id: expense.id, collection: "expenses", date: expense.status === "Paid" ? expense.paidDate || expense.date : expense.date, type: "Expense", typeGroup: expense.status === "Booked" ? "Scheduled Expenses" : "Expenses", party: expense.paidTo, status: expense.status, account: expense.accountId ? accountName(expense.accountId) : "Payable", reference: expense.receiptNo || expense.category, amount: expense.amount, printAction: expense.expensePaymentId ? `<button class="ghost-button" data-print-expense-payment-id="${expense.expensePaymentId}" type="button">Print</button>` : "" }));
  state.pdcs.forEach((pdc) => push({ id: pdc.id, collection: "pdcs", date: pdc.dueDate, type: "Post-Dated Cheque", typeGroup: "Post-Dated Cheques", party: pdc.partyName, status: pdc.status, account: accountName(pdc.accountId), reference: pdc.chequeNo, amount: pdc.amount }));
  state.salaryEntries.forEach((entry) => push({ id: entry.id, collection: "salaryEntries", date: entry.date, type: "Salary", typeGroup: "Salaries", party: "Salary", status: entry.type, account: entry.accountId ? accountName(entry.accountId) : "Payable", reference: entry.remarks, amount: entry.amount }));
  state.debts.forEach((debt) => push({ id: debt.id, collection: "debts", date: debt.date, type: "Debt", typeGroup: "Debt", party: debt.lender, status: debt.entryType, account: debt.entryType === "New Debt" ? accountName(debt.accountId) : "No balance impact", reference: debt.repaymentTerms, amount: debt.amount }));
  state.debtAccruals.forEach((item) => push({ id: item.id, collection: "debtAccruals", date: item.date, type: item.category, typeGroup: "Debt Accruals", party: item.lender, status: "Accrued", account: "No cash debit", reference: item.repaymentTerms, amount: item.amount }));
  state.debtPayments.forEach((payment) => push({ id: payment.id, collection: "debtPayments", date: payment.date, type: payment.paymentType || "Debt Payment", typeGroup: "Debt Payments", party: payment.lender, status: "Paid", account: accountName(payment.accountId), reference: payment.remarks || payment.repaymentTerms, amount: payment.amount }));
  state.paymentIns.forEach((item) => push({ id: item.id, collection: "paymentIns", date: item.date, type: "Payment In", typeGroup: "Payments In", party: item.party || item.source, status: item.source, account: accountName(item.accountId), reference: item.remarks, amount: item.amount }));
  state.receipts.forEach((receipt) => push({ id: receipt.id, collection: "receipts", date: receipt.date, type: "Receipt", typeGroup: "Receipts", party: receipt.customer, status: receipt.mode, account: accountName(receipt.accountId), reference: receipt.receiptNo, amount: receipt.amount, printAction: `<button class="ghost-button" data-print-receipt-id="${receipt.id}" type="button">Print</button>` }));
  state.withdrawals.forEach((item) => push({ id: item.id, collection: "withdrawals", date: item.date, type: "Personal Withdrawal", typeGroup: "Expenses", party: item.purpose, status: "Paid", account: accountName(item.accountId), amount: item.amount }));
  state.balanceAdjustments.forEach((item) =>
    push({
      id: item.id,
      collection: "balanceAdjustments",
      date: item.date,
      type: "Bank Adjustment",
      typeGroup: "All Transactions",
      party: accountName(item.accountId),
      status: item.adjustmentType === "set" ? "Set Balance" : "Adjustment",
      account: accountName(item.accountId),
      reference: item.reason,
      amount: item.amount,
    })
  );
  return rows;
}

function predictorItemName(id) {
  return state.purchasePredictorItems.find((item) => item.id === id)?.name || "Item";
}

function predictorVendorName(id) {
  return state.purchasePredictorVendors.find((vendor) => vendor.id === id)?.vendorName || "Vendor";
}

function getPredictorTaxLabel(item) {
  return item.taxedSupply ? `${numberValue(item.taxRate)}% taxed` : "Not taxed";
}

function formatQuantity(value) {
  return amountFormat.format(roundMoney(value));
}

function buildPurchasePredictionPlan(input) {
  const item = state.purchasePredictorItems.find((entry) => entry.id === input.itemId);
  const vendor = state.purchasePredictorVendors.find((entry) => entry.id === input.vendorOptionId && entry.itemId === input.itemId);
  if (!item) {
    if (input.silent) return null;
    showToast("Choose a predictor item.");
    return null;
  }
  if (!vendor) {
    if (input.silent) return null;
    showToast("Choose a vendor rate for this item.");
    return null;
  }
  const quantity = numberValue(input.quantity);
  if (quantity <= 0) {
    if (input.silent) return null;
    showToast("Enter a quantity above zero.");
    return null;
  }
  const date = input.date || state.settings.businessDate;
  const rate = numberValue(vendor.rate || item.baseRate);
  const grossAmount = roundMoney(rate * quantity);
  const taxRate = item.taxedSupply ? numberValue(item.taxRate) : 0;
  const taxAmount = roundMoney((grossAmount * taxRate) / 100);
  const totalAmount = roundMoney(grossAmount + taxAmount);
  const maturityDate = addDays(date, numberValue(vendor.terms));
  const paymentDate = getPurchaseProvisionDate(maturityDate);
  return {
    itemId: item.id,
    itemName: item.name,
    vendorOptionId: vendor.id,
    vendorName: vendor.vendorName,
    date,
    quantity,
    unit: item.unit || "unit",
    rate,
    taxedSupply: item.taxedSupply,
    taxRate,
    grossAmount,
    taxAmount,
    totalAmount,
    terms: Math.max(0, Math.round(numberValue(vendor.terms))),
    maturityDate,
    paymentDate,
    accountId: input.accountId,
  };
}

function getPurchaseProvisionDate(maturityDate) {
  const date = parseInputDate(maturityDate);
  const day = date.getDate();
  const month = monthKey(maturityDate);
  if (day <= 10) return monthDayInput(month, 10);
  if (day <= 20) return monthDayInput(month, 20);
  return monthDayInput(addMonths(month, 1), 10);
}

function getPurchasePaymentDate(purchase) {
  return getPurchaseProvisionDate(purchase.dueDate || purchase.date || state.settings.businessDate);
}

function getPredictionUnitTotal(prediction) {
  if (!prediction || !numberValue(prediction.quantity)) return 0;
  return roundMoney(numberValue(prediction.totalAmount) / numberValue(prediction.quantity));
}

function getOpenPurchasePredictions(extra = []) {
  return [...state.purchasePredictions, ...extra].filter((prediction) => prediction.status !== "Cancelled");
}

function assessPurchasePrediction(prediction, options = {}) {
  if (!prediction) return { accountProjected: 0, liquidityProjected: 0, shortfall: 0, safeQuantity: 0 };
  const extraPurchasePredictions = options.extraPurchasePredictions || [];
  const accountProjected = getProjectedAccountBalance(prediction.accountId, prediction.paymentDate, { extraPurchasePredictions });
  const liquidityProjected = getProjectedLiquidity(prediction.paymentDate, { extraPurchasePredictions });
  const shortfall = roundMoney(Math.max(0, -accountProjected));
  const availableBeforeCandidate = roundMoney(accountProjected + numberValue(prediction.totalAmount));
  const unitTotal = getPredictionUnitTotal(prediction);
  const safeQuantity = unitTotal > 0 ? Math.max(0, availableBeforeCandidate / unitTotal) : 0;
  return {
    accountProjected,
    liquidityProjected,
    shortfall,
    safeQuantity: roundMoney(safeQuantity),
  };
}

function getPurchasePaidAmount(purchaseId) {
  return roundMoney(
    state.vendorPayments.reduce((sum, payment) => {
      const allocation = payment.allocations?.find((item) => item.purchaseId === purchaseId);
      if (!allocation) return sum;
      if (!payment.isPdc) return sum + numberValue(allocation.amount);
      const pdc = state.pdcs.find((item) => item.id === payment.pdcId);
      return pdc?.status === "Cleared" ? sum + numberValue(allocation.amount) : sum;
    }, 0)
  );
}

function getPurchaseCommittedAmount(purchaseId) {
  return roundMoney(
    state.vendorPayments.reduce((sum, payment) => {
      if (!payment.isPdc) return sum;
      const allocation = payment.allocations?.find((item) => item.purchaseId === purchaseId);
      const pdc = state.pdcs.find((item) => item.id === payment.pdcId);
      return allocation && ["Pending", "Deposited"].includes(pdc?.status) ? sum + numberValue(allocation.amount) : sum;
    }, 0)
  );
}

function getPurchaseOpenAmount(purchaseId) {
  const purchase = state.purchases.find((item) => item.id === purchaseId);
  if (!purchase) return 0;
  return Math.max(0, roundMoney(numberValue(purchase.amount) - getPurchasePaidAmount(purchaseId) - getPurchaseCommittedAmount(purchaseId)));
}

function getPurchaseStatus(purchaseId) {
  const purchase = state.purchases.find((item) => item.id === purchaseId);
  if (!purchase) return "Unknown";
  const paid = getPurchasePaidAmount(purchaseId);
  const committed = getPurchaseCommittedAmount(purchaseId);
  if (paid >= numberValue(purchase.amount) - 0.01) return "Paid";
  if (committed > 0) return "PDC Issued";
  if (paid > 0) return "Partial";
  return "Unpaid";
}

function getDailyExpectedSalary(date = state.settings.businessDate) {
  return roundMoney(numberValue(state.settings.expectedMonthlySalary) / daysInMonth(date));
}

function getSalaryEntryMonth(entry) {
  if (entry.salaryMonth) return entry.salaryMonth;
  return monthKey(entry.date);
}

function getSalaryBookedForMonth(month) {
  return state.salaryEntries
    .filter((entry) => entry.type === "Booked" && getSalaryEntryMonth(entry) === month)
    .reduce((sum, entry) => sum + numberValue(entry.amount), 0);
}

function getSalaryAdvancePaidForMonth(month) {
  return state.salaryEntries
    .filter((entry) => entry.type === "Advance Paid" && getSalaryEntryMonth(entry) === month)
    .reduce((sum, entry) => sum + numberValue(entry.amount), 0);
}

function getSalaryPaidForMonth(month) {
  return state.salaryEntries
    .filter((entry) => ["Salary Paid", "Paid"].includes(entry.type) && getSalaryEntryMonth(entry) === month)
    .reduce((sum, entry) => sum + numberValue(entry.amount), 0);
}

function getSalaryBookedThisMonth() {
  return getSalaryBookedForMonth(monthKey(state.settings.businessDate));
}

function getSalaryBookedForDate(date) {
  return state.salaryEntries
    .filter((entry) => entry.type === "Booked" && entry.date === date)
    .reduce((sum, entry) => sum + numberValue(entry.amount), 0);
}

function getSalaryAdvancePaidThisMonth() {
  return getSalaryAdvancePaidForMonth(monthKey(state.settings.businessDate));
}

function getSalaryPaidThisMonth() {
  const currentMonth = monthKey(state.settings.businessDate);
  return state.salaryEntries
    .filter((entry) => ["Salary Paid", "Paid"].includes(entry.type) && isSameMonth(entry.date, state.settings.businessDate))
    .reduce((sum, entry) => sum + numberValue(entry.amount), 0) || getSalaryPaidForMonth(currentMonth);
}

function getSalaryPayableForMonth(month) {
  const booked = getSalaryBookedForMonth(month);
  const advances = getSalaryAdvancePaidForMonth(month);
  const paid = getSalaryPaidForMonth(month);
  return Math.max(0, roundMoney(booked - advances - paid));
}

function getSalaryPayable() {
  const booked = state.salaryEntries.filter((entry) => entry.type === "Booked").reduce((sum, entry) => sum + numberValue(entry.amount), 0);
  const paid = state.salaryEntries.filter((entry) => ["Advance Paid", "Salary Paid", "Paid"].includes(entry.type)).reduce((sum, entry) => sum + numberValue(entry.amount), 0);
  return Math.max(0, roundMoney(booked - paid));
}

function getSalaryAdvanceDueForMonth(month) {
  const expectedHalf = roundMoney(numberValue(state.settings.expectedMonthlySalary) / 2);
  return Math.max(0, roundMoney(expectedHalf - getSalaryAdvancePaidForMonth(month)));
}

function getPendingPdcNet() {
  return state.pdcs
    .filter((pdc) => ["Pending", "Deposited"].includes(pdc.status))
    .reduce((sum, pdc) => sum + (pdc.direction === "receivable" ? numberValue(pdc.amount) : -numberValue(pdc.amount)), 0);
}

function estimateMonthlyInterest(debt) {
  return roundMoney((numberValue(debt.amount) * numberValue(debt.interestRate)) / 100 / 12);
}

function daysInMonth(dateInput) {
  const date = parseInputDate(dateInput);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function daysInYear(dateInput) {
  const year = parseInputDate(dateInput).getFullYear();
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function monthDifference(startDate, currentDate) {
  const start = parseInputDate(startDate);
  const current = parseInputDate(currentDate);
  return (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth();
}

function getDebtStartDate(debt) {
  return debt.date || debt.originalDate || state.settings.businessDate;
}

function isDebtActiveOnDate(debt, date) {
  if (date < getDebtStartDate(debt)) return false;
  if (debt.repaymentTerms !== "Monthly EMI") return true;
  const tenure = Math.round(numberValue(debt.emiTenureMonths));
  if (tenure < 1) return true;
  return monthDifference(getDebtStartDate(debt), date) < tenure;
}

function getDebtMonthlyPayment(debt) {
  const principal = numberValue(debt.amount);
  if (debt.repaymentTerms !== "Monthly EMI") return estimateMonthlyInterest(debt);
  if (numberValue(debt.monthlyEmiAmount) > 0) return numberValue(debt.monthlyEmiAmount);
  const tenure = Math.max(1, Math.round(numberValue(debt.emiTenureMonths)));
  const monthlyRate = numberValue(debt.interestRate) / 100 / 12;
  if (!monthlyRate) return roundMoney(principal / tenure);
  const factor = Math.pow(1 + monthlyRate, tenure);
  return roundMoney((principal * monthlyRate * factor) / (factor - 1));
}

function getDebtPaymentType(debt) {
  return debt.repaymentTerms === "Monthly EMI" ? "EMI Payment" : "Interest Payment";
}

function getDebtPaidForDueDate(debtId, dueDate) {
  return roundMoney(
    state.debtPayments
      .filter((payment) => payment.debtId === debtId && payment.dueDate === dueDate)
      .reduce((sum, payment) => sum + numberValue(payment.amount), 0)
  );
}

function getDebtDueOpenAmount(debt, dueDate) {
  const dueAmount = getDebtMonthlyPayment(debt);
  const paidAmount = getDebtPaidForDueDate(debt.id, dueDate);
  return Math.max(0, roundMoney(dueAmount - paidAmount));
}

function getDebtDailyAccrual(debt, date) {
  if (!isDebtActiveOnDate(debt, date)) return 0;
  if (debt.repaymentTerms === "Monthly EMI") {
    return roundMoney(getDebtMonthlyPayment(debt) / daysInMonth(date));
  }
  return roundMoney((numberValue(debt.amount) * numberValue(debt.interestRate)) / 100 / daysInYear(date));
}

function getDebtPaymentLabel(debt) {
  if (debt.repaymentTerms === "Monthly EMI") {
    return `EMI ${formatAmount(getDebtMonthlyPayment(debt))}/month for ${Math.max(1, Math.round(numberValue(debt.emiTenureMonths)))} month(s)`;
  }
  return `${numberValue(debt.interestRate)}% ${debt.interestType || "interest"}`;
}

function getNextRepaymentDate(debt, fromDate = state.settings.businessDate) {
  const day = Math.round(numberValue(debt.repaymentDay));
  if (!day) return debt.dueDate || "";
  const current = parseInputDate(fromDate);
  const candidate = new Date(current.getFullYear(), current.getMonth(), Math.min(day, daysInMonth(fromDate)));
  if (dateToInput(candidate) < fromDate) {
    candidate.setMonth(candidate.getMonth() + 1);
    candidate.setDate(Math.min(day, daysInMonth(dateToInput(candidate))));
  }
  return dateToInput(candidate);
}

function getCurrentRepaymentDate(debt, date = state.settings.businessDate) {
  const day = Math.round(numberValue(debt.repaymentDay));
  if (!day) return debt.dueDate || "";
  if (date < getDebtStartDate(debt)) return "";
  const current = parseInputDate(date);
  const candidate = new Date(current.getFullYear(), current.getMonth(), Math.min(day, daysInMonth(date)));
  return dateToInput(candidate);
}

function vendorName(id) {
  return state.vendors.find((vendor) => vendor.id === id)?.name || "Vendor";
}

function stockItemName(id, sourceState = state) {
  return sourceState.stockItems?.find((item) => item.id === id)?.name || "Item";
}

function accountName(id) {
  if (id === "cash") return "Cash in hand";
  return state.accounts.find((account) => account.id === id)?.name || "Not selected";
}

function moneySelectOptions() {
  return [
    `<option value="cash">Cash in hand</option>`,
    ...state.accounts.map((account) => `<option value="${account.id}">${escapeHtml(account.name)}</option>`),
  ].join("");
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function statusPill(status) {
  const text = String(status || "");
  let type = "pill-neutral";
  if (["Paid", "Cleared", "Received", "Receivable", "New Debt", "Projected Safe", "Funds Available", "Advance Paid", "Salary Paid", "Salary Advance", "Quality Approved", "Stock Out"].includes(text)) type = "pill-in";
  if (["Unpaid", "Pending", "Booked", "Payable", "PDC Issued", "Pending PDC", "Accrued", "Old Debt", "Delayed", "Deposit Cash", "Scheduled", "Planned", "Pending Quality", "Pending Finance", "Salary Advance Scheduled", "Salary Clearing Due"].includes(text)) type = "pill-warn";
  if (["Bounced", "Cancelled", "Call Back PDC", "Overdue", "Shortfall", "Funds Not Available", "Rejected", "No Finance", "Salary Clearing Overdue"].includes(text)) type = "pill-out";
  return `<span class="pill ${type}">${escapeHtml(text)}</span>`;
}

function sortNewest(a, b) {
  return (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "");
}

function roundMoney(value) {
  return Math.round((numberValue(value) + Number.EPSILON) * 100) / 100;
}

function nextReceiptNo(prefixOverride) {
  const prefix = prefixOverride || state.settings.receiptPrefix || "RCP";
  const allNumbers = [
    ...state.receipts.map((item) => item.receiptNo),
    ...state.vendorPayments.map((item) => item.receiptNo),
    ...state.expensePayments.map((item) => item.receiptNo),
  ]
    .filter(Boolean)
    .filter((value) => value.startsWith(`${prefix}-`))
    .map((value) => Number(value.split("-").pop()))
    .filter(Number.isFinite);
  const next = (allNumbers.length ? Math.max(...allNumbers) : 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

function recordDebtAccrualsForDate(date) {
  let total = 0;
  state.debts.forEach((debt) => {
    if (state.debtAccruals.some((item) => item.debtId === debt.id && item.date === date)) return;
    const amount = getDebtDailyAccrual(debt, date);
    if (amount <= 0) return;
    const category = debt.repaymentTerms === "Monthly EMI" ? "Debt EMI Accrual" : "Debt Interest Accrual";
    addUniqueCategory("expenseCategories", category);
    state.debtAccruals.unshift({
      id: uid("debtcost"),
      date,
      debtId: debt.id,
      lender: debt.lender,
      category,
      repaymentTerms: debt.repaymentTerms,
      monthlyAmount: getDebtMonthlyPayment(debt),
      amount,
      daysInMonth: daysInMonth(date),
      createdAt: new Date().toISOString(),
    });
    total += amount;
  });
  return roundMoney(total);
}

function closeBusinessDay() {
  if (!requireOwnerAction()) return;
  const closedDate = state.settings.businessDate;
  const salaryBooked = getSalaryBookedForDate(closedDate);
  if (salaryBooked <= 0) {
    showToast("Book today's salary expense before closing the business day.");
    switchView("salaries");
    return;
  }
  const debtCost = recordDebtAccrualsForDate(closedDate);
  const balances = computeBalances({ throughDate: closedDate });
  state.dayCloses.push({
    id: uid("close"),
    date: closedDate,
    cash: balances.cash,
    bankTotal: balances.bankTotal,
    liquidity: balances.liquidity,
    debtCost,
    salaryBooked,
    createdAt: new Date().toISOString(),
  });
  pruneDayCloseReports(closedDate);
  state.settings.businessDate = addDays(closedDate, 1);
  const closeNotes = [];
  if (debtCost) closeNotes.push(`Debt cost ${formatAmount(debtCost)}`);
  if (salaryBooked) closeNotes.push(`Salary expense ${formatAmount(salaryBooked)}`);
  saveAndRender(closeNotes.length ? `Business day closed. Booked: ${closeNotes.join(", ")}.` : "Business day closed.");
  setInitialDates();
}

function pruneDayCloseReports(anchorDate = state.settings.businessDate) {
  const cutoff = addDays(anchorDate, -29);
  state.dayCloses = state.dayCloses.filter((item) => item.date >= cutoff && item.date <= anchorDate);
}

function printReceipt(id) {
  if (!requireOwnerAction()) return;
  const receipt = state.receipts.find((item) => item.id === id);
  if (!receipt) return;
  printVoucher({
    title: "Payment Receipt",
    number: receipt.receiptNo,
    date: receipt.date,
    partyLabel: "Received from",
    party: receipt.customer,
    lines: [
      ["Payment mode", `${receipt.mode} - ${accountName(receipt.accountId)}`],
      ["Invoice / order", receipt.invoice || "Not specified"],
      ["Notes", receipt.notes || "Payment received"],
    ],
    amount: receipt.amount,
  });
}

function printVendorPayment(id) {
  const payment = state.vendorPayments.find((item) => item.id === id);
  if (!payment) return;
  const linkedPdc = payment.pdcId ? state.pdcs.find((pdc) => pdc.id === payment.pdcId) : null;
  const rows = (payment.allocations || []).map((allocation) => {
    const purchase = state.purchases.find((item) => item.id === allocation.purchaseId);
    return {
      document: purchase?.invoiceNo || "Invoice",
      description: purchase?.description || purchase?.category || "Purchase invoice",
      date: purchase?.date || payment.date,
      deductions: 0,
      amount: allocation.amount,
    };
  });

  printPaymentAdvice({
    title: "Payment Receipt",
    documentNo: payment.receiptNo,
    date: payment.date,
    party: vendorName(payment.vendorId),
    amount: payment.amount,
    chequeNo: payment.reference || linkedPdc?.chequeNo || "Not recorded",
    bankName: accountName(payment.accountId),
    status: payment.status,
    remarks: payment.remarks,
    rows,
  });
}

function printPdcReceipt(id) {
  const pdc = state.pdcs.find((item) => item.id === id);
  if (!pdc) return;
  if (pdc.linkedType === "vendorPayment" && pdc.linkedId) {
    return printVendorPayment(pdc.linkedId);
  }

  printPaymentAdvice({
    title: "Cheque Handover Receipt",
    documentNo: `PDC-${pdc.chequeNo}`,
    date: state.settings.businessDate,
    party: pdc.partyName,
    amount: pdc.amount,
    chequeNo: pdc.chequeNo,
    bankName: pdc.bankName || accountName(pdc.accountId),
    status: pdc.status,
    remarks: pdc.notes,
    rows: [
      {
        document: pdc.chequeNo,
        description: pdc.notes || `${pdc.direction === "payable" ? "Cheque handed over" : "Cheque received"}`,
        date: pdc.dueDate,
        deductions: 0,
        amount: pdc.amount,
      },
    ],
  });
}

function printExpensePayment(id) {
  const payment = state.expensePayments.find((item) => item.id === id);
  if (!payment) return;
  const expenses = (payment.expenseIds || [])
    .map((expenseId) => state.expenses.find((expense) => expense.id === expenseId))
    .filter(Boolean);
  const rows = expenses.map((expense) => ({
    document: expense.receiptNo || payment.receiptNo,
    description: `${expense.category} - ${expense.notes || "Expense payable"}`,
    date: expense.date,
    deductions: 0,
    amount: expense.amount,
  }));

  printPaymentAdvice({
    title: "Expense Payment Receipt",
    documentNo: payment.receiptNo,
    date: payment.date,
    party: payment.paidTo,
    amount: payment.amount,
    chequeNo: "Not recorded",
    bankName: accountName(payment.accountId),
    status: "Paid",
    remarks: payment.category,
    rows,
  });
}

function printPaymentAdvice(data) {
  const rows = data.rows?.length
    ? data.rows
    : [
        {
          document: data.documentNo,
          description: data.remarks || "Payment settlement",
          date: data.date,
          deductions: 0,
          amount: data.amount,
        },
      ];
  const total = rows.reduce((sum, row) => sum + numberValue(row.amount), 0);
  qs("[data-print-receipt]").innerHTML = `
    <article class="payment-advice-card">
      <div class="advice-company">
        <h2>${escapeHtml(state.settings.businessName)}</h2>
        <strong>${escapeHtml(String(data.title || "PAYMENT ADVICE").toUpperCase())}</strong>
      </div>
      <div class="advice-meta">
        <div>
          <span>To,</span>
          <strong>${escapeHtml(data.party)}</strong>
        </div>
        <div>
          <div><strong>Document No. / Date:</strong> ${escapeHtml(data.documentNo)} / ${escapeHtml(formatDate(data.date))}</div>
          <div><strong>Cheque No. / UTR No:</strong> ${escapeHtml(data.chequeNo || "Not recorded")}</div>
          <div><strong>Bank Name & Branch:</strong> ${escapeHtml(data.bankName || "Not recorded")}</div>
          <div><strong>Status:</strong> ${escapeHtml(data.status || "Recorded")}</div>
        </div>
      </div>
      <p class="advice-copy">
        Please find enclosed payment for ${escapeHtml(formatAmount(data.amount))} (${escapeHtml(amountInWords(data.amount))} only) towards settlement of the following bills.
      </p>
      <table class="advice-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Description</th>
            <th>Date</th>
            <th class="amount-cell">Deductions</th>
            <th class="amount-cell">Gross amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.document)}</td>
                  <td>${escapeHtml(row.description)}</td>
                  <td>${escapeHtml(formatDate(row.date))}</td>
                  <td class="amount-cell">${escapeHtml(formatAmount(row.deductions || 0))}</td>
                  <td class="amount-cell">${escapeHtml(formatAmount(row.amount))}</td>
                </tr>
              `
            )
            .join("")}
          <tr>
            <td colspan="4" class="amount-cell"><strong>Sum total</strong></td>
            <td class="amount-cell"><strong>${escapeHtml(formatAmount(total))}</strong></td>
          </tr>
        </tbody>
      </table>
      ${data.remarks ? `<p class="advice-copy"><strong>Remarks:</strong> ${escapeHtml(data.remarks)}</p>` : ""}
      <div class="advice-signatures">
        <div>
          <strong>For ${escapeHtml(state.settings.businessName)}</strong>
          <span>Authorised Signatory</span>
        </div>
        <div>
          <strong>Receiver's Signature</strong>
          <span>Name / stamp</span>
        </div>
      </div>
    </article>
  `;
  window.print();
}

function printVoucher(data) {
  qs("[data-print-receipt]").innerHTML = `
    <article class="receipt-card">
      <div class="receipt-top">
        <div><h2>${escapeHtml(state.settings.businessName)}</h2><div>${escapeHtml(data.title)}</div></div>
        <div class="receipt-title"><span>No.</span><strong>${escapeHtml(data.number)}</strong><span>${escapeHtml(formatDate(data.date))}</span></div>
      </div>
      <div class="receipt-lines">
        <div class="receipt-line"><span>${escapeHtml(data.partyLabel)}</span><strong>${escapeHtml(data.party)}</strong></div>
        ${data.lines.map(([label, value]) => `<div class="receipt-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
      </div>
      <div class="receipt-amount">${escapeHtml(formatAmount(data.amount))}</div>
      <div class="receipt-footer"><div>Generated on ${escapeHtml(formatDate(todayInput()))}</div><div>Authorized signature</div></div>
    </article>
  `;
  window.print();
}

function printDaybook() {
  const selectedDate = qs("[data-daybook-date]")?.value || state.settings.businessDate;
  if (!isDaybookRetained(selectedDate)) return showToast("This daybook is older than 180 days and is no longer available.");
  const rows = getDaybookEntries(selectedDate);
  printTable(
    `Daybook - ${formatDate(selectedDate)}`,
    ["Type", "Party", "Details", "In", "Out", "Commitment"],
    rows.map((row) => [
      row.type,
      row.party,
      row.details,
      row.in ? formatAmount(row.in) : "",
      row.out ? formatAmount(row.out) : "",
      row.commitment ? formatAmount(row.commitment) : "",
    ])
  );
}

function printReport() {
  const rows = getFilteredReportRows();
  printTable("ERP Report", ["Date", "Type", "Party", "Status", "Account", "Reference", "Amount"], rows.map((row) => [formatDate(row.date), row.type, row.party, row.status, row.account, row.reference, formatAmount(row.amount)]));
}

function getSelectedCruxDate() {
  const selected = qs("[data-crux-date]")?.value || "";
  if (selected) return selected;
  return getClosedDays()[0]?.date || "";
}

function printCruxReport() {
  if (!requireOwnerAction()) return;
  const date = getSelectedCruxDate();
  if (!date) return showToast("Close a business day first.");
  qs("[data-print-receipt]").innerHTML = getCruxReportHtml(date);
  window.print();
}

function downloadCruxReportHtml() {
  if (!requireOwnerAction()) return;
  const date = getSelectedCruxDate();
  if (!date) return showToast("Close a business day first.");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Crux of the Day - ${escapeHtml(formatDate(date))}</title>${getCruxReportStyles()}</head><body>${getCruxReportHtml(date, true)}</body></html>`;
  downloadFile(`crux-of-the-day-${date}.html`, html, "text/html");
  showToast("Crux report downloaded. Open it and choose Print > Save as PDF when you need a PDF file.");
}

function getCruxReportHtml(date, standalone = false) {
  const crux = getDailyCrux(date);
  const metrics = [
    ["Opening liquidity", formatAmount(crux.opening.liquidity)],
    ["Money in", formatAmount(crux.moneyIn)],
    ["Money out", formatAmount(crux.moneyOut)],
    ["Commitments", formatAmount(crux.commitments)],
    ["Purchases", formatAmount(crux.purchasesBooked)],
    ["Salaries booked", formatAmount(crux.salariesBooked)],
    ["Expenses booked", formatAmount(crux.expensesBooked)],
    ["Closing liquidity", formatAmount(crux.closing.liquidity)],
  ];
  return `
    ${standalone ? "" : getCruxReportStyles()}
    <article class="crux-print-card">
      <section class="crux-report-page">
        <div class="crux-report-top">
          <div><h2>${escapeHtml(state.settings.businessName)}</h2><p>Crux of the Day</p></div>
          <strong>${escapeHtml(formatDate(date))}</strong>
        </div>
        <div class="crux-print-metrics">
          ${metrics.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
        </div>
        <div class="crux-print-grid">
          <div>
            <h3>Graphical briefing</h3>
            ${renderCruxCharts(crux)}
          </div>
          <div>
            <h3>Briefing notes</h3>
            <ul>${getCruxBriefingLines(crux).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
          </div>
        </div>
      </section>
      <section class="crux-report-page page-break">
        <h3>Daybook Page - ${escapeHtml(formatDate(date))}</h3>
        <table class="crux-print-table">
          <thead><tr><th>Type</th><th>Party</th><th>Details</th><th>In</th><th>Out</th><th>Commitment</th></tr></thead>
          <tbody>${crux.daybook.length ? crux.daybook.map((row) => `<tr><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.party)}</td><td>${escapeHtml(row.details)}</td><td>${row.in ? escapeHtml(formatAmount(row.in)) : ""}</td><td>${row.out ? escapeHtml(formatAmount(row.out)) : ""}</td><td>${row.commitment ? escapeHtml(formatAmount(row.commitment)) : ""}</td></tr>`).join("") : `<tr><td colspan="6">No daybook entries.</td></tr>`}</tbody>
        </table>
      </section>
    </article>
  `;
}

function getCruxReportStyles() {
  return `
    <style>
      .crux-print-card{width:min(1040px,100%);margin:0 auto;padding:26px;background:#fff;color:#111827;font:14px Arial,sans-serif}
      .crux-report-page{min-height:920px}
      .page-break{break-before:page;page-break-before:always}
      .crux-report-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:18px}
      .crux-report-top h2{margin:0;font-size:24px}.crux-report-top p{margin:4px 0 0;color:#4b5563}
      .crux-print-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:18px 0}
      .crux-print-metrics div{border:1px solid #d1d5db;padding:10px;border-radius:6px}.crux-print-metrics span{display:block;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700}.crux-print-metrics strong{display:block;margin-top:5px;font-size:16px}
      .crux-print-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.crux-print-grid h3{margin:0 0 10px}
      .crux-print-table{width:100%;border-collapse:collapse;font-size:12px}.crux-print-table th,.crux-print-table td{border:1px solid #d1d5db;padding:7px;text-align:left}.crux-print-table th{background:#f3f4f6}
      .crux-chart-stack{display:grid;gap:16px}.donut-row{display:grid;grid-template-columns:180px 1fr;gap:16px;align-items:center}.donut-chart{width:170px;height:170px;border-radius:50%;display:grid;place-items:center}.donut-chart>div{width:104px;height:104px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center;padding:8px}.donut-chart strong,.donut-chart span{display:block}.donut-chart span{font-size:11px;color:#6b7280}.chart-legend{display:grid;gap:8px}.chart-legend div{display:grid;grid-template-columns:12px 1fr auto;gap:8px;align-items:center}.chart-legend span{width:12px;height:12px;border-radius:2px}.chart-legend em{font-style:normal;color:#374151}.crux-bars{display:grid;gap:8px}.crux-bar-row{display:grid;grid-template-columns:86px 1fr 110px;gap:8px;align-items:center}.crux-bar-track{height:11px;background:#e5e7eb;border-radius:999px;overflow:hidden}.crux-bar-track div{height:100%;border-radius:999px}.crux-bar-row strong{font-size:11px;text-align:right}
      @media print{.crux-print-card{padding:0}.crux-report-page{min-height:auto}.crux-print-grid{grid-template-columns:1fr 1fr}}
    </style>
  `;
}

function printTable(title, headers, rows) {
  qs("[data-print-receipt]").innerHTML = `
    <article class="receipt-card">
      <div class="receipt-top"><div><h2>${escapeHtml(state.settings.businessName)}</h2><div>${escapeHtml(title)}</div></div></div>
      <table>
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="empty-state">No records found.</td></tr>`}</tbody>
      </table>
    </article>
  `;
  window.print();
}

function exportDaybookCsv() {
  const selectedDate = qs("[data-daybook-date]")?.value || state.settings.businessDate;
  if (!isDaybookRetained(selectedDate)) return showToast("This daybook is older than 180 days and is no longer available.");
  const rows = [["Date", "Type", "Party", "Details", "In", "Out", "Commitment"]];
  getDaybookEntries(selectedDate).forEach((entry) =>
    rows.push([selectedDate, entry.type, entry.party, entry.details, entry.in || "", entry.out || "", entry.commitment || ""])
  );
  downloadFile(`daybook-${selectedDate}.csv`, toCsv(rows), "text/csv");
}

function exportReportCsv() {
  const rows = [["Date", "Type", "Party", "Status", "Account", "Reference", "Amount"]];
  getFilteredReportRows().forEach((row) => rows.push([row.date, row.type, row.party, row.status, row.account, row.reference, row.amount]));
  downloadFile(`erp-report-${todayInput()}.csv`, toCsv(rows), "text/csv");
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(",")
    )
    .join("\n");
}

function exportJson() {
  if (!requireOwnerAction()) return;
  downloadFile(`yk-brahmastra-backup-${todayInput()}.json`, JSON.stringify(state, null, 2), "application/json");
  showToast("Backup exported.");
}

function importJson(event) {
  if (!requireOwnerAction()) return;
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      state = normalizeState(JSON.parse(reader.result));
      saveAndRender("Backup imported.");
      event.target.value = "";
    } catch (error) {
      console.error(error);
      showToast("Could not import this backup file.");
    }
  });
  reader.readAsText(file);
}

function getSyncUrl() {
  return state.settings.syncUrl?.trim() || "";
}

function getSyncHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = state.settings.syncToken?.trim();
  if (token) headers["X-YK-Sync-Key"] = token;
  return headers;
}

async function pushRemoteSync() {
  if (!requireOwnerAction()) return;
  const url = getSyncUrl();
  if (!url) return showToast("Add a cloud sync URL in Settings first.");
  try {
    state.settings.lastSyncAt = new Date().toISOString();
    saveState();
    const response = await fetch(url, {
      method: "PUT",
      headers: getSyncHeaders(),
      body: JSON.stringify({ app: APP_NAME, updatedAt: state.settings.lastSyncAt, data: state }),
    });
    if (!response.ok) throw new Error(`Sync push failed ${response.status}`);
    showToast("Cloud data pushed.");
  } catch (error) {
    console.error(error);
    showToast("Cloud push failed. Check sync URL, CORS, and endpoint permissions.");
  }
}

async function pullRemoteSync() {
  if (!requireOwnerAction()) return;
  const url = getSyncUrl();
  if (!url) return showToast("Add a cloud sync URL in Settings first.");
  if (!confirm("Pull shared cloud data and replace this browser's current app data?")) return;
  try {
    const response = await fetch(url, { method: "GET", headers: getSyncHeaders() });
    if (!response.ok) throw new Error(`Sync pull failed ${response.status}`);
    const payload = await response.json();
    state = applyRetention(normalizeState(payload.data || payload));
    state.settings.lastSyncAt = new Date().toISOString();
    saveAndRender("Cloud data pulled.");
  } catch (error) {
    console.error(error);
    showToast("Cloud pull failed. Check sync URL, CORS, and JSON format.");
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearReportFilters() {
  const type = qs("[data-report-type]");
  const start = qs("[data-report-start]");
  const end = qs("[data-report-end]");
  if (type) type.value = "All Transactions";
  if (start) start.value = "";
  if (end) end.value = "";
  renderReports();
}

function clearData() {
  if (!requireOwnerAction()) return;
  if (!confirm("Clear all ERP data from this browser?")) return;
  state = defaultState();
  saveAndRender("All data cleared.");
}

function showToast(message) {
  const toast = qs("[data-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => toast.classList.remove("show"), 2600);
}
