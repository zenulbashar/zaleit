/**
 * Cloudflare Pages Function — Contact form handler
 *
 * Receives zaleit.com.au contact form submissions and:
 *   1. Forwards them to Formspree (email notifications keep working).
 *   2. If the user consents to marketing, creates/updates a tagged contact
 *      in Brevo.
 *
 * Deployed automatically with the site at: https://zaleit.com.au/api/contact
 *
 * Requires a Cloudflare environment variable / secret: BREVO_API_KEY
 * (never hardcode it — see deploy notes in the PR/commit description).
 */

// The Formspree form that sends the email notification.
const FORMSPREE_ENDPOINT = "https://formspree.io/f/mwvzgkka";

// Brevo "All Enquiries" list — confirmed real ID.
const MASTER_LIST_ID = 2;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

// CORS preflight.
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function isTruthy(value) {
  if (value === true) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "on" || v === "true" || v === "1" || v === "yes";
  }
  return false;
}

async function parseBody(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return await request.json();
  }
  // form data / urlencoded
  const form = await request.formData();
  const obj = {};
  for (const [key, value] of form.entries()) {
    obj[key] = value;
  }
  return obj;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await parseBody(request);
  } catch (err) {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
  }

  const firstName = (data.firstName || "").toString().trim();
  const lastName = (data.lastName || "").toString().trim();
  const email = (data.email || "").toString().trim();
  const business = (data.business || "").toString().trim();
  const service = (data.service || "").toString().trim();
  const message = (data.message || "").toString().trim();
  const marketingConsent = isTruthy(data.marketingConsent);

  // Minimal server-side validation — the front-end validates too.
  if (!firstName || !lastName || !email || !business || !service || !message) {
    return jsonResponse(
      { ok: false, error: "Please complete all required fields." },
      400
    );
  }

  // ---- Step A: Forward to Formspree (notification channel) ----
  try {
    const formspreeRes = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        business,
        service,
        message,
        marketingConsent: marketingConsent ? "Yes" : "No",
      }),
    });

    if (!formspreeRes.ok) {
      // Formspree failed — this is the channel that actually notifies the
      // team, so surface a failure to the user.
      let detail = "";
      try {
        detail = JSON.stringify(await formspreeRes.json());
      } catch (_) {
        /* ignore */
      }
      console.error(
        "Formspree submission failed:",
        formspreeRes.status,
        detail
      );
      return jsonResponse(
        { ok: false, error: "We couldn't send your message. Please try again." },
        502
      );
    }
  } catch (err) {
    console.error("Formspree request error:", err);
    return jsonResponse(
      { ok: false, error: "We couldn't send your message. Please try again." },
      502
    );
  }

  // ---- Step B: Create/update Brevo contact (only if consented) ----
  // A Brevo failure must NOT block the user — Formspree already succeeded.
  if (marketingConsent) {
    if (!env || !env.BREVO_API_KEY) {
      console.warn("BREVO_API_KEY not configured — skipping Brevo sync.");
    } else {
      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/contacts", {
          method: "POST",
          headers: {
            "api-key": env.BREVO_API_KEY,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            email,
            attributes: {
              FIRSTNAME: firstName,
              LASTNAME: lastName,
              INTERESTS: service,
              BUSINESS: business,
            },
            listIds: [MASTER_LIST_ID],
            updateEnabled: true,
          }),
        });

        // 201 = created (new contact), 204 = updated (existing contact).
        if (brevoRes.status !== 201 && brevoRes.status !== 204) {
          let detail = "";
          try {
            detail = JSON.stringify(await brevoRes.json());
          } catch (_) {
            /* ignore */
          }
          console.error("Brevo sync failed:", brevoRes.status, detail);
        }
      } catch (err) {
        console.error("Brevo request error:", err);
      }
    }
  }

  // ---- Step C: Always report success once Formspree succeeded ----
  return jsonResponse({ ok: true });
}
