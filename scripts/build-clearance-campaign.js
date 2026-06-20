#!/usr/bin/env node
'use strict';

/*
 * Zale IT — Weekly featured-hardware campaign builder.
 *
 * Fetches MMT's MAIN stock feed (Id=2), curates a 4-product basket
 * (1 latest-tech laptop, 1 highest-margin laptop, 2 high-margin laptop
 * accessories), generates a branded HTML email led by a use-case story per
 * product, writes it to campaign-clearance.html, and (when BREVO_API_KEY is
 * present) pushes it to Brevo as a DRAFT email campaign — never sending — then
 * emails support@ to review.
 *
 * Pricing / privacy: the feed's RRPInc is GST-inclusive; the email shows the
 * ex-GST figure (RRPInc / 1.1) divided exactly ONCE here (we read raw RRPInc
 * from the live feed, never catalogue-data.json's pre-divided rrp). YourPrice
 * (trade price) and the computed margin are used ONLY to rank products in
 * memory and are then discarded — never written to the HTML, the email, the
 * Brevo payload, or any log line.
 *
 * Local testing (the live MMT host is firewalled in some envs): point
 * MMT_FEED_FILE (or MMT_MAIN_FILE) at a local XML file to parse it instead of
 * hitting the network, e.g.
 *   MMT_FEED_FILE=./fixture-main.xml node scripts/build-clearance-campaign.js
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------

const TOKEN = '2f8788cc-74f8-439c-b950-60f5c31720fb';
const FEED_FILTERS =
  '&af[]=ai&af[]=dp&af[]=tn&af[]=si&af[]=li&af[]=ln&af[]=wt&af[]=um&af[]=st&af[]=sn&af[]=et&af[]=bc';

const MAIN_FEED_URL =
  `https://www.mmt.com.au/dwapi/Feeds/GetFeedOutput?Id=2&lt=s&ft=xml&tk=${TOKEN}${FEED_FILTERS}`;

// Brevo "Laptop & Devices" list — confirmed ID 3.
const TARGET_LIST_ID = 3;
// Verified Brevo sender (mail.zaleit.com.au subdomain — DKIM + DMARC authenticated).
const SENDER = { name: 'Zale IT', email: 'marketing@mail.zaleit.com.au' };
const NOTIFY_TO = 'support@zaleit.com.au';
// Per-product "Buy Now" buttons open a pre-filled email to this address.
const SALES_EMAIL = 'sales@zaleit.com.au';
const ENQUIRE_URL = 'https://zaleit.com.au/?service=Hardware#contact';
const FEATURE_COUNT = 4;
const ACCENT = '#76b900'; // site green
const INK = '#0e1b2a'; // dark header
const MUTED_BADGE = '#41566e'; // accessory "ADD-ON" badge

// --- Easily-editable copy (named constants) --------------------------------

// Email title shown in the header inside the email.
const EMAIL_TITLE = 'Laptops worth a look this week';

// Subhead under the title.
const EMAIL_SUBHEAD =
  'A curated pick of laptops and the gear that goes with them, chosen by our team.';

// Honest "special pricing" framing for the intro — NOT a fake discount.
// Deliberately avoids "% off" / "sale" / "was/now" (those imply markdowns we
// aren't showing and trip spam filters). We only convey that pricing is
// competitive because it's sourced through us as a reseller.
const SPECIAL_PRICING_LINE =
  'Sharp, competitive pricing through Zale IT — sourced direct so you don’t overpay.';

// Subject-line pool — rotated weekly (deterministic by ISO week number, so it's
// stable within a week and varies across weeks). Index = isoWeek % length.
const SUBJECT_LINES = [
  'Thinking about a new laptop?',
  'Need a laptop that keeps up?',
  'Is it time to upgrade the laptops?',
  'Looking for your next work laptop?',
  'A few laptops worth a look this week',
];

const OUT_FILE = path.join(__dirname, '..', 'campaign-clearance.html');

// --- Selection categories (editable) ---------------------------------------
// True laptop categories — matched EXACTLY against CategoryName (lowercased).
// NOT a startsWith: that would wrongly match "Notebook Accessories".
const LAPTOP_CATEGORIES = ['notebooks', 'notebooks workstation'];

// Laptop-relevant accessory categories — an allow-list matched EXACTLY against
// CategoryName (lowercased). We deliberately do NOT keyword-match product names,
// and we deliberately EXCLUDE "Bags, Cases & Covers" / "Commercial Bags, Cases &
// Covers" (polluted with iPad / tablet / Chromebook cases and stylus holders).
const ACCESSORY_CATEGORIES = [
  'docking stations',
  'laptop docking and cradles',
  'keyboards',
  'keyboards & mice',
  'mice',
  'usb web cams',
];

// Soft priority for accessories. Tier 1 = genuinely additive to a laptop;
// tier 2 = redundant with a laptop's built-in (a standalone webcam). Tier is a
// HARD gate: a tier-2 item is only chosen when tier 1 can't fill the slots.
const ACCESSORY_PRIORITY = {
  'docking stations': 1,
  'laptop docking and cradles': 1,
  'keyboards & mice': 1,
  'mice': 1,
  'keyboards': 1,
  'usb web cams': 2,
};

// Maps an accessory CategoryName (lowercased) to a STORY_TEMPLATES key.
const ACCESSORY_STORY = {
  'docking stations': 'dock',
  'laptop docking and cradles': 'dock',
  'keyboards': 'inputDevice',
  'keyboards & mice': 'inputDevice',
  'mice': 'inputDevice',
  'usb web cams': 'callDevice',
};

// ----------------------------------------------------------------------------
// STORY TEMPLATES
// ----------------------------------------------------------------------------
//
// Each product block LEADS with a 2-3 sentence use-case story, chosen by type
// and filled from per-product data. Placeholders: {name}, {brand}, {cpu},
// {ram}, {storage}, {screen}, plus {specPhrase} (a natural-language summary of
// whatever specs parsed). Spec placeholders live in their OWN sentence so that
// when a spec is missing the whole sentence is dropped — no dangling
// "built with  and ". A variant is chosen deterministically by product code
// (stable per product, varied across the basket). See fillStory().
const STORY_TEMPLATES = {
  // Mobile workstations: CAD, 3D, video, dev/data — heavy compute.
  workstationLaptop: [
    "When the workload is CAD drawings, 3D rendering or multi-stream video editing, the {name} keeps pace. Powered by {specPhrase}, it chews through heavy compute and large data sets without the spinning wheel. A genuine mobile workstation for engineers, editors and developers.",
    "Some jobs need real horsepower — simulation, rendering, compiling, crunching data. The {name} is built for exactly that. It's configured with {specPhrase} to keep demanding applications responsive all day. Give your power users a machine that won't hold them back.",
    "Designed for professionals who can't wait on their tools, the {name} delivers workstation-grade performance in a portable shell. Under the hood sits {specPhrase}, ready for 3D, video and data-heavy workflows. Take the studio anywhere the work happens.",
  ],
  // Business / ultrabook: hybrid work, meetings, travel, security, battery.
  businessLaptop: [
    "The {name} is made for hybrid work — light enough for the commute, secure enough for IT, and ready for back-to-back meetings. With {specPhrase}, it stays quick through email, docs and video calls. Ideal for teams moving between home, office and the road.",
    "For staff who work everywhere, the {name} balances portability, security and all-day battery. It runs {specPhrase}, so multitasking across browser tabs, spreadsheets and Teams stays smooth. A dependable everyday laptop your whole business can standardise on.",
    "Meetings, travel, hot-desking — the {name} handles a modern workday with ease. Built around {specPhrase}, it pairs enterprise-grade security with the battery life to leave the charger behind. A clean, professional choice for hybrid teams.",
  ],
  // Docking stations: single-cable desk, multi-monitor, hot-desking.
  dock: [
    "Turn any desk into a full workstation with the {name}. One cable powers the laptop and drives multiple monitors, keyboard, mouse and network — perfect for hot-desking and tidy setups. Plug in, get to work, unplug and go.",
    "The {name} ends cable clutter for good. A single connection adds dual displays, wired ethernet and all your peripherals, so shared desks and home offices stay clean and consistent. Ideal for hybrid teams that dock and undock daily.",
    "Give every desk the same one-cable simplicity with the {name}. Connect once for charging, multi-monitor output and accessories — no more hunting for adapters. A small upgrade that makes hot-desking effortless.",
  ],
  // Keyboards / mice: ergonomics, wireless declutter, productivity.
  inputDevice: [
    "The {name} brings comfort to every working hour. Ergonomic design and wireless freedom cut the clutter and keep hands relaxed through long sessions. A small change that pays off in all-day productivity.",
    "Upgrade the everyday with the {name}. Responsive, quiet and wireless, it declutters the desk and keeps focus on the work — not the cables. Comfort and precision your team will feel from day one.",
    "Built for people who type and click all day, the {name} blends ergonomics with wireless convenience. Less strain, fewer cables, more done. An easy win for any workspace.",
  ],
  // Bags / sleeves / cases: protection on the commute, professional look.
  bag: [
    "Protect the daily carry with the {name}. Padded protection guards laptops against the knocks of the commute, while a clean, professional finish looks right in any meeting. Travel-ready peace of mind.",
    "The {name} keeps hardware safe from desk to door to destination. Smart padding shields against bumps and drops, and the sharp design keeps things looking professional. Made for people on the move.",
    "Commute with confidence using the {name}. Secure, well-padded protection meets a tidy professional look, so your laptop arrives ready for business. Everyday protection that travels well.",
  ],
  // Headsets / webcams: clear calls, remote meetings, hybrid teams.
  callDevice: [
    "Make every call clear with the {name}. Crisp audio and video cut through the noise of remote and hybrid meetings, so conversations stay sharp and professional. Fewer 'you're on mute' moments, better calls.",
    "The {name} levels up remote meetings. Clean sound and a clear picture help hybrid teams connect like they're in the same room. A simple upgrade that makes every call count.",
    "For teams that live in video calls, the {name} delivers the clarity that matters. Sharp audio and a professional image keep meetings smooth from home or office. Communication your colleagues will notice.",
  ],
  // Generic fallback for any unmatched accessory — clean, value-led.
  generic: [
    "The {name} is a practical, great-value addition to any setup. Reliable, easy to deploy and ready to work from day one. A smart pick for teams that want more without overspending.",
    "Get dependable performance and clean value with the {name}. It does its job well and fits straight into your existing kit. An easy yes for budget-conscious upgrades.",
    "Simple, useful and well-priced, the {name} earns its place on the desk. Straightforward to roll out and built to last. Quality that respects the budget.",
  ],
};

// ----------------------------------------------------------------------------
// Parsing helpers (same approach as scripts/fetch-stock.js)
// ----------------------------------------------------------------------------

// Deep, case-insensitive search for the first non-empty scalar whose key
// matches `nameLower`, anywhere in the nested product node.
function deepFind(node, nameLower) {
  if (node == null) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const v = deepFind(item, nameLower);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  if (typeof node === 'object') {
    for (const [k, val] of Object.entries(node)) {
      if (
        k.toLowerCase() === nameLower &&
        (typeof val === 'string' || typeof val === 'number') &&
        String(val).trim() !== ''
      ) {
        return String(val).trim();
      }
    }
    for (const val of Object.values(node)) {
      const v = deepFind(val, nameLower);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

// First present, non-empty value among candidate keys (case-insensitive, any depth).
function pick(obj, ...keys) {
  for (const key of keys) {
    const v = deepFind(obj, key.toLowerCase());
    if (v !== undefined) return v;
  }
  return '';
}

// Recursively collect every object that has an MMTCode field (a product node).
function collectProducts(node, acc) {
  if (Array.isArray(node)) {
    for (const item of node) collectProducts(item, acc);
  } else if (node && typeof node === 'object') {
    const hasCode = Object.keys(node).some((k) => k.toLowerCase() === 'mmtcode');
    if (hasCode) {
      acc.push(node);
      return acc; // don't recurse into a product node
    }
    for (const v of Object.values(node)) collectProducts(v, acc);
  }
  return acc;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ----------------------------------------------------------------------------
// Fetch + map
// ----------------------------------------------------------------------------

async function getFeedXml() {
  const localFile = process.env.MMT_MAIN_FILE || process.env.MMT_FEED_FILE || '';
  if (localFile) {
    console.log(`Reading main feed from local file: ${localFile}`);
    return fs.readFileSync(localFile, 'utf8');
  }
  console.log('Fetching main feed…');
  const res = await fetch(MAIN_FEED_URL, { headers: { Accept: 'application/xml, text/xml, */*' } });
  if (!res.ok) {
    throw new Error(`main feed request failed: HTTP ${res.status} ${res.statusText}`);
  }
  return res.text();
}

