import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = path.dirname(fileURLToPath(import.meta.url));
const palette = {
  navy: "#15243d",
  navyDeep: "#0d182a",
  navyMid: "#213653",
  gold: "#d4af57",
  goldInk: "#8b6814",
  paper: "#f7f9fc",
  white: "#ffffff",
  line: "#d8e0eb",
  muted: "#65748a",
};

const photos = {
  "toyota-1hz.jpg": {
    author: "Berndw~enwiki",
    credit: "CC BY 3.0",
    license: "https://creativecommons.org/licenses/by/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:TOYOTA_1HZ_engine_02.jpg",
  },
  "toyota-1kd-ftv.jpg": {
    author: "Iamjosemon",
    credit: "CC BY 4.0",
    license: "https://creativecommons.org/licenses/by/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:Toyota_1KD-FTV_Engine.jpg",
  },
  "nissan-yd25.jpg": {
    author: "AIMHO'S REBELLION 8490s",
    credit: "CC BY-SA 4.0",
    license: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:2021_Nissan_Terra_2.5_diesel_Premium_4WD_red_engine_view_in_Brunei.jpg",
  },
  "isuzu-6uz1.jpg": {
    author: "Mj-bird",
    credit: "CC BY-SA 3.0",
    license: "https://creativecommons.org/licenses/by-sa/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:Isuzu,_6UZ1-TCH,_9.8_liters,_Diesel_Engines.jpg",
  },
  "mitsubishi-4d56.jpg": {
    author: "Mr.choppers",
    credit: "CC BY-SA 3.0",
    license: "https://creativecommons.org/licenses/by-sa/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:1991_Mitsubishi_Pajero_2.5TD_Wagon_4D56_engine.jpg",
  },
  "mercedes-om642.jpg": {
    author: "160SX",
    credit: "CC BY-SA 3.0",
    license: "https://creativecommons.org/licenses/by-sa/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:OM642_TMS2005_01.JPG",
  },
  "engine-inspection.jpg": {
    author: "Shixart1985",
    credit: "CC BY 2.0",
    license: "https://creativecommons.org/licenses/by/2.0/",
    source: "https://commons.wikimedia.org/wiki/File:Car_engine_maintenance_involves_a_mechanic_inspecting_and_adjusting_parts_under_the_hood.jpg",
  },
};
const photoData = new Map();

