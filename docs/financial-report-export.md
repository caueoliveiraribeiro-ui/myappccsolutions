# Financial report export
Reports → Export financial report → choose title/date range → Generate preview.
Download the self-contained HTML report, or choose Print / Save as PDF and select the browser's PDF destination. No external export service, font download or database migration is required.

Includes period received income, expenses, groceries, net recorded result, monthly trends (latest 24 months for long ranges), top-client receipts, detailed ledgers, current receivables/overdue totals, project finances and remaining investments. Current snapshots are explicitly separated from period activity. Stored investment prices are not presented as fresh market quotes. Missing FX blocks report creation; missing prices make valuation unavailable rather than zero. Project costs are planning figures and are not subtracted again from ledger income.

The report headings are English; numbers follow the user's language setting and selected currency. Exported amounts use an available FX snapshot, not historical FX. This is a management report, not audited statements, cash balance or tax advice.

The server endpoint requires Reports permission and uses existing workspace membership and owner-feature checks. Each resource is read in 500-record pages. It errors instead of silently truncating at 50,000 rows per owner/resource. Dashboard/ledger search filters do not restrict the export. User text is HTML-escaped; the preview is sandboxed without scripts and has a restrictive CSP. Export files are confidential and contain only financial output, not record IDs or credentials.

Tests:
- node scripts/financial-report-regression.cjs
- node scripts/financial-report-access-regression.cjs
- node scripts/orbit-payments-regression.cjs
- node scripts/workflow-regression.cjs
- node node_modules/typescript/bin/tsc --noEmit
- npm run build

Visual QA used synthetic data at desktop and 390px phone widths. The temporary preview route is not shipped.

