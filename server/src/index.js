import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import calculationsRouter from "./routes/calculations.js";
import leadsRouter from "./routes/leads.js";
import ratesRouter from "./routes/rates.js";
import consumersRouter from "./routes/consumers.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: "256kb" }));

  // CORS: allow URA's own GitHub Pages origin by default, plus any extra
  // origins a partner's own site might need (comma-separated env var) — so
  // adding a new integration never requires touching this file again.
  const allowedOrigins = [
    "https://fmiftari.github.io",
    ...((process.env.EXTRA_CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)),
  ];
  app.use(cors({
    origin(origin, callback) {
      // Allow no-origin requests (server-to-server, curl, Postman) and any allowed browser origin.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
  }));

  // Generic rate limit — generous enough for normal integration traffic,
  // tight enough to stop a runaway/abusive client from one API key.
  app.use("/api/", rateLimit({ windowMs: 60_000, max: 120 }));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "ura-import-api", time: new Date().toISOString() }));

  app.use("/api/v1/calculations", calculationsRouter);
  app.use("/api/v1/leads", leadsRouter);
  app.use("/api/v1/rates", ratesRouter);
  app.use("/api/v1/consumers", consumersRouter);

  app.use((req, res) => res.status(404).json({ error: "not_found", path: req.path }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.message === "Not allowed by CORS") {
      return res.status(403).json({ error: "cors_rejected" });
    }
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  const port = process.env.PORT || 8787;
  app.listen(port, () => {
    console.log(`ura-import-api listening on :${port}`);
    if (!process.env.ADMIN_API_KEY) {
      console.warn("ADMIN_API_KEY is not set — consumer onboarding endpoints will refuse all requests until it is.");
    }
  });
}
