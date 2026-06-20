import { Router } from "express";
import { requireApiKey, requireScope } from "../middleware/auth.js";
import { saveCalculation, listCalculations, getCalculation } from "../db.js";

const router = Router();

// POST /api/v1/calculations
// Body: the calculation a URA user explicitly chose to share (inputs + result
// from computeImportCost). Storing is opt-in on the frontend side — URA does
// not send anything here by default.
router.post("/", requireApiKey(), requireScope("calculations:write"), async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({ error: "invalid_payload", message: "Body must be a JSON object." });
  }
  const record = await saveCalculation({ consumerId: req.consumer.id, payload });
  res.status(201).json({ id: record.id, createdAt: record.createdAt });
});

// GET /api/v1/calculations — a consumer only ever sees its own submissions.
router.get("/", requireApiKey(), requireScope("calculations:read"), async (req, res) => {
  const items = await listCalculations({ consumerId: req.consumer.id });
  res.json({ items });
});

router.get("/:id", requireApiKey(), requireScope("calculations:read"), async (req, res) => {
  const item = await getCalculation(req.params.id);
  if (!item || item.consumerId !== req.consumer.id) {
    return res.status(404).json({ error: "not_found" });
  }
  res.json(item);
});

export default router;
