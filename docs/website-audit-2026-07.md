# Zale — Public Website Audit

**Audit date:** 30 July 2026
**Scope:** `zaleit.com.au` — every route, asset, template, function, workflow and generated page in this repository
**Artefact under review:** commit `00771c1`
**Audience:** executive leadership, enterprise buyers, strategic partners, investors

---

## 0. How to read this report

Findings are numbered `F-01`…`F-44` and carry a severity:

| Severity | Meaning |
|---|---|
| **P0 — Critical** | Causes outage, legal exposure, secret disclosure, or blocks the primary conversion path. Fix now. |
| **P1 — High** | Materially damages credibility, conversion, or discoverability. Fix this quarter. |
| **P2 — Medium** | Real defect with contained impact. Fix opportunistically. |
| **P3 — Low** | Polish, consistency, hygiene. |

Every P0/P1 finding is given the full thirteen-field treatment requested (severity, evidence, root cause, business impact, technical impact, industry comparison, recommended implementation, migration strategy, dependencies, effort, priority, customer impact, conversion impact). P2/P3 findings are consolidated into tables in §9 with the same fields compressed, because spreading twelve paragraphs across a CSS token inconsistency would bury the findings that matter.

**On numbers.** Every quantity in the Evidence sections is measured from this repository and reproducible — file, line, byte count, or computed ratio. Where a figure is a *projection* (effort, conversion lift) it is explicitly labelled **[est.]**. No conversion percentage in this report is presented as measured fact, because — see **F-11** — the site currently has no analytics of any kind, so Zale has no baseline to measure against. That is itself one of the most important findings.

**On sourcing, stated plainly.** This audit's evidence base is the repository, not the open web. Every finding is anchored to code we can point at. The **Industry comparison** sections describe well-established, widely-observable patterns in the named platforms' public sites — they are *not* citations, and no external statistic, survey result or benchmark percentage is quoted anywhere in this report. References to legal instruments and standards (Australian Consumer Law, Privacy Act 1988 and the Australian Privacy Principles, Spam Act 2003, Disability Discrimination Act 1992, WCAG 2.2 success criteria, SOC 2 and ISO/IEC 27001) are given at the level of generality stated and are flagged as *risk* rather than as legal advice or as adjudicated breach; several are explicitly qualified where applicability depends on facts we cannot determine from the code, such as Zale's annual turnover or whether a representation is made to a consumer. **Before this report is put in front of enterprise customers or investors, the legal and compliance findings (F-05, F-06, F-12, F-13, F-36, F-44) should be confirmed by Australian counsel.** A companion appendix of verified primary-source citations was attempted, and its outcome is worth reporting rather than hiding. Two research passes ran, each fanning out to fetch primary sources and then subjecting every extracted claim to a three-vote adversarial verification. Most of both passes was lost to upstream rate limiting. Of the claims that did complete verification, **one was confirmed 3–0** (cited in F-15) and **three were refuted** — including a set of specific, confident-sounding developer-survey percentages and an attribution of a documentation framework to one of the benchmark platforms. Those refutations are the reason this report quotes no external statistic: the claims that died in verification are precisely the kind that would have read as authoritative here.

Separately, and materially for §F-05, F-06, F-12, F-13, F-36 and F-44: **every Australian regulator source was unreachable from the audit environment**, with `accc.gov.au`, `oaic.gov.au`, `cyber.gov.au` and `humanrights.gov.au` all returning HTTP 403 under an egress policy blocking `*.gov.au`. The regulatory findings in this report are therefore stated from general knowledge at the level of generality given, and are **unverified against the primary sources** — not merely uncited. This does not weaken the underlying findings, which rest on measured facts about the code (there is no privacy policy; personal data is sent to two overseas processors; a $0 offer is published; two uptime figures conflict). It does mean the *legal characterisation* of those facts must be confirmed by Australian counsel before this report is relied upon externally.

---

## 1. Executive summary

### 1.1 The headline

The audit brief asks us to transform Zale's website into a world-class multi-product cloud platform site comparable to Cloudflare, Stripe and Vercel, presenting Zale Hosting, Zale DB, Roster, the Hospitality Ordering Platform and seven future services as one cohesive operating system.

**None of those products exist on the website.** Not as a page, not as a nav item, not as a footer link, not as a sentence.

What exists today is:

- **One** HTML file (`index.html`, 2,098 lines, 132 KB, all CSS and JavaScript inline) marketing Brisbane-based IT support and cybersecurity services, navigated entirely by in-page anchors.
- **202** generated pages of third-party hardware catalogue, resold from a supplier XML feed (`catalogue.html`, 12 category pages, 189 laptop pages).
- **One** serverless function (`functions/api/contact.js`) that forwards a contact form to Formspree and Brevo.

That is the entire public surface. There is no pricing page, no documentation, no API, no SDK, no CLI, no status page, no security page, no compliance page, no privacy policy, no terms of service, no SLA, no changelog, no roadmap, no blog, no case study, no customer logo, no login, no signup, no dashboard, and no account concept.

**The gap between stated ambition and shipped reality is not a backlog. It is the finding.** A visitor cannot discover a single Zale platform product today, so no amount of hero-copy polish moves the business toward the platform thesis. This report therefore does two things: it fixes what is broken and dangerous *now* (§3–§4), and it specifies the information architecture and build sequence that turns the site into a platform surface (§6–§8).

### 1.2 The five things that need to happen this week

Ranked by risk, not by effort:

1. **F-01 — Rotate the leaked supplier feed token.** A live MMT feed credential is committed in plaintext at `scripts/fetch-stock.js:26`. That feed carries trade (wholesale) pricing that the code deliberately withholds from the public site. Anyone with repository read access can pull Zale's cost base.
2. **F-02 — Remove the JavaScript-gated black screen.** The entire website is hidden behind an opaque full-viewport overlay that only JavaScript can remove, and the code that removes it sits 256 lines deep in a single unguarded 400-line script block. One thrown exception and the site is a permanent black rectangle. There is no `<noscript>`, no CSS fallback, no error boundary.
3. **F-03 — Gate the auto-merge-to-production pipeline.** Any push to any `claude/**` branch fast-forwards `main` and deploys, with zero review and zero tests. Combined with F-02, one bad commit is a silent total outage.
4. **F-04 — Add a feed sanity threshold.** A scheduled job rebuilds the catalogue daily and force-deletes every generated page each run. An empty or schema-drifted supplier response deletes 201 of the site's 203 indexable URLs overnight and pushes it to production unreviewed.
5. **F-05 — Publish a privacy policy, and reconcile the claims that contradict it.** The site collects personal information, ships it to two overseas processors, and has no privacy policy anywhere — while the homepage asserts "100% Australia-based" and "Nothing offshore, ever."

### 1.3 Scorecard

| Dimension | Grade | One-line verdict |
|---|:---:|---|
| Platform positioning | **F** | Zero of the twelve named products are on the site. |
| Information architecture | **F** | Five anchors and one real page link. Cannot express 12 products. |
| Developer experience | **F** | No docs, API, SDK, CLI, OpenAPI, sandbox or code sample. |
| Enterprise readiness | **F** | No security, compliance, SLA, DPA, subprocessor or terms page. |
| Legal / regulatory | **F** | No privacy policy; unsubstantiated and self-contradicting claims. |
| Trust & social proof | **D−** | Vendor logos hand-drawn; zero customers named; conflicting stats. |
| Reliability & CI | **D−** | Unreviewed auto-deploy; no tests; no feed guard; no monitoring. |
| Security posture | **D−** | Leaked token; no CSP/HSTS; open CORS; unprotected form. |
| Performance | **D** | Deliberate 1.5–3.2 s blank screen; 259 KB gzip data fetch. |
| Accessibility (WCAG 2.2 AA) | **C−** | Good reduced-motion work undermined by contrast and focus failures. |
| SEO / discoverability | **D** | 99.5 % of URLs are resold catalogue; services have one URL. |
| Measurement | **F** | No analytics. No baseline. No funnel. Nothing is measurable. |
| Visual craft & motion | **B−** | Genuinely accomplished execution — the strongest thing here. |
| Code health | **C** | Clean, well-commented generator scripts; monolithic front end. |

### 1.4 What is genuinely good, and should be protected

An audit that only lists failures is not credible. The following are above the standard we would expect at this stage and should survive the rebuild:

- **`prefers-reduced-motion` is handled seriously.** Eleven separate media queries, a global animation kill-switch, and per-component fallbacks that reflow the marquee to a static wrapped list rather than just freezing it (`index.html:762–768`). Many funded startups do worse.
- **The generated catalogue pages are well-built.** Correct `Product` + `Offer` + `BreadcrumbList` JSON-LD, accurate `lang="en-AU"`, one `<h1>` per page, correct self-referencing canonicals, and images with `width`, `height`, `loading="lazy"`, `decoding="async"`, real `alt` text and an `onerror` fallback chain (`category/laptops.html`). That is a better image implementation than the hand-written homepage, which has no images at all.
- **The `_headers` caching strategy is deliberate and correctly reasoned**, including the `stale-while-revalidate` window on the data feed and the comment explaining why static assets are intentionally excluded.
- **The generator scripts are clean, commented, and explain their own trade-offs** — including why `sku` is empty and why `deepFind` exists. This is maintainable code.
- **The `?enquiry=` handoff works.** Product pages pass the product name to the homepage form, and the homepage reads and pre-fills it (`index.html:2077–2081`). The intent is right.
- **The visual and motion design is legitimately strong.** The mesh gradients, hex wireframes, trace animations and conic CTA sweep are executed with care and taste.

The problem is not craft. The problem is that the craft is aimed at a brochure while the business plan describes a cloud platform, and the foundations underneath the craft — legal, security, measurement, CI — are missing.

---

## 2. What was audited

| Surface | Count | Notes |
|---|---:|---|
| Hand-authored HTML pages | 2 | `index.html`, `catalogue.html` |
| Generated category pages | 12 | `category/*.html` |
| Generated product pages | 189 | `product/*.html` — laptops only |
| **Total indexable URLs** | **203** | Matches `sitemap.xml` exactly ✅ |
| Serverless functions | 1 | `functions/api/contact.js` |
| Build/data scripts | 4 | `scripts/*.js` |
| CI workflows | 3 | `.github/workflows/*.yml` |
| Stylesheets | 1 | `assets/site-pages.css` (125 lines) — homepage CSS is inline |
| Binary assets | 1 | `og-image.png` (32 KB) |
| Data files | 1 | `catalogue-data.json` — 1,684,912 bytes, 2,021 products |
| Legal / trust pages | **0** | — |
| Documentation pages | **0** | — |
| Product pages for named Zale products | **0** | — |

### 2.1 Products named in the brief vs. products on the site

| Product | On site? | Nav? | Docs? | Pricing? |
|---|:---:|:---:|:---:|:---:|
| Zale Hosting | ❌ | ❌ | ❌ | ❌ |
| Zale DB | ❌ | ❌ | ❌ | ❌ |
| Roster | ❌ | ❌ | ❌ | ❌ |
| Hospitality Ordering Platform | ❌ | ❌ | ❌ | ❌ |
| Zale AI | ❌ | ❌ | ❌ | ❌ |
| Zale Storage / Queue / Functions / CDN / Payments | ❌ | ❌ | ❌ | ❌ |
| Marketplace / Developer Platform | ❌ | ❌ | ❌ | ❌ |

The homepage's `#services` section markets *service lines* — "Email & Microsoft 365", "Cloud Hosting & Servers", "Device Management", "Cybersecurity", "Managed IT Support", "Compliance & Data Protection", "AI Assistants (Copilot)", "Hardware Supply". These are an MSP's service catalogue, resold on top of Microsoft. They are not the products in the brief, and one of them — "AI Assistants (Copilot)" — is explicitly positioned as *Microsoft* Copilot Studio, not Zale AI.

**This distinction is the strategic crux.** An MSP reselling Microsoft licences and Lenovo laptops and a cloud platform selling metered primitives are different businesses with different websites, different buyers, different unit economics and different valuations. The website currently describes the first. The brief describes the second. §6 resolves this rather than papering over it.

---

## 3. P0 — Critical findings

### F-01 · Live supplier API credential committed in plaintext

**Severity:** P0 — Critical (secret disclosure)

**Evidence**
`scripts/fetch-stock.js:24–27`:
```js
const FEED_URL =
  'https://www.mmt.com.au/dwapi/Feeds/GetFeedOutput?Id=2&lt=s&ft=xml' +
  '&tk=2f8788cc-****-****-****-************' +   // ← redacted in this report; live value is in the file
  '&af[]=ai&af[]=dp&…';
```
The `tk` parameter is a live access token for the MMT distributor feed, hardcoded and committed. It is present in the full git history, so removing it from `HEAD` does not revoke it.

The same file's header comment establishes exactly why this matters:
> *"We never read or emit YourPrice (trade price)."*

The feed therefore carries Zale's **wholesale cost base**, which the site deliberately withholds. The token grants that data to anyone who can read this repository — and to anyone who has ever been able to.

**Root cause**
No secret-management convention for build-time credentials. The repository already demonstrates the correct pattern twice — `BREVO_API_KEY` is injected via `secrets.BREVO_API_KEY` in `weekly-clearance.yml`, and `functions/api/contact.js:161` reads it from `env` with an explicit "never hardcode it" comment. The feed token simply never got the same treatment.

**Business impact**
Competitor access to Zale's margin structure on ~2,021 SKUs. Distributor agreements routinely make feed credentials non-transferable and non-disclosable; disclosure is plausible grounds for termination, which would take the entire catalogue — 99.5 % of the site's indexable surface — offline. In a funding or acquisition diligence process, a committed live credential in the primary repository is a standard finding that triggers a broader secrets review.

**Technical impact**
Third parties can invoke the feed at will, consuming whatever rate budget MMT allocates and potentially causing Zale's own scheduled job to be throttled or blocked. There is no detection: no secret scanning, and `run_secret_scanning` is not enabled in CI.

**Industry comparison**
Every platform in the comparison set treats this as a release blocker. GitHub ships push protection and secret scanning by default on public repositories; Cloudflare and Vercel both provide encrypted environment variables specifically so build-time credentials never enter version control. The baseline expectation is *zero* secrets in git, enforced mechanically rather than by convention.

**Recommended implementation**
1. **Rotate first.** Request a new token from MMT and invalidate the current one. Rotation is the only action that actually remediates disclosure; everything else is hygiene.
2. Move the token to `secrets.MMT_FEED_TOKEN`; read it as `process.env.MMT_FEED_TOKEN` and fail fast with a clear message if absent.
3. Add `env: MMT_FEED_TOKEN: ${{ secrets.MMT_FEED_TOKEN }}` to `update-stock.yml` and `weekly-clearance.yml`.
4. Enable GitHub secret scanning **and** push protection on the repository.
5. Add a pre-commit hook (`gitleaks` or `trufflehog`) so the next one is caught locally.
6. Decide explicitly whether to purge history. Purging requires a force-push that rewrites every commit SHA and breaks the `--ff-only` assumption in `auto-merge.yml`. **Recommendation: rotate, do not rewrite.** Once the token is dead the historical copy is inert, and history rewriting on a repo with active automation carries more operational risk than it removes.

**Migration strategy**
Fully backward compatible and independently deployable. Land the code change reading from `env` with a temporary fallback to the literal, deploy, add the secret, confirm a green scheduled run, then delete the fallback. Zero downtime, no consumer-visible change.

**Dependencies** MMT account access to issue a new token; repository admin to enable scanning and add secrets.

**Effort** **[est.]** 2–4 hours engineering, plus MMT turnaround on rotation.

**Priority** Immediate — before any other work in this report.

**Customer impact** None directly. Indirect protection against a catalogue-wide outage.

**Conversion impact** None directly; prevents a scenario that removes 99.5 % of indexable pages.

---

### F-02 · The whole website is hidden behind a JavaScript-gated opaque overlay

**Severity:** P0 — Critical (total availability risk + severe performance)

**Evidence**

The overlay (`index.html:782–783`):
```css
#loadScreen{position:fixed;inset:0;z-index:9999;background:#0a0a0a;display:grid;place-items:center;
            transition:opacity .6s ease,visibility .6s ease}
#loadScreen.done{opacity:0;visibility:hidden}
```
`inset:0` at `z-index:9999` with an opaque `#0a0a0a` fill — it covers the entire viewport. It is added to the markup at `index.html:936`, before any content.