const parser = new xml2js.Parser({
  explicitArray: false,
  mergeAttrs: true,
  trim: true,
  tagNameProcessors: [xml2js.processors.stripPrefix],
  attrNameProcessors: [xml2js.processors.stripPrefix],
});

// Map a raw product node to the internal shape. NOTE: yourPrice/rrpInc are kept
// here only so we can rank by margin; they are dropped before rendering.
function mapProduct(p) {
  return {
    code: pick(p, 'MMTCode'),
    name: pick(p, 'ShortDescription'),
    brand: pick(p, 'ManufacturerName'),
    parentCategory: pick(p, 'ParentCategoryName'),
    category: pick(p, 'CategoryName'),
    rrpInc: parseFloat(pick(p, 'RRPInc')) || 0,
    yourPrice: parseFloat(pick(p, 'YourPrice')) || 0,
    availability: parseInt(pick(p, 'Availability'), 10) || 0,
    // The main feed populates one of these image fields (matches fetch-stock.js).
    image: pick(p, 'LargeImageURL', 'HiresImageURL', 'ThumbnailImageURL'),
    description: pick(p, 'LongDescription'),
  };
}

async function loadProducts() {
  const xml = await getFeedXml();
  const parsed = await parser.parseStringPromise(xml);
  const raw = collectProducts(parsed, []);
  console.log(`Parsed ${raw.length} products from main feed.`);
  return raw.map(mapProduct);
}

