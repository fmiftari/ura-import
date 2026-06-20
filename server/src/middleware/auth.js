// ── Auth middleware ──────────────────────────────────────────────────────────
// One generic scheme for everyone — Kosovo Customs, a transport company, an
// insurance partner, or URA's own frontend all authenticate the same way:
// an `X-API-Key` header, checked against a hashed key on a `consumer` record,
// with the request restricted to that consumer's granted `scopes`.
//
// There is intentionally no special-cased "government" code path. Treating
// every integration identically is what makes this a genuinely reusable
// interface instead of a one-off built for a single future partner.

import { findConsumerByKey } from "../db.js";

export function requireApiKey() {
  return async (req, res, next) => {
    const key = req.header("X-API-Key");
    if (!key) {
      return res.status(401).json({ error: "missing_api_key", message: "Send your key in the X-API-Key header." });
    }
    const consumer = await findConsumerByKey(key);
    if (!consumer) {
      return res.status(401).json({ error: "invalid_api_key" });
    }
    req.consumer = consumer;
    next();
  };
}

export function requireScope(scope) {
  return (req, res, next) => {
    if (!req.consumer) {
      return res.status(401).json({ error: "missing_api_key" });
    }
    if (!req.consumer.scopes.includes(scope)) {
      return res.status(403).json({
        error: "insufficient_scope",
        message: `This API key does not have the "${scope}" scope.`,
        requiredScope: scope,
      });
    }
    next();
  };
}

// Separate, higher-privilege check for consumer/admin management — gated by
// a single ADMIN_API_KEY env var rather than the regular consumer table, so
// rotating it doesn't require touching the data file.
export function requireAdmin() {
  return (req, res, next) => {
    const key = req.header("X-Admin-Key");
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) {
      return res.status(503).json({ error: "admin_not_configured", message: "ADMIN_API_KEY is not set on the server." });
    }
    if (!key || key !== expected) {
      return res.status(401).json({ error: "invalid_admin_key" });
    }
    next();
  };
}
