#!/usr/bin/env node
'use strict';

/*
 * Zale IT — static catalogue page generator.
 *
 * Reads catalogue-data.json + the curated cards (via scripts/catalogue-config.js)
 * and writes crawlable static HTML:
 *   - /category/<slug>.html   one per tab (~12), all products baked into HTML.
 *   - /product/<slug>.html    one per clean in-feed laptop (~200), with Product
 *                             + BreadcrumbList JSON-LD.
 *   - /sitemap.xml            index + catalogue + every generated page.
 *
 * Lifecycle: /category and /product are WIPED and regenerated every run, so a
 * product that drops out of the feed simply no longer has a page (the CI commit
 * deletes it). Out-of-stock-but-ETA laptops keep a page (schema BackOrder) for
 * inbound-link stability; laptops that leave the feed entirely are removed.
 *
 * Runs in CI after fetch-stock.js. Pure Node — no network, no extra deps.
 * Test locally against the committed catalogue-data.json:
 *   node scripts/build-catalogue-pages.js
 */

const fs = require('fs');
const path = require('path');
const C = require('./catalogue-config');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://zaleit.com.au';
const CAT_DIR = path.join(ROOT, 'category');
const PROD_DIR = path.join(ROOT, 'product');
const DATA_FILE = path.join(ROOT, 'catalogue-data.json');

const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%231a1a1a'/><path d='M16 4l11 4v8c0 6.5-4.5 11-11 14C9 27 4 22.5 4 16V8l12-4z' fill='%2376b900'/><path d='M11 16l3.5 3.5L21 13' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>";

const e = C.escapeHtml;

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

// Inline 3-tier image fallback (image -> brand favicon -> text box). Mirrors
// catalogue.html's runtime behaviour; read from data-* attrs to avoid quoting
// issues with brand names. Defined once per page in <head>.
const IMG_FALLBACK_JS =
  '<script>function zfText(el){var c=el.closest&&el.closest(".pc-img");if(!c)return;' +
  'var b=el.getAttribute("data-brand")||"Zale IT";c.className=c.className.replace(/pc-imgchip/,"")+" pc-imgtext";' +
  'c.innerHTML="";var s=document.createElement("span");s.textContent=b;c.appendChild(s);}' +
  'function zfFav(el){el.onerror=null;var d=el.getAttribute("data-domain"),b=el.getAttribute("data-brand")||"";' +
  'if(!d){zfText(el);return;}var c=el.closest(".pc-img");if(!c){return;}c.className=c.className+" pc-imgchip";c.innerHTML="";' +
  'var ic=document.createElement("img");ic.src="https://www.google.com/s2/favicons?domain="+d+"&sz=128";' +
  'ic.alt=b;ic.width=48;ic.height=48;ic.loading="lazy";ic.referrerPolicy="no-referrer";ic.setAttribute("data-brand",b);' +
  'ic.onerror=function(){zfText(ic);};var l=document.createElement("div");l.className="pc-imgbrand";l.textContent=b;' +
  'c.appendChild(ic);c.appendChild(l);}</script>';

function head(opts) {
  const og = opts.image || SITE + '/og-image.png';
  const robots = opts.noindex ? '<meta name="robots" content="noindex,follow">\n' : '';
  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(opts.title)}</title>
<meta name="description" content="${e(opts.description)}">
${robots}<link rel="canonical" href="${e(opts.canonical)}">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site-pages.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zale IT">
<meta property="og:locale" content="en_AU">
<meta property="og:url" content="${e(opts.canonical)}">
<meta property="og:title" content="${e(opts.title)}">
<meta property="og:description" content="${e(opts.description)}">
<meta property="og:image" content="${e(og)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(opts.title)}">
<meta name="twitter:description" content="${e(opts.description)}">
<meta name="twitter:image" content="${e(og)}">
${opts.jsonld || ''}
${IMG_FALLBACK_JS}
</head>
<body>`;
}

const LOGO_SVG =
  '<span class="logo-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.4 8.4-8 11-4.6-2.6-8-6-8-11V5l8-3z"/><path d="M9 12l2 2 4-4"/></svg></span>';

const NAV = `<nav class="nav" aria-label="Primary">
  <div class="wrap">
    <a href="/" class="logo" aria-label="Zale IT home">${LOGO_SVG}<span>Zale <b>IT</b></span></a>
    <ul class="nav-links">
      <li><a href="/index.html#services">Services</a></li>
      <li><a href="/index.html#hardware">Hardware</a></li>
      <li><a href="/catalogue.html">Catalogue</a></li>
      <li><a href="/index.html#about">About</a></li>
      <li><a href="/index.html#contact">Contact</a></li>
    </ul>
    <a href="/index.html#contact" class="btn-primary">Free Assessment</a>
  </div>
