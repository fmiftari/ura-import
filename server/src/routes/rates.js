import { Router } from "express";
import { requireApiKey, requireScope } from "../middleware/auth.js";
import { getCurrentRates, publishRates, listRatesHistory } from "../db.js";

const router = Router();

// GET /api/v1/rates — intentionally public, no API key required.
// The rates this would eventually serve (customs %, VAT %, excise table, age
// limits) are already public law, hardcoded into URA's client-side JS today.
// Exposing them here read-only changes nothing about confidentiality; it just
// gives a machine-readable source that could replace the hardcoded copy later,
// and that Kosovo Customs could one day publish updates against directly.
router.get("/", async (_req, res) => {
  const current = await getCurrentRates();
  if (!current) {
    return res.json({ rates: null, message: "No rates have been published via the API yet — URA's frontend still uses its built-in TAX_CONFIG." });
  }
  res.json(current);
});

router.get("/history", async (_req, res) => {
  const history = await listRatesHistory();
  res.json({ items: history });
});

// PUT /api/v1/rates — write access reserved for whoever holds a "rates:write"
// key (today: nobody but URA's own admin; in the future: Dogana e Kosovës,
// once/if such a key is formally issued to them).
router.put("/", requireApiKey(), requireScope("rates:write"), async (req, res) => {
  const { rates, note } = req.body || {};
  if (!rates || typeof rates !== "object") {
    return res.status(400).json({ error: "invalid_payload", message: "Body must include a 'rates' object." });
  }
  const record = await publishRates({ consumerId: req.consumer.id, rates, note });
  res.status(201).json(record);
});

export default router;
