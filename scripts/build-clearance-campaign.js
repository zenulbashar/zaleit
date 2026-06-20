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
const ACCENT = '#76b900'; // site green
const INK = '#0e1b2a'; // dark header

// --- Easily-editable copy (named constants) --------------------------------

// Email title shown in the header inside the email.
// Options: "Complete Laptop Bundles for Your Team" | "Ready-to-Go Laptop Setups"
//          | "Laptop Bundles: Pick Your Tier"
const EMAIL_TITLE = 'Complete Laptop Bundles for Your Team';

// Subhead under the title.
const EMAIL_SUBHEAD =
  'Three ready-to-go laptop setups — each a laptop, dock and input device, priced as a bundle.';

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

// Dock pools (exact CategoryName, lowercased). "Docking Stations" is mostly
// cheap USB-C hubs; the genuine powered docks live in "Laptop Docking and
// Cradles". We treat them separately so Business gets a hub and Performance /
// Flagship get real powered docks.
const HUB_CATEGORIES = ['docking stations'];
const POWERED_DOCK_CATEGORIES = ['laptop docking and cradles'];

// Input device pool (keyboards / combos / mice).
const INPUT_CATEGORIES = ['keyboards', 'keyboards & mice', 'mice'];

// --- Tiers (editable) ------------------------------------------------------
// Tier band by laptop ex-GST price (AUD).
const TIER_BREAKS = { performanceMin: 2945, flagshipMin: 4330 };
const TIER_LABELS = { business: 'Business', performance: 'Performance', flagship: 'Flagship' };
const TIER_ORDER = ['business', 'performance', 'flagship'];
const MOST_POPULAR_TIER = 'performance'; // gets the "MOST POPULAR" badge
// Bundle price = sum of the items' ex-GST prices × (1 − discount). 0 = honest sum.
const BUNDLE_DISCOUNT_PCT = 0;

