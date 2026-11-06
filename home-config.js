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
    "New: Cost Inflation Index – CII table up to 2026-27 (384) and indexed cost calculator with working.",
    "New: Net Worth Certificate (visa) – Excel import, manual conversion rate, watermarked draft PDF for client confirmation.",
    "New: Partnership Deed tool – deed, NOC for the place of business, data sheet and checklist.",
    "New: Company Registration Tool Kit – Private Limited and One Person Company.",
    "LLP Registration Tool Kit now includes the LLP Agreement, print set, checklist and client request list.",
    "Reminder: check every generated document against the original KYC documents before it is signed."
  ],

  // Tool categories, in the order they are shown.
  categories: ["Registration", "Agreements", "Certificates", "Income Tax"],

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
    }
  ]
};
