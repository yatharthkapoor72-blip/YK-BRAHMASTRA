# Previous ERP Extraction: YK PAY SMART

Source: screenshots from `D:/revive erp`, captured on April 29, 2026.

This extraction is based on visible screen content and workflow behavior implied by the UI. Anything marked as "inferred" should be validated against the original code or data export if available.

## App Identity

- App name: YK PAY SMART
- Firebase Studio project/context: YK WORK SMART
- Main visible bank/account: KOTAK BANK
- Header live balance: INR 725053.80
- Theme: dark, compact, finance dashboard style
- Main header actions:
  - View Account
  - Import
  - Delete All Data
  - Hide/show balance icon
- View Account dropdown:
  - Search account
  - Cash in Hand
  - KOTAK BANK

## Main Navigation

Visible modules:

- Dashboard
- Vendors
- Purchases
- Make Payment
- Payment In
- Debt
- Scheduled
- Expected
- Reports
- PDCs
- Banks
- Salaries
- Daybook
- Expenses

## Dashboard

Screen title:

- Welcome to Your Dashboard
- Subtitle: "Here's a funky look at your key business facts for April 2026"

Dashboard KPI cards:

- Purchases Booked: INR 644394.99
  - Text: Total value of invoices booked this month.
- Bills Paid: INR 0
  - Text: Total amount paid out this month.
- Salaries Booked: INR 0
  - Text: Total expected salary expense for the month.
- Expenses Incurred: INR 0
  - Text: Miscellaneous expenses paid this month.

Dashboard panels:

- Upcoming PDCs This Month
  - Text: Post-dated cheques scheduled for clearance.
  - Empty state: No upcoming PDCs this month.
- Cheques Issued Today
  - Text: A list of all cheques recorded today.
  - Empty state: No cheques were issued today.

## Vendors

Purpose:

- Add vendors manually.
- Vendor purchases can be added later by file import.
- Vendor payment terms drive invoice due dates and maturity.

Add vendor form:

- Vendor Name
  - Placeholder: e.g., ABC Supplies
- Payment Terms (in days)
  - Default visible value: 30
- Button: Add Vendor

Vendor row behavior:

- Vendor name
- Total purchases count
- Matured for payment count
- Edit action
- Expand/collapse action

Visible vendors:

- TK Steels
  - 0 Total Purchases
  - 0 Matured for Payment
- NAMISH ENTERPRISES
  - 2 Total Purchases
  - 0 Matured for Payment
- G.S ENGINEERS
- DANG MILL STORE
- A.K. STEEL COMPANY
- M/S IMPACT ENGINEERS
- SHIVAY CHAIR SYSTEM
- B.T. STEEL
- LUDHIANA STEELS
- TECH TUBE ENTERPRISES
- S.P.G INDUSTRIES

## Purchases

Purpose:

- Create purchase categories.
- Manually add vendor purchase invoices.
- Track spend by category.
- Imported purchase files are supported or planned.

Manage Purchase Categories:

- New Category Name
  - Placeholder: e.g., Raw Materials, Consumables
- Button: Add Category
- Existing category visible:
  - raw material

Manual Purchase Entry fields:

- Vendor Name
  - Placeholder: Select or type vendor...
- Invoice ID
  - Placeholder: e.g., INV-12345
- Invoice Date (DD/MM/YYYY)
  - Placeholder: DD/MM/YYYY
- Amount
  - Placeholder: e.g., 5000.00
- Category
  - Placeholder: Select a category...
- Items / Description (Optional)
  - Placeholder: e.g., Cotton Yarn
- Button: Add Purchase

Spend by Category:

- raw material
  - Booked this month: INR 644394.99
  - Paid this month: INR 0.00

Visible purchase/report category:

- LABOUR JOB

Inferred purchase behavior:

- Purchase invoice creates an unpaid invoice.
- Due date is calculated from invoice date plus vendor payment terms.
- Purchases feed dashboard "Purchases Booked" and reports.
- Purchase invoices can be paid later through Make Payment.

## Make Payment

Purpose:

- Select vendor.
- Select one or more unpaid invoices.
- Pay full or partial amount.
- Generate receipt after payment.
- Support cash, bank transfer, cheque, and post-dated cheque.