// ----------------------------------------------------------------------------
// Classification
// ----------------------------------------------------------------------------

// True laptop iff CategoryName is EXACTLY one of LAPTOP_CATEGORIES. This
// excludes "Notebook Accessories" (stylus pens, tethers, etc.) entirely.
function isLaptopDevice(p) {
  return LAPTOP_CATEGORIES.includes((p.category || '').trim().toLowerCase());
}

// Box-damaged / open-box / refurbished units must never appear in the email.
function isExcludedUnit(name) {
  return /box damage|box damaged|open box|damaged|b-grade|refurb|refurbished|ex-demo|ex demo/i.test(
    name || ''
  );
}

// Returns the accessory CategoryName (lowercased) if it's an allow-listed,
// laptop-relevant accessory, else null. NO name-keyword matching.
function accessoryCategory(p) {
  const c = (p.category || '').trim().toLowerCase();
  return ACCESSORY_CATEGORIES.includes(c) ? c : null;
}

function isAccessory(p) {
  return !isLaptopDevice(p) && accessoryCategory(p) !== null;
}

// Priority tier for an accessory (lower = preferred). Unknown allow-listed
// categories default to tier 1 (treated as additive).
function accessoryTier(p) {
  return ACCESSORY_PRIORITY[accessoryCategory(p)] || 1;
}

// Story type for a product (drives STORY_TEMPLATES selection).
function storyType(p) {
  if (isLaptopDevice(p)) {
    const t = `${p.category} ${p.name}`.toLowerCase();
    if (/workstation|zbook|\bpro\b/.test(t)) return 'workstationLaptop';
    return 'businessLaptop';
  }
  const key = ACCESSORY_STORY[accessoryCategory(p)];
  return key && STORY_TEMPLATES[key] ? key : 'generic';
}

