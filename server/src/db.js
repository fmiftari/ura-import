// ── Storage layer ────────────────────────────────────────────────────────────
// Deliberately tiny and dependency-free (plain JSON file on disk, guarded by an
// in-process write queue) so the service has zero native-module / hosting
// surprises on day one. The public functions below are the ONLY thing the rest
// of the app talks to — swap this file for a Postgres/SQLite-backed version
// later without touching routes or middleware.
//
// NOT for high-concurrency production load. Fine for the volume a calculator's
// "send to customs/partner" button and a handful of partner integrations will
// produce. Revisit if/when a real government integration goes live.

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_DB = {
  consumers: [],     // { id, name, type, apiKeyHash, scopes: [], createdAt, revoked }
  calculations: [],  // { id, consumerId, payload, createdAt }
  leads: [],         // { id, consumerId, payload, status, createdAt }
  ratesHistory: [],  // { id, consumerId, rates, note, createdAt }
};

let writeLock = Promise.resolve();

async function ensureDb() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) await writeFile(DB_FILE, JSON.stringify(EMPTY_DB, null, 2));
}

async function readDb() {
  await ensureDb();
  const raw = await readFile(DB_FILE, "utf-8");
  try { return JSON.parse(raw); } catch { return structuredClone(EMPTY_DB); }
}

// All mutations go through this — serializes writes so concurrent requests
// don't clobber each other (good enough without a real DB engine).
function mutate(fn) {
  writeLock = writeLock.then(async () => {
    const db = await readDb();
    const result = fn(db);
    await writeFile(DB_FILE, JSON.stringify(db, null, 2));
    return result;
  });
  return writeLock;
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// ── Consumers (API key holders — government, partner companies, internal) ──
export async function createConsumer({ name, type, scopes }) {
  const rawKey = `ura_${crypto.randomBytes(24).toString("hex")}`;
  const consumer = {
    id: newId("con"),
    name,
    type, // free text label, e.g. "government" | "partner" | "internal" — purely descriptive, not used for permission logic
    apiKeyHash: hashKey(rawKey),
    scopes: scopes || [],
    createdAt: new Date().toISOString(),
    revoked: false,
  };
  await mutate((db) => { db.consumers.push(consumer); });
  // rawKey is returned ONLY here, at creation time — it is never stored or retrievable again.
  const { apiKeyHash, ...publicFields } = consumer;
  return { ...publicFields, apiKey: rawKey };
}

export async function findConsumerByKey(rawKey) {
  const db = await readDb();
  const hash = hashKey(rawKey);
  return db.consumers.find((c) => c.apiKeyHash === hash && !c.revoked) || null;
}

export async function listConsumers() {
  const db = await readDb();
  return db.consumers.map(({ apiKeyHash, ...rest }) => rest);
}

export async function revokeConsumer(id) {
  return mutate((db) => {
    const c = db.consumers.find((x) => x.id === id);
    if (c) c.revoked = true;
    return c || null;
  });
}

// ── Calculations (opt-in submissions from the URA frontend) ─────────────────
export async function saveCalculation({ consumerId, payload }) {
  const record = { id: newId("calc"), consumerId, payload, createdAt: new Date().toISOString() };
  await mutate((db) => { db.calculations.push(record); });
  return record;
}

export async function listCalculations({ consumerId } = {}) {
  const db = await readDb();
  return consumerId ? db.calculations.filter((c) => c.consumerId === consumerId) : db.calculations;
}

export async function getCalculation(id) {
  const db = await readDb();
  return db.calculations.find((c) => c.id === id) || null;
}

// ── Leads (partner inquiries — generalizes the existing Formspree-only flow) ─
export async function saveLead({ consumerId, payload }) {
  const record = { id: newId("lead"), consumerId, payload, status: "new", createdAt: new Date().toISOString() };
  await mutate((db) => { db.leads.push(record); });
  return record;
}

export async function listLeads({ consumerId } = {}) {
  const db = await readDb();
  return consumerId ? db.leads.filter((l) => l.consumerId === consumerId) : db.leads;
}

// ── Official rates (hook for future government rate updates) ───────────────
export async function getCurrentRates() {
  const db = await readDb();
  return db.ratesHistory.length ? db.ratesHistory[db.ratesHistory.length - 1] : null;
}

export async function publishRates({ consumerId, rates, note }) {
  const record = { id: newId("rates"), consumerId, rates, note: note || "", createdAt: new Date().toISOString() };
  await mutate((db) => { db.ratesHistory.push(record); });
  return record;
}

export async function listRatesHistory() {
   const db = await readDb();
  return db.ratesHistory;
}