Initial screen:

- Title: Make a Payment
- Text: Select a vendor, choose invoices, and generate a payment.
- Field: Select a Vendor
  - Placeholder: Choose a vendor...

Vendor dropdown options visible:

- TK Steels
- NAMISH ENTERPRISES
- G.S ENGINEERS
- DANG MILL STORE
- A.K. STEEL COMPANY
- M/S IMPACT ENGINEERS
- SHIVAY CHAIR SYSTEM
- B.T. STEEL
- LUDHIANA STEELS
- TECH TUBE ENTERPRISES
- S.P.G INDUSTRIES

Invoice selection table:

- Checkbox
- Invoice ID
- Purchase Date
- Due Date
- Amount
- Selected Total
- Pay Selected button

Visible G.S ENGINEERS invoices:

- Invoice 13
  - Purchase Date: 28-04-2026
  - Due Date: 28-05-2026
  - Amount: INR 13720.00
- Invoice 12
  - Purchase Date: 28-04-2026
  - Due Date: 28-05-2026
  - Amount: INR 32144.00
- Invoice 10
  - Purchase Date: 28-04-2026
  - Due Date: 28-05-2026
  - Amount: INR 9440.00
- Invoice 11
  - Purchase Date: 28-04-2026
  - Due Date: 28-05-2026
  - Amount: INR 5243.92
- Invoice 7
  - Purchase Date: 28-04-2026
  - Due Date: 28-05-2026
  - Amount: INR 7599.20

Payment modal:

- Title: Process Payment to G.S ENGINEERS
- Selected Invoices count
- Selected invoice rows with amount
- Total Selected
- Amount to Pay
  - Placeholder example: Max: 13720.00
- Partial Payment Remarks
  - Placeholder: e.g., Material discrepancy
- Payment Mode
  - Cash
  - Bank Transfer
  - Cheque
- Paying Bank
  - Placeholder: Choose a bank...
- Final Amount to Pay
- Buttons:
  - Mark as Paid & Get Receipt
  - Cancel

Cheque-specific fields:

- Cheque No.
  - Placeholder: Enter cheque number
- Post-Dated Cheque (PDC) toggle

Important payment rules:

- Payment can be partial.
- Payment can cover multiple selected invoices.
- Payment receipt should be generated after marking paid.
- Bank/cash balance must only be debited once.
- If cheque is PDC, it should become a commitment first and only affect live/statement balance when cleared.

## Payment In

Purpose:

- Record incoming funds from customers or owner capital.

Form title:

- Record an Incoming Payment
- Text: Log funds received from parties or as personal capital.

Source of Funds:

- Customer
- Own Capital

Customer mode fields:

- Party Name
- Receiving Account
- Amount
- Remarks (Optional)
- Button: Add Payment

Own Capital mode fields:

- Receiving Account
- Amount
- Remarks (Optional)
- Button: Add Payment

Receiving Account dropdown:

- Cash
- KOTAK BANK

History section:

- Payment-In History
- Text: History of all recorded incoming payments.
- Empty state: No incoming payments recorded yet.

## Debt

Purpose:

- Record official and unofficial loans/debts received.
- Manage debt accounts and repayments.
- Generate scheduled EMI or interest obligations.

Form title:

- Add a Debt Record
- Text: Directly record a new official or un-official loan received.

Entry Type:

