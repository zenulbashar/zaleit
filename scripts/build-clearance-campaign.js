#!/usr/bin/env node
'use strict';

/*
 * Zaleit IT — Weekly clearance campaign builder.
 *
 * Fetches MMT's CLEARANCE feed (Id=4) and the MAIN stock feed (Id=2), selects
 * the week's featured products, generates a branded HTML email, writes it to
 * campaign-clearance.html, and (when BREVO_API_KEY is present) pushes it to
 * Brevo as a DRAFT email campaign — never sending — then emails Drake to review.
 *
 * Selection strategy:
 *   1. Hero items: in-stock laptops / notebooks / Chromebooks from the
 *      CLEARANCE feed (actual devices, not bags/cases/covers). Badged
 *      "CLEARANCE".
 *   2. Fill remaining slots (up to 4 total) with the highest-margin in-stock
 *      products from the MAIN feed.
 *
 * Pricing / privacy: the feed's RRPInc is GST-inclusive; the email shows the
 * ex-GST figure (RRPInc/1.1). YourPrice (trade price) and the computed margin
 * are used ONLY to rank products in memory and are then discarded — they are
 * never written to campaign-clearance.html, the email, the Brevo payload, or
 * any log line.
 *
 * Local testing (the live MMT host is firewalled in some envs): point
 * MMT_CLEARANCE_FILE / MMT_MAIN_FILE (or MMT_FEED_FILE for the clearance feed)
 * at local XML files to parse them instead of hitting the network, e.g.
 *   MMT_CLEARANCE_FILE=./fixture-clearance.xml \
 *   MMT_MAIN_FILE=./fixture-main.xml node scripts/build-clearance-campaign.js
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

const CLEARANCE_FEED_URL =
  `https://www.mmt.com.au/dwapi/Feeds/GetFeedOutput?Id=4&lt=c&ft=xml&tk=${TOKEN}${FEED_FILTERS}`;
const MAIN_FEED_URL =
  `https://www.mmt.com.au/dwapi/Feeds/GetFeedOutput?Id=2&lt=s&ft=xml&tk=${TOKEN}${FEED_FILTERS}`;

// Brevo "Laptop & Devices" list — confirmed ID 3.
const TARGET_LIST_ID = 3;
// Verified Brevo sender (mail.zaleit.com.au subdomain — DKIM + DMARC authenticated).
const SENDER = { name: 'Zale IT', email: 'marketing@mail.zaleit.com.au' };
const NOTIFY_TO = 'support@zaleit.com.au';
const ENQUIRE_URL = 'https://zaleit.com.au/?service=Hardware#contact';
const FEATURE_COUNT = 4;
const ACCENT = '#76b900'; // site green
const INK = '#0e1b2a'; // dark header

const OUT_FILE = path.join(__dirname, '..', 'campaign-clearance.html');

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

function feedFileEnv(kind) {
  if (kind === 'clearance') {
    return process.env.MMT_CLEARANCE_FILE || process.env.MMT_FEED_FILE || '';
  }
  return process.env.MMT_MAIN_FILE || '';
}

async function getFeedXml(kind) {
  const localFile = feedFileEnv(kind);
  if (localFile) {
    console.log(`Reading ${kind} feed from local file: ${localFile}`);
    return fs.readFileSync(localFile, 'utf8');
  }
  const url = kind === 'clearance' ? CLEARANCE_FEED_URL : MAIN_FEED_URL;
  console.log(`Fetching ${kind} feed…`);
  const res = await fetch(url, { headers: { Accept: 'application/xml, text/xml, */*' } });
  if (!res.ok) {
    throw new Error(`${kind} feed request failed: HTTP ${res.status} ${res.statusText}`);
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
function mapProduct(p, source) {
  return {
    source, // 'clearance' | 'main'
    code: pick(p, 'MMTCode'),
    name: pick(p, 'ShortDescription'),
    brand: pick(p, 'ManufacturerName'),
    parentCategory: pick(p, 'ParentCategoryName'),
    category: pick(p, 'CategoryName'),
    rrpInc: parseFloat(pick(p, 'RRPInc')) || 0,
    yourPrice: parseFloat(pick(p, 'YourPrice')) || 0,
    availability: parseInt(pick(p, 'Availability'), 10) || 0,
    image: pick(p, 'LargeImageURL'),
    description: pick(p, 'LongDescription'),
  };
}

async function loadProducts(kind) {
  try {
    const xml = await getFeedXml(kind);
    const parsed = await parser.parseStringPromise(xml);
    const raw = collectProducts(parsed, []);
    console.log(`Parsed ${raw.length} products from ${kind} feed.`);
    return raw.map((p) => mapProduct(p, kind));
  } catch (err) {
    console.warn(`Could not load ${kind} feed: ${err.message}`);
    return [];
  }
}

// ----------------------------------------------------------------------------
// Selection
// ----------------------------------------------------------------------------

// True for actual laptop/notebook/Chromebook devices, false for bags/cases/etc.
function isLaptopDevice(p) {
  const text = `${p.category} ${p.parentCategory} ${p.name}`.toLowerCase();
  const isDevice = /\b(laptop|notebook|chromebook)\b/.test(text);
  const isAccessory =
    /\b(bag|bags|case|cases|cover|covers|sleeve|sleeves|backpack|skin|stand|dock)\b/.test(text);
  return isDevice && !isAccessory;
}

// margin % — internal ranking only. Never surfaced.
function marginPct(p) {
  if (!(p.rrpInc > 0)) return -Infinity;
  return (p.rrpInc - p.yourPrice) / p.rrpInc;
}

function byMarginDesc(a, b) {
  return marginPct(b) - marginPct(a);
}

function selectFeatured(clearance, main) {
  const inStock = (arr) => arr.filter((p) => p.availability > 0);

  const clearanceLaptops = inStock(clearance).filter(isLaptopDevice).sort(byMarginDesc);
  const mainRanked = inStock(main).slice().sort(byMarginDesc);

  const selected = [];
  const seen = new Set();
  const take = (p) => {
    if (!p.code || seen.has(p.code)) return;
    seen.add(p.code);
    selected.push(p);
  };

  // Hero clearance laptops first, then highest-margin general stock.
  for (const p of clearanceLaptops) {
    if (selected.length >= FEATURE_COUNT) break;
    take(p);
  }
  for (const p of mainRanked) {
    if (selected.length >= FEATURE_COUNT) break;
    take(p);
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
  const ex = round2(rrpInc / 1.1);
  return 'ex GST $' + ex.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Build the render model. Deliberately excludes yourPrice/margin so they
// cannot leak into the HTML.
function toCard(p) {
  return {
    name: p.name,
    brand: p.brand,
    category: p.category || p.parentCategory,
    image: p.image, // populated for clearance; empty for main feed
    blurb: blurbify(p.description),
    price: formatExGst(p.rrpInc),
    badge: p.source === 'clearance' ? 'CLEARANCE' : '',
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
  // Clean placeholder for main-feed products that have no image URL.
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
  return (
    `<span style="display:inline-block;background:${ACCENT};color:#0a0f14;` +
    `font-size:11px;font-weight:bold;letter-spacing:1px;padding:4px 10px;` +
    `border-radius:99px;margin-bottom:10px;">${escapeHtml(card.badge)}</span><br/>`
  );
}

function renderProductBlock(card) {
  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 14px 0;">
              <tr>
                <td style="padding:22px;background:#ffffff;border:1px solid #e4e9ef;border-radius:12px;font-family:Arial,Helvetica,sans-serif;">
                  ${renderImageCell(card)}
                  <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>
                  ${renderBadge(card)}
                  <div style="font-size:12px;font-weight:bold;color:${ACCENT};text-transform:uppercase;letter-spacing:.5px;">${escapeHtml(card.brand)}</div>
                  <div style="font-size:18px;font-weight:bold;color:${INK};margin:4px 0 8px 0;line-height:1.3;">${escapeHtml(card.name)}</div>
                  <div style="font-size:14px;color:#41566e;line-height:1.5;margin-bottom:14px;">${escapeHtml(card.blurb)}</div>
                  <div style="font-size:20px;font-weight:bold;color:${INK};margin-bottom:16px;">${escapeHtml(card.price)}</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td align="center" bgcolor="${ACCENT}" style="border-radius:8px;">
                        <a href="${ENQUIRE_URL}" target="_blank" style="display:inline-block;padding:12px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0a0f14;text-decoration:none;border-radius:8px;">Enquire&nbsp;&rarr;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`;
}

function renderEmail(cards) {
  const blocks = cards.map(renderProductBlock).join('\n');
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>This Week's Clearance Picks</title>
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
              <h1 style="margin:0;font-size:26px;line-height:1.25;color:${INK};">This Week's Clearance Picks</h1>
              <p style="margin:10px 0 0 0;font-size:15px;color:#41566e;line-height:1.5;">Hand-picked, high-value hardware while stocks last — fresh from our distributor clearance.</p>
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

async function createDraftCampaign(html, names) {
  const apiKey = process.env.BREVO_API_KEY;
  const payload = {
    name: `Clearance Picks - ${isoDate()}`,
    subject: "This week's clearance picks - while stocks last",
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

async function notifyDrake(names, campaignId) {
  const apiKey = process.env.BREVO_API_KEY;
  const featured = names.map((n) => escapeHtml(n)).join(', ');
  const htmlContent =
    `<p>This week's clearance campaign draft is ready in Brevo. ` +
    `Review the products, tweak if needed, and hit Send.</p>` +
    `<p><strong>Featured:</strong> ${featured}.<br/>` +
    `<strong>Draft campaign ID:</strong> ${campaignId == null ? '(not created — see logs)' : campaignId}.</p>`;

  const payload = {
    sender: SENDER,
    to: [{ email: NOTIFY_TO }],
    subject: 'Weekly clearance draft ready to review',
    htmlContent,
  };

  if (!apiKey) {
    console.warn('BREVO_API_KEY not set — skipping notification email.');
    console.log('Would POST /v3/smtp/email with:', JSON.stringify(payload, null, 2));
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
  const [clearance, main] = await Promise.all([
    loadProducts('clearance'),
    loadProducts('main'),
  ]);

  if (!clearance.length && !main.length) {
    throw new Error('Both feeds returned no products (unreachable or empty).');
  }

  const featured = selectFeatured(clearance, main);

  if (featured.length === 0) {
    console.warn('No in-stock products available this week — skipping draft creation.');
    // Notify Drake there was nothing to feature (no draft, no file overwrite).
    await notifyDrake(['(none — no in-stock products this week)'], null);
    return;
  }

  const cards = featured.map(toCard);
  const names = featured.map((p) => p.name);
  console.log(`Selected ${featured.length} product(s): ${names.join(' | ')}`);

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

  const campaignId = await createDraftCampaign(html, names);
  await notifyDrake(names, campaignId);
}

main().catch((err) => {
  console.error('build-clearance-campaign failed:', err.message);
  process.exit(1);
});