The only thing that removes it (`index.html:1953–1955`):
```js
function hideLoad(){ if(loadScreen){ loadScreen.classList.add('done'); setTimeout(function(){ loadScreen.remove(); },700); } }
window.addEventListener('load', function(){ setTimeout(hideLoad, reduce?100:900); });
setTimeout(hideLoad, 2600); // safety fallback
```

Three measured facts:

1. **There is exactly one `<script>` block**, spanning `index.html:1697–2096` — roughly 400 statements. The `hideLoad` registration sits at line 1953, **256 lines into it**. There is no `try`/`catch` anywhere in the file.
2. **Everything before line 1953 runs first, unguarded, and dereferences DOM nodes without null checks.** For example `index.html:1701–1707`:
   ```js
   var nav = document.getElementById('nav');
   var onScroll = function(){ if(window.scrollY > 12){ nav.classList.add('scrolled'); } … };
   ```
   and `index.html:1719`: `burger.addEventListener('click', …)`. Any thrown exception in those 256 lines aborts the block, `hideLoad` is never registered, and the overlay is never removed.
3. **There is no `<noscript>` anywhere in the file** (measured: 0 occurrences) and no CSS-only escape hatch — no `html.no-js` rule, no `@keyframes` that self-hides the overlay.

**Consequence A — total outage from a single error.** A JS exception, a blocked script, a corrupted deploy, a future Content-Security-Policy that blocks inline script (see F-08), or a browser with JavaScript disabled all produce the same result: **a permanent black screen with the word "ZALE" on it.** Not degraded content — no content. Every section, the entire contact form, and the only conversion path on the site are behind that overlay.

**Consequence B — a deliberate blank screen on every single visit.** Even in the fully healthy path, content is withheld for `min(load + 900 ms, 2600 ms)`, then fades over 600 ms. So:

| Scenario | Content hidden for |
|---|---|
| Warm cache, fast connection | **~1.5 s** (900 ms timer + 600 ms fade) |
| Cold cache, mobile | **up to 3.2 s** (2,600 ms cap + 600 ms fade) |

The `load` event is the gate, and `load` waits for *all* subresources — including the render-blocking Google Fonts stylesheet at `index.html:11` and its font files. So the artificial delay stacks on top of the slowest third-party request.

**Root cause**
An aesthetic decision — a scan-line brand reveal — was implemented as a blocking gate over the document rather than as a non-blocking decoration. The `2600` fallback shows the author anticipated the failure mode and reached for a timer instead of removing the dependency.

**Business impact**
Every visitor is charged 1.5–3.2 seconds of nothing before they can read a word or reach the contact form, on a site whose sole conversion action is that form. Bounce is concentrated exactly in that window because the page is indistinguishable from a broken site. And the tail risk is uncapped: one bad deploy is a silent, unmonitored, total outage — nobody is alerted, because there is no monitoring (F-11) and no status page.

**Technical impact**
Directly degrades LCP and FCP: the largest contentful element cannot be a content element until the overlay clears. `#0a0a0a` against the `#76b900` load logo is the first meaningful paint, and the real hero replaces it 1.5–3.2 s later — which also risks a layout-shift penalty at the swap. It also makes the site untestable by synthetic tooling in a representative way, and it couples 100 % of content availability to 100 % of script success.

**Industry comparison**
No site in the comparison set gates content on a preloader. Vercel, Linear, Stripe and Supabase all server-render content that is readable before hydration; the modern default is that JavaScript *enhances* a page that already works. Google's published "good" LCP threshold is ≤ 2.5 s at the 75th percentile — this implementation can consume the entire budget before rendering anything, and on a warm cache still burns 60 % of it on an animation.

**Recommended implementation**
The brand reveal can be kept. The gate cannot.

1. **Invert the overlay.** Make the document visible by default and let the overlay be a decorative layer that animates *out* on its own, in CSS, with no JS dependency:
   ```css
   #loadScreen{animation:loadOut .5s ease .35s forwards;pointer-events:none}
   @keyframes loadOut{to{opacity:0;visibility:hidden}}
   @media (prefers-reduced-motion:reduce){#loadScreen{display:none}}
   ```
   Now the worst case if JS never runs is a half-second decoration, not an outage.
2. **Delete the `load` dependency and the 900 ms timer.** If a JS hook is still wanted, fire it on `DOMContentLoaded`, never `load`.
3. **Wrap the script block in `try`/`catch`**, or split it into independent IIFEs per feature so one failure cannot cascade. Splitting is better: it makes each feature independently degradable.
4. **Add null guards** to the DOM lookups at lines 1701–1719 and everywhere following.
5. **Add a `<noscript>` block** confirming the page works and surfacing the `mailto:` contact path.
6. **Move the script to an external file with `defer`** so it is cacheable and CSP-noncible (prerequisite for F-08).

**Migration strategy**
Independently deployable, fully backward compatible, no URL or markup contract changes. Ship the CSS inversion first (removes the outage risk immediately, one-line-ish change), then the script split, then the external-file move. Each step is separately revertable.

**Dependencies** None for steps 1–2. Step 6 should land with F-08 (CSP) to avoid touching the same lines twice.

**Effort** **[est.]** Steps 1–2: 2 hours. Steps 3–5: 1 day. Step 6: 0.5 day.

**Priority** Immediate — highest-value single change on the site.

**Customer impact** Every visitor sees content 1.5–3.2 s sooner. Tail-risk of total outage eliminated.

**Conversion impact** **[est.]** Directionally large and positive, but *deliberately not quantified here* — Zale has no analytics baseline (F-11), so any percentage would be invented. Instrument first (F-11), then measure this change as the first controlled experiment. It is the cleanest available A/B test on the site.

---

### F-03 · Unreviewed, untested auto-merge straight to production

**Severity:** P0 — Critical (release governance)

**Evidence**
`.github/workflows/auto-merge.yml`, in full:
```yaml
on:
  push:
    branches:
      - 'claude/**'
jobs:
  auto-merge:
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0, token: "${{ secrets.GITHUB_TOKEN }}" }
      - name: Merge to main
        run: |
          git checkout main
          git merge --ff-only origin/${{ github.ref_name }}
          git push origin main
```
Any push to any branch matching `claude/**` fast-forwards `main` and pushes it. `main` is the Cloudflare Pages production branch, so **push to branch → live site**, with:

- no pull request,
- no review,
- no status checks (there are none in the repository — no test, lint, build-verify, link-check, HTML-validation or Lighthouse workflow exists),
- no branch protection that could stop it, since it runs with `contents: write`.

All three workflows in the repository push directly to `main`. None runs a single test.

> **Confirmed live during this audit.** Pushing the audit branch `claude/zale-website-audit-zlywun` fast-forwarded `main` to commit `ffde7db` within seconds of the push, unattended. No pull request was created — one could not be, because by the time it was requested GitHub reported *"No commits between main and claude/zale-website-audit-zlywun"*: the merge had already happened. The commit is therefore live in production with no review, no approval and no checks. This audit adds only documentation under `docs/`, so the production impact was a new unlinked Markdown file — but the mechanism is the finding, and it has now been demonstrated rather than inferred. Any commit reaching a `claude/**` branch ships.

**Root cause**
Automation built for velocity on a solo-maintained brochure, retained unchanged as the site became revenue-facing. `--ff-only` is a genuine partial mitigation — it prevents merge-commit surprises and refuses when `main` has diverged — but it constrains *history shape*, not *content correctness*.

**Business impact**
There is no mechanism by which a bad change is caught before customers see it. Combined with F-02 (one JS error = black screen) and F-11 (no analytics, no monitoring, no alerting), the realistic failure mode is: a broken deploy goes live, nobody is notified, and it is discovered when a customer or the founder happens to load the site. For an enterprise buyer performing vendor diligence, "we deploy to production with no review and no tests" is a disqualifying answer to a standard change-management question — and it is the answer SOC 2 change-management controls (CC8.1) exist to prevent, which matters directly to the ISO 27001 ambition asserted on the homepage.

**Technical impact**
No CI gate anywhere. No rollback runbook. No deploy notification. Cloudflare Pages retains previous deployments so rollback is *possible*, but it is manual and undocumented, and nothing detects that it is needed.

**Industry comparison**
Universal in the comparison set: required reviews plus required status checks on the production branch, and preview deployments per PR. GitHub, Vercel and Cloudflare Pages all provide preview deployments out of the box — Zale is paying for the platform and not using the safety features it ships with.

**Recommended implementation**
1. **Keep the automation, add the gate.** Change `auto-merge.yml` to open a PR rather than merge, then enable auto-merge conditional on checks passing (`gh pr merge --auto --squash`, or `enable_pr_auto_merge`). Velocity is preserved; the unreviewed path is removed.
2. **Create the checks that must pass.** A minimal but real `ci.yml`:
   - `node --check` on all scripts, plus the existing `module.exports` test surface in `catalogue.html:544`;
   - HTML validation on `index.html`, `catalogue.html` and a sample of generated pages;
   - internal link check across all 203 URLs;
   - Lighthouse CI with a performance budget (see F-10) as a **required** check;
   - `axe-core` accessibility scan on the homepage, catalogue and one product page.
3. **Enable branch protection on `main`:** require the checks, require the PR, disallow force-push. Scheduled jobs need an explicit bypass or a `github-actions` allowance.
4. **Turn on Cloudflare Pages preview deployments** for every PR so changes are reviewable in a browser before merge.
5. **Add deploy notifications** to email or Slack so a production change is never silent.

**Migration strategy**
Land `ci.yml` in report-only mode first so the team sees what currently fails without blocking. Fix those. Then flip the checks to required and switch `auto-merge.yml` to the PR flow. Backward compatible throughout; the scheduled feed jobs need their bypass configured in the same change.

**Dependencies** Repository admin for branch protection. F-04 should land alongside, since the feed job is the automation most likely to break production.

**Effort** **[est.]** 1–2 days for CI plus protection; 0.5 day for previews and notifications.

**Priority** Immediate — this is the control that makes every other fix in this report safe to ship.

**Customer impact** Prevents customer-visible breakage.

**Conversion impact** Indirect — protects the conversion path from silent regression.

---

### F-04 · The daily catalogue job can delete 201 of 203 URLs, unreviewed

**Severity:** P0 — Critical (data-driven self-destruct path)

**Evidence**

`scripts/fetch-stock.js` validates the HTTP status and nothing else:
```js
if (!res.ok) { throw new Error(`Feed request failed: HTTP ${res.status} …`); }
```
It then parses, maps, filters, and writes unconditionally:
```js
const kept = mapped.filter((p) => p.stock > 0 || p.eta !== '');
…
fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
```
There is **no check that `kept.length` is plausible.** A `200 OK` carrying an empty envelope, an auth-expiry page, or a renamed `MMTCode` element yields `kept = []`, and `catalogue-data.json` is overwritten with `{"count":0,"products":[]}`.

`update-stock.yml` then runs the generator, whose own header comment states the destructive contract:
> *"the generator wipes and rebuilds `category/` and `product/` each run, so `git add -A` over those paths also stages deletions of pages whose products left the feed"*

and pushes to production with no gate:
```yaml
git add -A catalogue-data.json category product sitemap.xml assets
git commit -m "chore: update stock feed + catalogue pages $(date -u +%Y-%m-%d)"
git push origin HEAD:main
```

**The full failure chain, from one silent upstream change:** empty parse → 0 products → all 189 product pages and 12 category pages deleted → `sitemap.xml` rewritten from 203 URLs to 2 → committed → pushed to `main` → deployed. Runs at 22:00 UTC daily, unattended.

**This is not hypothetical — the schema is already drifting.** Measured from the current `catalogue-data.json`:

| Symptom | Count | % |
|---|---:|---:|
| Products with empty `category` (`ParentCategoryName` missing) | 28 | 1.4 % |
| Products with empty `description` | 71 | 3.5 % |
| Products with `rrp` ≤ 0 | **18** | 0.9 % |

The `pick(p, 'ParentCategoryName')` lookup is *already* returning empty for 28 products. The same mechanism that produces 28 empty categories produces 2,021 of them if MMT renames one element.

**Root cause**
The pipeline treats the supplier feed as trusted, complete and stably-shaped. There is no invariant asserting that a destructive regeneration is warranted, and no human in the loop between a third-party API response and a production deploy.

**Business impact**
An overnight loss of 99 % of indexable URLs. Recovery of git content is easy (`git revert`); recovery of search rankings is not — mass 404s and a collapsed sitemap trigger de-indexing, and re-crawling 201 URLs back to prior positions takes weeks. The failure is also invisible: no alerting, no monitoring, no status page.

**Technical impact**
Hard dependency on an external XML schema with no contract test, no snapshot, no staleness tolerance and no atomic write. A partial or malformed response is indistinguishable from a legitimate catalogue reduction.

**Industry comparison**
Standard practice for feed-driven catalogues is a **delta threshold with fail-closed semantics**: if the incoming record count deviates beyond a bound, abort and alert rather than publish. Google Merchant Center applies the same defensive posture, warning and retaining prior data on sudden large feed shrinkage rather than dropping the offers.

**Recommended implementation**
1. **Threshold guard in `fetch-stock.js`** — the single highest-value change:
   ```js
   const prev = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE,'utf8')) : null;
   const floor = prev ? Math.floor(prev.count * 0.7) : 100;
   if (kept.length < floor) {
     throw new Error(`Feed sanity check failed: ${kept.length} products, expected >= ${floor} (previous ${prev?.count}). Refusing to overwrite.`);
   }
   ```
   Fail before the write. The existing `main().catch(… process.exit(1))` already turns a throw into a red workflow.
2. **Field-level assertions**: abort if > 5 % of products have an empty `category`, or > 2 % have `rrp <= 0`. These bounds are exceeded only by real schema drift, and both are already measurable today.
3. **Drop `rrp <= 0` products** from `kept` regardless — see F-06, where one has reached production.
4. **Alert on failure**: notify on workflow failure so a red run is not silent.
5. **Write atomically**: write to `.tmp` and rename, so a crash mid-write cannot leave truncated JSON.
6. **Add a generator floor**: refuse to delete more than 20 % of existing generated pages in one run without an explicit `FORCE_REBUILD=1`.

**Migration strategy**
Purely additive and backward compatible. Land the guard in warn-only mode for one week to confirm the thresholds do not trip on normal feed variance, then switch to throwing. No consumer-visible change.

**Dependencies** Notification channel for step 4. Pairs naturally with F-03's CI work.

**Effort** **[est.]** 4–6 hours for steps 1–3 and 5; 2 hours for 4 and 6.

**Priority** Immediate.

**Customer impact** Prevents 201 pages of 404s and a broken catalogue.

**Conversion impact** Protects the organic-discovery path that currently accounts for 99.5 % of indexable surface.

---

### F-05 · No privacy policy, undisclosed overseas processors, and claims that contradict both

**Severity:** P0 — Critical (regulatory + misleading conduct)

**Evidence**

**(a) There is no privacy policy, and no link to one.** Measured: no file matching `*privacy*`, `*terms*`, `*legal*` exists anywhere in the repository. The complete set of unique `href` values in `index.html` is six in-page anchors, `catalogue.html`, one `mailto:`, the font URLs, the favicon data-URI, and the canonical. The footer (`index.html:1671–1695`) contains five anchor links, a copyright line, and a `mailto:` — **no privacy link, no terms link, no ABN/ACN.**

**(b) Personal information is collected and sent to two overseas processors.** `functions/api/contact.js` collects first name, last name, work email, business name, service interest and a free-text message, then:
- forwards all of it to **Formspree** (`formspree.io`, US) — line 16, unconditionally;
- on marketing consent, creates a contact in **Brevo** (`api.brevo.com`) with name, business and interests — lines 165–183.

Neither processor is named anywhere a visitor can see.

**(c) The form's only privacy statement is inaccurate.** `index.html:1657`:
> *"We'll only use your details to respond to your enquiry."*

This sits in the same form as a checkbox that adds the submitter to a Brevo marketing list. The two statements cannot both be true.

**(d) The homepage asserts the opposite of what the code does.** `index.html` hero and About section:
> *"100% Australia-based"* · *"Nothing offshore, ever."*