- New Debt (Today's Transaction)
- Old Debt (Historical Entry)

Old debt extra field:

- Date of Original Debt (DD/MM/YYYY)

Type of Debt:

- Un-Official Debt
- Bank Debt

Fields:

- Lender Name
- Amount
- Receiving Account
- Interest Rate (% p.a.)
- Repayment Terms
- Interest Type
- Remarks (Optional)
- Button: Record Debt

Repayment Terms options:

- Monthly EMI
- Monthly Interest
- Interest + Principle Fixed
- Interest + Principle Unfixed

Interest Type options:

- Fixed Interest
- Floating

Debt Accounts section:

- Text: Summary of all active loans. Pre-payments can be made here.
- Empty state: No debt payments recorded yet.

Inferred debt behavior:

- New debt increases selected receiving account and creates liability.
- Old debt records historical liability and original date.
- Repayment terms feed Scheduled payments.
- Interest type and interest rate are needed for future payable calculations.

## Scheduled

Purpose:

- Confirm scheduled EMI or interest repayments due today.
- Track scheduled expense/payment history.

Pending Scheduled Payments:

- Text: Confirm scheduled EMI or interest repayments that are due today.
- Empty state: No scheduled payments are due today.

Scheduled Payments History:

- Text: A record of all expenses that were booked to be paid later.
- Filters:
  - All Categories
  - Start Date (DD/MM/YYYY)
  - End Date (DD/MM/YYYY)
  - Clear Filters
- Empty state: No scheduled expenses match the selected filters.

Inferred scheduled sources:

- Debt EMI
- Debt interest
- Booked unpaid expenses
- Salary payable

## Expected

Purpose:

- Record future incoming payments.
- Support expected payment forecasting by type, mode, and delay risk.

Form title:

- Log an Expected Payment
- Text: Record an upcoming payment you expect to receive.

Type of Payment:

- Customer Payment
- Capital Infusion
- Un-Official Debt
- Bank Debt
- Miscellaneous

Fields:

- Customer Name
  - Label likely changes based on selected type.
- Amount
- Expected Date (DD/MM/YYYY)
- Mode of Payment
- Expected Max Possible Delay (in days)
- Remarks (Optional)
- Button: Log Payment

Mode of Payment options:

- Cash
- Bank Transfer
- Cheque

Expected Payments section:

- Text: A list of upcoming payments you expect to receive.

## Reports

Purpose:

- Filter, print, edit, and delete all recorded transactions.

Header:

- Reports
- Text: Filter and view all recorded transactions.
- Button: Print Report

Filters:

- Transaction type
- Start Date (DD/MM/YYYY)
- End Date (DD/MM/YYYY)
- Generate Report
- Clear

Transaction type options:

- All Transactions
- Vendor Payments
- Expenses
- Scheduled Expenses
- Post-Dated Cheques
- Salaries
- Interest Statement
- Payments In

Visible report columns:

- Vendor / Purpose
- Status / Type
- Category / Purpose
- Date
- Bank Name
- Cheque/UTR
- Amount
- Actions

Visible report rows:

- NAMISH ENTERPRISES
  - Status: Unpaid Invoice
  - Date: 28-04-2026
  - Bank Name: N/A
  - Cheque/UTR: N/A
  - Amount: INR 0.88
- NAMISH ENTERPRISES
  - Status: Unpaid Invoice
  - Date: 28-04-2026
  - Bank Name: N/A
  - Cheque/UTR: N/A
  - Amount: INR 5546.00
- G.S ENGINEERS
  - Status: Unpaid Invoice
  - Category/Purpose: LABOUR JOB
  - Date: 28-04-2026
  - Bank Name: N/A
  - Cheque/UTR: N/A
  - Amount: INR 13720.00
- G.S ENGINEERS
  - Category/Purpose: LABOUR JOB
  - Date: 28-04-2026
  - Amount: INR 32144.00
- G.S ENGINEERS
  - Category/Purpose: LABOUR JOB
  - Date: 28-04-2026
  - Amount: INR 9440.00
- G.S ENGINEERS
  - Date: 28-04-2026
  - Amount: INR 5243.92

Actions:

- Edit
- Delete

Important bug captured from previous build:

- When a payment is deleted from Reports, the related bank balance was not readjusted.
- Required rule: every edit/delete must reverse and recalculate all account, ledger, invoice, PDC, daybook, and report impacts.

## PDCs

Purpose:

- Track and update all issued post-dated cheques.

Screen title:

- Post-Dated Cheques Management
- Text: Track and update the status of all issued post-dated cheques.
- Empty state: No post-dated cheques found.

PDC entry source:

- Created from Make Payment when Payment Mode is Cheque and Post-Dated Cheque toggle is enabled.

Visible/inferred PDC fields:

- Vendor/party
- Linked invoice/payment
- Cheque number
- Amount
- Paying bank
- Due date
- Status

Important PDC accounting rules from old build notes:

- Issued but uncleared PDCs are commitments, not cleared balance movements.
- Statement Balance means money that actually cleared.
- Commitments are tracked separately until PDC clears.
- Day Close should not deduct unpaid PDCs from closing balance and then deduct again the next day.
- A cheque or bank transfer must result in exactly one debit from live balance and ledger.

## Banks

Purpose:

- Manage bank accounts.
- Close the business day.
- Record operational cash/bank movements.
- Show detailed bank balance breakdown.

Daily Operations:

- Text: Manage the business day.
- Current Business Day: April 29th, 2026
- Button: Close for Today

Add a New Bank Account:

- Bank Name
  - Placeholder: e.g., HDFC Bank
- Button: Add Bank

Operational cards:

- Personal Withdrawal
  - Text: Record funds withdrawn for personal use.
  - Text: Click to open a secure dialog and record a personal withdrawal.
  - Button: Record Withdrawal
- Record Salary Payment
  - Text: Log a payment made for salaries.
  - Text: Quickly record immediate salary payments.
  - Button: Record Salary
- Record Immediate Expense
  - Text: Log a miscellaneous expense paid now.
  - Text: Record and pay for a general business expense.
  - Button: Record Expense
- Book Unpaid Expense
  - Text: Log an expense to be paid later.
  - Text: Record an accrued expense without immediate payment.
  - Button: Book Expense

KOTAK BANK account card:

- Opening Balance: INR 1000000.00
- Today's Payments In: +INR 0.00
- Vendor Payments: -INR 274946.20
- Salaries Paid: -INR 0.00
- Expenses Paid: -INR 0.00
- Personal Withdrawals: -INR 0.00
- Today's Total Dispersed: -INR 274946.20
- Current Balance: INR 725053.80
- Button: View Post-Dated Cheques (0)
- Action: Update Base Balance

Balance formula visible:

- 1000000.00 - 274946.20 = 725053.80

Balance concepts mentioned in old build notes:

- Live Balance shown in header.
- Current Balance shown in Banks view.
- Projected Balance used for safety warnings.
- Statement Balance means actual cleared funds.
- Commitments include uncleared PDCs.

## Salaries

Purpose:

- Manage monthly salary forecast, booked salary payable, and salary payment.

Salary Management card:

- Text: Manage and forecast your monthly salary expenses.
- Expected Monthly Salary: INR 0.00
- Booked This Month (April): INR 0.00
- Paid This Month (April): INR 0.00
- Current Balance Payable: INR 0.00
- Buttons:
  - Update Expected Salary
  - Pay Salary

Book Salary Expense card:

- Text: Book today's consolidated salary expense without immediate payment. This increases the 'Balance Payable'.
- Amount to Book
  - Placeholder: Enter total salary amount for today
- Remarks
  - Placeholder: e.g., Salaries for Week 1
- Button: Book Expense

Inferred salary behavior:

- Booking salary increases salary payable but does not reduce bank/cash.
- Paying salary reduces selected account and salary payable.
- Salary entries feed reports, scheduled/history, daybook, and dashboard.

## Daybook

Purpose:

- Daily live summary of business-day transactions.

Screen title:

- Daybook for April 29th, 2026
- Text: A live summary of all transactions for the current business day.

Sections:

- Payments In
  - Total: +INR 0.00
  - Empty state: No incoming payments.
- Payments Out
  - Total: -INR 0.00
  - Empty state: No outgoing payments.

Inferred daybook behavior:

- Uses current business day from Banks screen.
- Close for Today likely snapshots/closes the day and rolls to next day.
- Daybook should include incoming payments, vendor payments, salary payments, expense payments, withdrawals, debt receipts/repayments, and cleared PDCs.

## Expenses

Purpose:

- Manage expense categories.
- Record immediate expenses.
- Book unpaid scheduled expenses.
- Track expense summary and unpaid booked expenses.

Manage Expense Categories:

- Text: Add new categories to track both immediate and scheduled expenses.
- New Category Name
  - Placeholder: e.g., Freight, Office Supplies, Rent
- Button: Add Category

Expense Summary:

- Text: Live summary of all your expenses.
- Empty state: No expense categories created yet.

Unpaid Booked Expenses:

- Text: Individual scheduled expenses that have been booked but not yet paid.
- Empty state: No unpaid scheduled expenses.

Expense actions also visible in Banks:

- Record Immediate Expense
- Book Unpaid Expense

## Import

Visible action:

- Import button in header.

Inferred import behavior:

- Likely supports importing purchases/vendor invoice files.
- Vendor screen text says purchases for vendors can be added via file import later.

## Delete All Data

Visible action:

- Delete All Data button in header.

Required behavior:

- Should clear all stored ERP data only after confirmation.
- Should reset balances, reports, ledgers, daybook, vendors, purchases, debts, PDCs, and settings.

## Critical Accounting Rules To Preserve

- Use ledger-style entries for every transaction.
- Avoid direct balance mutation without a reversible transaction record.
- Any edit/delete must reverse old ledger effects and apply new effects.
- Bank transfer and cheque payment should never double debit.
- PDC should be a commitment until it clears.
- Cleared PDC should affect statement/live balance once.
- Day Close should roll statement balance forward while keeping uncleared commitments separate.
- Purchases create unpaid liabilities until paid.
- Partial vendor payment must reduce invoice balance without marking invoice fully paid unless paid in full.
- Salary booking creates payable; salary payment reduces payable and bank/cash.
- Booked unpaid expense creates payable; payment reduces payable and bank/cash.
- Old debt should preserve historical date and liability without corrupting today's daybook.
- New debt should increase selected receiving account and create liability.

## Proposed Data Model For Rebuilding

- Account
  - name
  - type: cash, bank
  - opening/base balance
  - live balance
  - statement balance
  - projected balance
- Vendor
  - name
  - payment terms days
- PurchaseCategory
  - name
- PurchaseInvoice
  - vendor
  - invoice id
  - invoice date
  - due date
  - amount
  - paid amount
  - balance amount
  - category
  - items/description
  - status: unpaid, partial, paid
- VendorPayment
  - vendor
  - selected invoices
  - amount
  - payment mode
  - paying account
  - cheque number
  - is PDC
  - due/clearance date
  - partial remarks
  - receipt number
- IncomingPayment
  - source: customer, own capital
  - party name
  - receiving account
  - amount
  - remarks
- DebtAccount
  - entry type: new, historical
  - original date
  - debt type: unofficial, bank
  - lender name
  - principal amount
  - receiving account
  - interest rate
  - repayment terms
  - interest type
  - outstanding principal
  - remarks
- ScheduledPayment
  - source type: debt, booked expense, salary, other
  - due date
  - amount
  - status
  - paid account
- ExpectedPayment
  - payment type
  - party/customer name
  - amount
  - expected date
  - mode
  - max possible delay days
  - remarks
  - status
- PDC
  - party/vendor
  - cheque number
  - linked payment
  - amount
  - bank/account
  - issue date
  - due date
  - status
- SalaryLedger
  - expected monthly salary
  - booked salary
  - paid salary
  - payable balance
  - remarks
- ExpenseCategory
  - name
- Expense
  - category
  - amount
  - immediate or booked
  - paid account
  - payable status
  - remarks
- DayBook
  - business date
  - payments in
  - payments out
  - closing snapshot
  - closed status
- ReportTransaction
  - generated from ledger records, not manually separate

## Upgrade Gap Against Current New Prototype

The current new prototype already covers:

- Payment receipts
- Cash and bank balance
- Bank accounts
- Transfers
- PDC register
- Daily expenses
- Daybook
- Expected payment forecasting
- Backup/import/export

Missing or incomplete compared to the old ERP:

- Vendor master with payment terms
- Purchase categories
- Purchase invoice booking
- Invoice maturity and unpaid/partial/paid states
- Batch vendor payment against selected invoices
- Partial payment with remarks
- Vendor payment receipt
- Incoming payment source types: customer vs own capital
- Debt/loan accounts
- Repayment schedules and interest tracking
- Scheduled payment confirmation
- Business-day close
- Personal withdrawal
- Salary expected/booked/payable/payment workflow
- Expense categories and unpaid booked expenses
- Report center with filters, print, edit, delete reversal
- Account dropdown/search in header
- Live/current/projected/statement balance separation
- Import workflow for purchase/vendor data
