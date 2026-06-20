import { Router } from "express";
import { requireApiKey, requireScope } from "../middleware/auth.js";
import { saveLead, listLeads } from "../db.js";

const router = Router();

// POST /api/v1/leads
// Generalizes the existing Formspree-only partner contact form (LeadModal in
// the frontend) into a stored, queryable record. A transport/insurance/finance
// partner with "leads:write" can receive inquiries directly instead of (or in
// addition to) the email-based flow.
router.post("/", requireApiKey(), requireScope("leads:write"), async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({ error: "invalid_payload", message: "Body must be a JSON object." });
  }
  const record = await saveLead({ consumerId: req.consumer.id, payload });
  res.status(201).json({ id: record.id, status: record.status, createdAt: record.createdAt });
});

// GET /api/v1/leads — a partner only ever sees leads addressed to itself.
router.get("/", requireApiKey(), requireScope("leads:read"), async (req, res) => {
  const items = await listLeads({ consumerId: req.consumer.id });
  res.json({ items });
});

export default router;