</nav>`;

function footer() {
  const year = new Date().getFullYear();
  return `<section class="cta-strip">
  <div class="wrap">
    <h2>Need help choosing?</h2>
    <p>Tell us what you're outfitting — a new office, a fleet refresh or a single workstation — and we'll put together the right gear at the right price.</p>
    <a href="/index.html#contact" class="btn-primary">Request a quote</a>
  </div>
</section>
<footer class="footer">
  <div class="wrap">
    <div class="footer-top">
      <a href="/" class="logo" aria-label="Zale IT home">${LOGO_SVG}<span>Zale <b>IT</b></span></a>
      <nav class="footer-nav" aria-label="Footer">
        <a href="/index.html#services">Services</a>
        <a href="/index.html#hardware">Hardware</a>
        <a href="/catalogue.html">Catalogue</a>
        <a href="/index.html#about">About</a>
        <a href="/index.html#contact">Contact</a>
      </nav>
      <div class="footer-copy">&copy; ${year} Zale IT</div>
    </div>
    <div class="footer-bottom">
      <p class="footer-legal">Zale IT Pty Ltd · Brisbane QLD · <a href="mailto:support@zaleit.com.au">support@zaleit.com.au</a></p>
      <p class="footer-legal">Prices are in AUD, exclude GST and are indicative only. Specifications and availability subject to change. E&amp;OE.</p>
    </div>
  </div>
</footer>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Card / image rendering (static, 3-tier fallback baked)
// ---------------------------------------------------------------------------

// Build the .pc-img cell. Feed items with an image bake the real <img> (the
// onerror downgrades to favicon -> text at runtime). Imageless items bake the
// best available tier directly (favicon chip if the brand is known, else text).
function imageCell(item, opts) {
  opts = opts || {};
  const cls = opts.pdp ? 'pc-img pdp-imgbox' : 'pc-img';
  const dom = C.brandDomain(item.brand);
  const brandAttr = e(item.brand || 'Zale IT');
  if (item.image) {
    const w = opts.pdp ? '' : ' width="200" height="156"';
    return `<div class="${cls}"><img src="${e(C.encodeImageUrl(item.image))}" alt="${e(item.name)}"${w} loading="lazy" decoding="async" data-domain="${e(dom || '')}" data-brand="${brandAttr}" onerror="zfFav(this)"></div>`;
  }
  if (dom) {
    return `<div class="${cls} pc-imgchip"><img src="https://www.google.com/s2/favicons?domain=${e(dom)}&sz=128" alt="${brandAttr}" width="48" height="48" loading="lazy" referrerpolicy="no-referrer" data-brand="${brandAttr}" onerror="zfText(this)"><div class="pc-imgbrand">${e(item.brand)}</div></div>`;
  }
  return `<div class="${cls} pc-imgtext"><span>${e(item.brand || 'Zale IT')}</span></div>`;
}

function stockBadge(item) {
  if (item.source === 'curated') return '<span class="pc-stock order">Available to Order</span>';
  if (item.stock > 0) return '<span class="pc-stock in">In Stock</span>';
  if (item.eta) return '<span class="pc-stock eta">ETA: ' + e(item.eta) + '</span>';
  return '';
}

// One category-grid card. Laptops with a generated product page link to it.
function card(item, productUrl) {
  const model = item.model ? `<span class="pc-model">${e(item.model)}</span>` : '';
  const top = `<div class="pc-top"><span class="pc-brand">${e(item.brand)}</span>${model}</div>`;
  const name = productUrl
    ? `<a class="pc-name" href="${e(productUrl)}"><h3 style="font:inherit;margin:0">${e(item.name)}</h3></a>`
    : `<h3 class="pc-name">${e(item.name)}</h3>`;
  const badge = stockBadge(item);
  const mid =
    item.specs && item.specs.length
      ? `<div class="pb-specs">${item.specs.map((s) => `<span class="pb">${e(s)}</span>`).join('')}</div>`
      : item.specLine
      ? `<p class="pc-desc">${e(item.specLine)}</p>`
      : '';
  const cta = productUrl
    ? `<a class="pc-enq" href="${e(productUrl)}">View details &rarr;</a>`
    : `<a class="pc-enq" href="${e(C.enquiryHref(item.name))}">Enquire</a>`;
  const foot = `<div class="pc-foot"><div class="pc-price"><span class="pc-rrp">ex GST</span>${C.money(item.priceExGst)}</div>${cta}</div>`;
  const img = productUrl ? `<a href="${e(productUrl)}" aria-label="${e(item.name)}">${imageCell(item)}</a>` : imageCell(item);
  return `<article class="pcard" data-tab="${e(item.tab)}">${top}${name}${badge}${img}${mid}${foot}</article>`;
}