// ----------------------------------------------------------------------------
// Spec extraction (laptops only) — PARSE THE NAME, best-effort.
// ----------------------------------------------------------------------------
//
// Specs live in the product NAME (a comma-delimited tail), not the marketing
// description. We extract only tokens LITERALLY PRESENT in the name and never
// fabricate. Any field not found is omitted entirely.
function parseSpecs(name) {
  const n = String(name || '');
  const specs = {};

  // CPU — HP-style "U7-255H"/"U5-225U"/"U9-..."; Intel Core Ultra/Core i;
  // AMD Ryzen; Qualcomm Snapdragon X.
  let m;
  if ((m = n.match(/\bCore\s+Ultra\s+[579][\w-]*/i))) specs.cpu = `Intel ${m[0].replace(/\s+/g, ' ')}`;
  else if ((m = n.match(/\b[Uu][579]-\d{3}[A-Z]?\b/))) specs.cpu = `Intel ${m[0].toUpperCase()}`;
  else if ((m = n.match(/\bCore\s+i[3579][- ]?\d{3,5}[A-Z]*\b/i))) specs.cpu = `Intel ${m[0]}`;
  else if ((m = n.match(/\bi[3579]-\d{3,5}[A-Z]*\b/i))) specs.cpu = `Intel Core ${m[0]}`;
  else if ((m = n.match(/\bRyzen\s+[3579][\w\s-]*?\d{3,4}[A-Z]*\b/i)))
    specs.cpu = `AMD ${m[0].replace(/\s+/g, ' ').trim()}`;
  else if ((m = n.match(/\bRyzen\s+[3579]\b/i))) specs.cpu = `AMD ${m[0]}`;
  else if ((m = n.match(/\bSnapdragon\s+X[\w\s-]*\b/i))) specs.cpu = m[0].replace(/\s+/g, ' ').trim();

  // RAM / storage — capacity tokens in order. In "32GB, 512GB" the first GB
  // value is RAM and the second (GB/TB) is storage.
  const caps = [...n.matchAll(/\b(\d{1,4})\s?(GB|TB)\b/gi)].map((x) => ({
    value: parseInt(x[1], 10),
    unit: x[2].toUpperCase(),
    raw: `${x[1]}${x[2].toUpperCase()}`,
  }));
  if (caps.length >= 2) {
    specs.ram = caps[0].raw; // first = RAM
    specs.storage = caps[1].raw; // second = storage
  } else if (caps.length === 1) {
    const c = caps[0];
    // Lone token: TB or large GB → storage; small GB → RAM (best-effort).
    if (c.unit === 'TB' || c.value >= 128) specs.storage = c.raw;
    else specs.ram = c.raw;
  }

  // Screen — NN" plus an adjacent panel token if present.
  if ((m = n.match(/\b(\d{2})"\s*([A-Z]{2,5})?/))) {
    const panel = m[2] && /^(WUXGA|FHD|OLED|UHD|QHD|WQXGA|WQHD)$/i.test(m[2]) ? ` ${m[2].toUpperCase()}` : '';
    specs.screen = `${m[1]}"${panel}`;
  }

  return specs;
}

// Render the dedicated spec line shown under a laptop story, e.g.
// "Intel U7-255H · 32GB RAM · 512GB SSD · 14\" WUXGA". Missing fields omitted.
function specLine(specs) {
  const parts = [];
  if (specs.cpu) parts.push(specs.cpu);
  if (specs.ram) parts.push(`${specs.ram} RAM`);
  if (specs.storage) parts.push(`${specs.storage} SSD`);
  if (specs.screen) parts.push(specs.screen);
  return parts.join(' · ');
}

// Natural-language spec phrase woven into the story, e.g.
// "Intel U7-255H, 32GB RAM, 512GB SSD and a 14\" WUXGA display". Empty if no
// specs parsed (the story's spec sentence is then dropped — see fillStory).
function specPhrase(specs) {
  const parts = [];
  if (specs.cpu) parts.push(specs.cpu);
  if (specs.ram) parts.push(`${specs.ram} RAM`);
  if (specs.storage) parts.push(`${specs.storage} SSD`);
  if (specs.screen) parts.push(`a ${specs.screen} display`);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// ----------------------------------------------------------------------------
// Selection
// ----------------------------------------------------------------------------

// margin % — internal ranking only. Never surfaced.
function marginPct(p) {
  if (!(p.rrpInc > 0)) return -Infinity;
  return (p.rrpInc - p.yourPrice) / p.rrpInc;
}

function byMarginDesc(a, b) {
  return marginPct(b) - marginPct(a);
}

// Heuristic "latest tech" score: count signals of a modern AI-era laptop in the
// name + description. Higher = newer-feeling. This is a heuristic, not a spec
// lookup — it just biases the hero pick toward current-gen machines.
function latestTechScore(p) {
  const t = `${p.name} ${p.description}`.toLowerCase();
  const signals = [
    /core ultra/, /\bultra [579]\b/, /\b[u][579]-/, /snapdragon/, /\bai pc\b/, /\bai\b/,
    /\bnpu\b/, /\btops\b/, /copilot/, /g1i|gen 1i/, /wuxga|oled/, /rtx 50/, /ddr5/, /wi-?fi 7/,
  ];
  return signals.reduce((s, re) => s + (re.test(t) ? 1 : 0), 0);
}

// hero ordering: latest-tech score desc, tie-break by highest RRP.
function byLatestTechDesc(a, b) {
  return latestTechScore(b) - latestTechScore(a) || b.rrpInc - a.rrpInc;
}

// Pick up to n accessories. Tier is a HARD gate: tier 1 is filled before tier 2
// is considered at all (so a webcam is only chosen when there aren't enough
// tier-1 accessories). Within a tier we prefer DIFFERENT categories first
// (dock + mouse beats dock + dock), then backfill that tier by margin before
// dropping to the next tier.
function pickVariedAccessories(pool, n) {
  const out = [];
  const tiers = [...new Set(pool.map(accessoryTier))].sort((a, b) => a - b);
  for (const tier of tiers) {
    if (out.length >= n) break;
    const tierPool = pool.filter((p) => accessoryTier(p) === tier).sort(byMarginDesc);
    const usedCats = new Set();
    // First: distinct categories by margin.
    for (const p of tierPool) {
      if (out.length >= n) break;
      const cat = accessoryCategory(p);
      if (!usedCats.has(cat)) {
        out.push(p);
        usedCats.add(cat);
      }
    }
    // Then: backfill remaining slots from THIS tier (same category allowed)
    // before moving to the next tier.
    for (const p of tierPool) {
      if (out.length >= n) break;
      if (!out.includes(p)) out.push(p);
    }
  }
  return out;
}

// Returns up to FEATURE_COUNT products, each tagged with { role, badge }.
function selectFeatured(products) {
  const inStock = products.filter((p) => p.availability > 0 && !isExcludedUnit(p.name));
  if (inStock.length === 0) return [];

  const laptops = inStock.filter(isLaptopDevice);
  // No real laptops → skip the week (don't build an accessory-only basket).
  if (laptops.length === 0) return [];

  const selected = [];
  const seen = new Set();
  const take = (p, role, badge) => {
    if (!p || !p.code || seen.has(p.code)) return false;
    seen.add(p.code);
    selected.push({ ...p, role, badge });
    return true;
  };

  // 1. Hero laptop — best "latest tech" signal.
  const hero = laptops.slice().sort(byLatestTechDesc)[0];
  take(hero, 'hero', 'LATEST TECH');

  // 2. Value laptop — highest margin among remaining laptops.
  const value = laptops.filter((p) => !seen.has(p.code)).sort(byMarginDesc)[0];
  take(value, 'value', 'BEST VALUE');

  // 3 & 4. Accessories — allow-listed categories only, tier-then-margin with
  // category diversity. Slots = whatever the laptops didn't fill (2 laptops → 2
  // accessories; 1 laptop → 3). If no accessories match, ship the laptops only.
  const accSlots = FEATURE_COUNT - selected.length;
  const accPool = inStock
    .filter((p) => isAccessory(p) && !seen.has(p.code))
    .sort(byMarginDesc);
  for (const p of pickVariedAccessories(accPool, accSlots)) {
    take(p, 'accessory', 'ADD-ON');
  }

  return selected;
}

// ----------------------------------------------------------------------------
// Public-safe view (strips yourPrice / margin entirely)
// ----------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blurbify(desc) {
  const t = String(desc || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= 120) return t;
  let cut = t.slice(0, 120);
  const sp = cut.lastIndexOf(' ');
  if (sp > 40) cut = cut.slice(0, sp);
  return cut + '…';
}

function formatExGst(rrpInc) {
  // Single division: raw inclusive RRPInc → ex-GST. No double-division.
  const ex = round2(rrpInc / 1.1);
  return 'ex GST $' + ex.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Encode spaces (and other unsafe path chars) in an image URL's PATH only, so
// MMT URLs like ".../Product assets/Media 1.jpg" render in email clients.
function encodeImageUrl(u) {
  if (!u) return '';
  try {
    const url = new URL(u);
    url.pathname = url.pathname
      .split('/')
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join('/');
    return url.toString();
  } catch (_) {
    return String(u).replace(/ /g, '%20');
  }
}

// "Buy Now" mailto with a pre-filled subject + body. NAME and CODE are
// URL-encoded; newlines become %0D%0A via encodeURIComponent.
function buyNowUrl(name, code) {
  const subject = `Purchase enquiry: ${name}`;
  const body =
    `Hi Zale IT,\r\n\r\n` +
    `I'd like to buy: ${name} (model ${code}).\r\n\r\n` +
    `Please confirm availability and send a quote.\r\n\r\n` +
    `Thanks`;
  return `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Stable hash of a string → non-negative integer (deterministic variant pick).
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Fill a story template. Substitutes {tokens} with per-product values (HTML-
// escaped). Sentences containing a token whose value is empty are DROPPED
// entirely, so missing specs never leave dangling text. {name}/{brand} are
// always present, so their sentences always survive.
function fillStory(template, values) {
  const sentences = template.split(/(?<=[.!?])\s+/);
  const kept = [];
  for (const sentence of sentences) {
    const tokens = [...sentence.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (tokens.some((t) => !values[t])) continue; // drop sentence with missing data
    kept.push(sentence.replace(/\{(\w+)\}/g, (_, t) => values[t]));
  }
  return kept.join(' ');
}

// Assign a story-variant index to each product. Deterministic by product code,
// but de-duplicated within the basket so two same-type products don't reuse the
// same variant (satisfies "stable per product, varied across the basket").
function assignVariantIndices(products) {
  const byCode = new Map();
  const usedByType = new Map();
  for (const p of products) {
    const type = storyType(p);
    const len = (STORY_TEMPLATES[type] || STORY_TEMPLATES.generic).length;
    const used = usedByType.get(type) || new Set();
    let idx = hashCode(p.code || p.name) % len;
    // Bump to the next free variant for this type if already taken in this basket.
    for (let i = 0; i < len && used.has(idx); i++) idx = (idx + 1) % len;
    used.add(idx);
    usedByType.set(type, used);
    byCode.set(p.code, idx);
  }
  return byCode;
}

function buildStory(p, variantIndex) {
  const type = storyType(p);
  const variants = STORY_TEMPLATES[type] || STORY_TEMPLATES.generic;
  const base = variantIndex == null ? hashCode(p.code || p.name) : variantIndex;
  const variant = variants[((base % variants.length) + variants.length) % variants.length];
  const specs = isLaptopDevice(p) ? parseSpecs(p.name) : {};
  const values = {
    name: escapeHtml(p.name),
    brand: escapeHtml(p.brand),
    cpu: specs.cpu ? escapeHtml(specs.cpu) : '',
    ram: specs.ram ? escapeHtml(specs.ram) : '',
    storage: specs.storage ? escapeHtml(specs.storage) : '',
    screen: specs.screen ? escapeHtml(specs.screen) : '',
    specPhrase: escapeHtml(specPhrase(specs)),
  };
  return fillStory(variant, values);
}

// Build the render model. Deliberately excludes yourPrice/margin so they
// cannot leak into the HTML.
function toCard(p, variantIndex) {
  const laptop = isLaptopDevice(p);
  const specs = laptop ? parseSpecs(p.name) : {};
  return {
    name: p.name,
    brand: p.brand,
    image: encodeImageUrl(p.image),
    isLaptop: laptop,
    story: buildStory(p, variantIndex),
    spec: laptop ? specLine(specs) : '',
    blurb: laptop ? '' : blurbify(p.description),
    price: formatExGst(p.rrpInc),
    badge: p.badge || '',
    badgeMuted: p.role === 'accessory',
    buyUrl: buyNowUrl(p.name, p.code),
  };
}

// ----------------------------------------------------------------------------
// Email HTML (table-based, inline CSS, email-client-safe, max-width 600px)
// ----------------------------------------------------------------------------

function renderImageCell(card) {
  if (card.image) {
    return (
      `<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" width="560" ` +
      `style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:8px;" />`
    );
  }
  // Clean placeholder for products with no image URL.
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;background:#f1f4f7;border-radius:8px;">` +
    `<tr><td align="center" valign="middle" height="180" ` +
    `style="height:180px;color:#41566e;font-family:Arial,Helvetica,sans-serif;` +
    `font-size:22px;font-weight:bold;letter-spacing:.5px;">` +
    `${escapeHtml(card.brand || 'Zale IT')}</td></tr></table>`
  );
}