Measured third-party origins the browser actually contacts: `www.mmt.com.au` (2,749 references — every product image), `fonts.googleapis.com` (406), `www.google.com/s2/favicons` (317), `fonts.gstatic.com` (203). Plus, server-side, Formspree and Brevo. Visitor data leaves Australia on every page view.

**(e) The consent copy names the wrong company.** `index.html:1648`:
> *"I'd like to receive product updates and offers from **Zaleit IT**"*

Every other instance on the site is "Zale IT". The one string where the legal identity of the sender matters most is the one that gets it wrong.

**Root cause**
The site was built as a brochure and grew a data-collection backend without the legal layer that collection requires. No compliance review gate exists in the release process (which is itself F-03).

**Business impact**
Three distinct exposures:

1. **Privacy.** Australian Privacy Principle 1 requires an APP entity to maintain a clearly expressed, up-to-date privacy policy and to make it *freely available* — in practice, on the website. APP 5 requires notification of collection at or before the time of collection; APP 8 governs cross-border disclosure. Zale collects personal information, discloses it overseas, and has no policy. Whether Zale is currently an APP entity turns on annual turnover (the small-business exemption), **and the 2024–2026 Privacy Act reform program is narrowing that exemption** — so this is a gap that closes on Zale rather than one it grows out of. Any enterprise or government-adjacent customer will require a policy and a DPA regardless of the statutory threshold.
2. **Misleading conduct.** Australian Consumer Law s18 prohibits misleading or deceptive conduct. "Nothing offshore, ever" alongside four overseas front-end origins and two overseas processors, and "We'll only use your details to respond to your enquiry" alongside a marketing-list sync, are both representations contradicted by the site's own implementation.
3. **Email marketing.** The Spam Act 2003 requires consent, accurate sender identification, and a functional unsubscribe facility. The consent checkbox is correctly unticked by default — good — but it identifies the sender as "Zaleit IT", an entity that does not exist.

**Technical impact**
No consent record is persisted beyond Brevo's own contact attributes — no timestamp, no IP, no version of the terms consented to, which is what an actual consent audit requires. No mechanism exists for access or deletion requests. `Access-Control-Allow-Origin: "*"` on the endpoint (F-07) means submissions can originate anywhere, so even Brevo's record of provenance is unreliable.

**Industry comparison**
Every platform in the comparison set publishes, at minimum: a privacy policy, terms of service, a DPA, and a named subprocessor list — usually under a `/legal` or `/trust` hub reachable from the footer of every page. Stripe, Cloudflare and Vercel all maintain public subprocessor registries precisely because enterprise procurement requires them. Zale has none of these and is asking enterprise buyers to trust an "ISO 27001 Aligned" badge instead (F-12).

**Recommended implementation**
1. **Ship `/legal/privacy`** covering: what is collected, why, the named processors (Formspree, Brevo, Cloudflare, Google Fonts), cross-border disclosure and destinations, retention, access/correction/complaint process, and a contact point. Link it from the footer of **all 203 pages** — the generated templates in `scripts/build-catalogue-pages.js` make this a one-place change.
2. **Ship `/legal/terms`.** Required before any of the F-12 service-level claims can responsibly stand.
3. **Correct the form copy** to state plainly that details are used to respond and, with consent, to send updates — with a link to the policy.
4. **Fix "Zaleit IT" → "Zale IT"** and audit the string across the repository.
5. **Resolve the "Nothing offshore, ever" claim.** Either qualify it precisely (it is presumably about *support staffing*, which is a legitimate and strong differentiator) or remove it. Recommended wording: *"Your support team is in Brisbane — no offshore call centres."* That keeps the differentiator and is true.
6. **Self-host the two fonts** (removes 2 of 4 overseas origins, and helps LCP — F-10).
7. **Replace the Google favicon service** with locally-stored brand assets (removes a third origin, and see F-13).
8. **Persist consent records** — timestamp, policy version, source URL — in the function.

**Migration strategy**
Additive: new pages plus copy edits, no existing URL changes. Publish the policy first (it is the item with legal weight), then the copy corrections, then the origin removals, which are independently deployable.

**Dependencies** Legal review of the policy and terms. Confirmation of Zale IT Pty Ltd's ACN and turnover position.

**Effort** **[est.]** 1 day engineering plus legal drafting time (external). Items 4–6 are hours.

**Priority** Immediate — item 1 gates enterprise sales entirely.

**Customer impact** Enterprise and government-adjacent buyers can complete procurement, which is currently impossible.

**Conversion impact** Removes an absolute blocker on enterprise deals rather than incrementally improving a rate.

---

### F-06 · A page titled "PHYSICAL DAMAGE …" is published at $0, marked In Stock

**Severity:** P0 — Critical (content integrity, invalid structured data, price representation)

**Evidence**

`product/bv5l6pt-q.html` is live, indexable, in `sitemap.xml`, and carries this JSON-LD:
```json
"price":"0","availability":"https://schema.org/InStock"
```
Its `<title>`:
> `PHYSICAL DAMAGE HP Zbook 8 7-255H 16" 32GB DDR5-6400 1TB · 32GB / 1TB | Zale IT`

So the page presents a **$0**, **In Stock** offer for a product whose name announces it is physically damaged — with `Product`/`Offer` markup telling Google the same thing.

This is not isolated; it is an ungated class. Measured across the feed:

| Supplier condition prefix | In feed | Published as a page |
|---|---:|---:|
| `BOX DAMAGED` | 3 | 1 |
| `BOX OPENED` | 3 | 1 |
| `OPEN BOX` | 1 | 0 |
| `PHYSICAL DAMAGE` | 1 | **1** |
| `REFURB` | 1 | 0 |
| **Total** | **9** | **2** |

And separately, **18 feed products have `rrp <= 0`**, of which one has reached a published page. The prefixes also leak into `alt` text on category pages — e.g. `alt="BOX DAMAGED HP EliteBook 8 G1i 14&quot; WUXGA IR"` in `category/laptops.html`.

**Root cause**
`buildLaptops()` in `scripts/build-catalogue-pages.js` filters on `C.isLaptopFeedProduct(p) && !C.isExcludedUnit(p.name) && p.code`. There is a name-based exclusion mechanism — `isExcludedUnit` — but it does not cover supplier condition prefixes, and **nothing validates price at all**. Supplier-internal warehouse annotations are treated as product names and published verbatim.

**Business impact**
A prospective buyer's Google result for an HP ZBook can be a Zale page headlined "PHYSICAL DAMAGE" at $0. That is worse than having no page. A $0 In-Stock offer is also a price representation: under ACL s29 a business must not make false or misleading representations about price, and an advertised $0 that will not be honoured is precisely that. Google's structured-data policies require markup to reflect the visible page and to be accurate; a $0 offer risks rich-result invalidation or a manual action against the catalogue.

**Technical impact**
`Offer.price = "0"` fails Google's Merchant listing requirements and will surface in Search Console as an invalid item. Because the generator wipes and rebuilds every run, the defect recurs whenever such a product is in the feed — the population is stochastic, so the site's public quality varies daily with MMT's warehouse notes.

**Industry comparison**
Shopify, and every mature commerce platform, enforces publish-time validation: a product with no valid price cannot go live. The applicable pattern is a content gate between supplier data and public pages — Zale currently has none.

**Recommended implementation**
1. **Price validation, non-negotiable:** exclude any product with `rrp <= 0` from both `catalogue-data.json` (F-04, step 3) and page generation. A product with no price is not a publishable product.
2. **Condition-prefix handling in `catalogue-config.js`.** Recognise the prefix set (`PHYSICAL DAMAGE`, `BOX DAMAGED`, `BOX OPENED`, `OPEN BOX`, `REFURB`, `EX-DEMO`, `DEMO`, `B GRADE`, `SCRATCH`, `SECOND`), then either:
   - **(a)** exclude them from publication — safest, and the recommended default; or
   - **(b)** strip the prefix from the title and render it as a structured `itemCondition` (`DamagedCondition` / `RefurbishedCondition`) with a visible condition badge and a discount rationale.
   **(b)** is commercially better — clearance stock converts — but only once there is a designed condition-disclosure UI. Ship **(a)** now, **(b)** later.
3. **Immediately delete `product/bv5l6pt-q.html`** and return `410 Gone`, or let the next guarded run remove it.
4. **Add an allowlist assertion to CI** (F-03): fail the build if any generated page has `price` ≤ 0 or a title matching the prefix set. This is a five-line test that permanently closes the class.

**Migration strategy**
Additive filter in the generator; the next scheduled run self-heals. Removing 2 of 189 pages is immaterial to crawl budget. If (b) is adopted later, condition pages return under the same URL scheme, so no redirects are needed.

**Dependencies** F-04's guard should land first so the filters cannot themselves trigger a mass deletion.

**Effort** **[est.]** 3–4 hours for steps 1, 2(a), 3 and 4. Step 2(b): 2–3 days including UI.

**Priority** Immediate — it is publicly visible and legally exposed today.

**Customer impact** Removes damaged-goods and $0 listings from the storefront and from search results.

**Conversion impact** Protects trust at the exact moment of product evaluation; eliminates a structured-data penalty risk affecting all 189 product pages.

---

## 4. P1 — High findings

### F-07 · No security headers; open CORS and no bot protection on the only form

**Severity:** P1 — High

**Evidence**

`_headers` is 1,482 bytes and sets **only** `Cache-Control`. Measured absent: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, `Cross-Origin-Opener-Policy`.

`functions/api/contact.js:21–25`:
```js
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
```
The endpoint accepts cross-origin POSTs from **any** origin. Measured absent from the form and the function: `turnstile`, `captcha`, `honeypot`, and any rate limit (0 occurrences each).

So `https://zaleit.com.au/api/contact` is a publicly writable endpoint that, per submission, sends an email via Zale's Formspree account and — with one checkbox — writes a contact into Zale's Brevo list. It is scriptable from anywhere at any volume.

**Root cause**
The CORS block was written to make the browser fetch work and copied the permissive default. The security headers were never added because `_headers` was created for caching.

**Business impact**
An attacker or a commodity spam bot can exhaust the Formspree quota (silencing genuine enquiries — the function returns `502` when Formspree fails, so real leads are lost during an attack), pollute the Brevo list with fabricated contacts, and drive Zale's sending reputation down via bounces and complaints, damaging deliverability for the weekly clearance campaign. Missing HSTS and `frame-ancestors` leave the site clickjackable and downgradeable.

**Technical impact**
No CSP means no defence-in-depth against XSS — relevant because `catalogue.html` builds DOM from remote JSON (it does escape correctly via `esc()` at line 348, using `textContent`, which is the right technique — credit where due). Missing `Referrer-Policy` means full referrer URLs leak to `mmt.com.au` on every product image; note that `zfFav` sets `referrerPolicy="no-referrer"` on the favicon chip (`category/*.html:26`) but the **primary product images do not have it**, so the leak is on the main path.

**Industry comparison**
Cloudflare, Stripe and GitHub all ship strict CSP with nonces or hashes, HSTS with long max-age, and restrictive `Permissions-Policy`. Cloudflare Turnstile is free on the platform Zale is already using; not enabling it on a public write endpoint is leaving a provided control switched off.

**Recommended implementation**

1. **Lock the endpoint down first** — highest value, lowest effort. Replace `*` with an explicit origin allowlist (`https://zaleit.com.au`), and reflect only on match:
   ```js
   const ALLOWED = new Set(["https://zaleit.com.au", "https://www.zaleit.com.au"]);
   const origin = request.headers.get("Origin");
   const cors = ALLOWED.has(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin", … } : {};
   ```
2. **Add Cloudflare Turnstile** to the form and verify the token server-side before touching Formspree or Brevo. Free, first-party, and materially less hostile to users than a visual CAPTCHA.
3. **Add a honeypot field** plus a minimum time-to-submit check — cheap, catches unsophisticated bots before Turnstile is even consulted.
4. **Rate-limit** per `CF-Connecting-IP` using Cloudflare Rate Limiting or a KV counter.
5. **Add security headers to `_headers`:**
   ```
   /*
     Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
     X-Content-Type-Options: nosniff
     Referrer-Policy: strict-origin-when-cross-origin
     Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
     X-Frame-Options: DENY
   ```
6. **CSP — stage it, and understand the blockers.** A strict CSP is currently *incompatible* with the codebase, and this must be sequenced honestly:
   - `index.html` has a 400-line inline `<script>` and a ~860-line inline `<style>`;
   - `category/*.html` define `zfFav`/`zfText` in an inline `<script>` and invoke them through inline `onerror=` attributes — inline handlers require `unsafe-hashes`, which is a poor place to end up;
   - Cloudflare Pages `_headers` serves static values, so **per-request nonces are not available** through it. A nonce-based CSP requires moving header generation into a Pages Function or using hashes.

   The correct sequence: **(i)** deploy `Content-Security-Policy-Report-Only` with a permissive policy and a reporting endpoint to inventory reality; **(ii)** externalise the inline script and style (this is F-02 step 6, so the work is shared); **(iii)** replace inline `onerror=` with delegated listeners in the generator; **(iv)** tighten to `script-src 'self'`, add `img-src` covering `mmt.com.au`, and enforce.
7. **Add `referrerpolicy="no-referrer"`** to the main product `<img>` tags in the generator, matching what `zfFav` already does.

**Migration strategy**
Steps 1–5 are independently deployable and backward compatible today. Step 6 must follow F-02's script externalisation — attempting CSP first would break the site, which is exactly the trap to avoid. Report-Only mode makes stage (i) risk-free.

**Dependencies** Turnstile site key (Cloudflare dashboard). Step 6(ii) depends on F-02.

**Effort** **[est.]** Steps 1–5: 1 day. Step 6: 2–3 days across the sequence.

**Priority** High — steps 1–3 within the first sprint.

**Customer impact** Genuine enquiries stop being lost behind spam-induced failures.

**Conversion impact** Protects the *only* conversion mechanism on the site from denial.

---

### F-08 · Information architecture cannot express a platform, or even the current business

**Severity:** P1 — High (strategic)

**Evidence**

The complete navigation, in both the header (`index.html:956–962`) and the footer (`1682–1688`):
`Services` · `Hardware` · `Partners` · `About` · `Contact` — **all five are in-page anchors** (`#services`, `#hardware`, …).

The complete set of real page links anywhere in `index.html` is **one**: `catalogue.html`.

There is no `Pricing`, `Docs`, `Support`, `Status`, `Security`, `Blog`, `Changelog`, `Login` or `Sign up` — and no such pages to link to. Meanwhile the `#services` section markets eight distinct service lines, and the brief names twelve products.

Consequences, measured:

| Consequence | Detail |
|---|---|
| Zero indexable service pages | All eight service lines share the single URL `/`. None can rank for its own intent. |
| 99.5 % of URLs are resold catalogue | 202 of 203. The services business — the revenue — has **one** URL. |
| No shareable service link | A salesperson cannot send "here's our Cybersecurity page." It does not exist. |
| No page-level analytics possible | Even with analytics installed, all service interest collapses into one pageview. |
| Anchors cannot scale to 12 products | A twelve-item anchor list is not navigation. |
| Duplicate homepage paths | Generated pages link `/index.html#services` while the canonical is `/`. Two crawlable paths to one page, splitting internal link equity. |

**Root cause**
A single-page design chosen when the site had one message, retained as the business grew eight service lines and planned twelve products. Anchors are a presentation choice that became an architecture constraint.

**Business impact**
This is the primary structural cap on inbound growth. Search demand for Zale's services is *specific* — "managed IT support Brisbane", "Microsoft 365 migration Brisbane", "Essential Eight assessment" — and specific queries are won by specific pages. Zale has one general page competing for eight specific intents, and 202 pages competing on someone else's product descriptions (see F-09). Simultaneously, the platform thesis is unrepresentable: there is nowhere to put Zale Hosting, and no pattern to follow when Zale DB arrives.

**Technical impact**
Everything is in one 132 KB HTML file, so every visitor downloads all eight service sections, the hardware section, the partner marquee and the whole contact form regardless of intent. There is no code-splitting boundary because there are no routes. No `sitemap.xml` entry, no per-page metadata, no per-page OG image, no per-page structured data.