// ---------------------------------------------------------------------------
// Build the unified product list (curated + feed), like catalogue.html.
// ---------------------------------------------------------------------------

function buildAll(feedProducts) {
  const all = [];
  C.CURATED.forEach((c) => {
    const it = C.normCurated(c);
    if (it) all.push(it);
  });
  (feedProducts || []).forEach((p) => {
    const it = C.normFeed(p);
    if (it) all.push(it);
  });
  // Same sort as catalogue.html: image-rich feed items first, then alphabetical.
  const hasImg = (it) => it.source === 'feed' && !!it.image;
  all.sort((a, b) => {
    if (hasImg(a) !== hasImg(b)) return hasImg(a) ? -1 : 1;
    const ka = C.lc(a.brand + ' ' + a.name), kb = C.lc(b.brand + ' ' + b.name);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return all;
}

// ---------------------------------------------------------------------------
// Laptop product pages
// ---------------------------------------------------------------------------

const tabLabel = (id) => (C.TABS.find((t) => t.id === id) || {}).label || id;

// Build laptop records (raw feed shape) → page model. Slugs are unique per the
// data (verified); a defensive counter guards any future collision.
function buildLaptops(feedProducts) {
  const seen = Object.create(null);
  const laptops = [];
  feedProducts
    .filter((p) => C.isLaptopFeedProduct(p) && !C.isExcludedUnit(p.name) && p.code)
    .forEach((p) => {
      let slug = C.slugify(p.code);
      if (!slug) return;
      if (seen[slug]) slug = slug + '-' + seen[slug]++;
      else seen[slug] = 1;
      const specs = C.parseSpecs(p.name);
      const sl = C.specLine(specs);
      const descClean = String(p.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      laptops.push({
        code: p.code,
        slug,
        url: SITE + '/product/' + slug + '.html',
        brand: p.brand || '',
        name: p.name || '',
        image: p.image || null,
        priceExGst: Number(p.rrp) || 0,
        stock: p.stock != null ? p.stock : 0,
        eta: p.eta || '',
        specs,
        specLine: sl,
        descClean,
        tab: 'laptops',
        // Thin = no parseable specs AND a very short description.
        thin: !sl && descClean.length < 120,
      });
    });
  return laptops;
}

function laptopTitle(l, titleCounts) {
  // Distinguish near-identical variants by their key spec; fall back to model.
  const bits = [];
  if (l.specs.cpu) bits.push(l.specs.cpu);
  if (l.specs.ram) bits.push(l.specs.ram);
  if (l.specs.storage) bits.push(l.specs.storage);
  let t = l.name + (bits.length ? ' · ' + bits.join(' / ') : '') + ' | Zale IT';
  if (titleCounts[t] === undefined) titleCounts[t] = 0;
  titleCounts[t]++;
  if (titleCounts[t] > 1) t = l.name + ' (' + l.code + ') | Zale IT'; // guarantee uniqueness
  return t;
}

function laptopDescription(l) {
  const avail = l.stock > 0 ? 'In stock' : l.eta ? 'Awaiting stock (ETA ' + l.eta + ')' : 'Available to order';
  if (l.specLine) {
    return `${l.brand} ${l.name}: ${l.specLine}. ${C.money(l.priceExGst)} ex GST from Zale IT, Brisbane. ${avail} — enquire for a tailored quote.`;
  }
  const snip = C.snippet(l.descClean, 130);
  return `${l.brand} ${l.name} — ${snip || 'business laptop'}. ${C.money(l.priceExGst)} ex GST from Zale IT, Brisbane. ${avail}.`;
}

function availabilitySchema(l) {
  if (l.stock > 0) return 'https://schema.org/InStock';
  if (l.eta) return 'https://schema.org/BackOrder';
  return 'https://schema.org/InStock';
}

function laptopJsonLd(l) {
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: l.name,
    brand: { '@type': 'Brand', name: l.brand },
    sku: l.code,
    mpn: l.code,
    category: 'Laptops',
    description: l.descClean || (l.brand + ' ' + l.name + (l.specLine ? ' — ' + l.specLine : '')),
    offers: {
      '@type': 'Offer',
      url: l.url,
      priceCurrency: 'AUD',
      price: String(l.priceExGst),
      availability: availabilitySchema(l),
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Zale IT' },
    },
  };
  if (l.image) product.image = C.encodeImageUrl(l.image);
  // NOTE: aggregateRating / review intentionally omitted — we have no real
  // ratings and must not fabricate them.
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Laptops', item: SITE + '/category/laptops.html' },
      { '@type': 'ListItem', position: 3, name: l.name, item: l.url },
    ],
  };
  return (
    '<script type="application/ld+json">' + JSON.stringify(product) + '</script>\n' +
    '<script type="application/ld+json">' + JSON.stringify(breadcrumb) + '</script>'
  );
}