function renderBadge(card) {
  if (!card.badge) return '';
  const bg = card.badgeMuted ? MUTED_BADGE : ACCENT;
  const fg = card.badgeMuted ? '#ffffff' : '#0a0f14';
  return (
    `<span style="display:inline-block;background:${bg};color:${fg};` +
    `font-size:11px;font-weight:bold;letter-spacing:1px;padding:4px 10px;` +
    `border-radius:99px;margin-bottom:10px;">${escapeHtml(card.badge)}</span><br/>`
  );
}

// Story leads the block, then (laptops) the spec line, then ex-GST price, then
// the Buy Now button.
function renderProductBlock(card) {
  const specBlock = card.isLaptop && card.spec
    ? `<div style="font-size:13px;font-weight:bold;color:${INK};letter-spacing:.2px;margin-bottom:14px;">${escapeHtml(card.spec)}</div>`
    : '';
  const blurbBlock = !card.isLaptop && card.blurb
    ? `<div style="font-size:13px;color:#5a6b7b;line-height:1.5;margin-bottom:14px;">${escapeHtml(card.blurb)}</div>`
    : '';
  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 14px 0;">
              <tr>
                <td style="padding:22px;background:#ffffff;border:1px solid #e4e9ef;border-radius:12px;font-family:Arial,Helvetica,sans-serif;">
                  ${renderImageCell(card)}
                  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
                  ${renderBadge(card)}
                  <div style="font-size:12px;font-weight:bold;color:${ACCENT};text-transform:uppercase;letter-spacing:.5px;">${escapeHtml(card.brand)}</div>
                  <div style="font-size:18px;font-weight:bold;color:${INK};margin:4px 0 10px 0;line-height:1.3;">${escapeHtml(card.name)}</div>
                  <div style="font-size:14px;color:#41566e;line-height:1.6;margin-bottom:14px;">${card.story}</div>
                  ${specBlock}
                  ${blurbBlock}
                  <div style="font-size:20px;font-weight:bold;color:${INK};margin-bottom:16px;">${escapeHtml(card.price)}</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td align="center" bgcolor="${ACCENT}" style="border-radius:8px;">
                        <a href="${escapeHtml(card.buyUrl)}" style="display:inline-block;padding:12px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0a0f14;text-decoration:none;border-radius:8px;">Buy Now&nbsp;&rarr;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`;
}

// ============================================================================
// BOUNDARY: renderEmail() produces the CUSTOMER-FACING campaign HTML (sent via
// /v3/emailCampaigns). It must NEVER contain cost data — no YourPrice, margin,
// profit, or trade cost. Only public RRP (ex-GST) and product copy. The
// internal margin summary lives solely in buildNotificationHtml() below.
// ============================================================================
function renderEmail(cards) {
  const blocks = cards.map(renderProductBlock).join('\n');
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(EMAIL_TITLE)}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f4;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#eef1f4;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:600px;max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:${INK};border-radius:12px 12px 0 0;padding:22px 24px;font-family:Arial,Helvetica,sans-serif;">
              <span style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:.3px;">Zale <span style="color:${ACCENT};">IT</span></span>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="background:#ffffff;padding:28px 24px 8px 24px;font-family:Arial,Helvetica,sans-serif;">
              <h1 style="margin:0;font-size:26px;line-height:1.25;color:${INK};">${escapeHtml(EMAIL_TITLE)}</h1>
              <p style="margin:10px 0 0 0;font-size:15px;color:#41566e;line-height:1.5;">${escapeHtml(EMAIL_SUBHEAD)}</p>
              <p style="margin:8px 0 0 0;font-size:14px;color:${INK};font-weight:bold;line-height:1.5;">${escapeHtml(SPECIAL_PRICING_LINE)}</p>
            </td>
          </tr>

          <!-- Products -->
          <tr>
            <td style="background:#ffffff;padding:18px 24px 8px 24px;">
${blocks}
            </td>
          </tr>

          <!-- CTA strip -->
          <tr>
            <td style="background:#ffffff;padding:6px 24px 28px 24px;font-family:Arial,Helvetica,sans-serif;text-align:center;">
              <p style="margin:0 0 14px 0;font-size:14px;color:#41566e;">Need something specific? We supply across the full hardware range.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;">
                <tr>
                  <td align="center" bgcolor="${INK}" style="border-radius:8px;">
                    <a href="${ENQUIRE_URL}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">Talk to our team</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0a0f14;border-radius:0 0 12px 12px;padding:24px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 6px 0;font-size:14px;font-weight:bold;color:#ffffff;">Zale IT Pty Ltd</p>
              <p style="margin:0 0 4px 0;font-size:13px;color:#9fb0c0;line-height:1.6;">Brisbane QLD, Australia &middot; Brisbane-based IT &amp; cybersecurity for Australian business.</p>
              <p style="margin:0 0 14px 0;font-size:13px;color:#9fb0c0;">
                <a href="mailto:support@zaleit.com.au" style="color:${ACCENT};text-decoration:none;">support@zaleit.com.au</a>
                &middot;
                <a href="https://zaleit.com.au" target="_blank" style="color:${ACCENT};text-decoration:none;">zaleit.com.au</a>
              </p>
              <p style="margin:0;font-size:11px;color:#6b7c8c;line-height:1.6;">
                You're receiving this because you opted in to product updates from Zale IT.<br/>
                <a href="{{unsubscribe}}" style="color:#9fb0c0;text-decoration:underline;">Unsubscribe</a> &middot; &copy; ${year} Zale IT
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ----------------------------------------------------------------------------
// Brevo (draft campaign + notification) — never auto-sends
// ----------------------------------------------------------------------------

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

// ISO 8601 week number (1-53). Used to rotate the subject line deterministically.
function isoWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // shift to the week's Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fdDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fdDayNum + 3);
  return 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
}

// Stable-within-week, varied-across-weeks subject line.
function weeklySubject(date = new Date()) {
  return SUBJECT_LINES[isoWeekNumber(date) % SUBJECT_LINES.length];
}

async function createDraftCampaign(html) {
  const apiKey = process.env.BREVO_API_KEY;
  const payload = {
    name: `Featured Hardware - ${isoDate()}`,
    subject: weeklySubject(),
    sender: SENDER,
    type: 'classic',
    htmlContent: html,
    recipients: { listIds: [TARGET_LIST_ID] },
    status: 'draft', // DRAFT — must NOT send automatically
  };

  if (!apiKey) {
    console.warn('BREVO_API_KEY not set — skipping draft creation.');
    console.log(
      'Would POST /v3/emailCampaigns with:',
      JSON.stringify({ ...payload, htmlContent: `[${html.length} bytes of HTML]` }, null, 2)
    );
    return null;
  }

  const res = await fetch('https://api.brevo.com/v3/emailCampaigns', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch (_) {
      /* ignore */
    }
    throw new Error(`Brevo campaign create failed: HTTP ${res.status} ${detail}`);
  }

  const data = await res.json().catch(() => ({}));
  const id = data && data.id;
  console.log(`Brevo DRAFT campaign created. Campaign ID: ${id}`);
  return id;
}

// ============================================================================
// BOUNDARY: buildNotificationHtml() is INTERNAL — it is sent ONLY to NOTIFY_TO
// (support@) via /v3/smtp/email. Cost data (YourPrice / trade cost / margin /
// profit) is permitted HERE and ONLY here. It must never reach the customer
// campaign HTML (renderEmail) or any committed file or log line.
// ============================================================================
function buildNotificationHtml(featured, campaignId) {
  const idLine =
    `<p style="margin:0 0 16px 0;"><strong>Draft campaign ID:</strong> ` +
    `${campaignId == null ? '(not created — see logs)' : escapeHtml(String(campaignId))}.</p>`;

  if (!featured.length) {
    return (
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#0e1b2a;">` +
      `<p>No in-stock products to feature this week — no draft was created.</p>${idLine}</div>`
    );
  }

  const roleLabel = {
    hero: 'Latest tech laptop',
    value: 'Highest-margin laptop',
    accessory: 'High-margin add-on',
  };
  const money = (n) =>
    '$' + round2(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (m) => `${(m * 100).toFixed(1)}%`;

  const th =
    'style="text-align:left;padding:8px 10px;border-bottom:2px solid #0e1b2a;font-size:13px;"';
  const thR = th.replace('text-align:left', 'text-align:right');
  const td = 'style="padding:8px 10px;border-bottom:1px solid #e4e9ef;font-size:13px;"';
  const tdR = td.replace('padding:8px 10px;', 'padding:8px 10px;text-align:right;');

  let totRrpEx = 0;
  let totProfit = 0;
  let marginSum = 0;
  const rows = featured
    .map((p) => {
      const tradeEx = round2(p.yourPrice / 1.1); // YourPrice ex-GST
      const rrpEx = round2(p.rrpInc / 1.1); // RRP ex-GST
      const profit = round2(rrpEx - tradeEx); // profit per unit ex-GST
      const margin = p.rrpInc > 0 ? (p.rrpInc - p.yourPrice) / p.rrpInc : 0;
      totRrpEx += rrpEx;
      totProfit += profit;
      marginSum += margin;
      return (
        `<tr>` +
        `<td ${td}>${escapeHtml(p.name)}</td>` +
        `<td ${td}>${roleLabel[p.role] || '—'}</td>` +
        `<td ${tdR}>${money(tradeEx)}</td>` +
        `<td ${tdR}>${money(rrpEx)}</td>` +
        `<td ${tdR}>${pct(margin)}</td>` +
        `<td ${tdR}>${money(profit)}</td>` +
        `</tr>`
      );
    })
    .join('');

  const avgMargin = featured.length ? marginSum / featured.length : 0;
  const sumTd =
    'style="padding:10px;border-top:2px solid #0e1b2a;font-size:13px;font-weight:bold;"';
  const sumTdR = sumTd.replace('padding:10px;', 'padding:10px;text-align:right;');
  const summaryRow =
    `<tr>` +
    `<td ${sumTd} colspan="2">Totals (one of each sells)</td>` +
    `<td ${sumTdR}>—</td>` +
    `<td ${sumTdR}>${money(round2(totRrpEx))}</td>` +
    `<td ${sumTdR}>${pct(avgMargin)}</td>` +
    `<td ${sumTdR}>${money(round2(totProfit))}</td>` +
    `</tr>`;

  const table =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;width:100%;max-width:760px;font-family:Arial,Helvetica,sans-serif;color:#0e1b2a;">` +
    `<thead><tr>` +
    `<th ${th}>Product</th>` +
    `<th ${th}>Why picked</th>` +
    `<th ${thR}>Trade cost (ex GST)</th>` +
    `<th ${thR}>RRP (ex GST)</th>` +
    `<th ${thR}>Margin %</th>` +
    `<th ${thR}>Profit / unit (ex GST)</th>` +
    `</tr></thead>` +
    `<tbody>${rows}${summaryRow}</tbody></table>`;

  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#0e1b2a;">` +
    `<p>This week's featured-hardware campaign draft is ready in Brevo. ` +
    `Review the products, tweak if needed, and hit Send.</p>` +
    idLine +
    `<h3 style="margin:0 0 6px 0;font-size:15px;">Margin summary — INTERNAL, do not forward</h3>` +
    table +
    `<p style="font-size:12px;color:#6b7c8c;margin-top:14px;">` +
    `Trade cost, margin and profit are internal only — they never appear in the customer email.</p>` +
    `</div>`
  );
}

