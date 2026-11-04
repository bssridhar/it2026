/*
 * Suggests a draft main objects clause from a short description of the business.
 * Built from standard clause wording for each kind of activity; runs offline.
 * The draft is a starting point and must be reviewed and edited before use.
 */
window.LLPObjects = (function () {
  "use strict";

  const ACTIVITIES = [
    { key: "trading", label: "Trading (wholesale / retail)" },
    { key: "manufacturing", label: "Manufacturing / processing" },
    { key: "services", label: "Services" },
    { key: "consultancy", label: "Consultancy / advisory" },
    { key: "contracting", label: "Contracts / works / installation" },
    { key: "import_export", label: "Import and export" },
    { key: "it", label: "Software / IT services" },
    { key: "ecommerce", label: "Online selling (e-commerce)" },
    { key: "agency", label: "Agency / distribution / franchise" },
  ];

  // Activities that usually need a licence, registration or membership of a profession.
  const REGULATED = /chartered accountan|\baudit(ing)?\b|\blegal\b|law firm|advocate|solicitor|\bmedical\b|\bhospitals?\b|\bclinics?\b|pharmac|\bdrugs?\b|\bbanking\b|\binsurance\b|\bchit\b|\bnidhi\b|\bnbfc\b|non[- ]banking|\bdeposits?\b|\blending\b|money ?lend|investment advi|stock ?brok|mutual fund|portfolio manage|liquor|alcohol|\barms\b|ammunition|explosive|\bschools?\b|\bcolleges?\b|telecom|broadcast/i;

  const tidy = s => (s || "").replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");

  /** Joins a free-text list ("a, b and c" / "a, b, c") into "a, b and c". */
  function listText(s) {
    const parts = tidy(s).split(/\s*(?:,|;|\band\b|\n)\s*/i).map(tidy).filter(Boolean);
    if (parts.length <= 1) return parts[0] || "";
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  }

  /**
   * opts: { activities: [keys], goods: "…", services: "…", customers: "…", abroad: bool }
   * Returns { lines: [clause, …], notes: [ … ] }
   */
  function draft(opts) {
    const notes = [];
    const G = listText(opts.goods), S = listText(opts.services);
    const C = tidy(opts.customers) ? ` for ${listText(opts.customers)}` : "";
    const geo = opts.abroad ? "in India and abroad" : "in India";
    const acts = (opts.activities || []).slice();
    if (!G && !S) return { lines: [], notes: ["Describe the goods or the services first."] };
    if (!acts.length) {
      if (G) acts.push("trading");
      if (S) acts.push("services");
      notes.push("No type of activity was ticked, so the draft assumes " + acts.map(a => ACTIVITIES.find(x => x.key === a).label.toLowerCase()).join(" and ") + ".");
    }
    const has = k => acts.includes(k);
    const needGoods = ["manufacturing", "trading", "import_export"].filter(has);
    if (needGoods.length && !G) notes.push("Trading, manufacturing and import/export clauses need the goods to be described; the services were used instead. Please edit.");
    if (has("services") && !S) notes.push("The services clause needs the services to be described; the goods were used instead. Please edit.");
    const goods = G || S, services = S || G;
    const svc = /services?$/i.test(services) ? services : services + " services";
    const L = [];

    if (has("manufacturing"))
      L.push(`To carry on ${geo} the business of manufacturing, producing, processing, fabricating, assembling, packing, testing and repairing ${goods}, and to set up, acquire, own and operate factories, workshops and plants for that purpose.`);
    if (has("trading"))
      L.push(`To carry on ${geo} the business of buying, selling, trading, wholesale and retail dealing, stocking, supplying and distributing ${goods}${C}, together with all related goods, accessories, spares and materials.`);
    if (has("services"))
      L.push(`To carry on ${geo} the business of providing ${svc}${C}, and all services incidental or related thereto.`);
    if (has("consultancy"))
      L.push(`To act as consultants and advisors and to provide consultancy, project management, technical, planning and advisory services in relation to ${services}${C}.`);
    if (has("contracting")) {
      const what = S ? S + (G ? `, including the supply and installation of ${G}` : "") : `the supply and installation of ${G}`;
      L.push(`To undertake contracts, sub-contracts, turnkey and works contracts for ${what}${C}, and the execution, commissioning, maintenance and repair of such works.`);
    }
    if (has("import_export"))
      L.push(`To import, export, source and procure ${goods} and related goods, materials, machinery and equipment, and to act as merchant exporters and importers of the same.`);
    if (has("it"))
      L.push(`To design, develop, customise, license, host, maintain and support software, applications, websites and digital solutions relating to ${services}, and to provide information technology and information technology enabled services.`);
    if (has("ecommerce"))
      L.push(G ? `To establish, own and operate online stores, websites, mobile applications and electronic market places for the sale and supply of ${G}, and to sell through third-party online platforms.`
               : `To establish, own and operate websites, mobile applications and online platforms for providing and booking ${svc}.`);
    if (has("agency"))
      L.push(`To act as agents, commission agents, distributors, stockists, dealers, franchisees and representatives of manufacturers, traders and service providers of ${goods} ${geo}.`);

    L.push("To enter into contracts, joint ventures, collaborations and other arrangements with any person, firm, limited liability partnership or body corporate, and to do all such other acts, deeds and things as are incidental or conducive to the attainment of the above objects.");

    if (REGULATED.test([opts.goods, opts.services, opts.customers].join(" ")))
      notes.push("The description mentions an activity that may need a licence or registration from a regulator, or may be open only to members of a profession. Check this before the objects are finalised.");
    return { lines: L, notes };
  }

  return { ACTIVITIES, draft };
})();