function relatedCards(l, allLaptops) {
  // Prefer same brand, then nearest price; up to 4, excluding self.
  const others = allLaptops.filter((x) => x.slug !== l.slug);
  others.sort((a, b) => {
    const sa = a.brand === l.brand ? 0 : 1;
    const sb = b.brand === l.brand ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return Math.abs(a.priceExGst - l.priceExGst) - Math.abs(b.priceExGst - l.priceExGst);
  });
  const picks = others.slice(0, 4);
  if (!picks.length) return '';
  const cards = picks
    .map(
      (r) =>
        `<a class="rel-card" href="${e(r.url)}"><span class="rc-brand">${e(r.brand)}</span>` +
        `<span class="rc-name">${e(r.name)}</span>` +
        `<span class="rc-price"><span class="pc-rrp">ex GST</span> ${C.money(r.priceExGst)}</span></a>`
    )
    .join('');
  return `<section class="related"><div class="wrap"><h2>Related laptops</h2><div class="rel-grid">${cards}</div></div></section>`;
}

function renderLaptopPage(l, allLaptops, titleCounts) {
  const title = laptopTitle(l, titleCounts);
  const description = laptopDescription(l);
  const specChips = Object.keys(l.specs).length
    ? `<div class="pdp-specs">${['cpu', 'ram', 'storage', 'screen']
        .filter((k) => l.specs[k])
        .map((k) => `<span class="pb">${e(k === 'ram' ? l.specs[k] + ' RAM' : k === 'storage' ? l.specs[k] + ' SSD' : l.specs[k])}</span>`)
        .join('')}</div>`
    : '';
  const availLine =
    l.stock > 0
      ? '<span class="pc-stock in">In Stock</span>'
      : l.eta
      ? '<span class="pc-stock eta">Awaiting stock — ETA ' + e(l.eta) + '</span>'
      : '<span class="pc-stock order">Available to Order</span>';
  const descBlock = l.descClean ? `<div class="pdp-desc">${e(l.descClean)}</div>` : '';

  return (
    head({
      title,
      description,
      canonical: l.url,
      image: l.image ? C.encodeImageUrl(l.image) : SITE + '/og-image.png',
      noindex: l.thin,
      jsonld: laptopJsonLd(l),
    }) +
    NAV +
    `<header class="phead"><div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>›</span> <a href="/category/laptops.html">Laptops</a> <span>›</span> ${e(l.name)}</nav>
    </div></header>
    <main class="wrap pdp">
      <div class="pdp-grid">
        <div>${imageCell(l, { pdp: true })}</div>
        <div>
          <span class="pdp-brand">${e(l.brand)}</span>
          <h1>${e(l.name)}</h1>
          <div class="pdp-model">Model: ${e(l.code)}</div>
          ${availLine}
          ${l.specLine ? `<p class="pdp-desc" style="margin:14px 0 0;font-weight:600;color:#1a1a1a">${e(l.specLine)}</p>` : ''}
          ${specChips}
          ${descBlock}
          <div class="pdp-pricebox">
            <div class="pdp-price"><span class="pc-rrp">ex GST</span>${C.money(l.priceExGst)}</div>
            <a class="pdp-cta" href="${e(C.enquiryHref(l.name))}">Enquire about this laptop &rarr;</a>
            <p class="pdp-note">Price in AUD, excludes GST. Contact us for a tailored quote and current availability.</p>
          </div>
        </div>
      </div>
      ${relatedCards(l, allLaptops)}
    </main>` +
    footer()
  );
}

// ---------------------------------------------------------------------------
// Category pages
// ---------------------------------------------------------------------------

function categoryDescription(label, n) {
  return `Browse ${n} ${label} ${n === 1 ? 'product' : 'products'} at Zale IT — business-grade hardware for Australian business, priced ex GST. Brisbane-based IT supply, configuration and delivery Australia-wide.`;
}