// Per-tier bundle scenario stories. {name} is the laptop; the {specPhrase}
// sentence is dropped when no specs parse (see fillStory). 2 variants per tier,
// chosen deterministically by the laptop's code.
const TIER_STORIES = {
  business: [
    'Built for everyday business productivity — email, documents, meetings and the web, all day without fuss. The {name} keeps your team moving. It comes configured with {specPhrase}.',
    'A dependable setup for the daily grind of business — docs, inboxes and back-to-back calls. The {name} handles it all and standardises nicely across a team. Under the lid: {specPhrase}.',
  ],
  performance: [
    'For power users who multitask hard — big spreadsheets, dozens of tabs, design and dev tools running at once. The {name} keeps pace under pressure. It packs {specPhrase}.',
    'When the workload steps up, so does this setup. The {name} is built for heavy multitasking and demanding apps, with {specPhrase} to stay responsive all day.',
  ],
  flagship: [
    'For executives and the most demanding workloads — the {name} delivers top-tier performance, a premium build and the headroom for anything you throw at it. Configured with {specPhrase}.',
    'The no-compromise choice. The {name} pairs flagship performance with premium design for leaders and power users who expect the best. It runs {specPhrase}.',
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

// CategoryName (lowercased, trimmed) helper.
function catOf(p) {
  return (p.category || '').trim().toLowerCase();
}
const inCats = (p, cats) => cats.includes(catOf(p));

// Tier key for a laptop ex-GST price.
function tierForPrice(exGst) {
  if (exGst >= TIER_BREAKS.flagshipMin) return 'flagship';
  if (exGst >= TIER_BREAKS.performanceMin) return 'performance';
  return 'business';
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

const exGstOf = (p) => round2(p.rrpInc / 1.1);
const byPriceAsc = (a, b) => exGstOf(a) - exGstOf(b);

// Build up to 3 tier bundles. Each bundle = { tierKey, label, mostPopular,
// laptop, dock|null, input|null }. No product is reused across bundles.
function selectBundles(products) {
  const inStock = products.filter((p) => p.availability > 0 && !isExcludedUnit(p.name));
  const laptops = inStock.filter(isLaptopDevice);
  if (laptops.length === 0) return []; // no laptops → skip + notify

  const used = new Set();
  const claim = (p) => {
    if (!p || !p.code || used.has(p.code)) return null;
    used.add(p.code);
    return p;
  };

  // 1. Laptop per tier: highest latest-tech score within the tier's price band.
  const bundles = [];
  for (const tierKey of TIER_ORDER) {
    const inBand = laptops
      .filter((p) => tierForPrice(exGstOf(p)) === tierKey && !used.has(p.code))
      .sort(byLatestTechDesc);
    const laptop = claim(inBand[0]);
    if (!laptop) continue; // no in-band laptop → skip this bundle
    bundles.push({
      tierKey,
      label: TIER_LABELS[tierKey],
      mostPopular: tierKey === MOST_POPULAR_TIER,
      laptop,
      dock: null,
      input: null,
    });
  }
  if (bundles.length === 0) return [];

  const byKey = Object.fromEntries(bundles.map((b) => [b.tierKey, b]));
  const hubs = inStock.filter((p) => inCats(p, HUB_CATEGORIES)).sort(byPriceAsc);
  const poweredDocks = inStock.filter((p) => inCats(p, POWERED_DOCK_CATEGORIES)).sort(byPriceAsc);
  const inputs = inStock.filter((p) => inCats(p, INPUT_CATEGORIES)).sort(byPriceAsc);
  const firstUnused = (arr) => arr.find((p) => !used.has(p.code));
  const lastUnused = (arr) => [...arr].reverse().find((p) => !used.has(p.code));

  // 2. Docks. Business → cheapest hub; Performance/Flagship → powered docks
  //    (lower-priced to Performance, higher to Flagship), falling back to the
  //    priciest unused hub if powered docks run short. Business first so it
  //    never steals a powered dock.
  if (byKey.business) byKey.business.dock = claim(firstUnused(hubs)) || claim(firstUnused(poweredDocks));
  for (const tierKey of ['performance', 'flagship']) {
    const b = byKey[tierKey];
    if (!b) continue;
    b.dock = claim(firstUnused(poweredDocks)) || claim(lastUnused(hubs));
  }

  // 3. Input devices, distinct: Flagship = priciest unused, Business = cheapest
  //    unused, Performance = a mid unused (assigned last so all three differ).
  if (byKey.flagship) byKey.flagship.input = claim(lastUnused(inputs));
  if (byKey.business) byKey.business.input = claim(firstUnused(inputs));
  if (byKey.performance) {
    const remaining = inputs.filter((p) => !used.has(p.code));
    byKey.performance.input = claim(remaining[Math.floor(remaining.length / 2)]);
  }

  return bundles;
}

// All present items of a bundle, tagged with role, in display order.
function bundleItems(bundle) {
  const items = [{ ...bundle.laptop, role: 'laptop' }];
  if (bundle.dock) items.push({ ...bundle.dock, role: 'dock' });
  if (bundle.input) items.push({ ...bundle.input, role: 'input' });
  return items;
}

// Bundle ex-GST price = sum of item ex-GST prices × (1 − discount).
function bundlePriceExGst(bundle) {
  const sum = bundleItems(bundle).reduce((s, it) => s + exGstOf(it), 0);
  return Math.round(sum * (1 - BUNDLE_DISCOUNT_PCT / 100));
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

// Price label: "Price $X,XXX ex GST" / "Bundle price: $X,XXX ex GST" — whole
// dollars, "ex GST" AFTER the figure.
function priceLabel(dollars, opts = {}) {
  const amount = '$' + Math.round(dollars).toLocaleString('en-AU');
  return `${opts.bundle ? 'Bundle price: ' : 'Price '}${amount} ex GST`;
}

// "Buy Now" mailto for a BUNDLE: subject names the tier + laptop; body lists all
// present items with model codes and the bundle price. Everything URL-encoded;
// newlines become %0D%0A via encodeURIComponent. The href is HTML-escaped later.
function bundleBuyUrl(bundle) {
  const items = bundleItems(bundle);
  const priceDollars = bundlePriceExGst(bundle);
  const subject = `Bundle enquiry: ${bundle.label} Setup - ${bundle.laptop.name}`;
  const lines = items.map((it) => `- ${it.name} (model ${it.code})`).join('\r\n');
  const body =
    `Hi Zale IT,\r\n\r\n` +
    `I'm interested in the ${bundle.label} Setup:\r\n` +
    `${lines}\r\n\r\n` +
    `${priceLabel(priceDollars, { bundle: true })}. Please confirm availability and send a quote.\r\n\r\n` +
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

// Per-tier bundle story for the laptop. Deterministic variant by laptop code;
// the {specPhrase} sentence drops gracefully when no specs parse (Flagship).
function buildBundleStory(bundle) {
  const variants = TIER_STORIES[bundle.tierKey] || TIER_STORIES.business;
  const variant = variants[hashCode(bundle.laptop.code || bundle.laptop.name) % variants.length];
  const specs = parseSpecs(bundle.laptop.name);
  return fillStory(variant, {
    name: escapeHtml(bundle.laptop.name),
    specPhrase: escapeHtml(specPhrase(specs)),
  });
}

// Build the CUSTOMER-FACING render model for a bundle. Deliberately excludes
// yourPrice / margin / trade cost — only the public bundle price (a sum of
// public RRP ex-GST) appears.
function toBundleCard(bundle) {
  const specs = parseSpecs(bundle.laptop.name);
  return {
    tierLabel: `${bundle.label} Setup`,
    mostPopular: bundle.mostPopular,
    laptop: {
      name: bundle.laptop.name,
      brand: bundle.laptop.brand,
      image: encodeImageUrl(bundle.laptop.image),
      spec: specLine(specs), // empty for messy Flagship names → omitted
      story: buildBundleStory(bundle),
    },
    includes: bundleItems(bundle)
      .filter((it) => it.role !== 'laptop')
      .map((it) => it.name),
    priceLabel: priceLabel(bundlePriceExGst(bundle), { bundle: true }),
    buyUrl: bundleBuyUrl(bundle),
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

// Render one bundle block: tier heading (+ MOST POPULAR badge), laptop image,
// name, spec line, scenario story, the included accessories, bundle price, and
// the Buy Now button.
function renderBundleBlock(card) {
  const popularBadge = card.mostPopular
    ? `<span style="display:inline-block;background:${ACCENT};color:#0a0f14;font-size:11px;font-weight:bold;letter-spacing:1px;padding:4px 10px;border-radius:99px;margin-left:10px;vertical-align:middle;">MOST POPULAR</span>`
    : '';
  const border = card.mostPopular ? `2px solid ${ACCENT}` : '1px solid #e4e9ef';
  const specBlock = card.laptop.spec
    ? `<div style="font-size:13px;font-weight:bold;color:${INK};letter-spacing:.2px;margin-bottom:12px;">${escapeHtml(card.laptop.spec)}</div>`
    : '';
  const includesBlock = card.includes.length
    ? `<div style="font-size:13px;color:#41566e;line-height:1.5;margin:0 0 16px 0;padding:10px 12px;background:#f1f4f7;border-radius:8px;"><strong>Includes:</strong> ${escapeHtml(card.includes.join(' + '))}</div>`
    : '';
  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 16px 0;">
              <tr>
                <td style="padding:22px;background:#ffffff;border:${border};border-radius:12px;font-family:Arial,Helvetica,sans-serif;">
                  <div style="font-size:17px;font-weight:bold;color:${INK};margin-bottom:14px;">${escapeHtml(card.tierLabel)}${popularBadge}</div>
                  ${renderImageCell(card.laptop)}
                  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
                  <div style="font-size:12px;font-weight:bold;color:${ACCENT};text-transform:uppercase;letter-spacing:.5px;">${escapeHtml(card.laptop.brand)}</div>
                  <div style="font-size:18px;font-weight:bold;color:${INK};margin:4px 0 10px 0;line-height:1.3;">${escapeHtml(card.laptop.name)}</div>
                  <div style="font-size:14px;color:#41566e;line-height:1.6;margin-bottom:12px;">${card.laptop.story}</div>
                  ${specBlock}
                  ${includesBlock}
                  <div style="font-size:20px;font-weight:bold;color:${INK};margin-bottom:16px;">${escapeHtml(card.priceLabel)}</div>
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
  const blocks = cards.map(renderBundleBlock).join('\n');
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
function buildNotificationHtml(bundles, campaignId) {
  const idLine =
    `<p style="margin:0 0 16px 0;"><strong>Draft campaign ID:</strong> ` +
    `${campaignId == null ? '(not created — see logs)' : escapeHtml(String(campaignId))}.</p>`;

  if (!bundles.length) {
    return (
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#0e1b2a;">` +
      `<p>No in-stock laptops to build bundles this week — no draft was created.</p>${idLine}</div>`
    );
  }

  const roleLabel = { laptop: 'Laptop', dock: 'Dock', input: 'Input device' };
  const money = (n) =>
    '$' + round2(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (m) => `${(m * 100).toFixed(1)}%`;

  const th =
    'style="text-align:left;padding:7px 10px;border-bottom:2px solid #0e1b2a;font-size:13px;"';
  const thR = th.replace('text-align:left', 'text-align:right');
  const td = 'style="padding:7px 10px;border-bottom:1px solid #e4e9ef;font-size:13px;"';
  const tdR = td.replace('padding:7px 10px;', 'padding:7px 10px;text-align:right;');
  const sumTd = 'style="padding:8px 10px;border-top:2px solid #0e1b2a;font-size:13px;font-weight:bold;"';
  const sumTdR = sumTd.replace('padding:8px 10px;', 'padding:8px 10px;text-align:right;');

  let grandRrpEx = 0;
  let grandProfit = 0;
  let marginSum = 0;

  const sections = bundles
    .map((b) => {
      const items = bundleItems(b);
      let bRrpInc = 0;
      let bYour = 0;
      let bRrpEx = 0;
      let bTradeEx = 0;
      const rows = items
        .map((it) => {
          const tradeEx = round2(it.yourPrice / 1.1);
          const rrpEx = round2(it.rrpInc / 1.1);
          bRrpInc += it.rrpInc;
          bYour += it.yourPrice;
          bRrpEx += rrpEx;
          bTradeEx += tradeEx;
          return (
            `<tr>` +
            `<td ${td}>${escapeHtml(it.name)}</td>` +
            `<td ${td}>${roleLabel[it.role] || '—'}</td>` +
            `<td ${tdR}>${money(tradeEx)}</td>` +
            `<td ${tdR}>${money(rrpEx)}</td>` +
            `</tr>`
          );
        })
        .join('');
      const bMargin = bRrpInc > 0 ? (bRrpInc - bYour) / bRrpInc : 0;
      const bProfit = round2(bRrpEx - bTradeEx);
      grandRrpEx += round2(bRrpEx);
      grandProfit += bProfit;
      marginSum += bMargin;
      const note =
        items.length < 3 ? ` <span style="font-weight:normal;color:#a3623a;">(${3 - items.length} accessory slot(s) unfilled)</span>` : '';
      const totalsRow =
        `<tr>` +
        `<td ${sumTd} colspan="2">${escapeHtml(b.label)} bundle total${note}</td>` +
        `<td ${sumTdR}>${money(round2(bTradeEx))}</td>` +
        `<td ${sumTdR}>${money(round2(bRrpEx))}</td>` +
        `</tr>` +
        `<tr><td ${td} colspan="2" style="padding:7px 10px;font-size:12px;color:#41566e;">` +
        `Bundle margin ${pct(bMargin)} · profit ${money(bProfit)} ex GST · customer price ${money(round2(bRrpEx))} ex GST</td>` +
        `<td ${td}></td><td ${td}></td></tr>`;
      return (
        `<h3 style="margin:18px 0 6px 0;font-size:15px;">${escapeHtml(b.label)} Setup — ${escapeHtml(b.laptop.name)}</h3>` +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
        `style="border-collapse:collapse;width:100%;max-width:760px;font-family:Arial,Helvetica,sans-serif;color:#0e1b2a;">` +
        `<thead><tr><th ${th}>Item</th><th ${th}>Role</th>` +
        `<th ${thR}>Trade cost (ex GST)</th><th ${thR}>RRP (ex GST)</th></tr></thead>` +
        `<tbody>${rows}${totalsRow}</tbody></table>`
      );
    })
    .join('');

  const avgMargin = bundles.length ? marginSum / bundles.length : 0;
  const grand =
    `<h3 style="margin:22px 0 6px 0;font-size:15px;">Grand total (one of each bundle sells)</h3>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#0e1b2a;font-size:13px;">` +
    `<tr><td ${sumTd}>Total RRP (ex GST)</td><td ${sumTdR}>${money(round2(grandRrpEx))}</td></tr>` +
    `<tr><td ${sumTd}>Total profit (ex GST)</td><td ${sumTdR}>${money(round2(grandProfit))}</td></tr>` +
    `<tr><td ${sumTd}>Average bundle margin</td><td ${sumTdR}>${pct(avgMargin)}</td></tr></table>`;

  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#0e1b2a;">` +
    `<p>This week's bundle campaign draft is ready in Brevo. ` +
    `Review the bundles, tweak if needed, and hit Send.</p>` +
    idLine +
    `<p style="margin:0 0 4px 0;font-size:13px;"><strong>${bundles.length} bundle(s) rendered:</strong> ` +
    `${escapeHtml(bundles.map((b) => b.label).join(', '))}.</p>` +
    `<h3 style="margin:14px 0 6px 0;font-size:15px;">Margin summary — INTERNAL, do not forward</h3>` +
    sections +
    grand +
    `<p style="font-size:12px;color:#6b7c8c;margin-top:14px;">` +
    `Trade cost, margin and profit are internal only — they never appear in the customer email.</p>` +
    `</div>`
  );
}

async function notifyDrake(bundles, campaignId) {
  const apiKey = process.env.BREVO_API_KEY;
  const htmlContent = buildNotificationHtml(bundles, campaignId);

  const payload = {
    sender: SENDER,
    to: [{ email: NOTIFY_TO }],
    subject: 'Weekly bundle draft ready to review',
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

  const bundles = selectBundles(products);

  if (bundles.length === 0) {
    console.warn('No in-stock laptops available this week — skipping draft creation.');
    // Notify there was nothing to bundle (no draft, no file overwrite).
    await notifyDrake([], null);
    return;
  }

  const cards = bundles.map(toBundleCard);
  console.log(
    `Built ${bundles.length} bundle(s):\n  ` +
      bundles
        .map((b) => `[${b.label}] ${b.laptop.name} + ${[b.dock, b.input].filter(Boolean).map((x) => x.name).join(' + ') || '(laptop only)'}`)
        .join('\n  ')
  );

  const html = renderEmail(cards);

  // Safety net (defense-in-depth): ensure no trade-price figure leaks into the
  // CUSTOMER HTML. Cards are built without yourPrice, so this should never trip
  // — but we check the raw "1200.00" and grouped "1,200.00" forms with digit
  // boundaries so a coincidental substring (e.g. 90.00 inside 590.00) doesn't
  // cause a false positive. We check every item across every bundle.
  const leaks = (haystack, value) => {
    const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\d.,])${esc}(?![\\d])`).test(haystack);
  };
  for (const b of bundles) {
    for (const it of bundleItems(b)) {
      if (!(it.yourPrice > 0)) continue;
      const forms = [
        it.yourPrice.toFixed(2),
        it.yourPrice.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ];
      if (forms.some((f) => leaks(html, f))) {
        throw new Error('Refusing to write: a YourPrice value appears in the generated HTML.');
      }
    }
  }

  fs.writeFileSync(OUT_FILE, html, 'utf8');
  console.log(`Wrote ${OUT_FILE} (${html.length} bytes).`);

  const campaignId = await createDraftCampaign(html);
  // The notification carries the INTERNAL per-bundle margin summary (cost data
  // allowed here only) — pass the full bundle records.
  await notifyDrake(bundles, campaignId);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('build-clearance-campaign failed:', err.message);
    process.exit(1);
  });
}

// Exported for tests (no cost data is exported — only pure functions).
module.exports = {
  selectBundles,
  bundleItems,
  bundlePriceExGst,
  toBundleCard,
  renderEmail,
  buildNotificationHtml,
  priceLabel,
  bundleBuyUrl,
  weeklySubject,
  isoWeekNumber,
  isLaptopDevice,
  tierForPrice,
  SUBJECT_LINES,
};