const posters = [
  {
    slug: "the-right-engine",
    title: "First you ask. Then we search.",
    layout: "cover",
    photo: "toyota-1hz.jpg",
    eyebrow: "CUSTOMER-REQUESTED ENGINE SOURCING",
    headline: ["TELL US WHAT", "YOU NEED."],
    body: ["Share your engine code, VIN or vehicle details.", "We check availability and send you an option and quote."],
    detail: "You approve before we process shipment.",
  },
  {
    slug: "toyota-1hz",
    title: "Toyota 1HZ — sourced on request",
    layout: "split",
    photo: "toyota-1hz.jpg",
    eyebrow: "TOYOTA · 4.2L DIESEL",
    headline: ["THE TOYOTA 1HZ.", "SOURCED ON REQUEST."],
    body: ["Looking for a Land Cruiser 1HZ?", "We search, share an option and quote for your approval."],
    detail: "Example model only · availability checked per request.",
  },
  {
    slug: "hilux-1kd-ftv",
    title: "Looking for a Hilux 1KD-FTV?",
    layout: "editorial",
    photo: "toyota-1kd-ftv.jpg",
    eyebrow: "FOR HILUX & FORTUNER",
    headline: ["ASK US TO", "SEARCH FOR IT."],
    body: ["Share your 1KD-FTV and vehicle details.", "We'll check availability and quote an option before you decide."],
    detail: "You approve the option before we process it to ship.",
  },
  {
    slug: "the-right-fit",
    title: "You ask. We search. You decide.",
    layout: "route",
    photo: "engine-inspection.jpg",
    eyebrow: "START WITH YOUR VEHICLE",
    headline: ["YOU ASK.", "WE SEARCH.", "YOU DECIDE."],
    body: ["Share your engine code, VIN or vehicle details.", "Review the available option and quote before you approve."],
    detail: "No order or shipment before your approval.",
  },
  {
    slug: "dubai-to-zimbabwe",
    title: "From your request to shipment",
    layout: "route",
    photo: "isuzu-6uz1.jpg",
    eyebrow: "A CUSTOMER-APPROVED JOURNEY",
    headline: ["YOUR REQUEST.", "YOUR APPROVAL.", "THEN IT SHIPS."],
    body: ["We search in Dubai and share an available option.", "When you approve the quote, we process the shipment."],
    detail: "Request → source → review → approve → ship",
  },
  {
    slug: "inspect-before-export",
    title: "We search after you ask",
    layout: "cover",
    photo: "engine-inspection.jpg",
    eyebrow: "NO SPECULATIVE ENGINE STOCK",
    headline: ["NO STOCK.", "NO GUESSWORK."],
    body: ["Request the engine you need; we check availability.", "Review the option and landed quote before approval."],
    detail: "We process shipping only after you approve.",
  },
  {
    slug: "landed-cost",
    title: "Know the landed cost. Then decide.",
    layout: "cost",
    photo: "mercedes-om642.jpg",
    eyebrow: "A CLEARER WAY TO IMPORT",
    headline: ["KNOW THE", "LANDED COST."],
    body: ["Review the found engine option and itemised quote.", "Approve when you're ready; then we process shipping."],
    detail: "Quote first · your approval next · shipping after",
  },
  {
    slug: "no-guesswork",
    title: "We find an option. You choose.",
    layout: "split",
    photo: "mitsubishi-4d56.jpg",
    eyebrow: "SOURCING WITH YOUR APPROVAL",
    headline: ["WE FIND AN", "OPTION.", "YOU CHOOSE."],
    body: ["Tell us your vehicle and engine code.", "We'll check availability and share a quote to review."],
    detail: "Shipment starts after you approve the option.",
  },
  {
    slug: "diesel-sourcing",
    title: "Diesel engines. Searched on request.",
    layout: "dark",
    photo: "nissan-yd25.jpg",
    eyebrow: "DIESEL ENGINES",
    headline: ["DIESEL POWER.", "SOURCED ON", "YOUR REQUEST."],
    body: ["Share your model, engine code or vehicle details.", "We check availability and price before you decide."],
    detail: "No engines held in stock · availability confirmed per request",
  },
  {
    slug: "fleet-power",
    title: "Looking for a fleet engine?",
    layout: "technical",
    photo: "isuzu-6uz1.jpg",
    modelMark: "6UZ1",
    eyebrow: "COMMERCIAL & FLEET",
    headline: ["REQUEST IT.", "WE'LL SEARCH."],
    body: ["Tell us the truck, bus or fleet engine you need.", "We share an available option and quote for your approval."],
    detail: "Your approval comes before we process shipment.",
  },
  {
    slug: "one-sourcing-desk",
    title: "One sourcing journey. Your decision first.",
    layout: "arch",
    photo: "mercedes-om642.jpg",
    eyebrow: "FROM DUBAI TO ZIMBABWE",
    headline: ["ONE REQUEST.", "ONE QUOTE.", "YOUR DECISION."],
    body: ["We search for your engine in Dubai.", "We process shipping only after you approve the option."],
    detail: "Search · share · approve · ship",
  },
  {
    slug: "start-with-the-code",
    title: "It starts with your engine code",
    layout: "editorial",
    photo: "toyota-1kd-ftv.jpg",
    eyebrow: "A SIMPLE FIRST STEP",
    headline: ["START WITH", "YOUR CODE."],
    body: ["Send your engine code, VIN or vehicle model.", "We'll search, then send an option and quote to review."],
    detail: "You choose whether to proceed before shipment.",
  },
  {
    slug: "clear-costs",
    title: "See the full cost before you decide",
    layout: "cost",
    photo: "isuzu-6uz1.jpg",
    eyebrow: "NO HIDDEN LINES",
    headline: ["CLEAR COSTS.", "YOUR CALL."],
    body: ["Review the engine option, freight, duty and delivery.", "Approve the quote before we process shipping."],
    detail: "An itemised quote for your approval.",
  },
  {
    slug: "source-to-order",
    title: "No stock. We search on request.",
    layout: "arch",
    photo: "toyota-1hz.jpg",
    eyebrow: "CUSTOMER-REQUESTED ENGINE SOURCING",
    headline: ["NO STOCK.", "WE SEARCH", "ON REQUEST."],
    body: ["Tell us the engine and vehicle you need.", "Review the option and price before you decide."],
    detail: "We process your shipment only after approval.",
  },
  {
    slug: "toyota-1kd-ftv",
    title: "Toyota 1KD-FTV — ask us to search",
    layout: "technical",
    photo: "toyota-1kd-ftv.jpg",
    modelMark: "1KD-FTV",
    eyebrow: "TOYOTA · 3.0 D-4D",
    headline: ["LOOKING FOR", "A 1KD-FTV?"],
    body: ["We'll search for the specification you request.", "You approve the found option and quote before shipment."],
    detail: "Example model only · availability confirmed per request.",
  },
  {
    slug: "mitsubishi-4d56",
    title: "Mitsubishi 4D56 — availability checked on request",
    layout: "cover",
    photo: "mitsubishi-4d56.jpg",
    eyebrow: "MITSUBISHI · 2.5L DIESEL",
    headline: ["LOOKING FOR", "A 4D56?"],
    body: ["Tell us your vehicle and engine details.", "We'll check availability and quote an option."],
    detail: "If you approve, we process it for shipment.",
  },
  {
    slug: "nissan-yd25",
    title: "Nissan YD25 — let's check availability",
    layout: "dark",
    photo: "nissan-yd25.jpg",
    eyebrow: "NISSAN · 2.5L DIESEL",
    headline: ["LOOKING FOR", "A YD25?", "LET'S SEARCH."],
    body: ["Share the exact engine code and vehicle.", "We confirm a sourcing option and quote before you decide."],
    detail: "No shipment is processed before your approval.",
  },
  {
    slug: "mercedes-om642",
    title: "Mercedes OM642 — sourced by request",
    layout: "arch",
    photo: "mercedes-om642.jpg",
    eyebrow: "MERCEDES-BENZ · V6 DIESEL",
    headline: ["DETAILS FIRST.", "SEARCH NEXT.", "YOUR CHOICE."],
    body: ["Send your vehicle and OM642 details.", "We'll search and share an option and quote to review."],
    detail: "Shipment is processed only after you approve.",
  },
  {
    slug: "the-full-picture",
    title: "Review the option. Approve the quote.",
    layout: "cost",
    photo: "engine-inspection.jpg",
    eyebrow: "YOUR DECISION COMES FIRST",
    headline: ["REVIEW IT.", "THEN DECIDE."],
    body: ["We share the available engine option and landed cost.", "When you approve, we process it for shipment."],
    detail: "A quote is an option to review, not stock on a shelf.",
  },
  {
    slug: "zimosaka-autospares",
    title: "Request. Approve. Ship. Fit in Zimbabwe.",
    layout: "dark",
    photo: "isuzu-6uz1.jpg",
    eyebrow: "ZIMOSAKA AUTOSPARES",
    headline: ["SOURCED TO", "YOUR REQUEST.", "FITTED HERE."],
    body: ["You review and approve an available option before shipment.", "After arrival, our trusted mechanic fits the engine in Zimbabwe."],
    detail: "Request → approval → shipment → fitting in Zimbabwe",
  },
];

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function text(x, y, value, size, fill, options = {}) {
  const family = options.serif
    ? "Georgia, 'Times New Roman', serif"
    : "Arial, Helvetica, sans-serif";
  const weight = options.weight || 400;
  const anchor = options.anchor || "start";
  const letterSpacing = options.letterSpacing ?? 0;
  const opacity = options.opacity ?? 1;
  const style = options.italic ? 'font-style="italic"' : "";
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${letterSpacing}" text-anchor="${anchor}" opacity="${opacity}" ${style}>${escapeXml(value)}</text>`;
}

