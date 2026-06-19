#!/usr/bin/env node
'use strict';

/*
 * Zale IT — MMT stock feed fetcher.
 *
 * Fetches the MMT XML price feed, filters to products that are either in stock
 * or have an ETA, and writes catalogue-data.json to the repo root for the
 * catalogue page to consume.
 *
 * Pricing note: the feed's RRPInc is GST-inclusive. The Zale IT catalogue
 * displays EX-GST prices, so we divide by 1.1 and store that as `rrp`. The raw
 * inclusive figure is kept as `rrpInc` for reference. We never read or emit
 * YourPrice (trade price).
 *
 * Local testing (the live host may be firewalled): point MMT_FEED_FILE at a
 * local XML file to parse it instead of hitting the network, e.g.
 *   MMT_FEED_FILE=./sample-feed.xml node scripts/fetch-stock.js
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const FEED_URL =
  'https://www.mmt.com.au/dwapi/Feeds/GetFeedOutput?Id=2&lt=s&ft=xml' +
  '&tk=2f8788cc-74f8-439c-b950-60f5c31720fb' +
  '&af[]=ai&af[]=dp&af[]=tn&af[]=si&af[]=li&af[]=ln&af[]=wt&af[]=um&af[]=st&af[]=sn&af[]=et&af[]=bc';

const OUT_FILE = path.join(__dirname, '..', 'catalogue-data.json');

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

// Brisbane / AEST is a fixed UTC+10 (Queensland has no daylight saving).
function aestTimestamp(date) {
  const aest = new Date(date.getTime() + 10 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${aest.getUTCFullYear()}-${p(aest.getUTCMonth() + 1)}-${p(aest.getUTCDate())}` +
    `T${p(aest.getUTCHours())}:${p(aest.getUTCMinutes())}:${p(aest.getUTCSeconds())}+10:00`
  );
}

// Deep, case-insensitive search for the first non-empty scalar value whose key
// matches `nameLower`, anywhere in the (nested) product node. The MMT feed
// nests fields under wrappers (Description.ShortDescription, Pricing.RRPInc,
// Manufacturer.*, Files.*), so a flat lookup misses them.
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

// Returns the first present, non-empty value among candidate keys (searched
// case-insensitively at any depth of the product subtree).
function pick(obj, ...keys) {
  for (const key of keys) {
    const v = deepFind(obj, key.toLowerCase());
    if (v !== undefined) return v;
  }
  return '';
}

// Recursively collect every object that has an MMTCode field. This survives
// whatever wrapper/namespace structure the feed nests products in.
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
// Fetch + parse
// ----------------------------------------------------------------------------

async function getFeedXml() {
  const localFile = process.env.MMT_FEED_FILE;
  if (localFile) {
    console.log(`Reading feed from local file: ${localFile}`);
    return fs.readFileSync(localFile, 'utf8');
  }
  console.log('Fetching MMT feed…');
  const res = await fetch(FEED_URL, {
    headers: { Accept: 'application/xml, text/xml, */*' },
  });
  if (!res.ok) {
    throw new Error(`Feed request failed: HTTP ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function mapProduct(p) {
  const rrpInc = parseFloat(pick(p, 'RRPInc')) || 0;
  const stock = parseInt(pick(p, 'Availability'), 10) || 0;
  return {
    code: pick(p, 'MMTCode'),
    // Best-effort manufacturer/part number — used by the catalogue to match
    // feed products to the existing hand-built cards (whose model numbers are
    // manufacturer part numbers). Falls back to '' if the feed lacks it.
    sku: pick(
      p,
      'ManufacturerSKU',
      'ManufacturerPartNo',
      'ManufacturerPartNumber',
      'PartNumber',
      'MPN',
      'SKU',
      'ProductCode',
      'SupplierPartNo'
    ),
    name: pick(p, 'ShortDescription'),
    brand: pick(p, 'ManufacturerName'),
    category: pick(p, 'ParentCategoryName'),
    subCategory: pick(p, 'CategoryName'),
    rrp: round2(rrpInc / 1.1), // ex-GST
    rrpInc: round2(rrpInc), // raw inclusive figure, for reference
    stock,
    eta: pick(p, 'ETA'),
    image: pick(p, 'LargeImageURL', 'ThumbnailImageURL'),
    description: pick(p, 'LongDescription'),
  };
}

async function main() {
  const xml = await getFeedXml();

  const parser = new xml2js.Parser({
    explicitArray: false,
    // MMT exposes most product fields as XML attributes (only MMTCode /
    // Availability are child elements), so merge attributes onto the node
    // rather than ignoring them.
    mergeAttrs: true,
    trim: true,
    tagNameProcessors: [xml2js.processors.stripPrefix], // drop the mmt: namespace prefix
    attrNameProcessors: [xml2js.processors.stripPrefix],
  });

  const parsed = await parser.parseStringPromise(xml);
  const rawProducts = collectProducts(parsed, []);
  console.log(`Parsed ${rawProducts.length} products from feed.`);
  if (rawProducts[0]) {
    console.log('First product fields:', Object.keys(rawProducts[0]).join(', '));
    if (process.env.MMT_DUMP) {
      console.log('First product (full):', JSON.stringify(rawProducts[0], null, 2));
    }
  }

  const mapped = rawProducts.map(mapProduct);

  // Keep products that are in stock OR have an ETA. Drop 0-stock/no-ETA items.
  const kept = mapped.filter((p) => p.stock > 0 || p.eta !== '');
  const filteredOut = mapped.length - kept.length;

  // Stable ordering: category, then brand, then name.
  kept.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.brand.localeCompare(b.brand) ||
      a.name.localeCompare(b.name)
  );

  const output = {
    lastUpdated: aestTimestamp(new Date()),
    count: kept.length,
    products: kept,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(
    `Fetched ${mapped.length} · kept ${kept.length} · filtered out ${filteredOut} (0 stock, no ETA).`
  );
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('fetch-stock failed:', err.message);
  process.exit(1);
});
