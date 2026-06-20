// ── Opt-in companion-API client ─────────────────────────────────────────────
// Inert by default. URA's frontend ships as a 100% client-side calculator —
// no server, no stored data, that's a stated privacy promise. This module
// only does anything if VITE_API_BASE is set at build time (i.e. Flamur has
// actually deployed the companion service under server/ and pointed a build
// at it). Until then, every exported function is a no-op and nothing is sent
// anywhere.
//
// Security note on VITE_API_PUBLIC_KEY: anything bundled into client-side JS
// is effectively public — anyone can read it out of the built bundle. Only
// ever put a key here that is scoped to write-only intake (e.g. "leads:write"
// or "calculations:write", NOT "*:read" or admin). This mirrors how public
// form services like Formspree work: a public-facing endpoint ID, not a
// secret. See server/README.md "Frontend integration".

const API_BASE = import.meta.env.VITE_API_BASE || null;
const PUBLIC_KEY = import.meta.env.VITE_API_PUBLIC_KEY || null;

export const apiEnabled = Boolean(API_BASE);

async function post(path, body) {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(PUBLIC_KEY ? { "X-API-Key": PUBLIC_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || detail.error || `API request failed (${res.status})`);
  }
  return res.json();
}

// Called only when a user explicitly clicks "Send to Customs/Partner" on a
// finished calculation — never automatically.
export function submitCalculation(payload) {
  return post("/api/v1/calculations", payload);
}

// Generalizes the existing Formspree-based partner contact form; same
// opt-in-only rule applies.
export function submitLead(payload) {
  return post("/api/v1/leads", payload);
}

// Public, no key needed — fetches officially-published rates if a government
// body has ever used PUT /api/v1/rates. Falls back to null (caller should
// keep using the built-in TAX_CONFIG) if the API is disabled or nothing has
// been published yet.
export async function fetchOfficialRates() {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/rates`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates || null;
  } catch {
    return null;
  }
}