**Industry comparison**
Every platform in the comparison set uses the same proven taxonomy — Cloudflare, Stripe, Vercel, Supabase and Neon are structurally identical here:
- `/products/<product>` — one page per product, with a consistent template
- `/solutions/<industry|use-case>` — the same products framed by buyer problem
- `/pricing` — always a top-level nav item
- `/docs/<product>` — separate IA, separate search
- `/customers`, `/blog`, `/changelog`, `/security`, `/trust`, `/status`
- Global `Login` / `Sign up` in the top-right, always

Zale has none of these. The shape is well-established and does not need inventing — §6 lays out the specific target.

**Recommended implementation**
Detailed in §6. Summarised:

1. **Keep `/` as a marketing home**, but reduce it to a routing surface: positioning, product grid, proof, one primary CTA.
2. **Extract each service to `/services/<slug>`** — eight pages from content that already exists. This is copy-move, not authoring, so it is fast and low-risk.
3. **Introduce `/products/<slug>`** for platform products as they become real, using an identical template. **Do not publish pages for products that do not exist** — see F-14.
4. **Ship `/pricing`** (F-12) and `/legal/*` (F-05) as top-level nav.
5. **Redesign the nav** as a product-aware mega-menu with `Platform` · `Solutions` · `Developers` · `Pricing` · `Company`, plus persistent `Docs` and `Sign in`.
6. **Add breadcrumbs with `BreadcrumbList`** to every non-home page — the generated pages already do this correctly and are the reference implementation.
7. **Normalise `/index.html` → `/`** with a 301 and fix the generator's internal links.

**Migration strategy**
This is the largest item in the report and must be incremental. Because in-page anchors keep working when content is *duplicated* to a real page, extraction can be done one service at a time with zero broken links: create `/services/cybersecurity`, add a `301` from nothing (it is new), keep `#cybersecurity` on the homepage as a summary that links to it, and repeat. Anchors remain valid throughout, so no redirects and no dead links at any point. Once all eight exist, shorten the homepage sections to teasers.

**Dependencies** Content decisions on the eight service pages. F-14 (product-reality policy) must be settled before any `/products/*` page ships.

**Effort** **[est.]** 1–2 days per service page including copy (8 pages ≈ 2–3 weeks, parallelisable); nav rebuild 3–5 days; ~1 week for the pricing and legal pages.

**Priority** High — the top strategic priority after the P0s.

**Customer impact** Buyers can find, read, and share the specific thing they need.

**Conversion impact** **[est.]** The largest available structural upside, because it multiplies indexable intent-matched surface by ~8× for the services business. Not quantified — F-11 first.

---

### F-09 · 99.5 % of the site's indexable surface is resold third-party content

**Severity:** P1 — High (SEO risk concentration)

**Evidence**

| Metric | Value |
|---|---:|
| Total indexable URLs | 203 |
| Catalogue URLs (supplier-derived) | **202 (99.5 %)** |
| URLs about Zale's own business | **1 (0.5 %)** |
| Products in feed | 2,021 |
| Products with a detail page | **189 (9.4 %)** |
| Products with **no** detail URL | **1,832 (90.6 %)** |
| Product images self-hosted | **0 of 2,021** |
| Product images hotlinked from `mmt.com.au` | **2,021 (100 %)** |

Product descriptions are the supplier's verbatim — `description: pick(p, 'LongDescription')` in `fetch-stock.js`. Every other MMT reseller publishing the same feed publishes the same text. Zale's differentiating content on these 189 pages is a price computed as `rrpInc / 1.1` and a generated meta description.

Only laptops get pages: `buildLaptops()` filters `C.isLaptopFeedProduct(p)`. So the largest categories in the feed — **588 Computers, 354 Mounting Solutions, 326 Networking, 292 Display** — have category pages but no detail pages at all.

`sitemap.xml` further weakens the signal: all 203 entries carry an **identical `lastmod` of `2026-07-30`**, regenerated daily regardless of whether a given page changed, plus `changefreq` and `priority` on every entry (both long ignored by Google). A `lastmod` that claims every page changed every day is not a usable freshness signal and, applied uniformly, invites the crawler to disregard `lastmod` entirely.

**Root cause**
The catalogue was built to demonstrate hardware availability, and the generator scaled it to 189 pages without a strategy for what makes those pages worth indexing.

**Business impact**
Two problems compound. First, thin duplicate-content pages at 99.5 % concentration define what Google understands Zale to *be* — a laptop reseller, not an IT platform. Second, these pages cannot win: they compete against the manufacturer, every other MMT reseller, and every major retailer, using identical text. The high-value pages — the eight services people actually buy — do not exist as URLs (F-08). Zale is spending its entire crawl budget and domain authority on its lowest-margin, least-defensible content.

Google's Search Essentials spam policies specifically address scraped content republished without added value, and thin pages whose primary content is sourced from a third party. Zale is not being deceptive, but the shape matches the pattern, and the downside — a site-wide quality assessment — lands on the whole domain, not just `/product/*`.

**Technical impact**
100 % third-party image hosting is a hard external dependency: if MMT blocks hotlinking, every product image on the site breaks at once, and there is no fallback beyond `zfFav`'s 128 px Google favicon (F-13). No image is optimised, resized, or served as WebP/AVIF, because Zale does not control them.

**Industry comparison**
Successful reseller catalogues add genuine value: original photography, hands-on assessment, compatibility guidance, comparison tooling, or an integrated quoting flow. The pattern that works is *"we sell this and here's our expertise about it"*, not a mirrored feed.

**Recommended implementation**
1. **Rebalance the ratio.** The fastest lever is not deleting catalogue pages — it is creating the 8 service pages and the pricing/legal/docs pages from F-05, F-08 and F-12. That alone takes Zale from 1 to ~20 substantive first-party URLs.
2. **Add first-party value to the pages worth keeping.** For each retained product: a Zale assessment ("what we recommend this for"), warranty and support terms, an Essential Eight fit note, and a real quote CTA. Two paragraphs of original expertise converts a thin page into a legitimate one.
3. **Prune deliberately.** 189 pages of undifferentiated laptops is not obviously better than 40 curated, genuinely-described recommendations. Recommended: keep a curated set, `410` the rest, and expand only where original content exists. The generator already supports a curated concept (`CURATED` in `catalogue-config.js`).
4. **Fix `lastmod`.** Emit a per-page value that changes only when that page's content changes — hash the rendered page and preserve the prior date on match. Drop `changefreq` and `priority` entirely.
5. **Self-host and optimise images** via Cloudflare Images or a build-time fetch-and-transform, producing responsive `srcset` in WebP/AVIF. This removes the external dependency, the referrer leak (F-07) and the hotlinking exposure in one change.
6. **Decide the strategy for the other 1,832 products.** Either extend detail pages to categories where Zale has real expertise, or accept catalogue-only presentation and mark those grids `noindex`. The current middle state — indexable category grids of products with no detail pages — is the weakest option.

**Migration strategy**
Steps 1, 2 and 4 are additive and safe. Step 3 is destructive and needs care: return `410 Gone` (not 404) for deliberate removals, remove them from `sitemap.xml` in the same deploy, and stage in tranches while watching Search Console. Step 5 is a generator change with a build-time asset pipeline — deploy behind a flag, verify a sample, then switch the template.

**Dependencies** F-04's guard before any generator change. Cloudflare Images (or equivalent) for step 5. MMT licensing confirmation for image rehosting.