async function notifyDrake(featured, campaignId) {
  const apiKey = process.env.BREVO_API_KEY;
  const htmlContent = buildNotificationHtml(featured, campaignId);

  const payload = {
    sender: SENDER,
    to: [{ email: NOTIFY_TO }],
    subject: 'Weekly featured-hardware draft ready to review',
    htmlContent,
  };

  if (!apiKey) {
    console.warn('BREVO_API_KEY not set — skipping notification email.');
    // NOTE: do not log htmlContent — it contains internal margin/cost data.
    console.log(
      `Would POST /v3/smtp/email to ${NOTIFY_TO} · subject "${payload.subject}" ` +
        `· htmlContent ${htmlContent.length} bytes (redacted — internal margin data).`
    );
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch (_) {
      /* ignore */
    }
    // A failed notification shouldn't fail the run — the draft already exists.
    console.error(`Notification email failed: HTTP ${res.status} ${detail}`);
    return;
  }
  console.log(`Notification email sent to ${NOTIFY_TO}.`);
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  const products = await loadProducts();

  if (!products.length) {
    throw new Error('Main feed returned no products (unreachable or empty).');
  }

  const featured = selectFeatured(products);

  if (featured.length === 0) {
    console.warn('No in-stock products available this week — skipping draft creation.');
    // Notify Drake there was nothing to feature (no draft, no file overwrite).
    await notifyDrake([], null);
    return;
  }

  const variantIndices = assignVariantIndices(featured);
  const cards = featured.map((p) => toCard(p, variantIndices.get(p.code)));
  console.log(
    `Selected ${featured.length} product(s):\n  ` +
      featured.map((p) => `[${p.role}] ${p.name}`).join('\n  ')
  );

  const html = renderEmail(cards);

  // Safety net (defense-in-depth): ensure no trade-price figure leaks into the
  // output. Cards are built without yourPrice, so this should never trip — but
  // we check the raw "1200.00" and grouped "1,200.00" forms with digit
  // boundaries so a coincidental substring (e.g. 90.00 inside 590.00) doesn't
  // cause a false positive.
  const leaks = (haystack, value) => {
    const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\d.,])${esc}(?![\\d])`).test(haystack);
  };
  for (const p of featured) {
    if (!(p.yourPrice > 0)) continue;
    const forms = [
      p.yourPrice.toFixed(2),
      p.yourPrice.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ];
    if (forms.some((f) => leaks(html, f))) {
      throw new Error('Refusing to write: a YourPrice value appears in the generated HTML.');
    }
  }

  fs.writeFileSync(OUT_FILE, html, 'utf8');
  console.log(`Wrote ${OUT_FILE} (${html.length} bytes).`);

  const campaignId = await createDraftCampaign(html);
  // The notification carries the INTERNAL margin summary (cost data allowed
  // here only) — pass the full featured records, not just names.
  await notifyDrake(featured, campaignId);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('build-clearance-campaign failed:', err.message);
    process.exit(1);
  });
}

// Exported for tests (no cost data is exported — only pure functions).
module.exports = {
  selectFeatured,
  assignVariantIndices,
  toCard,
  renderEmail,
  buildNotificationHtml,
  weeklySubject,
  isoWeekNumber,
  isLaptopDevice,
  isAccessory,
  accessoryCategory,
  SUBJECT_LINES,
};
