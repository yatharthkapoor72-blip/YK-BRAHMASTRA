# YK BRAHMASTRA

A self-contained dark-theme finance ERP prototype for managing:

- Payment receipts with printable receipt vouchers
- Cash in hand and bank balances
- Bank accounts and internal transfers
- Vendors and vendor payment terms
- Purchase categories and unpaid purchase invoices
- Purchase Predictor for item rates, tax, vendor-specific rates, maturity terms, 10th/20th/next-month-10th payment provision dates, and projected affordability after booked purchases and salaries
- Vendor payments against selected invoices with partial payment support
- Cash/bank balance guard that blocks outgoing payments when available funds are short
- Incoming payments from customers, capital, debt, or miscellaneous sources
- Debt accounts with new/old debt handling, EMI tenure, repayment day, and daily interest/EMI accruals
- Overdue debt interest/EMI payments that debit the selected cash or bank account and recalculate balances
- Scheduled payable tracking
- Salary forecast for advance-reserve judgement, manual daily salary expense booking, advance payments, and salary clearing
- Store inward/outward entries with quality approval before finance books purchase liability
- Reports with filters, print, CSV export, and delete/recalculate behavior
- Post-dated cheques with due-date projection, deposit-cash warnings, and call-back warnings
- Immediate expenses that debit cash/bank at once
- Unpaid expense booking for freight and other monthly-settlement vendors, with edit/reduce controls and grouped printable settlement receipts
- Daily expenses, debt cost accruals, and category totals
- Daily day book with print, CSV export, and non-cash debt cost booking at day close
- Crux of the Day reports for closed days, with charts, printable day summary, daybook page, and source-record correction controls
- Payment forecasting from expected payments, delay windows, pending PDCs, salary advances, and salary clearing
- JSON backup import/export and optional cloud sync endpoint for shared multi-computer use
- Two-year transaction retention, 180-day daybook access, and 30-day Crux of the Day retention

## Open the app

Open `index.html` in a browser. The app stores records in the browser on this computer using local storage.

The app starts clean. It does not preload vendors, banks, balances, purchases, or demo transactions.

## Local shared backend

For one shared factory database, run the included local server on one always-on computer:

```powershell
npm start
```

Then open the app from:

```text
http://localhost:8787
```

On other computers in the same factory network, open:

```text
http://SERVER-COMPUTER-IP:8787
```

In **Settings & Data**, set **Cloud sync URL** to:

```text
http://SERVER-COMPUTER-IP:8787/api/sync
```

Use **Push cloud data** after changes and **Pull cloud data** on another computer to load the latest shared data. The server stores the shared data in `data/yk-brahmastra-store.json`.

Optional server password:

```powershell
$env:YK_SYNC_KEY="your-secret"; npm start
```

If you use this, enter the same value in **Sync secret** inside app settings.

## Login access

- Owner password: `Yatharth@98761`
- Finance password: `FINANCE@YK`
- Store password: `STORE@YK`
- Quality password: `QUALITY@YK`

Owner login can access the full app. Finance login is limited to operational work: vendors, purchases, approval requests, purchase predictor, outgoing vendor payments, scheduled expenses, payable PDCs, salary expense booking, expenses, filtered reports, and printable vendor/payment receipts. Finance login does not show bank balances, cash in hand, Payment In, Expected Payments, Debts, Banks, Daybook, Crux of the Day, owner receipts, settings, or export/clear-data tools. Low-funds and PDC checks show only whether appropriate funds are available, without exposing balances or shortfall amounts.

Store login only sees the Store Desk with large IN and OUT entry flows plus item creation. Quality login only sees Approval Requests and can approve the quality-passed quantity for material inward entries.

## First setup

1. Go to **Settings & Data**.
2. Enter the business name, opening cash, receipt prefix, and low-balance alert amount.
3. Go to **Cash & Bank** and add your bank accounts with opening balances.
4. Start entering receipts, expenses, transfers, PDCs, and expected payments.

## Backups

Use **Export backup** regularly. Use **Import backup** to restore the JSON file later.

For multi-computer use after publishing, configure **Cloud sync URL** in Settings. The endpoint must accept `GET` and `PUT` JSON and allow browser CORS from the published app. GitHub Pages or Vercel can host the app, but hosting alone cannot store shared business data by itself.