**Effort** **[est.]** Step 4: 4 hours. Step 2: ~1 hour per product of original content (scoped by step 3's decision). Step 3: 1 day plus monitoring. Step 5: 3–5 days.

**Priority** High, but sequence *after* F-08 — creating first-party pages is more valuable than pruning third-party ones.

**Customer impact** Fewer, better pages that answer real questions.

**Conversion impact** **[est.]** Shifts organic acquisition from low-intent hardware browsing toward high-intent service enquiry, which is where Zale's margin is.

---

### F-10 · No analytics, no monitoring, no measurement of any kind

**Severity:** P1 — High (foundational)

**Evidence**
Measured across every HTML file: **zero** occurrences of `gtag(`, `googletagmanager`, `plausible`, `posthog`, `segment`, `clarity.ms` or `hotjar`. There is no analytics, no tag manager, no product analytics, no session recording, no error tracking, no uptime monitoring, no Real User Monitoring, and no Core Web Vitals field data.

There is also no status page and no alerting on the three workflows that push to production.

**Root cause**
Never installed. Not a regression — an omission.

**Business impact**
Zale cannot answer: how many people visit, where they come from, which of the eight services they care about, where they abandon, how many start the form versus submit it, or what a lead costs. **Every conversion figure in every recommendation in this report is therefore an estimate**, and will remain one until this is fixed. That is why this finding is ranked above most of the UX work: without it, no improvement can be validated and no spend can be justified. It is also the finding that makes the roadmap in §8 accountable rather than aspirational.

Combined with F-02, F-03 and F-04, it means a total site outage produces **no signal at all**.

**Technical impact**
No field CWV data, so LCP/CLS/INP claims can only be reasoned about from code (as done in F-02) rather than measured at the 75th percentile where Google's thresholds apply. No error tracking, so the F-02 exception scenario is undetectable.

**Industry comparison**
Universal. Every company in the comparison set runs product analytics, RUM, error tracking and public status. Zale's Cloudflare plan already includes Web Analytics — privacy-friendly, cookieless, one script tag.

**Recommended implementation**
1. **Cloudflare Web Analytics** immediately — already available, cookieless, no consent banner needed, one tag. Do this before any other change in this report so the "before" baseline exists.
2. **A privacy-friendly product analytics tool** (Plausible or PostHog) with a defined event taxonomy from day one:
   - `form_start`, `form_field_error`, `form_submit`, `form_success`, `form_error`
   - `service_section_view` per service (and later, per-page views)
   - `catalogue_filter`, `product_view`, `product_enquire_click`
   - `cta_click` with a `location` property
3. **Error tracking** (Sentry) — would have surfaced F-02's failure mode.
4. **RUM for field CWV**, so §7's budgets are enforced against reality.
5. **Uptime monitoring** on `/`, `/catalogue.html` and `/api/contact`, alerting to a real channel.
6. **Workflow failure alerts** for the three pushing workflows (also F-04 step 4).
7. **A public status page** — required for the enterprise posture in F-12, and the natural home for the uptime claims currently asserted without evidence.

**Migration strategy**
Purely additive, entirely backward compatible, deployable in a single change. Cloudflare Web Analytics can go live today. Note that a strict CSP (F-07) must allowlist whatever is chosen — pick the tools now so the CSP is written once.

**Dependencies** Tool selection and a consent decision (cookieless tools avoid the banner, which is itself a conversion argument for choosing them).

**Effort** **[est.]** Step 1: 1 hour. Steps 2–3: 1 day. Steps 4–7: 1–2 days.

**Priority** **Do this first.** It is cheap, additive, risk-free, and it is the precondition for measuring everything else.

**Customer impact** None directly; enables every other improvement to be verified.

**Conversion impact** Enables measurement, targeting and experimentation — currently all impossible.

---

### F-11 · Performance: render-blocking third-party fonts and a 259 KB data fetch

**Severity:** P1 — High

**Evidence**

**(a) Render-blocking cross-origin stylesheet.** `index.html:9–11`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```
Two families, **six** Outfit weights plus DM Serif Display in roman and italic. The `preconnect` hints are correct and `display=swap` is right — credit — but this is still a render-blocking stylesheet on a third-party origin, requiring DNS + TLS + fetch on `fonts.googleapis.com`, then a second chain to `fonts.gstatic.com` for the font files. Critically, `load` does not fire until these complete, and **F-02 gates all content on `load`** — so third-party font latency is multiplied into the blank-screen duration.

**(b) A 259 KB data fetch gates the catalogue.** `catalogue-data.json` is **1,684,912 bytes** raw, **259 KB gzipped**, containing 2,021 products with full descriptions. `catalogue.html:537` fetches it client-side, and at line 533 calls `rebuild([])` first — so the page renders an **empty catalogue**, then re-renders after the fetch.

**(c) The fetch failure path is silent.** `catalogue.html:540`:
```js
.catch(function(err){console.warn('Stock feed unavailable:',err.message);});
```
On failure the user is left with a permanently empty catalogue, no message, no retry, no explanation. A `console.warn` is not an error state.

**(d) Everything is inline and uncacheable.** `index.html` is 132 KB with ~860 lines of CSS and ~400 lines of JS inline. Combined with `_headers`' `max-age=0, must-revalidate` on HTML (correct for freshness), **every visit re-downloads all CSS and JS** because none of it is a separately cacheable asset. `assets/site-pages.css` exists and is used by generated pages — the homepage just does not use it.

**Root cause**
Single-file authoring convenience, and a data-loading approach designed for a much smaller feed that grew to 2,021 products.

**Business impact**
Slow first render on the two pages that matter, worst on the mobile connections most SMB buyers use. The catalogue's empty-then-populate sequence reads as broken. And per F-10 none of this is measured, so the cost is invisible.

**Technical impact**
LCP is gated on `load` + the artificial delay (F-02) + third-party font latency. The empty-then-populate render is a large layout shift risk on the catalogue. 132 KB of uncacheable inline payload per visit. Zero code-splitting, because there are no route boundaries (F-08).

**Industry comparison**
Self-hosted, subsetted, `preload`ed fonts are the norm — Vercel and Linear both do this, and `next/font` exists specifically to eliminate this request chain. For catalogue data at this size the norm is server-side rendering or pagination; nobody ships 259 KB of JSON to render a first screen.

**Recommended implementation**
1. **Self-host the fonts, subsetted.** Download the WOFF2s, subset to Latin, cut to the weights actually used (audit first — six weights is unlikely to be real), `preload` the two used above the fold, keep `font-display: swap`. Removes two third-party origins, two DNS/TLS handshakes, and the dependency inside `load`. Also resolves two of the four overseas origins in F-05.
2. **Extract CSS and JS to `assets/`** with long-lived immutable cache headers and content hashes. Turns 132 KB per visit into ~8 KB of HTML plus cached assets — and is a prerequisite for CSP (F-07) and for fixing F-02 properly.
3. **Fix the catalogue data path.** In order of preference:
   - **(a)** Pre-render the first screen of each category server-side at build time — the generator already produces static category pages, so extend it. Best result: instant first paint, no empty state.
   - **(b)** Split `catalogue-data.json` per category (12 files, ~20 KB gzip each) and fetch only the active tab.
   - **(c)** Strip `description` from the index payload — it is the bulk of the 1.6 MB and is not needed for grid cards. Fetch detail on demand.
   **(c) is a one-line change with a large win** and should ship immediately; **(a)** is the right destination.
4. **Add a real error state** with a retry button and a `mailto:` fallback, plus a skeleton loading state instead of an empty grid.
5. **Set explicit performance budgets** and enforce them in CI (F-03): LCP ≤ 2.0 s on mobile at p75, CLS ≤ 0.05, INP ≤ 200 ms, total JS ≤ 100 KB gzip, initial HTML ≤ 50 KB.

**Migration strategy**
Each item is independent and backward compatible. Step 3(c) first (one line, large win). Then fonts, then the CSS/JS extraction — coordinate that with F-02 and F-07 since all three touch the same lines; doing them as one change avoids three risky edits to the same file.

**Dependencies** Step 2 is shared with F-02 step 6 and F-07 step 6(ii). Sequence together.

**Effort** **[est.]** Step 3(c): 1 hour. Step 1: 0.5 day. Step 2: 1 day. Step 3(a): 2–3 days. Steps 4–5: 1 day.

**Priority** High — after F-02, which dominates the same metric.

**Customer impact** Materially faster first render; the catalogue stops appearing broken.

**Conversion impact** **[est.]** Positive and measurable once F-10 lands. Set up as a controlled experiment.

---

### F-12 · Unsubstantiated, conflicting and self-contradicting trust claims

**Severity:** P1 — High (credibility + regulatory)

**Evidence**

Claims made on the homepage, with what backs them:

| Claim | Location | Substantiation |
|---|---|---|
| **"99.98%" uptime** | Hero "LIVE" dashboard (`data-count="99.98"`) | None. No status page, no SLA, no monitoring (F-10). |
| **"99.9% Uptime delivered"** | About stats | None — **and it conflicts with the hero's 99.98 % on the same page.** |
| "4hr Critical SLA" / "A 4-hour SLA on critical issues" | About | No SLA document, no terms of service. |
| "24/7 Critical Support" | Trust marquee | No support page, no hours, no channel. |
| "ISO 27001 Aligned" | Trust marquee | No security page, no compliance page, no evidence. |
| "Essential Eight aligned" | Hero + marquee | No assessment, no maturity level stated. |
| "Microsoft Partner" | Trust marquee | No partner ID, no badge, no verification link. |
| "50+ Clients supported" | About stats | Zero named customers, zero case studies, zero testimonials. |
| **"Transparent pricing — Flat monthly fees… You always know what you're paying."** | About | **There is not a single price anywhere on the site.** |
| **"100% Australia-based" / "Nothing offshore, ever."** | Hero + About | Contradicted by 4 overseas front-end origins and 2 overseas processors (F-05). |

Two further specifics:

**The hero "LIVE" dashboard is a fabricated mock.** `index.html:1157` onward renders a panel labelled `Zale IT · Security Operations` with a `LIVE` badge, showing Uptime 99.98 %, Devices secured 98 %, Security score 89 %, Open incidents 0, and a feed of invented events ("Risky logins blocked · 3 attempts denied", "Secure login rules applied · 12 users"). Nothing is connected to anything. And because the counters animate from zero via `data-count`, **if JavaScript fails the hero advertises "Uptime 0%", "Devices secured 0%", "Security score 0%"** — a compounding failure with F-02.

**The vendor logos are hand-drawn imitations.** `index.html:1372–1392`. The HP "logo" is a blue circle with the text `hp` in Arial:
```html
<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0096D6"/>
  <text x="4.5" y="16.5" font-family="Arial" font-weight="700" font-size="11" fill="white">hp</text></svg>
```
Dell is a blue circle with `DELL` in Arial; Lenovo a red rounded rectangle with `LENOVO` in Arial. Only the Microsoft four-square is approximately accurate. These are presented under the heading *"Our technology partners — We work with the world's leading technology vendors."*

**Root cause**
Aspirational marketing copy written ahead of the operational reality, with no substantiation process and no single owner reconciling claims across sections. The logos are placeholders that shipped.

**Business impact**
Three compounding harms.

*Regulatory:* ACL s18 and s29 prohibit misleading conduct and false representations about services. Quantified performance claims must be substantiable — and two different uptime figures on one page demonstrate that neither is. Every vendor partner program has brand guidelines that prohibit recreating or modifying their marks; hand-drawn approximations next to a "Microsoft Partner" badge is trademark exposure layered on top of misrepresentation.

*Enterprise sales:* every claim here is one an enterprise buyer will test. "ISO 27001 Aligned" is read by procurement and their auditors as "not certified", and using it as a trust badge beside "Microsoft Partner" implies certification by association. When the buyer asks for the SOC 2 report, the SLA, the DPA or the status page, there is nothing.

*Investor diligence:* conflicting uptime figures, a "LIVE" dashboard connected to nothing, hand-drawn vendor logos and "transparent pricing" with no prices are exactly what a diligence process surfaces, and they recalibrate trust in *all* of management's numbers — not just these.

**Technical impact**
The mock dashboard is a meaningful share of the homepage's inline JS and DOM for zero functional value.

**Industry comparison**
The comparison set is unanimous. Uptime claims live on a status page backed by real monitoring (Cloudflare, Stripe, GitHub, Vercel all publish one). Compliance claims live in a trust centre with downloadable evidence under NDA. Partner logos are official artwork used under an actual agreement. Customer logos are real customers with signed permission. Pricing is a top-level nav item. **Nobody labels a static mock "LIVE."**

**Recommended implementation**

*Immediately (hours, not days):*
1. **Remove or reconcile the conflicting uptime numbers.** Pick one, or remove both until measured.
2. **Remove the `LIVE` badge** from the hero panel, or relabel it `Illustrative dashboard`. If it is kept as illustration, ensure the static markup shows the final values so a JS failure cannot render "Uptime 0%".
3. **Replace the hand-drawn vendor logos** with official artwork obtained under each vendor's brand guidelines — or, if authorisation is not in place, with plain text wordmarks under an accurate heading such as *"Technologies we deploy"*, which is defensible without a partner agreement.
4. **Soften or substantiate "ISO 27001 Aligned."** Recommended interim: *"Built to ISO 27001 and ACSC Essential Eight controls — certification in progress"*, only if that is true.
5. **Fix "Nothing offshore, ever"** per F-05 step 5.
6. **Fix "Zaleit IT" → "Zale IT"** (F-05 step 4).

*This quarter:*
7. **Publish `/status`** with real monitoring (F-10 step 5–7). Then the uptime number becomes a fact.
8. **Publish `/legal/sla`** defining the 4-hour critical SLA — severity definitions, business hours, exclusions, remedies. Then "4hr SLA" is a commitment rather than a slogan.
9. **Publish `/security`** — the security page enterprise buyers look for first: architecture, data residency, encryption, access control, incident response, Essential Eight maturity level, certification roadmap with dates.
10. **Publish `/pricing`** (see F-13).
11. **Build real social proof:** three named case studies with permission, and a testimonial with a name, role and company. Move vendor logos out of any position where they read as customer logos.
12. **Institute a claims register** — every quantified public claim, its owner, its evidence, and its review date. This is the process fix that prevents recurrence, and it is what a SOC 2 or ISO 27001 audit will ask for anyway.

**Migration strategy**
Items 1–6 are copy edits, independently deployable today, no dependencies, immediate risk reduction. Items 7–11 are new pages, additive. Item 12 is process.

**Dependencies** Marketing and legal sign-off on the claims register. Vendor authorisation for logos. Customer permission for case studies. Monitoring (F-10) before `/status`.

**Effort** **[est.]** Items 1–6: 0.5 day total. Item 7: 1–2 days. Items 8–10: 1 week with legal input. Item 11: 2–3 weeks, mostly non-engineering.

**Priority** High — items 1–6 in the first sprint. They are the cheapest credibility gain available.

**Customer impact** Buyers stop encountering claims that collapse under one question.

**Conversion impact** **[est.]** Substantial for enterprise, where these are gating rather than persuasive. Publishing pricing (F-13) is the single largest change in this group.

---

### F-13 · No pricing anywhere, while the site claims pricing transparency

**Severity:** P1 — High

**Evidence**
No `/pricing` page exists. No price for any service appears anywhere on the site. The About section states: *"Transparent pricing — Flat monthly fees with no lock-in contracts. You always know what you're paying."*

The only prices on the entire site are resold hardware RRPs, displayed **ex-GST** (`product/*.html`: `<span class="pc-rrp">ex GST</span>$3,181`), with the footer disclaimer *"Prices are in AUD, exclude GST and are indicative only."*

The **only** path to a price is the contact form, which requires six fields including a mandatory free-text message (F-16).

**Root cause**
Classic MSP objection to publishing rates. Defensible for bespoke managed-services contracts; indefensible in combination with an explicit on-site claim of pricing transparency, and incompatible with the self-serve platform model in the brief.

**Business impact**
Price is the most-sought information in B2B evaluation. Its absence removes Zale from consideration sets before contact, and pushes every enquiry — including unqualified ones — through a single high-friction form, loading the sales team with tyre-kickers while serious buyers who will not fill in a form simply leave. The claim of transparency alongside zero prices is also the kind of internal contradiction that damages trust in everything adjacent to it.

For the platform thesis this is existential: Zale Hosting and Zale DB cannot be sold by contact form. Metered infrastructure requires public unit pricing, and building that muscle now is a prerequisite.

**Technical impact**
None currently. Note that the ex-GST-only display is worth reviewing: `rrpInc` is *already stored* in `catalogue-data.json`, so showing a GST-inclusive total costs nothing. Australian Consumer Law s48 restricts component pricing where a single total price is not displayed at least as prominently; whether it bites here depends on whether the representation is to consumers, and the site is publicly reachable by consumers. Given the fix is free, show both.

**Industry comparison**
Every platform in the comparison set publishes pricing — Cloudflare, Vercel, Supabase, Neon and DigitalOcean all publish per-unit rates with a calculator, reserving "Contact sales" for genuine enterprise tiers. The prevailing pattern is transparent tiers *plus* an enterprise tier, not opacity everywhere.

**Recommended implementation**
1. **Ship `/pricing` as a top-level nav item.** Even "from $X per user per month" with a clear scope statement outperforms silence decisively.
2. **Three tiers plus Enterprise** — Essentials / Business / Advanced with per-seat pricing, plus "Contact sales" for bespoke. Include what is in and out of scope, response times (linking the SLA from F-12 item 8), and onboarding cost.
3. **An interactive cost estimator** — seats, devices, sites, add-ons → indicative monthly figure. High-intent, self-qualifying, and it captures email at a moment of genuine interest rather than as a toll gate.
4. **Show GST-inclusive prices alongside ex-GST** on hardware. `rrpInc` is already there; render both.
5. **Publish comparison content** — "Zale vs in-house IT", "Zale vs offshore helpdesk" — with honest trade-offs. High-intent search capture, and honesty about where Zale is not the right fit builds more trust than claiming to win everywhere.
6. **For platform products, design metered pricing now**, even in draft, so the model exists before Zale Hosting launches.

**Migration strategy**
New page, additive, no existing URLs affected. Add to nav, footer and sitemap in the same change. Recommend launching with a defined price-change policy so early customers are not surprised later.

**Dependencies** Commercial decision on published rates — the blocker is a business decision, not engineering. Item 3 depends on item 2.

**Effort** **[est.]** Item 1–2: 3–5 days engineering once pricing is decided. Item 3: 3–5 days. Item 4: 2 hours. Item 5: content-led.

**Priority** High — likely the largest single conversion lever in the report.

**Customer impact** Buyers can self-qualify instead of negotiating for the right to know a price.

**Conversion impact** **[est.]** Large. Expect fewer, better-qualified enquiries and higher close rates — and a measurable trade-off between raw form volume and lead quality, which is exactly why F-10 must land first.

---

### F-14 · Accessibility: brand colour fails contrast, and the form's focus ring is invisible

**Severity:** P1 — High (WCAG 2.2 AA)

**Evidence**

Computed contrast ratios from the tokens in `index.html:71–120` and `:777`:

| Foreground | Background | Ratio | AA text (4.5) | AA large / non-text (3.0) |
|---|---|---:|:---:|:---:|
| `#76b900` brand green | `#ffffff` | **2.41** | ❌ | ❌ |
| `#8fd000` accent | `#ffffff` | **1.88** | ❌ | ❌ |
| `#f5a623` amber (status) | `#ffffff` | **2.03** | ❌ | ❌ |
| `#e5604d` red (status) | `#ffffff` | **3.44** | ❌ | ✅ |
| `#000` on `#76b900` (primary button) | — | **8.19** | ✅ | ✅ |
| `#3d6200` `--nv-deep` | `#ffffff` | 7.13 | ✅ | ✅ |
| `#555555` body copy | `#ffffff` | 7.46 | ✅ | ✅ |
| `#6e6e6e` meta copy | `#ffffff` | 5.10 | ✅ | ✅ |
| `#999999` | `#1a1a1a` | 6.11 | ✅ | ✅ |
| `#a32d2d` error text | `#fcebeb` | 6.13 | ✅ | ✅ |

**The primary CTA passes** — `.btn-primary` is `#000` on `#76b900` at 8.19:1 (`index.html:183`). That is a good decision and should be preserved. But the brand green **fails at 2.41:1 wherever it is used as text or as a meaningful boundary on white**, and the accent green at 1.88:1 is worse. The amber status colour at 2.03:1 fails as both text and non-text — a problem for a company whose brand promise is security status reporting.

**The form's focus indicator is effectively invisible.** `index.html:570–571`:
```css
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:#76b900;box-shadow:0 0 0 4px rgba(118,185,0,.15)}
.field input:focus-visible,.field select:focus-visible,.field textarea:focus-visible{outline:none}
```
The global `:focus-visible{outline:3px solid #76b900;outline-offset:3px}` at line 144 is **explicitly overridden to `outline:none` on every form control**, and replaced by a 15 %-alpha green ring. Composited over white, `rgba(118,185,0,.15)` renders as `#eaf5d9` — a measured **1.13:1** against white. WCAG 2.2 **1.4.11 Non-text Contrast** requires 3:1 for focus indicators. This fails by a wide margin, on the six controls of the site's only conversion form.

**Other findings in this area:**

- **No skip link** (measured: 0). There is a `<main>` landmark, so 2.4.1 Bypass Blocks is arguably satisfied by the landmark technique, but a keyboard user still traverses the full nav on every visit. Best practice, not a strict failure — reported accurately as such.
- **No `Escape` key handling anywhere** (measured: 0 occurrences of `escape`/`keydown`). The mobile menu cannot be dismissed from the keyboard, and no keyboard shortcuts exist. The menu is correctly removed from the tab order when closed (`visibility:hidden` at `index.html:245`) — that part is right.
- **Form errors are not programmatically associated.** The error `<span>`s (e.g. `index.html:1608`) have no `role="alert"`, no `aria-live`, and no `aria-describedby` from the input; inputs never receive `aria-invalid`. Errors are visible but not announced — WCAG 3.3.1 Error Identification. The success panel *does* have `role="status" aria-live="polite"` (line 1665), which is correct — the same treatment simply was not applied to errors.
- **`novalidate`** (line 1599) disables native validation, so all validation depends on the script that F-02 shows can fail entirely.
- **The custom cursor replaces the system cursor.** `body.cursor-on{cursor:none}` (line 794) hides the pointer on all interactive elements, substituting a 7 px dot and a 34 px ring. It is correctly gated on `(hover:hover) and (pointer:fine)` and skipped under `prefers-reduced-motion` — genuinely thoughtful — but it still overrides OS cursor size and high-visibility cursor settings, which are assistive settings for low-vision and motor-impaired users. There is no way to turn it off.
- **WCAG 2.2 additions** — 2.5.8 Target Size (Minimum) needs verification on the marquee chips and nav items at mobile widths; 3.3.7 Redundant Entry is satisfied (nothing is asked twice).

**Root cause**
The palette was chosen for brand impact against dark backgrounds — where it performs well (`#76b900` on `#0a0a0a` measures 8.21:1) — without a light-background accessible variant. `--nv-deep:#3d6200` exists and passes at 7.13:1, so the fix is already in the codebase and simply not applied consistently. The `outline:none` overrides look like an aesthetic cleanup that removed a required affordance.

**Business impact**
Australia's Disability Discrimination Act 1992 applies to online services, and WCAG 2.x AA is the referenced benchmark in Australian government procurement. Any government-adjacent or enterprise buyer will run an accessibility assessment, and contrast plus focus-visibility failures are the first things automated tooling reports. There is also direct commercial cost: low-vision users cannot reliably use the enquiry form.

**Technical impact**
Contrast failures are systemic rather than local because they originate in the tokens — which means they are also *fixable* at the token level in one change.

**Industry comparison**
Stripe, GitHub and Cloudflare all publish accessibility statements and maintain AA conformance, with dual-purpose palettes providing accessible variants for light and dark surfaces. Removing focus outlines without an equivalent replacement is a well-known anti-pattern.

**Recommended implementation**
1. **Add accessible palette variants**, keeping the brand colour for large display and dark surfaces:
   ```css
   --c-primary:#76b900;        /* brand — dark surfaces, large display, button fills */
   --c-primary-text:#3d6200;   /* 7.13:1 on white — any green text on light */
   --c-primary-edge:#5c8f00;   /* ≥3:1 on white — borders, focus rings, icons */
   ```
   Audit all seven `var(--nv…)` and `--c-primary` usages and route each to the correct token by surface.
2. **Restore the focus indicator on form controls.** Delete both `outline:none` declarations; keep the global `:focus-visible` 3 px outline, and if a softer look is wanted use a solid `--c-primary-edge` ring at ≥3:1 rather than a 15 % alpha wash.
3. **Fix the status colours:** amber to ≥4.5:1 on white for text (≈`#8a5a00`), and pair every status colour with an icon or text label so colour is never the sole carrier (1.4.1 Use of Colour).
4. **Associate form errors:** `aria-describedby` from input to error span, `aria-invalid="true"` on failure, `role="alert"` on the error container, and move focus to the first invalid field on submit.
5. **Add a skip link** as the first focusable element.
6. **Add `Escape` to close the mobile menu**, with focus returned to the burger and focus trapped while open.
7. **Make the custom cursor opt-out** — respect `prefers-reduced-motion` (already done) and add a visible toggle, or scope it to non-interactive areas so real cursors remain over controls.
8. **Keep native validation** — remove `novalidate` and enhance rather than replace, so the form works when JS does not.
9. **Add `axe-core` to CI** (F-03) and publish an accessibility statement.
10. **Verify 2.5.8 target sizes** (≥24×24 CSS px) at mobile widths.

**Migration strategy**
Token changes are global and visual, so land them behind a review of every green surface — screenshot-diff the homepage, catalogue, a category page and a product page before and after. Items 2, 4, 5, 6 and 8 are local and independently deployable. Items 1 and 3 should ship as one "accessible palette" change with visual review.

**Dependencies** Design sign-off on the palette variants. Item 9 depends on F-03's CI.

**Effort** **[est.]** Items 1–3: 1–2 days including visual review. Items 4–6, 8: 1 day. Item 7: 0.5 day. Items 9–10: 1 day.

**Priority** High — item 2 is a two-line deletion with immediate benefit and should ship this week.

**Customer impact** The enquiry form becomes usable by keyboard and low-vision users.

**Conversion impact** **[est.]** Direct improvement in form completion for affected users, plus removal of a procurement blocker for government-adjacent buyers.

---

## 5. P1 — Remaining high findings (condensed)

The following carry the same thirteen dimensions in compressed form.

### F-15 · No developer experience surface whatsoever

**Severity** P1 · **Evidence** Zero docs pages, zero API references, zero SDK or CLI documentation, zero code samples, zero OpenAPI specs, zero Terraform providers, zero architecture diagrams, zero quickstarts, zero sandbox. The only API in the repository is the internal `/api/contact` handler, which is undocumented. · **Root cause** The site was never intended to serve developers; the platform ambition postdates it. · **Business impact** Zale DB, Zale Functions, Zale Queue and the Developer Platform cannot be adopted without documentation — for infrastructure products, documentation *is* the product surface, and developer adoption is bottom-up and docs-led. · **Technical impact** No docs toolchain, no versioning strategy, no API design conventions, no reference-generation pipeline. Every day this is deferred, more API surface is designed without a documentation contract. · **Industry comparison** Stripe, Cloudflare, Supabase and Neon all treat docs as a first-class product with dedicated IA, search, versioning and runnable examples. Stripe's documentation is routinely cited as its primary competitive moat. · **Recommended implementation** Choose a docs platform now (Mintlify, Docusaurus, or Nextra) and stand up `/docs` with the Diátaxis split — tutorials, how-to guides, reference, explanation.<sup>1</sup> Adopt OpenAPI 3.1 as the source of truth for every API *before* the first one ships, and generate reference from it. Establish conventions now: auth, errors, pagination, idempotency, rate limits, versioning. Add a "Developers" nav item. · **Migration strategy** Entirely greenfield; no migration. Stand up the shell with a single quickstart, then grow per product. · **Dependencies** Blocked on F-14 (product reality) — do not document products that do not exist. · **Effort [est.]** 1 week for the docs platform and IA shell; then ~1 week per product. · **Priority** High, but sequenced with the first real platform product. · **Customer impact** Developers can evaluate and integrate. · **Conversion impact** For developer products this is the primary acquisition channel, not a support cost.

### F-16 · No enterprise trust surface

**Severity** P1 · **Evidence** No `/security`, `/compliance`, `/trust`, `/legal/*`, `/sla`, `/dpa`, `/subprocessors`, or `/status` page. No SOC 2, no ISO 27001 certification, no penetration test summary, no architecture documentation, no data-residency statement, no incident-response policy, no enterprise contact route distinct from the general form. · **Root cause** Enterprise motion has not started; the site serves SMB self-service enquiry only. · **Business impact** Enterprise procurement cannot complete. A security questionnaire arrives, and there is nothing to answer it with — while the homepage claims "ISO 27001 Aligned" (F-12), which invites the questionnaire in the first place. Deals stall at security review. · **Technical impact** No evidence artefacts exist to reference. · **Industry comparison** Trust centres are table stakes: Stripe, Cloudflare, Vercel and Supabase all publish security architecture, compliance certifications, subprocessor lists and DPAs, with SOC 2 reports available under NDA. · **Recommended implementation** Ship `/security` first (architecture, encryption, access control, data residency, Essential Eight maturity, certification roadmap with dates), then `/legal/*` (privacy — F-05, terms, DPA, subprocessors, SLA), then `/trust` as the hub, then `/status` (F-10). Add an enterprise contact path that is not the general form. Begin SOC 2 Type II readiness — the change-management control (CC8.1) is already implicated by F-03, so fixing F-03 is genuine progress toward it. · **Migration strategy** Additive pages, footer-linked from all 203 pages via the generator template. · **Dependencies** Legal drafting; security decisions; F-10 for `/status`. · **Effort [est.]** 2–3 weeks including legal review; SOC 2 readiness is a 6–12 month program. · **Priority** High — `/security` and `/legal/privacy` are the gating pair. · **Customer impact** Enterprise buyers can proceed. · **Conversion impact** Removes an absolute blocker rather than shifting a rate.

### F-17 · The conversion form is the site's only CTA, and it is high-friction

**Severity** P1 · **Evidence** Six required fields — first name, last name, work email, business name, service, **and a required free-text message** (`index.html:1599–1656`), all enforced server-side (`contact.js:84`). The submit button says "Request free assessment". There is no alternative conversion path: no phone number anywhere on the site, no live chat, no calendar booking, no email-only capture, no newsletter signup independent of the enquiry form. Every CTA on the page — hero, nav, service cards, hardware cards, product pages — funnels to this one form. · **Root cause** A single-goal page design; each field was added for sales-qualification convenience without weighing abandonment. · **Business impact** Every visitor who is not ready to write a paragraph about their business is lost with no lesser commitment available. A mandatory free-text message is among the highest-friction field types in B2B lead capture. Requiring "Business name" also excludes sole traders and anyone unwilling to identify their employer while researching. And no phone number on a site selling *local Brisbane* IT support removes the highest-intent channel a local services buyer expects. · **Technical impact** Client validation is disabled natively (`novalidate`) and depends on the fragile script (F-02); errors are not announced (F-14). · **Industry comparison** The prevailing pattern is progressive commitment — self-serve signup, then docs, then sales — with graduated CTAs (see pricing → try free → talk to sales) rather than one maximal ask. · **Recommended implementation** Make `message` optional (single highest-value change). Make `business` optional. Reduce to a two-step form: email plus service first, details second — the first step captures a recoverable lead even on abandonment. Add a visible phone number in the header and footer. Add calendar booking as an alternative to the form. Add a low-commitment email capture tied to genuinely useful content (an Essential Eight checklist). Then instrument `form_start`, `form_field_error` and `form_submit` (F-10) to find where abandonment actually occurs, rather than guessing. · **Migration strategy** Field-optionality changes require matching relaxation of the server-side check in `contact.js:84` — deploy the function change first so it accepts both shapes, then the form. Backward compatible in that order; **not** in the reverse order. · **Dependencies** F-10 to measure. Phone number requires an answering commitment. · **Effort [est.]** Field changes 2 hours. Two-step form 2 days. Booking integration 1 day. · **Priority** High — the field-optionality change is hours of work on the primary conversion path. · **Customer impact** Lower-commitment ways to make contact. · **Conversion impact [est.]** Directionally the highest-leverage micro-change available; measure with F-10 in place.

### F-18 · Third-party image and favicon dependencies with privacy and reliability exposure

**Severity** P1 · **Evidence** All 2,021 product images hotlink `www.mmt.com.au` (2,749 references). The fallback chain calls `https://www.google.com/s2/favicons?domain=…&sz=128` (317 references) via `zfFav` in `category/*.html:26`. The favicon chips set `referrerPolicy="no-referrer"`; the primary product images do not. Both `zfFav`/`zfText` are defined inline and invoked via inline `onerror=` attributes. · **Root cause** Expedient sourcing of imagery Zale does not own, plus a pragmatic fallback that reached for a convenient endpoint. · **Business impact** If MMT blocks hotlinking, every product image breaks simultaneously and the fallback is a 128 px favicon — the catalogue becomes unusable in one upstream config change Zale does not control. Hotlinking third-party assets also carries licensing exposure. · **Technical impact** Google's `s2/favicons` is an undocumented, unsupported endpoint with no stability guarantee. Every visitor's IP and user-agent is disclosed to two third parties with no privacy policy disclosing it (F-05). The inline `onerror=` handlers are a hard CSP blocker (F-07). No image is optimised, resized, or served in a modern format. · **Industry comparison** Product imagery is normally ingested, licensed, optimised and self-hosted or served through a controlled image CDN. · **Recommended implementation** Ingest images at build time into Cloudflare Images or R2, generating responsive `srcset` in WebP/AVIF. Replace the favicon service with locally-stored brand marks (there are ~20 brands, so this is a one-off asset task). Replace inline `onerror=` with a delegated listener in the generator. Add `referrerpolicy="no-referrer"` to product images in the interim. · **Migration strategy** Build-time ingestion behind a flag; verify a sample category, then switch the template. URLs unchanged, so no redirects. · **Dependencies** MMT licensing confirmation. F-04's guard before generator changes. · **Effort [est.]** 3–5 days for ingestion; 0.5 day for brand assets; 2 hours for the referrer policy. · **Priority** High. · **Customer impact** Faster, reliable, higher-quality imagery. · **Conversion impact [est.]** Product-page imagery quality correlates directly with commerce conversion.

### F-19 · Announcing products that do not exist would be the worst available outcome

**Severity** P1 (strategic guard-rail) · **Evidence** The brief asks the site to present twelve products as "one unified operating system." Four are described as current (Zale Hosting, Zale DB, Roster, Hospitality Ordering Platform) and eight as future — yet none appears on the site, and nothing in this repository indicates any of them exists in a shippable form. · **Root cause** A gap between roadmap ambition and shipped reality, with the website nominated to close it. · **Business impact** This is the one place where following the brief literally would cause harm. Publishing twelve polished product pages for products that cannot be signed up for produces the specific failure the comparison set avoids: a developer arrives from search, hits "Get started", and finds nothing. That converts curiosity into distrust, and it is *not* recoverable by shipping later — the visitor does not come back. It also compounds F-12: a company already carrying unsubstantiated claims cannot afford twelve more. · **Technical impact** None; the risk is entirely reputational. · **Industry comparison** The comparison set is disciplined here. Cloudflare and Vercel announce at beta with a working signup, a real quickstart and honest status labels; Supabase and Neon ship public roadmaps and changelogs that distinguish GA from beta from planned. Nobody publishes a full product page for vapour. · **Recommended implementation** Adopan explicit maturity taxonomy and enforce it in the template: **GA** (full page, pricing, docs, signup) · **Beta** (page with a visible Beta badge, docs, waitlist or gated access) · **Coming soon** (roadmap entry only — one line, no product page) · **Not announced** (absent). Then: build the platform IA and the *template* now (F-08), and populate it strictly as products become real. Publish `/roadmap` and `/changelog` so ambition has an honest home — that is where the twelve-product story belongs, and it reads as momentum rather than as vapour. Sequence one product to GA quality end-to-end (page, docs, pricing, signup, status) before starting a second; one credible product beats twelve hollow ones for every audience in the brief, including investors. · **Migration strategy** N/A — this is a publishing policy, and it should be written down before the first `/products/*` page ships. · **Dependencies** Product and leadership decision on which product goes first. · **Effort [est.]** Policy: hours. Per-product GA surface: 2–4 weeks. · **Priority** High — settle before any product page is authored. · **Customer impact** What the site promises is what the customer can actually get. · **Conversion impact [est.]** Protects the credibility that every other conversion improvement depends on.

---

## 6. Target information architecture

### 6.1 The strategic question that must be answered first

Before any IA can be designed, leadership has to resolve a contradiction the website currently hides:

**Zale IT today** is a Brisbane managed-service provider. It resells Microsoft licences, supplies Lenovo and HP hardware through a distributor, and sells local hands-on support. Its buyer is an SMB owner or office manager. Its differentiators are proximity, accountability and no offshore handoffs. It sells through relationships and a contact form.

**Zale (the platform)** per the brief sells metered infrastructure primitives — hosting, database, storage, queue, functions, CDN, payments — plus vertical SaaS (Roster, Hospitality Ordering). Its buyer is a developer or technical founder. Its differentiators would have to be price, performance, developer experience and regional data residency. It sells bottom-up through documentation and self-serve signup.

These are not the same company, and **one website cannot be excellent at both while pretending they are one thing.** The good news: there is a genuine, defensible strategy that unifies them, and it is not a compromise.

### 6.2 Recommended positioning: the Australian sovereign cloud for businesses that need a human

Zale's credible wedge is the intersection nobody in the comparison set occupies:

> **Australian-owned, Australian-hosted infrastructure — with a Brisbane team who will pick up the phone.**

AWS, Azure and Google Cloud have Australian regions but no Australian accountability and no human you can reach. Vercel, Supabase and Neon have superb developer experience but are US companies under US jurisdiction with community-tier support. Local MSPs have the human but no platform.

Zale can have both, and the two halves of the business reinforce rather than dilute each other:

- **The MSP business funds the platform** and provides the reference customers and hospitality domain expertise that make Roster and the Ordering Platform credible.
- **The platform gives the MSP business a moat** — Zale hosts it, Zale runs it, Zale answers the phone.
- **Data sovereignty is a real and rising buyer requirement** in Australian government-adjacent and regulated sectors, and it is the one axis on which a Brisbane company genuinely beats a hyperscaler.

This positioning also makes the "Nothing offshore, ever" claim (F-05, F-12) *true and central* rather than a liability — provided the implementation is fixed to match, which is exactly what F-05 step 6 and F-11 step 1 do.

### 6.3 Target site map

```
/                                   Home — positioning, product grid, proof, one primary CTA
│
├── /platform                       Platform overview — the "one operating system" story
│   ├── /platform/hosting           Zale Hosting          [maturity-gated per F-19]
│   ├── /platform/database          Zale DB               [maturity-gated]
│   ├── /platform/storage|queue|functions|cdn|payments    [roadmap only until real]
│   └── /platform/ai                Zale AI               [roadmap only until real]
│
├── /apps                           Vertical products (distinct from primitives)
│   ├── /apps/roster                Roster
│   └── /apps/ordering              Hospitality Ordering Platform
│
├── /services                       Managed IT — the business that pays for all of this
│   ├── /services/managed-it
│   ├── /services/cybersecurity
│   ├── /services/microsoft-365
│   ├── /services/cloud-servers
│   ├── /services/device-management
│   ├── /services/compliance
│   ├── /services/ai-assistants
│   └── /services/hardware          → links to /catalogue
│
├── /solutions                      Same capabilities, framed by buyer
│   ├── /solutions/hospitality      Zale's strongest vertical — lead with it
│   ├── /solutions/professional-services
│   ├── /solutions/retail
│   └── /solutions/government        (once compliance evidence exists)
│
├── /pricing                        Top-level. Non-negotiable. (F-13)
│   └── /pricing/calculator         Interactive estimator
│
├── /docs                           Separate IA, own search, own nav (F-15)
│   ├── /docs/getting-started
│   ├── /docs/<product>/…           Diátaxis: tutorial · how-to · reference · explanation
│   ├── /docs/api                   Generated from OpenAPI 3.1
│   └── /docs/cli
│
├── /catalogue                       Hardware — curated, first-party content (F-09)
│   ├── /catalogue/<category>
│   └── /catalogue/<category>/<product>
│
├── /trust                          Enterprise hub (F-16)
│   ├── /trust/security
│   ├── /trust/compliance
│   ├── /trust/sub-processors
│   └── /trust/architecture
│
├── /legal                          (F-05)
│   ├── /legal/privacy              ← highest-priority missing page on the site
│   ├── /legal/terms
│   ├── /legal/sla
│   ├── /legal/dpa
│   └── /legal/acceptable-use
│
├── /company
│   ├── /company/about
│   ├── /company/customers          Named case studies (F-12 item 11)
│   ├── /company/careers
│   └── /company/contact            Phone, email, form, booking (F-17)
│
├── /blog · /changelog · /roadmap   Momentum, honestly labelled (F-19)
├── /status                         Real monitoring (F-10, F-12)
└── /support                        Channels, hours, escalation, SLA link
```

### 6.4 Target navigation

Replace the five anchors with a product-aware structure. Persistent on every page:

| Slot | Contents |
|---|---|
| **Platform** ▾ | Mega-menu: primitives (with maturity badges), vertical apps, "View all" |
| **Solutions** ▾ | By industry, by use case, by company size |
| **Developers** ▾ | Docs, API reference, CLI, changelog, status, community |
| **Pricing** | Direct link — never nested |
| **Company** ▾ | About, customers, blog, careers, contact |
| *(right)* | **Docs** · **Sign in** · **Get started** (primary CTA) |

Rules that matter:
- Every non-home page gets breadcrumbs with `BreadcrumbList` markup — the generated catalogue pages already do this correctly and are the reference implementation.
- Every page gets a footer with the full site map plus legal, on all pages, generated from one template.
- `Sign in` appears from the moment any product has accounts, and not before.
- Maturity badges (GA / Beta / Coming soon) appear in the nav itself, per F-19.

### 6.5 Product page template

One template, used identically by every product, so the ecosystem feels like one operating system. This *is* the "unified OS" requirement in the brief — cohesion comes from template discipline, not from a shared colour.

1. Hero — what it is in one sentence, primary CTA, secondary "View docs"
2. The problem, in the customer's words
3. How it works — architecture diagram, honest about mechanics
4. Capabilities — 4–6, each with a concrete outcome
5. Code or configuration — a real, copyable example
6. Pricing — the actual numbers, linking to `/pricing`
7. Reliability — SLA, regions, data residency
8. Security & compliance — linking to `/trust`
9. Integrations — including the rest of the Zale ecosystem
10. Migration — from the incumbent, with a real guide
11. Proof — a customer using this specific product
12. Getting started — three steps, then "Read the docs"

A product that cannot fill sections 6, 7 and 12 is not GA (F-19).

---

## 7. P2 / P3 findings

All fields present, compressed. Severity · Evidence · Root cause · Business impact · Technical impact · Industry comparison · Fix · Migration · Dependencies · Effort · Priority · Customer impact · Conversion impact.

| ID | Finding | Sev | Evidence | Root cause | Business / technical impact | Industry norm | Fix & migration | Deps | Effort **[est.]** | Cust. / conv. impact |
|---|---|:--:|---|---|---|---|---|---|---|---|
| **F-20** | Stale comment falsely states Product schema is omitted | P3 | `index.html:32–34` says products "have no stable per-product URLs yet; Product/Offer markup will be added once products get individual pages" — 189 product pages exist *with* correct Product/Offer markup | Comment not updated when pages shipped | Misleads future maintainers into re-implementing existing work | Comments kept in sync or deleted | Delete the stale comment; consider adding `LocalBusiness` here instead. Non-breaking | None | 5 min | None / none |
| **F-21** | Organization schema is thin; no `LocalBusiness` | P2 | `index.html:35–58`: no `address`, `telephone`, `geo`, `openingHours`, `sameAs`, `ABN`. `@type: Organization`, not `LocalBusiness`/`ProfessionalService` | Minimum viable markup | A Brisbane local-services business forgoes local-pack eligibility and rich results — measurable organic loss for "IT support Brisbane" | `LocalBusiness` with full NAP is standard for local services | Switch to `ProfessionalService`, add postal address, phone, geo, hours, `sameAs`, `areaServed`. Additive | Real phone number (F-17); confirmed address | 3 h | Better local discovery / positive |
| **F-22** | `og:type` is `website` on all 189 product pages | P3 | `product/*.html:14`: `<meta property="og:type" content="website">` | Shared head template | Weaker social previews for shared products | `product` (or `og:product` namespace) | Set `og:type` per template in the generator; add `product:price:amount` / `:currency`. Additive | None | 1 h | Slight share-CTR gain |
| **F-23** | Sitemap `lastmod` identical on all 203 URLs; `changefreq`/`priority` noise | P2 | All entries `<lastmod>2026-07-30</lastmod>`, regenerated daily; every entry carries `changefreq` + `priority` | Build stamps "today" unconditionally | A freshness signal that claims everything changed daily is not usable and invites the crawler to ignore `lastmod` entirely | Accurate per-page `lastmod`; `changefreq`/`priority` long ignored by Google | Hash each rendered page; preserve prior date when unchanged. Drop `changefreq`/`priority`. Additive | F-04 guard first | 4 h | Better crawl efficiency / indirect |
| **F-24** | Two parallel, undocumented colour-token systems | P2 | `--c-primary:#76b900` (line 73, "DESIGN TOKENS") and `--nv:#76b900` (line 777, added under "UPGRADE") define the same colour twice; 7 `var(--nv…)` usages | Iterative bolt-ons never consolidated | Every future colour change must be made twice or drifts; blocks the accessible-palette fix in F-14 | One documented token source | Consolidate on one namespace; delete the duplicate; document surface intent per token. Land with F-14 item 1 | F-14 | 3 h | None / enables F-14 |
| **F-25** | `--r-pill` defined then overridden to `0` on every button | P3 | `.btn{border-radius:var(--r-pill)}` (line 180) then `.btn-primary{border-radius:0}` (183), `.btn-ghost{border-radius:0}` (185), `.btn-light{border-radius:0}` (187) | Design direction changed; token retained | Two competing radius languages in one system | Tokens reflect shipped design | Set `--r-pill` to the real value or remove the override chain. Non-breaking | F-24 | 1 h | None / none |
| **F-26** | Footer copyright hardcoded to `2022`, JS-populated | P3 | `index.html:1690`: `&copy; <span id="year">2022</span>`, set by script | Client-side date injection | If JS fails, the site reads "© 2022" — a strong abandonment signal. (Moot while F-02 stands, since JS failure blanks the page entirely.) | Build-time or omitted | Stamp the year at build time — the repo already has a daily build. Non-breaking | None | 30 min | Trust / slight |
| **F-27** | No `Escape` handling; no focus trap on mobile menu | P2 | 0 occurrences of `escape`/`keydown` in `index.html`. Menu correctly leaves the tab order when closed (`visibility:hidden`, line 245) — that part is right | Menu built for pointer input | Keyboard and screen-reader users cannot dismiss the menu | `Escape` closes; focus trapped while open; focus returns to trigger | Add `keydown` handler, focus trap, focus restore. Local, non-breaking | None | 3 h | A11y / slight |
| **F-28** | No skip link | P3 | 0 occurrences of `skip`. `<main>` landmark **is** present, so 2.4.1 is arguably met via the landmark technique — best practice, not a strict AA failure | Not implemented | Keyboard users traverse the nav on every page | Standard on all comparison-set sites | Add a visually-hidden skip link as first focusable element. Additive | None | 1 h | A11y / none |
| **F-29** | Silent catalogue failure with no error or empty state | P2 | `catalogue.html:540`: `.catch(function(err){console.warn(…)})` — user sees a permanently empty grid, no message, no retry | Error path treated as a developer concern | On fetch failure the catalogue looks broken with no explanation and no recovery | Skeleton loading, explicit error, retry affordance | Add skeleton, error panel with retry and `mailto:` fallback. Local, non-breaking | None | 4 h | Direct / positive |
| **F-30** | `rebuild([])` renders an empty grid before data arrives | P2 | `catalogue.html:533` then fetch at 537 | Render-then-populate sequencing | Empty-state flash then reflow — layout-shift risk on the main commerce page | Server-render the first screen | Pre-render first screen at build time (F-11 step 3a), or render a skeleton. Additive | F-11 | 1 d | Perceived speed / positive |
| **F-31** | Homepage CSS/JS fully inline; `assets/site-pages.css` unused by it | P2 | 132 KB `index.html`; ~860 lines CSS + ~400 lines JS inline; `_headers` sets `max-age=0, must-revalidate` on HTML, so all of it re-downloads every visit | Single-file authoring | ~120 KB of uncacheable payload per visit; blocks CSP (F-07) and the F-02 fix | External hashed assets with immutable caching | Extract to `assets/` with content hashes and long-lived cache. Coordinate as one change with F-02 step 6 and F-07 step 6(ii) | F-02, F-07 | 1 d | Repeat-visit speed / positive |
| **F-32** | Internal links point at `/index.html`, canonical is `/` | P2 | `category/*.html:32` links `/index.html#services`; product CTAs use `/index.html?enquiry=…#contact`. Canonical is correctly `https://zaleit.com.au/` | Generator convenience | Two crawlable paths to one page; split internal link equity; two `_headers` cache entries | One canonical path, enforced | Change generator links to `/#services`; add a 301 from `/index.html` to `/`. Backward compatible (301 preserves inbound links) | None | 2 h | None / indirect SEO |
| **F-33** | Product image referrer leaks to `mmt.com.au` | P2 | `zfFav` sets `referrerPolicy="no-referrer"` on favicon chips (`category/*.html:26`); the 2,021 primary product `<img>` tags do not | Inconsistent application of an already-known fix | Full page URLs disclosed to a third party on every product view, undisclosed (F-05) | `Referrer-Policy` set globally | Add `referrerpolicy="no-referrer"` in the generator; set `Referrer-Policy` in `_headers` (F-07 step 5). Additive | None | 1 h | Privacy / none |
| **F-34** | Six weights of one font family loaded; usage unaudited | P3 | `index.html:11` requests Outfit at 300/400/500/600/700/800 plus DM Serif Display roman + italic | Requested defensively | Unnecessary font bytes inside the `load` gate that F-02 depends on | Subset to weights actually used | Audit computed styles; drop unused weights; self-host (F-11 step 1) | F-11 | 2 h | Speed / slight |
| **F-35** | No consent audit record persisted | P2 | `contact.js:160–183` sends consent to Brevo but stores no timestamp, IP, policy version or source URL | Consent treated as a flag, not a record | Cannot evidence consent under challenge; Spam Act requires demonstrable consent | Immutable consent log with version and timestamp | Persist to KV/D1 with timestamp, source URL and policy version. Additive | F-05 privacy policy versioning | 4 h | Compliance / none |
| **F-36** | Ex-GST-only price display | P2 | `product/*.html`: `<span class="pc-rrp">ex GST</span>$3,181`; `rrpInc` **already stored** in `catalogue-data.json` | Trade-pricing convention carried into a public consumer-reachable site | ACL s48 restricts component pricing where a single total is not shown as prominently; the site is publicly reachable by consumers. Fix is free | Single total price displayed prominently | Render both figures — data already present. Additive | None | 2 h | Clarity / positive |
| **F-37** | No `noscript` fallback anywhere | P2 | 0 occurrences in any HTML file | Progressive enhancement not considered | With F-02 fixed, a JS-less visitor gets content but no form feedback; without it, nothing | Content readable without JS | Add `<noscript>` with `mailto:` contact path; keep native validation (F-14 item 8) | F-02 | 2 h | Resilience / slight |
| **F-38** | 12 category pages indexable, but 1,832 of their products have no detail page | P2 | Only `buildLaptops()` generates detail pages; 588 Computers / 354 Mounting / 326 Networking / 292 Display products are grid-only | Generator scoped to laptops | Weakest of the three options: indexable grids of products a user cannot open | Either full detail pages or `noindex` on grid-only listings | Decide per category: extend detail pages where Zale has expertise, else `noindex`. Backward compatible | F-09 strategy | 1 d decision + build | Clarity / indirect |
| **F-39** | No 404 page; no `_redirects` file | P2 | No `404.html`; no `_redirects`. Cloudflare Pages serves a generic 404 | Never added | Dead ends with no navigation back; blocks the `410`/redirect strategy in F-06 and F-09 | Branded 404 with search and nav; redirect map maintained | Add `404.html` with nav and search; create `_redirects` for the `301`/`410` work in F-06, F-09, F-32. Additive | None | 3 h | Recovery / slight |
| **F-40** | Single OG image for all 203 URLs | P3 | `og-image.png` (32 KB) referenced by every page | One asset, shared | Every shared link looks identical; product shares show no product | Per-page OG images, often generated | Generate per-product OG images at build time (or via a Pages Function). Additive | None | 1 d | Share CTR / slight |
| **F-41** | Hero counters render `0%` before JS | P3 | `data-count="99.98"`, `data-count="98"`, `data-count="89"` animate from zero; static markup shows `0%` | Animation-first markup | Without JS the hero advertises "Uptime 0%", "Security score 0%" — compounds F-02 and F-12 | Final value in markup; animate from it | Put the real value in the HTML and animate from it. Non-breaking. (Also see F-12 item 2 — the panel may be removed) | F-12 | 1 h | Trust / slight |
| **F-42** | No `<h2>`-level landmark labels on repeated regions | P3 | 8 `<section>` elements, 1 `<h1>`, 8 `<h2>`, 29 `<h3>` — heading order is sound; sections lack `aria-labelledby` | Not applied | Screen-reader region navigation is less useful than it could be | `aria-labelledby` on each landmark region | Add `aria-labelledby` linking each section to its `<h2>`. Additive | None | 1 h | A11y / none |
| **F-43** | No structured data for services, FAQ, or breadcrumbs on the homepage | P3 | Only `Organization` + `WebSite`. No `Service`, `FAQPage`, `BreadcrumbList`, `AggregateRating` | Minimum viable markup | Forgoes rich results on the highest-value commercial page | `Service`/`FAQPage` markup standard for services sites | Add `Service` per service page (F-08) and `FAQPage` where genuine Q&A exists. Additive | F-08 | 4 h | Discovery / positive |
| **F-44** | No ABN/ACN, no phone, no physical address published | P2 | Footer states "Zale IT Pty Ltd · Brisbane QLD" plus an email. No ABN, no ACN, no street address, no phone anywhere on the site | Minimal footer | Strong trust deficit for a company selling security services. A Pty Ltd's ACN appears on public documents by convention and buyers check; ABN lookup is the standard Australian verification step. No phone on a *local* IT support site removes the highest-intent channel | Full legal identity and contact in footer | Add ABN/ACN, registered address, phone to the footer template across all 203 pages | Confirm ACN; commit to answering a phone (F-17) | 3 h | Trust / positive |

---

## 8. State-of-the-art and original capability recommendations

Only capabilities that meaningfully improve customer value, filtered against Zale's actual position. Several of the examples in the brief are deliberately **rejected** below, with reasons — recommending all of them would be advice-shaped noise.

### 8.1 Recommended — genuinely differentiating for Zale

**1 · Essential Eight self-assessment tool** — *the single highest-value original feature available to Zale.*
An interactive assessment against the ACSC Essential Eight that produces a maturity-level report and a prioritised remediation plan. Zale already claims Essential Eight alignment (F-12); this makes the claim demonstrable and inverts the lead-gen model — instead of a form demanding six fields before any value (F-17), the visitor receives something genuinely useful and self-qualifies in the process. It is defensible (no hyperscaler will build an ACSC-specific SMB tool), directly aligned to Zale's expertise, and its output *is* the sales conversation. **Effort [est.] 3–4 weeks. Priority: high — build this before any AI feature.**

**2 · Data-residency and sovereignty explorer**
An interactive map showing exactly where each Zale service stores and processes data, which jurisdiction applies, and which subprocessors touch it. This is Zale's core differentiator made concrete, it directly answers the questionnaire in F-16, and it is the artefact that wins government-adjacent deals. It also forces the internal honesty that F-05 demands. **Effort [est.] 2 weeks.**

**3 · Transparent cost estimator** — F-13 item 3
Seats, devices, sites, add-ons → indicative monthly cost, with a comparison against in-house and offshore alternatives. Self-qualifying, high-intent, and it makes the "transparent pricing" claim true. **Effort [est.] 1–2 weeks.**

**4 · Live status page with real history** — F-10, F-12
Not a badge: real monitoring, per-service uptime, incident history with post-mortems. This is what converts "99.98 %" from a liability into an asset. Published incident post-mortems are one of the strongest trust signals a small vendor can offer, precisely because larger vendors are often vaguer. **Effort [est.] 1 week.**

**5 · Migration assessment wizard**
"What are you running today?" → a specific migration plan, timeline and cost. Applies to both halves of the business (MSP switching and platform migration) and directly addresses the migration-assistance gap in the brief. **Effort [est.] 2–3 weeks.**

**6 · Hospitality-specific interactive demo**
Zale's strongest vertical, with two products aimed at it (Roster, Ordering). A working demo — no signup — of a shift roster and an order flow. Hospitality operators buy what they can see. **Effort [est.] 3–4 weeks, after the products are real (F-19).**

**7 · Docs with runnable examples and an OpenAPI-driven playground** — F-15
When the first platform product ships. Copyable, runnable, versioned. Table stakes for developer products, so it is on this list as a requirement rather than an innovation.

**8 · Public roadmap and changelog** — F-19
Cheap, honest, and the correct home for the twelve-product ambition. Ship in week one; it costs almost nothing and immediately makes the platform story legible without over-promising.

### 8.2 Recommended later — after the foundations

**9 · AI documentation assistant** — only once docs exist. An assistant over an empty corpus is worse than none.
**10 · Personalised homepage by visitor type** — developer / SMB owner / enterprise. Requires the analytics from F-10 and enough content to personalise between; premature today.
**11 · Sandbox environments** — genuinely valuable for a developer platform, and meaningless before a product exists.
**12 · Per-product OG image generation** — F-40.

### 8.3 Explicitly not recommended now, and why

- **AI solution architect / AI pricing advisor.** Both require a real product catalogue with real pricing to reason about. Building an AI advisor for products that do not exist (F-19) manufactures confident answers about vapour — the worst possible failure mode for a company already carrying unsubstantiated claims (F-12).
- **Live infrastructure map with real-time traffic.** Cloudflare's works because it has a global network. Zale's would advertise how small it is. Revisit at scale; the sovereignty explorer (#2) is the version that works today.
- **Interactive product comparison against AWS/Azure/GCP.** Invites a feature-by-feature comparison Zale loses. Compete on sovereignty, support and simplicity, not on breadth.
- **Marketplace / developer platform surfaces.** Multi-sided marketplaces require supply, demand and a platform. None exists. This is a 3–5 year item, not a website feature.
- **Elaborate homepage animation work.** The existing motion design is already the strongest thing on the site (§1.4). Adding more optimises the one dimension that is not the constraint.

---

## 9. Implementation roadmap

Every milestone is independently deployable, ships in ≤ 2 weeks, preserves backward compatibility, and carries explicit test and analytics requirements.

**Sequencing principle:** measurement first, then stop the bleeding, then remove blockers, then build. M1 is deliberately the cheapest milestone in the plan, because without it nothing that follows can be evaluated.

### M1 — Measurement baseline · Week 1 · ~1 day

**Ship** Cloudflare Web Analytics; product analytics with the F-10 event taxonomy; Sentry; uptime monitoring on `/`, `/catalogue.html`, `/api/contact`; workflow-failure alerts.
**Backward compatibility** Purely additive.
**Testing** Verify events fire in staging; confirm no CLS regression from the tags; confirm alerting delivers to a real channel.
**Analytics** *This milestone is the analytics.* Success = 7 consecutive days of clean baseline data for sessions, bounce, form-start rate, form-submit rate, catalogue engagement and CWV field data.
**Why first** Every subsequent milestone's success criteria depend on it, and it is a one-day additive change with no risk.

### M2 — Stop the bleeding · Week 1–2 · ~3 days

**Ship** F-01 token rotation; F-02 CSS-inverted load screen + script guards + `noscript`; F-04 feed threshold guard (warn mode) + atomic write; F-06 price and condition filters + delete `product/bv5l6pt-q.html`; F-07 steps 1–5 (CORS allowlist, Turnstile, honeypot, rate limit, security headers).
**Backward compatibility** No URL, markup or API contract changes. Turnstile is additive to the form; deploy the function's token verification tolerantly first, then enforce.
**Testing** Confirm content renders with JS disabled and with a deliberate early exception injected; unit-test the feed guard against empty, truncated and schema-drifted fixtures; verify cross-origin POST is rejected and same-origin succeeds; confirm no page has `price ≤ 0` or a condition prefix; run `securityheaders.com` and Mozilla Observatory.
**Analytics** LCP/FCP before vs after (expect the largest single delta in the programme); form submission volume before vs after Turnstile (spam should fall, genuine submissions should not); zero workflow failures unalerted.

### M3 — Legal and trust minimum · Week 3–4 · ~1 week + legal

**Ship** `/legal/privacy`, `/legal/terms`; footer legal links across all 203 pages via the generator template; F-12 items 1–6 (reconcile uptime figures, de-`LIVE` the mock, replace hand-drawn vendor logos, soften ISO claim, fix the offshore claim, fix "Zaleit IT"); F-44 (ABN/ACN, address, phone); F-35 consent records.
**Backward compatibility** New pages plus copy edits; no existing URL changes.
**Testing** Link-check all 203 pages for the new footer links; verify consent records persist with timestamp and policy version; legal sign-off recorded before deploy.
**Analytics** Track `/legal/*` pageviews (a baseline for procurement interest); monitor bounce on the homepage for copy-change regressions.

### M4 — Release governance · Week 3–4 · ~2 days (parallel with M3)

**Ship** `ci.yml` with `node --check`, HTML validation, link check, Lighthouse CI budgets, `axe-core`; branch protection on `main`; `auto-merge.yml` converted to PR + conditional auto-merge; Cloudflare Pages preview deployments; F-04 guard switched from warn to enforce.
**Backward compatibility** No product change. Scheduled workflows keep an explicit bypass.
**Testing** Deliberately open a PR that violates each check and confirm it blocks; confirm the scheduled feed job still completes.
**Analytics** Zero unreviewed production deploys; CI pass rate; mean time from PR to merge (should not materially regress).

### M5 — Conversion path · Week 5–6 · ~1 week

**Ship** F-17 (message and business optional — with the function relaxed *first*; visible phone number; booking link); F-14 items 2, 4, 5, 6, 8 (restore focus indicators, associate errors, skip link, `Escape`, native validation); F-29 catalogue error and skeleton states; F-39 404 page and `_redirects`.
**Backward compatibility** The function must accept both old and new payload shapes before the form changes — deploy in that order.
**Testing** Full keyboard traversal of the form; NVDA/VoiceOver announcement of every error; `axe-core` clean on homepage, catalogue and a product page; submit with and without optional fields against the deployed function.
**Analytics** `form_start` → `form_submit` completion rate vs the M1 baseline; per-field error rates; phone-click and booking-click volume. **This is the first true A/B opportunity** — run the field-optionality change as a controlled experiment.

### M6 — Performance and asset control · Week 7–8 · ~1 week

**Ship** F-11 step 3(c) (strip `description` from the catalogue index payload); F-11 step 1 (self-hosted subsetted fonts); F-31 (extract CSS/JS to hashed assets); F-33 (referrer policy on product images); F-07 step 6(i)–(ii) (CSP Report-Only, inline code externalised); F-34 (font weight audit).
**Backward compatibility** No URL changes; CSP stays in Report-Only for the whole milestone.
**Testing** Lighthouse CI budgets enforced (LCP ≤ 2.0 s mobile p75, CLS ≤ 0.05, INP ≤ 200 ms, JS ≤ 100 KB gzip, HTML ≤ 50 KB); visual regression on all four page types; CSP violation report reviewed and empty of legitimate breakage before proceeding.
**Analytics** Field CWV at p75 vs the M1 baseline; repeat-visit payload; catalogue time-to-first-card.

### M7 — Services IA extraction · Week 9–12 · two 2-week milestones

**Ship (M7a)** `/services/managed-it`, `/services/cybersecurity`, `/services/microsoft-365`, `/services/compliance` — the four highest-intent services — plus the new nav shell, breadcrumbs with `BreadcrumbList`, per-page metadata and OG, `Service` structured data, F-32 (`/index.html` → `/` 301 and generator link fix), F-21 (`ProfessionalService` schema with full NAP).
**Ship (M7b)** The remaining four service pages; homepage sections reduced to teasers linking out; F-43 (`FAQPage` where genuine); F-42 (region labels).
**Backward compatibility** Critical: homepage anchors keep working throughout because content is *duplicated* to the new pages before the homepage sections are shortened. No redirects needed, no dead links at any point.
**Testing** Link-check every anchor still resolves; confirm canonical and sitemap correctness per new page; Search Console coverage watched for indexing of the new URLs; `axe-core` on each new page.
**Analytics** Per-service pageviews (previously impossible — all eight collapsed into one URL); organic entry by service; per-service form conversion. This milestone is where marketing attribution becomes possible at all.

### M8 — Pricing · Week 13–14 · ~1 week engineering

**Ship** `/pricing` with tiers and scope (F-13 items 1–2); `/legal/sla` (F-12 item 8); F-36 (GST-inclusive prices alongside ex-GST); `Pricing` in top-level nav.
**Backward compatibility** Additive.
**Testing** Verify GST arithmetic against `rrpInc` on a product sample; legal review of SLA wording; link-check.
**Analytics** `/pricing` views and the pricing → form conversion rate. **Expect fewer, better-qualified enquiries** — instrument lead *quality* (via CRM outcome) alongside volume, or this milestone will look like a regression when it is an improvement.

### M9 — Enterprise trust · Week 15–16 · ~2 weeks

**Ship** `/trust` hub, `/trust/security`, `/trust/compliance`, `/trust/sub-processors`; `/status` with real monitoring; `/legal/dpa`; enterprise contact path distinct from the general form.
**Backward compatibility** Additive.
**Testing** Confirm every claim on `/trust/*` traces to the F-12 item 12 claims register; verify `/status` reflects real monitors.
**Analytics** `/trust/*` and `/status` traffic; enterprise-path enquiry volume; security-questionnaire cycle time (the real business metric here).

### M10 — Catalogue quality · Week 17–18 · ~2 weeks

**Ship** F-09 items 2–4 (first-party content on retained products, deliberate pruning with `410`s, accurate `lastmod`); F-18 (self-hosted optimised images, local brand assets, delegated `onerror`); F-38 category decisions; F-40 per-product OG images.
**Backward compatibility** `410 Gone` for deliberate removals, coordinated with the sitemap in the same deploy. Staged in tranches.
**Testing** Search Console coverage monitored per tranche; verify no `404` where `410` is intended; visual regression on the image pipeline.
**Analytics** Organic catalogue traffic and product-enquire rate per retained page; watch impressions during pruning.

### M11+ — Platform surface · Week 19 onward

Gated on **F-19**: one product taken to GA quality end-to-end — product page, docs, pricing, signup, status — before a second starts. Then `/platform` overview, the `/docs` shell (F-15), `/changelog`, `/roadmap`, and the differentiating capabilities in §8.1 in order: Essential Eight tool, sovereignty explorer, cost estimator, migration wizard.

### Roadmap summary

| # | Milestone | Weeks | Effort **[est.]** | Unblocks |
|---|---|---|---|---|
| M1 | Measurement baseline | 1 | 1 d | Everything |
| M2 | Stop the bleeding | 1–2 | 3 d | Safe iteration |
| M3 | Legal & trust minimum | 3–4 | 1 w + legal | Enterprise sales |
| M4 | Release governance | 3–4 | 2 d | Safe deploys |
| M5 | Conversion path | 5–6 | 1 w | Lead volume |
| M6 | Performance & assets | 7–8 | 1 w | CSP, speed |
| M7 | Services IA (a + b) | 9–12 | 4 w | Organic growth |
| M8 | Pricing | 13–14 | 1 w | Self-qualification |
| M9 | Enterprise trust | 15–16 | 2 w | Enterprise deals |
| M10 | Catalogue quality | 17–18 | 2 w | Domain quality |
| M11+ | Platform surface | 19+ | Per product | The platform thesis |

---

## 10. Closing assessment

The website is a competently-built, visually accomplished brochure for a Brisbane MSP, sitting on top of a resold hardware catalogue, with no legal layer, no measurement, no release gate, and none of the twelve products the business plan is built on.

Three things about that are worth stating plainly to the audiences this report is written for.

**The craft is not the problem.** The motion design, the reduced-motion handling, the generated catalogue templates and the generator scripts are all better than the median for a company at this stage. Whoever built this can build the platform site. The failures are of foundation and sequencing, not of capability.

**The foundations are cheap to fix and are currently load-bearing.** F-01 through F-07 are days of work, not months, and until they are done every other investment sits on a site that can black-screen from one exception, deploy unreviewed, delete 99 % of its own pages overnight, and cannot prove it collected anyone's consent lawfully. M1 and M2 together are four days.

**The platform ambition is credible, but the website cannot lead it.** The recommendation this report makes most strongly is the one that contradicts the brief: **do not put twelve products on the site.** Build the architecture that will hold them (M7), publish the roadmap and changelog that make the ambition legible, and populate the product IA strictly as each product becomes real. One product at GA quality — with a page, docs, pricing, a signup and a status feed — does more for enterprise buyers, partners and investors than twelve pages that lead nowhere. The comparison set earned their credibility that way, and it is the only way it can be earned.

The differentiator is real and available now: **Australian-owned, Australian-hosted, with a Brisbane team who answer the phone.** Nothing in the comparison set can claim it. Right now the site asserts it in copy while contradicting it in implementation. Making it true — self-hosted fonts, Australian processors where possible, published data residency, a real phone number, and a sovereignty explorer that shows exactly where data lives — converts the strongest claim on the site from a liability into the foundation of the platform story.

### The five actions, restated

1. **Rotate the MMT token** (F-01) — today.
2. **Un-gate the page from JavaScript** (F-02) — the highest-value single change on the site.
3. **Gate deploys behind review and tests** (F-03).
4. **Guard the feed job** (F-04).
5. **Publish a privacy policy and reconcile the contradicting claims** (F-05, F-12).

Then install analytics (F-10) so that everything after that can be measured rather than argued about.

---

## Appendix A — Verified citation

This report deliberately quotes almost no external source (see §0, "On sourcing"). The following is the one claim that completed adversarial verification and was **confirmed unanimously (3–0)**, with the source text quoted directly. It supports the documentation architecture recommended in **F-15** and §6.5.

**A-1 · The Diátaxis documentation framework** — <https://diataxis.fr/>

> "Diátaxis identifies four distinct needs, and four corresponding forms of documentation — tutorials, how-to guides, technical reference and explanation. It places them in a systematic relationship, and proposes that documentation should itself be organised around the structures of those needs. […] Diátaxis solves problems related to documentation content (what to write), style (how to write it) and architecture (how to organise it)."

**Why it matters for Zale.** F-15 recommends standing up `/docs` around these four modes *before* the first platform product ships. The relevant property is that the framework separates three problems Zale will otherwise conflate — what to write, how to write it, and how to organise it — and organises the documentation around reader *needs* rather than around the product's feature list. For a company intending to ship twelve products into one documentation surface, choosing that structure once, up front, is materially cheaper than retrofitting it per product later.

**Claims that did not survive verification, and are therefore absent from this report.** Recorded so the omissions are auditable rather than invisible:

| Claim tested | Verdict | Why it is excluded |
|---|---|---|
| Specific developer-survey percentages on documentation as the leading API collaboration failure | **Refuted 0–2** | The quoted figures did not hold up. No survey statistic appears in this report. |
| An attribution of the Diátaxis framework to one benchmark platform's documentation redesign | **Refuted 1–2** | Attribution unsupported. No such claim is made. |
| That the framework names feature-oriented organisation as its default failure mode across product portfolios | **Refuted 0–3** | Overstated relative to the source. The recommendation in F-15 rests on A-1 only. |

**Sources that could not be reached at all.** `accc.gov.au`, `oaic.gov.au`, `cyber.gov.au`, `humanrights.gov.au` — all HTTP 403 under an egress policy blocking `*.gov.au`, plus rate-limited fetches of `developers.google.com`, `w3.org`, `owasp.org`, `developers.cloudflare.com` and `aicpa-cima.com`. The Australian regulatory and WCAG 2.2 references in this report are consequently unverified against primary sources. Confirming them is a prerequisite to circulating the legal findings externally, and is the first item of follow-up work.