function categoryJsonLd(tab, label, url, items, laptopUrlByCode) {
  const list = items.slice(0, 500).map((it, i) => {
    const li = { '@type': 'ListItem', position: i + 1, name: it.name };
    const purl = it.source === 'feed' && it.code ? laptopUrlByCode[it.code] : null;
    if (purl) li.url = purl;
    return li;
  });
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: label + ' — Zale IT',
    url,
    description: categoryDescription(label, items.length),
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: list },
  };
  return '<script type="application/ld+json">' + JSON.stringify(obj) + '</script>';
}

function renderCategoryPage(tab, label, items, laptopUrlByCode) {
  const url = SITE + '/category/' + tab + '.html';
  const title = `${label} — Zale IT Hardware Catalogue | Brisbane`;
  const description = categoryDescription(label, items.length);
  const cards = items
    .map((it) => {
      const purl = it.source === 'feed' && it.code ? laptopUrlByCode[it.code] : null;
      return card(it, purl);
    })
    .join('');
  return (
    head({
      title,
      description,
      canonical: url,
      jsonld: categoryJsonLd(tab, label, url, items, laptopUrlByCode),
    }) +
    NAV +
    `<header class="phead"><div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>›</span> <a href="/catalogue.html">Catalogue</a> <span>›</span> ${e(label)}</nav>
      <span class="eyebrow">Category</span>
      <h1>${e(label)}</h1>
      <p>${e(items.length)} ${items.length === 1 ? 'product' : 'products'} — business-grade ${e(label.toLowerCase())} sourced, configured and delivered by Zale IT across Australia.</p>
      <div class="rrp-note">All prices shown are in AUD and exclude GST. Contact us for a tailored quote.</div>
    </div></header>
    <main class="wrap">
      <div class="pgrid">${cards}</div>
    </main>` +
    footer()
  );
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

function buildSitemap(lastmod, categoryTabs, laptops) {
  const urls = [];
  const add = (loc, cf, pr) =>
    urls.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${cf}</changefreq>\n    <priority>${pr}</priority>\n  </url>`);
  add(SITE + '/', 'monthly', '1.0');
  add(SITE + '/catalogue.html', 'daily', '0.9');
  categoryTabs.forEach((t) => add(SITE + '/category/' + t + '.html', 'daily', '0.8'));
  laptops.forEach((l) => add(l.url, 'weekly', '0.7'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function wipe(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const feed = (data && data.products) || [];
  const lastmod = (data && data.lastUpdated ? String(data.lastUpdated) : new Date().toISOString()).slice(0, 10);

  // Clean regenerate — removed products leave no orphaned pages.
  wipe(CAT_DIR);
  wipe(PROD_DIR);

  // Laptop pages first (so category cards can link to them).
  const titleCounts = Object.create(null);
  const laptops = buildLaptops(feed);
  const laptopUrlByCode = Object.create(null);
  laptops.forEach((l) => (laptopUrlByCode[l.code] = l.url));

  let thinCount = 0;
  laptops.forEach((l) => {
    if (l.thin) thinCount++;
    fs.writeFileSync(path.join(PROD_DIR, l.slug + '.html'), renderLaptopPage(l, laptops, titleCounts), 'utf8');
  });

  // Category pages — all 12 tabs.
  const all = buildAll(feed);
  const usedTabs = [];
  C.TABS.forEach((t) => {
    const items = all.filter((it) => it.tab === t.id);
    if (!items.length) return;
    usedTabs.push(t.id);
    fs.writeFileSync(path.join(CAT_DIR, t.id + '.html'), renderCategoryPage(t.id, t.label, items, laptopUrlByCode), 'utf8');
  });

  // Sitemap (overwrites Round 1's static file).
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), buildSitemap(lastmod, usedTabs, laptops), 'utf8');

  console.log(
    `Generated ${usedTabs.length} category pages + ${laptops.length} laptop pages ` +
      `(${thinCount} noindex) · sitemap: ${2 + usedTabs.length + laptops.length} URLs · lastmod ${lastmod}.`
  );
  return { categories: usedTabs.length, laptops: laptops.length, thin: thinCount };
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('build-catalogue-pages failed:', err.message);
    process.exit(1);
  }
}

module.exports = {
  main, buildLaptops, buildAll, renderLaptopPage, renderCategoryPage,
  laptopJsonLd, laptopTitle, buildSitemap, card, imageCell,
};