function lines(x, y, values, size, lineHeight, fill, options = {}) {
  return values.map((value, index) => text(x, y + index * lineHeight, value, size, fill, options)).join("");
}

function rect(x, y, width, height, fill, radius = 0, extra = "") {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${extra}/>`;
}

function image(poster, x, y, width, height, clip = "", preserve = "xMidYMid slice") {
  const clipAttribute = clip ? ` clip-path="url(#${clip})"` : "";
  const data = photoData.get(poster.photo);
  if (!data) {
    throw new Error(`Missing poster photo asset: ${poster.photo}`);
  }
  return `<image href="data:image/jpeg;base64,${data}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${preserve}"${clipAttribute}/>`;
}

function brand(x, y, inverse = false) {
  const ink = inverse ? palette.white : palette.navy;
  return `
    <g transform="translate(${x} ${y})">
      ${rect(0, 0, 52, 52, ink, 14)}
      <path d="M13 16h17L17 34h17" fill="none" stroke="${inverse ? palette.navyDeep : palette.paper}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="36" cy="35" r="7" fill="none" stroke="${palette.gold}" stroke-width="3"/>
      <path d="M31 8l2 4 4-2-2 4 4 2" fill="none" stroke="${palette.gold}" stroke-width="2.2" stroke-linecap="round"/>
    </g>
    ${text(x + 68, y + 28, "Zim", 26, ink, { weight: 800, letterSpacing: -0.8 })}
    ${text(x + 112, y + 28, "Osaka", 26, palette.gold, { weight: 800, letterSpacing: -0.8 })}
    ${text(x + 69, y + 48, "AUTOSPARES  ·  DUBAI TO ZIMBABWE", 9.5, inverse ? "#dbe3ee" : palette.muted, { weight: 700, letterSpacing: 1.15 })}
  `;
}

function eyebrow(x, y, value, fill = palette.goldInk, anchor = "start") {
  return text(x, y, value, 14, fill, { weight: 700, letterSpacing: 2.1, anchor });
}

function button(x, y, label, inverse = false) {
  const fill = inverse ? palette.gold : palette.navy;
  const ink = inverse ? palette.navyDeep : palette.white;
  return `
    ${rect(x, y, 360, 62, fill, 31)}
    ${text(x + 180, y + 39, label, 14, ink, { weight: 700, letterSpacing: 1.3, anchor: "middle" })}
    <path d="M${x + 321} ${y + 31}h14m-6-6 6 6-6 6" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function footer(poster, dark = false, y = 1242) {
  const rule = dark ? "#526078" : palette.line;
  const ink = dark ? "#dbe3ee" : palette.muted;
  const photo = photos[poster.photo];
  return `
    <path d="M72 ${y}H1008" stroke="${rule}" stroke-width="1"/>
    ${text(72, y + 31, "NO STOCK HELD · AVAILABILITY & PRICE CONFIRMED AFTER YOUR REQUEST", 11.5, ink, { weight: 600, letterSpacing: 0.45 })}
    <a href="${escapeXml(photo.source)}">
      ${text(72, y + 59, `PHOTO: ${photo.author} / WIKIMEDIA COMMONS`, 11.5, ink, { weight: 500, letterSpacing: 0.25 })}
    </a>
    <a href="${escapeXml(photo.license)}">
      ${text(72, y + 81, `LICENSE: ${photo.credit} · CROPPED & PLACED IN POSTER ARTWORK`, 11.5, ink, { weight: 500, letterSpacing: 0.25 })}
    </a>
  `;
}

function documentStart(poster, index) {
  const safeTitle = escapeXml(poster.title);
  const safeDescription = escapeXml(`${poster.body.join(" ")} ${poster.detail}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-labelledby="title desc">
  <title id="title">${safeTitle}</title>
  <desc id="desc">${safeDescription}</desc>
  <metadata>ZimOsaka AutoSpares poster ${String(index + 1).padStart(2, "0")} of 20. Photo and engine model are illustrative examples, not stock listings. See CREDITS.md for image attribution and license.</metadata>
  <defs>
    <linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.navyDeep}" stop-opacity=".16"/>
      <stop offset=".58" stop-color="${palette.navyDeep}" stop-opacity=".28"/>
      <stop offset="1" stop-color="${palette.navyDeep}" stop-opacity=".94"/>
    </linearGradient>
    <linearGradient id="fullShade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${palette.navyDeep}" stop-opacity=".96"/>
      <stop offset=".64" stop-color="${palette.navyDeep}" stop-opacity=".72"/>
      <stop offset="1" stop-color="${palette.navyDeep}" stop-opacity=".38"/>
    </linearGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M44 0H0V44" fill="none" stroke="${palette.gold}" stroke-opacity=".11" stroke-width="1"/>
    </pattern>
    <clipPath id="editorialFrame"><rect x="72" y="420" width="936" height="485" rx="18"/></clipPath>
    <clipPath id="routeFrame"><rect x="72" y="538" width="936" height="382" rx="18"/></clipPath>
    <clipPath id="costFrame"><rect x="562" y="385" width="446" height="488" rx="18"/></clipPath>
    <clipPath id="technicalFrame"><rect x="72" y="296" width="936" height="520" rx="18"/></clipPath>
    <clipPath id="archFrame"><path d="M620 1085V505c0-205 94-340 220-340s220 135 220 340v580Z"/></clipPath>
    <clipPath id="circleFrame"><circle cx="540" cy="620" r="325"/></clipPath>
  </defs>`;
}

function layoutCover(poster) {
  return `
    ${rect(0, 0, 1080, 1350, palette.paper)}
    ${image(poster, 0, 0, 1080, 710)}
    ${rect(0, 0, 1080, 710, "url(#photoShade)")}
    ${brand(72, 66, true)}
    ${eyebrow(76, 385, poster.eyebrow, palette.gold)}
    ${lines(72, 472, poster.headline, 70, 76, palette.white, { serif: true, weight: 700 })}
    <path d="M0 696c228 50 444 55 648 20s301-32 432 3v51H0Z" fill="${palette.paper}"/>
    <path d="M72 802h64" stroke="${palette.goldInk}" stroke-width="3"/>
    ${text(72, 847, poster.detail, 15, palette.goldInk, { weight: 700, letterSpacing: 1.05 })}
    ${lines(72, 913, poster.body, 23, 36, palette.navy, { weight: 400 })}
    ${button(72, 1058, "REQUEST AN ENGINE SEARCH")}
    ${footer(poster, false, 1227)}
  `;
}

function layoutSplit(poster) {
  return `
    ${rect(0, 0, 1080, 1350, palette.navy)}
    ${rect(0, 0, 552, 1170, palette.paper)}
    ${rect(570, 0, 510, 1170, palette.navyMid)}
    ${image(poster, 570, 0, 510, 1170, "", "xMidYMid slice")}
    ${rect(570, 0, 510, 1170, "url(#photoShade)")}
    ${rect(552, 0, 6, 1170, palette.gold)}
    ${brand(62, 70, false)}
    ${eyebrow(70, 252, poster.eyebrow, palette.goldInk)}
    ${lines(70, 357, poster.headline, 48, 58, palette.navy, { serif: true, weight: 700 })}
    <path d="M70 630h84" stroke="${palette.goldInk}" stroke-width="3"/>
    ${text(70, 684, poster.detail, 14, palette.navy, { weight: 700, letterSpacing: 0.7 })}
    ${lines(70, 748, poster.body, 19, 32, palette.navy, { weight: 400 })}
    ${button(70, 958, "REQUEST AN ENGINE SEARCH")}
    ${rect(0, 1170, 1080, 180, palette.navy)}
    ${footer(poster, true, 1200)}
  `;
}

function layoutEditorial(poster) {
  return `
    ${rect(0, 0, 1080, 1350, palette.paper)}
    ${brand(72, 62, false)}
    ${eyebrow(76, 206, poster.eyebrow)}
    ${lines(72, 288, poster.headline, 68, 76, palette.navy, { serif: true, weight: 700 })}
    ${image(poster, 72, 420, 936, 485, "editorialFrame")}
    ${rect(72, 420, 936, 485, "none", 18, `stroke="${palette.goldInk}" stroke-opacity=".5" stroke-width="2"`)}
    <circle cx="962" cy="868" r="46" fill="${palette.gold}"/>
    <path d="M943 868h38m-13-13 13 13-13 13" fill="none" stroke="${palette.navyDeep}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(72, 994, poster.detail, 14, palette.goldInk, { weight: 700, letterSpacing: 1.1 })}
    ${lines(72, 1040, poster.body, 18, 30, palette.navy, { weight: 400 })}
    ${button(72, 1137, "REQUEST AN ENGINE SEARCH")}
    ${footer(poster, false, 1235)}
  `;
}

function layoutRoute(poster) {
  const headlineSize = poster.headline.length >= 3 ? 60 : 67;
  const headlineLineHeight = poster.headline.length >= 3 ? 66 : 74;
  return `
    ${rect(0, 0, 1080, 1350, palette.paper)}
    ${brand(72, 62, false)}
    ${eyebrow(76, 194, poster.eyebrow)}
    ${lines(72, 275, poster.headline, headlineSize, headlineLineHeight, palette.navy, { serif: true, weight: 700 })}
    <path d="M102 480H978" fill="none" stroke="${palette.gold}" stroke-width="3"/>
    <circle cx="122" cy="480" r="13" fill="${palette.goldInk}"/>
    <circle cx="958" cy="480" r="13" fill="${palette.navy}"/>
    <path d="M930 469l28 11-28 11" fill="none" stroke="${palette.navy}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(122, 456, "DUBAI", 12, palette.navy, { weight: 700, letterSpacing: 1.6, anchor: "middle" })}
    ${text(958, 456, "ZIMBABWE", 12, palette.navy, { weight: 700, letterSpacing: 1.6, anchor: "middle" })}
    ${image(poster, 72, 538, 936, 382, "routeFrame")}
    ${rect(72, 538, 936, 382, "none", 18, `stroke="${palette.goldInk}" stroke-opacity=".45" stroke-width="2"`)}
    ${text(72, 985, poster.detail, 14, palette.goldInk, { weight: 700, letterSpacing: 0.65 })}
    ${lines(72, 1033, poster.body, 18, 30, palette.navy)}
    ${button(72, 1128, "REQUEST AN ENGINE SEARCH")}
    ${footer(poster, false, 1231)}
  `;
}

function layoutCost(poster) {
  const rowLabels = ["ENGINE & SUPPLIER", "FREIGHT + INSURANCE", "DUTY + VAT", "CLEARING + DELIVERY"];
  const rows = rowLabels.map((label, index) => `
    <path d="M96 ${548 + index * 82}H500" stroke="${palette.line}" stroke-width="1"/>
    ${text(96, 584 + index * 82, label, 12, palette.navy, { weight: 700, letterSpacing: 0.75 })}
    ${text(500, 584 + index * 82, "ITEMISED", 10.5, palette.goldInk, { weight: 700, letterSpacing: 0.8, anchor: "end" })}
  `).join("");
  return `
    ${rect(0, 0, 1080, 1350, palette.paper)}
    ${brand(72, 62, false)}
    ${eyebrow(76, 201, poster.eyebrow)}
    ${lines(72, 284, poster.headline, 66, 74, palette.navy, { serif: true, weight: 700 })}
    ${rect(72, 385, 458, 488, palette.white, 18, `stroke="${palette.line}" stroke-width="1.5"`)}
    ${text(96, 443, "YOUR LANDED-COST QUOTE", 12, palette.goldInk, { weight: 700, letterSpacing: 1.35 })}
    ${rows}
    ${image(poster, 562, 385, 446, 488, "costFrame")}
    ${rect(562, 385, 446, 488, "none", 18, `stroke="${palette.goldInk}" stroke-opacity=".5" stroke-width="2"`)}
    ${text(72, 944, poster.detail, 14, palette.goldInk, { weight: 700, letterSpacing: 0.65 })}
    ${lines(72, 995, poster.body, 18, 30, palette.navy)}
    ${button(72, 1104, "REQUEST AN ENGINE SEARCH")}
    ${footer(poster, false, 1231)}
  `;
}

function layoutTechnical(poster) {
  const model = (poster.modelMark || "ENGINE").toUpperCase();
  return `
    ${rect(0, 0, 1080, 1350, palette.navy)}
    ${rect(0, 0, 1080, 1180, "url(#grid)")}
    ${text(1000, 286, model, 84, palette.gold, { weight: 700, letterSpacing: 2, anchor: "end", opacity: 0.24 })}
    ${brand(72, 62, true)}
    ${eyebrow(76, 231, poster.eyebrow, palette.gold)}
    ${image(poster, 72, 296, 936, 520, "technicalFrame")}
    ${rect(72, 296, 936, 520, "none", 18, `stroke="${palette.gold}" stroke-opacity=".65" stroke-width="2"`)}
    <path d="M72 862h80" stroke="${palette.gold}" stroke-width="3"/>
    ${lines(72, 928, poster.headline, 55, 62, palette.white, { serif: true, weight: 700 })}
    ${lines(72, 1072, poster.body, 16, 25, "#dbe3ee")}
    ${button(72, 1146, "REQUEST AN ENGINE SEARCH", true)}
    ${footer(poster, true, 1237)}
  `;
}

function layoutDark(poster) {
  return `
    ${image(poster, 0, 0, 1080, 1350)}
    ${rect(0, 0, 1080, 1350, "url(#fullShade)")}
    <path d="M0 0h1080v18H0Z" fill="${palette.gold}"/>
    ${brand(72, 66, true)}
    ${eyebrow(76, 338, poster.eyebrow, palette.gold)}
    ${lines(72, 434, poster.headline, 70, 76, palette.white, { serif: true, weight: 700 })}
    <path d="M72 742h82" stroke="${palette.gold}" stroke-width="3"/>
    ${text(72, 794, poster.detail, 15, palette.gold, { weight: 700, letterSpacing: 1.1 })}
    ${lines(72, 860, poster.body, 21, 34, palette.white)}
    ${button(72, 1065, "REQUEST AN ENGINE SEARCH", true)}
    ${footer(poster, true, 1235)}
  `;
}

function layoutArch(poster) {
  return `
    ${rect(0, 0, 1080, 1350, palette.paper)}
    <path d="M594 1068V495c0-220 112-385 246-385s246 165 246 385v573Z" fill="${palette.navy}"/>
    ${image(poster, 620, 165, 440, 920, "archFrame", "xMidYMid slice")}
    <path d="M620 1085V505c0-205 94-340 220-340s220 135 220 340v580Z" fill="none" stroke="${palette.gold}" stroke-width="3"/>
    ${brand(72, 62, false)}
    ${eyebrow(76, 260, poster.eyebrow)}
    ${lines(72, 355, poster.headline, 48, 60, palette.navy, { serif: true, weight: 700 })}
    <path d="M72 612h62" stroke="${palette.goldInk}" stroke-width="3"/>
    ${text(72, 668, poster.detail, 13, palette.goldInk, { weight: 700, letterSpacing: 0.3 })}
    ${lines(72, 729, poster.body, 17, 29, palette.navy)}
    ${button(72, 968, "REQUEST AN ENGINE SEARCH")}
    ${footer(poster, false, 1235)}
  `;
}

const layouts = {
  cover: layoutCover,
  split: layoutSplit,
  editorial: layoutEditorial,
  route: layoutRoute,
  cost: layoutCost,
  technical: layoutTechnical,
  dark: layoutDark,
  arch: layoutArch,
};

function posterSvg(poster, index) {
  const layout = layouts[poster.layout];
  if (!layout) {
    throw new Error(`Unknown poster layout: ${poster.layout}`);
  }
  return `${documentStart(poster, index)}\n${layout(poster)}\n</svg>\n`;
}

function galleryHtml() {
  const cards = posters.map((poster, index) => {
    const number = String(index + 1).padStart(2, "0");
    const filename = `${number}-${poster.slug}.svg`;
    return `
      <article class="card">
        <a class="preview" href="${filename}" target="_blank" rel="noreferrer">
          <img src="${filename}" alt="${escapeXml(poster.title)}" loading="lazy">
        </a>
        <div class="card-copy">
          <span class="number">${number}</span>
          <h2>${escapeXml(poster.title)}</h2>
          <a class="download" href="${filename}" download>Download SVG <span aria-hidden="true">↗</span></a>
        </div>
      </article>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="${palette.navy}">
  <title>ZimOsaka AutoSpares — 20 premium engine posters</title>
  <style>
    :root { color-scheme: light; --navy: ${palette.navy}; --gold: ${palette.goldInk}; --paper: ${palette.paper}; --line: ${palette.line}; --muted: ${palette.muted}; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--navy); font: 16px/1.5 Arial, Helvetica, sans-serif; }
    header { padding: clamp(2rem, 6vw, 5rem) max(24px, calc((100vw - 1280px) / 2)); background: var(--navy); color: white; }
    .eyebrow { color: #e2c47d; font-size: .72rem; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
    h1 { max-width: 760px; margin: .6rem 0 1rem; font: 600 clamp(2.4rem, 6vw, 5rem)/.98 Georgia, 'Times New Roman', serif; letter-spacing: -.04em; }
    header p { max-width: 620px; color: #dbe3ee; }
    .actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1.5rem; }
    .actions a { display: inline-flex; align-items: center; padding: .8rem 1.15rem; border-radius: 999px; background: var(--gold); color: var(--navy); font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-decoration: none; text-transform: uppercase; }
    .actions a.secondary { border: 1px solid #718097; background: transparent; color: white; }
    main { width: min(1280px, calc(100% - 48px)); margin: 2rem auto 5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap: 1.25rem; }
    .card { overflow: hidden; border: 1px solid var(--line); border-radius: 12px; background: white; box-shadow: 0 12px 32px -28px rgba(21,36,61,.45); }
    .preview { display: block; background: #e5eaf1; }
    .preview img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; }
    .card-copy { padding: 1rem 1.15rem 1.15rem; }
    .number { color: var(--gold); font-size: .7rem; font-weight: 700; letter-spacing: .14em; }
    .card h2 { min-height: 3em; margin: .5rem 0 1rem; font: 600 1.15rem/1.25 Georgia, 'Times New Roman', serif; }
    .download { display: inline-flex; gap: .5rem; color: var(--navy); font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-decoration: none; text-transform: uppercase; }
    .download:hover { color: var(--gold); }
    footer { padding: 2rem 24px; border-top: 1px solid var(--line); color: var(--muted); font-size: .84rem; text-align: center; }
    @media (max-width: 540px) { main { width: calc(100% - 32px); } .grid { gap: .85rem; } }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">ZimOsaka AutoSpares · Campaign 01</div>
    <h1>Twenty ways to get the right engine moving.</h1>
    <p>Premium posters featuring illustrative engine photos. No engines are held in stock: request an engine, review its availability and quote, and approve before shipment is processed. Fitting is available in Zimbabwe with our trusted mechanic after arrival.</p>
    <div class="actions">
      <a href="print-all.html">Open A4 print set</a>
      <a class="secondary" href="CREDITS.md">Photo credits & licenses</a>
    </div>
  </header>
  <main><div class="grid">${cards}</div></main>
  <footer>Illustrative photos and model names only. We search on request, share the option and quote for your approval, then process shipment. Fitting is available in Zimbabwe with our trusted mechanic after arrival.</footer>
</body>
</html>
`;
}

function printHtml() {
  const pages = posters.map((poster, index) => {
    const number = String(index + 1).padStart(2, "0");
    return `<section class="page"><img src="${number}-${poster.slug}.svg" alt="${escapeXml(poster.title)}"></section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ZimOsaka AutoSpares — A4 poster set</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #eef2f7; }
    .toolbar { position: sticky; top: 0; z-index: 1; padding: 14px; background: #15243d; color: #fff; font: 14px/1.4 Arial, sans-serif; text-align: center; }
    .toolbar button { margin-left: 12px; padding: 10px 18px; border: 0; border-radius: 999px; background: #d4af57; color: #15243d; font-weight: 700; cursor: pointer; }
    .page { display: flex; width: 210mm; height: 297mm; margin: 24px auto; align-items: center; justify-content: center; background: white; box-shadow: 0 8px 36px rgba(21,36,61,.2); break-after: page; page-break-after: always; }
    .page img { display: block; width: 210mm; height: 262.5mm; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    @media print {
      html, body { background: white; }
      .toolbar { display: none; }
      .page { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">20 posters · A4 portrait · fit to page <button onclick="window.print()">Print / save as PDF</button></div>
  ${pages}
</body>
</html>
`;
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  for (const filename of Object.keys(photos)) {
    const bytes = await readFile(path.join(outputDirectory, "assets", filename));
    photoData.set(filename, bytes.toString("base64"));
  }
  for (const [index, poster] of posters.entries()) {
    const number = String(index + 1).padStart(2, "0");
    const filename = `${number}-${poster.slug}.svg`;
    await writeFile(path.join(outputDirectory, filename), posterSvg(poster, index), "utf8");
  }
  await writeFile(path.join(outputDirectory, "index.html"), galleryHtml(), "utf8");
  await writeFile(path.join(outputDirectory, "print-all.html"), printHtml(), "utf8");
  console.log(`Generated ${posters.length} SVG posters, a gallery and an A4 print set.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
