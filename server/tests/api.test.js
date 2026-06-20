import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { rmSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DATA_DIR = path.join(__dirname, "..", "data-test");

process.env.DATA_DIR = TEST_DATA_DIR;
process.env.ADMIN_API_KEY = "test-admin-key";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/index.js");

function freshApp() {
  if (existsSync(TEST_DATA_DIR)) rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  return createApp();
}

afterAll(() => {
  if (existsSync(TEST_DATA_DIR)) rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

describe("GET /health", () => {
  it("returns ok:true without any auth", async () => {
    const app = freshApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("Consumer onboarding (admin-only)", () => {
  it("rejects without X-Admin-Key", async () => {
    const app = freshApp();
    const res = await request(app).post("/api/v1/consumers").send({ name: "X" });
    expect(res.status).toBe(401);
  });

  it("rejects with a wrong admin key", async () => {
    const app = freshApp();
    const res = await request(app).post("/api/v1/consumers").set("X-Admin-Key", "wrong").send({ name: "X" });
    expect(res.status).toBe(401);
  });

  it("creates a consumer and returns a one-time apiKey, no stored hash leaked", async () => {
    const app = freshApp();
    const res = await request(app).post("/api/v1/consumers")
      .set("X-Admin-Key", "test-admin-key")
      .send({ name: "Gani Transport GmbH", type: "partner", scopes: ["leads:write", "leads:read"] });
    expect(res.status).toBe(201);
    expect(res.body.apiKey).toMatch(/^ura_/);
    expect(res.body.apiKeyHash).toBeUndefined();
    expect(res.body.scopes).toEqual(["leads:write", "leads:read"]);
  });

  it("silently drops unknown/invalid scopes instead of granting them", async () => {
    const app = freshApp();
    const res = await request(app).post("/api/v1/consumers")
      .set("X-Admin-Key", "test-admin-key")
      .send({ name: "X", scopes: ["leads:write", "totally:made-up"] });
    expect(res.body.scopes).toEqual(["leads:write"]);
  });

  it("can list and then revoke a consumer, after which its key stops working", async () => {
    const app = freshApp();
    const created = await request(app).post("/api/v1/consumers")
      .set("X-Admin-Key", "test-admin-key")
      .send({ name: "Temp Partner", scopes: ["leads:write"] });
    const key = created.body.apiKey;

    const before = await request(app).post("/api/v1/leads").set("X-API-Key", key).send({ note: "hi" });
    expect(before.status).toBe(201);

    const revoke = await request(app).delete(`/api/v1/consumers/${created.body.id}`).set("X-Admin-Key", "test-admin-key");
    expect(revoke.status).toBe(200);

    const after = await request(app).post("/api/v1/leads").set("X-API-Key", key).send({ note: "hi again" });
    expect(after.status).toBe(401);
  });
});

describe("API-key auth and scopes (same mechanism for any consumer type)", () => {
  let key;
  beforeEach(async () => {
    globalThis.__app = freshApp();
    const created = await request(globalThis.__app).post("/api/v1/consumers")
      .set("X-Admin-Key", "test-admin-key")
      .send({ name: "Scoped Consumer", scopes: ["leads:write", "leads:read"] });
    key = created.body.apiKey;
  });

  it("rejects requests with no API key", async () => {
    const res = await request(globalThis.__app).post("/api/v1/leads").send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("missing_api_key");
  });

  it("rejects an unknown API key", async () => {
    const res = await request(globalThis.__app).post("/api/v1/leads").set("X-API-Key", "ura_does_not_exist").send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_api_key");
  });

  it("rejects a request for a scope the key was not granted", async () => {
    const res = await request(globalThis.__app).post("/api/v1/calculations").set("X-API-Key", key).send({ price: 1000 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("insufficient_scope");
  });

  it("accepts a request matching a granted scope", async () => {
    const res = await request(globalThis.__app).post("/api/v1/leads").set("X-API-Key", key).send({ name: "Test Lead" });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^lead_/);
  });
});

describe("Calculations endpoint", () => {
  it("stores a calculation and only lets the same consumer read it back", async () => {
    const app = freshApp();
    const c1 = await request(app).post("/api/v1/consumers").set("X-Admin-Key", "test-admin-key")
      .send({ name: "C1", scopes: ["calculations:write", "calculations:read"] });
    const c2 = await request(app).post("/api/v1/consumers").set("X-Admin-Key", "test-admin-key")
      .send({ name: "C2", scopes: ["calculations:read"] });

    const submit = await request(app).post("/api/v1/calculations").set("X-API-Key", c1.body.apiKey)
      .send({ make: "VW", model: "Golf", price: 8000, arrival: 10500 });
    expect(submit.status).toBe(201);
    const id = submit.body.id;

    const ownRead = await request(app).get(`/api/v1/calculations/${id}`).set("X-API-Key", c1.body.apiKey);
    expect(ownRead.status).toBe(200);
    expect(ownRead.body.payload.make).toBe("VW");

    // a different consumer, even with calculations:read, cannot read someone else's record
    const otherRead = await request(app).get(`/api/v1/calculations/${id}`).set("X-API-Key", c2.body.apiKey);
    expect(otherRead.status).toBe(404);
  });

  it("rejects a non-object body", async () => {
    const app = freshApp();
    const c1 = await request(app).post("/api/v1/consumers").set("X-Admin-Key", "test-admin-key")
      .send({ name: "C1", scopes: ["calculations:write"] });
    const res = await request(app).post("/api/v1/calculations").set("X-API-Key", c1.body.apiKey)
      .send([1, 2, 3]);
    expect(res.status).toBe(400);
  });
});

describe("Rates endpoint (public read, scoped write)", () => {
  it("GET is public and returns null before anything is published", async () => {
    const app = freshApp();
    const res = await request(app).get("/api/v1/rates");
    expect(res.status).toBe(200);
    expect(res.body.rates).toBeNull();
  });

  it("rejects PUT without rates:write scope", async () => {
    const app = freshApp();
    const c1 = await request(app).post("/api/v1/consumers").set("X-Admin-Key", "test-admin-key")
      .send({ name: "No Write", scopes: ["rates:read"] });
    const res = await request(app).put("/api/v1/rates").set("X-API-Key", c1.body.apiKey).send({ rates: { vatRate: 0.18 } });
    expect(res.status).toBe(403);
  });

  it("a consumer with rates:write can publish, and GET reflects it immediately", async () => {
    const app = freshApp();
    const gov = await request(app).post("/api/v1/consumers").set("X-Admin-Key", "test-admin-key")
      .send({ name: "Dogana e Kosoves (test)", type: "government", scopes: ["rates:write"] });

    const put = await request(app).put("/api/v1/rates").set("X-API-Key", gov.body.apiKey)
      .send({ rates: { customsRate: 0.1, vatRate: 0.18 }, note: "2026 update" });
    expect(put.status).toBe(201);

    const get = await request(app).get("/api/v1/rates");
    expect(get.body.rates).toEqual({ customsRate: 0.1, vatRate: 0.18 });
    expect(get.body.note).toBe("2026 update");
  });
});

describe("CORS", () => {
  it("allows the URA GitHub Pages origin", async () => {
    const app = freshApp();
    const res = await request(app).get("/health").set("Origin", "https://fmiftari.github.io");
    expect(res.headers["access-control-allow-origin"]).toBe("https://fmiftari.github.io");
  });
});
