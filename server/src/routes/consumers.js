import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { createConsumer, listConsumers, revokeConsumer } from "../db.js";

const router = Router();

const VALID_SCOPES = [
  "calculations:read", "calculations:write",
  "leads:read", "leads:write",
  "rates:read", "rates:write",
];

// Admin-only onboarding for a new integration partner — used by Flamur to
// issue a key once a real collaboration (government or company) is agreed.
// Not exposed anywhere in the URA frontend.
router.post("/", requireAdmin(), async (req, res) => {
  const { name, type, scopes } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "invalid_payload", message: "'name' is required." });
  }
  const grantedScopes = Array.isArray(scopes) ? scopes.filter((s) => VALID_SCOPES.includes(s)) : [];
  const consumer = await createConsumer({ name, type: type || "partner", scopes: grantedScopes });
  // apiKey is shown exactly once, here — store it now, it cannot be retrieved again.
  res.status(201).json(consumer);
});

router.get("/", requireAdmin(), async (_req, res) => {
  const items = await listConsumers();
  res.json({ items });
});

router.delete("/:id", requireAdmin(), async (req, res) => {
  const revoked = await revokeConsumer(req.params.id);
  if (!revoked) return res.status(404).json({ error: "not_found" });
  res.json({ id: revoked.id, revoked: true });
});

export default router;
