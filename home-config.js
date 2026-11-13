/*
 * Settings for the home page (index.html). Edit this file to change the firm name,
 * the ticker messages or the list of tools. Keep the quotes and commas as they are.
 *
 * To add a tool: copy one entry in "tools", change the values, and set status to
 * "available" (opens the tool) or "planned" (shown as "Coming soon").
 */
window.HOME_CONFIG = {
  // Shown at the top of the page. Replace with your firm's name.
  firmName: "B S Sridhar & Co., Chartered Accountants",
  // A short line under the firm name.
  tagline: "Practice tool kit – for internal use",

  // Messages that scroll across the top (internal notices, what's new, reminders).
  // Leave the list empty ([]) to hide the ticker.
  ticker: [
    "New: GSTR-9 / 9C Working – reads GSTR-1 and GSTR-3B PDFs and prepares the GSTR reconciliation, GSTR-9 draft and 9C summary in Excel.",
    "New: Depreciation under Schedule II, Companies Act, 2013 – rate and pro rata working, fixed asset register with audit checks, PPE note.",
    "New: Form 26AS · AIS · TIS Consolidator – reads the three PDFs and prepares the income consolidation workbook with TDS credit and review points.",
    "New: EPF and ESI Monthly Returns – ECR file, ESIC upload file, registers and portal reconciliation from the salary sheet.",
    "New: Trust Formation – deed, NOC, bank resolution, PAN and Form 104 data sheets, and a checklist of every formality.",
    "New: Payment Voucher – PDF voucher with Cash / Cheque / UPI details and a register of vouchers.",
    "New: HUF Formation – affidavit for stamp paper and PAN data sheet for the HUF.",
    "New: TDS rate chart and calculator under section 393 – shows the section and Sl. No. to select on the portal.",
    "New: Income Tax Calculator for tax year 2026-27 (new regime) with slab-wise working.",
    "New: Cost Inflation Index – CII table up to 2026-27 (384) and indexed cost calculator with working.",
    "New: Net Worth Certificate (visa) – Excel import, manual conversion rate, watermarked draft PDF for client confirmation.",
    "New: Partnership Deed tool – deed, NOC for the place of business, data sheet and checklist.",
    "New: Company Registration Tool Kit – Private Limited and One Person Company.",
    "LLP Registration Tool Kit now includes the LLP Agreement, print set, checklist and client request list.",
    "Reminder: check every generated document against the original KYC documents before it is signed."
  ],

  // Tool categories, in the order they are shown.
  categories: ["Registration", "Agreements", "Certificates", "Income Tax", "GST", "Company Law and Audit", "Payroll", "Office"],

  tools: [
    {
      id: "llp",
      title: "LLP Registration Tool Kit",
      category: "Registration",
      path: "llp-docs/index.html",
      status: "available",
      description: "Form 9, consent letter, subscription sheet, NOC, LLP Agreement, data sheet and print set. Reads PAN, Aadhaar and bank statement PDFs or an Excel sheet.",
      added: "2026-11-04"
    },
    {
      id: "company",
      title: "Company Registration Tool Kit",
      category: "Registration",
      path: "company-docs/index.html",
      status: "available",
      description: "Private Limited Company and One Person Company: NOC, data sheet for SPICe+ (e-MoA / e-AoA), checklist and client request list.",
      added: "2026-11-05"
    },
    {
      id: "huf",
      title: "HUF Formation",
      category: "Registration",
      path: "huf/index.html",
      status: "available",
      description: "Affidavit for forming an HUF (for stamp paper) in the firm's format, and the data sheet for the HUF's PAN application from the same details. Excel import.",
      added: "2026-11-08"
    },
    {
      id: "trust",
      title: "Trust Formation",
      category: "Registration",
      path: "trust/index.html",
      status: "available",
      description: "Trust deed in the firm's format (objects retained, clauses added), NOC, bank resolution, PAN data sheet, Form 104 data sheet (section 332 / 354, Income-tax Act, 2025), activities note and a formalities tracker.",
      added: "2026-11-08"
    },
    {
      id: "partnership",
      title: "Partnership Deed",
      category: "Agreements",
      path: "partnership-docs/index.html",
      status: "available",
      description: "Partnership deed in the firm's format, NOC for the place of business, data sheet, checklist and client request list. Reads PAN, Aadhaar and bank statement PDFs or an Excel sheet.",
      added: "2026-11-05"
    },
    {
      id: "networth",
      title: "Net Worth Certificate (visa)",
      category: "Certificates",
      path: "networth/index.html",
      status: "available",
      description: "Net worth certificate in the firm's format with annexure of documents reviewed. Excel import, any foreign currency at a rate you enter and lock, draft PDF with DRAFT watermark, final PDF and Word.",
      added: "2026-11-06"
    },
    {
      id: "cii",
      title: "Cost Inflation Index",
      category: "Income Tax",
      path: "cii/index.html",
      status: "available",
      description: "CII table from 2001-02 to 2026-27 and an indexed cost calculator: purchase and sale dates and amounts, improvements, pre-2001 FMV, with the working step by step.",
      added: "2026-11-06"
    },
    {
      id: "taxcalc",
      title: "Income Tax Calculator – TY 2026-27",
      category: "Income Tax",
      path: "taxcalc/index.html",
      status: "available",
      description: "Tax under the new regime for tax year 2026-27: slab-wise working, rebate up to Rs. 12 lakh with marginal relief, surcharge, cess and standard deduction.",
      added: "2026-11-07"
    },
    {
      id: "tds",
      title: "TDS Rate Chart and Calculator – TY 2026-27",
      category: "Income Tax",
      path: "tds/index.html",
      status: "available",
      description: "Section 393 rate chart (all Table rows) and TDS calculator with thresholds, showing the section and Table Sl. No. to select when paying TDS on the e-filing portal.",
      added: "2026-11-07"
    },
    {
      id: "26as-ais-tis",
      title: "Form 26AS · AIS · TIS Consolidator",
      category: "Income Tax",
      path: "26as-ais-tis/index.html",
      status: "available",
      description: "Reads Form 26AS, AIS and TIS PDFs; nature-wise income with 26AS vs AIS/TIS and the figure to consider, TDS credit, and points for review – downloaded as an Excel workbook.",
      added: "2026-11-09"
    },
    {
      id: "gst9",
      title: "GSTR-9 / 9C Working",
      category: "GST",
      path: "gst9/index.html",
      status: "available",
      description: "Reads the GSTR-1 and GSTR-3B PDFs for the year (any number of months) and prepares the GSTR reconciliation working with formulas, month-wise data, a GSTR-9 draft (Tables 4 to 9), books-vs-returns summary for 9C, filing dates and checks.",
      added: "2026-11-13"
    },
    {
      id: "depn",
      title: "Depreciation – Schedule II (Companies Act)",
      category: "Company Law and Audit",
      path: "depn/index.html",
      status: "available",
      description: "Rate and pro rata depreciation for an asset added during the year (SLM / WDV, extra shift), life-time working, fixed asset register from Excel with audit checks, PPE note and Note 3 disclosure.",
      added: "2026-11-12"
    },
    {
      id: "pfesi",
      title: "EPF and ESI Monthly Returns",
      category: "Payroll",
      path: "pfesi/index.html",
      status: "available",
      description: "Import the salary sheet; EPF with the dated wage ceiling (split month), ESI with contribution-period coverage; ECR file, ESIC upload file (.xls), registers, monthly summary and reconciliation with the portal.",
      added: "2026-11-09"
    },
    {
      id: "voucher",
      title: "Payment Voucher",
      category: "Office",
      path: "voucher/index.html",
      status: "available",
      description: "Payment voucher as a PDF in the voucher-book format with the firm's name: Cash / Cheque / UPI, automatic numbering, amount in words, office and payee copies, and a register of vouchers.",
      added: "2026-11-08"
    }
  ]
};
