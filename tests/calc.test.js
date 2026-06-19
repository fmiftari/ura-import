import { describe, it, expect } from "vitest";
import {
  TAX_CONFIG,
  computeExcise,
  computeCatalogValue,
  computeImportCost,
  vinCheckDigit,
  vinInvalidChars,
  decodeVinLocal,
  encodeState,
  decodeState,
} from "../src/ura-prototype.jsx";

// ── Kosovo age-limit rule (Neni 44, Ligji 05/L-132) ────────────────────────
// Regression guard for the car-only age-limit fix: Art. 44 names only "vetura"
// (passenger cars) — vans, trucks and motorcycles must NOT have the rule applied.
describe("TAX_CONFIG age-limit rule (Kosovo, Art. 44)", () => {
  it("applies the 10-year/Euro-4 limit only to category 'car'", () => {
    expect(TAX_CONFIG.ageLimitAppliesTo.car).toBe(true);
    expect(TAX_CONFIG.ageLimitAppliesTo.van).toBe(false);
    expect(TAX_CONFIG.ageLimitAppliesTo.truck).toBe(false);
    expect(TAX_CONFIG.ageLimitAppliesTo.moto).toBe(false);
  });

  it("keeps the limit value itself at 10 years for every category (informational)", () => {
    expect(TAX_CONFIG.ageLimitByCategory).toEqual({ car: 10, van: 10, truck: 10, moto: 10 });
  });

  it("minimum Euro norm is 4", () => {
    expect(TAX_CONFIG.minEuro).toBe(4);
  });
});

// ── Excise tax (Akcizë) ─────────────────────────────────────────────────────
describe("computeExcise", () => {
  it("returns 0 for electric vehicles (cc <= 0)", () => {
    expect(computeExcise({ cc: 0, ageYears: 5, isNewUnregistered: false, fuel: "ev" })).toBe(0);
  });

  it("returns 0 for new/unregistered vehicles regardless of cc", () => {
    expect(computeExcise({ cc: 1968, ageYears: 0, isNewUnregistered: true, fuel: "diesel" })).toBe(0);
  });

  it("looks up the le2000 band correctly for a young vehicle", () => {
    // ageYears <= 8 -> table index 0
    expect(computeExcise({ cc: 1968, ageYears: 5, isNewUnregistered: false, fuel: "diesel" })).toBe(200);
  });

  it("clamps the table index for very old vehicles instead of going out of bounds", () => {
    const tbl = TAX_CONFIG.exciseTable.le2000;
    expect(computeExcise({ cc: 1968, ageYears: 50, isNewUnregistered: false, fuel: "diesel" })).toBe(tbl[tbl.length - 1]);
  });

  it("picks the gt3000 band for large engines", () => {
    expect(computeExcise({ cc: 3500, ageYears: 5, isNewUnregistered: false, fuel: "petrol" })).toBe(TAX_CONFIG.exciseTable.gt3000[0]);
  });
});

// ── Catalog value (for returners / undocumented price) ─────────────────────
describe("computeCatalogValue", () => {
  it("uses the full new-market price at age 0", () => {
    expect(computeCatalogValue({ cc: 1968, ageYears: 0 })).toBe(TAX_CONFIG.newMarketPrice.le2000);
  });

  it("never drops below the configured minimum factor for very old cars", () => {
    const v = computeCatalogValue({ cc: 1968, ageYears: 30 });
    expect(v).toBe(Math.round(TAX_CONFIG.newMarketPrice.le2000 * TAX_CONFIG.catalogFactorMin));
  });
});

// ── Full Kosovo import cost calculation ─────────────────────────────────────
describe("computeImportCost — Kosovo (XK)", () => {
  it("matches a hand-computed reference scenario (10000€ diesel car, 5 years old)", () => {
    const r = computeImportCost({
      destCountry: "XK", price: 10000, transport: 0, insurance: 0,
      engine: 1968, ageYears: 5, isNew: false, fuel: "diesel", hasEur1: false,
    });
    expect(r.customs).toBeCloseTo(1000, 2);   // 10% of price
    expect(r.excise).toBe(200);               // le2000 band, age<=8 -> idx 0
    expect(r.vat).toBeCloseTo((10000 + 1000 + 200) * 0.18, 2);
    expect(r.reg).toBe(TAX_CONFIG.ecoTax + TAX_CONFIG.roadTax);
    expect(r.arrival).toBeCloseTo(13266, 2);
  });

  it("drops customs duty to 0 with a valid EUR.1 certificate", () => {
    const r = computeImportCost({ destCountry: "XK", price: 10000, engine: 1968, ageYears: 5, fuel: "diesel", hasEur1: true });
    expect(r.customs).toBe(0);
  });

  it("treats returning residents (isReturner) the same as EUR.1 for customs", () => {
    const r = computeImportCost({ destCountry: "XK", price: 10000, engine: 1968, ageYears: 5, fuel: "diesel", isReturner: true });
    expect(r.customs).toBe(0);
  });

  it("charges 0 excise for electric vehicles", () => {
    const r = computeImportCost({ destCountry: "XK", price: 20000, engine: 0, ageYears: 2, fuel: "ev" });
    expect(r.excise).toBe(0);
  });
});

// ── VIN handling ─────────────────────────────────────────────────────────────
describe("VIN utilities", () => {
  it("flags VINs containing the ISO-3779-forbidden letters I, O, Q", () => {
    expect(vinInvalidChars("WVWZZZ1QZ6W000001")).toBe(true);
    expect(vinInvalidChars("WVWZZZ1KZ6W000001")).toBe(false);
  });

  it("decodeVinLocal extracts WMI-based make and model-year from a 17-char VIN", () => {
    const d = decodeVinLocal("WVWZZZ1KZ6W000001"); // WVW = Volkswagen, year char '6' -> 2006
    expect(d).not.toBeNull();
    expect(d.make).toBe("Volkswagen");
    expect(d.year).toBe(2006);
  });

  it("returns null for VINs that are not exactly 17 characters", () => {
    expect(decodeVinLocal("TOOSHORT")).toBeNull();
  });

  it("vinCheckDigit is a pure boolean function that does not throw on garbage input", () => {
    expect(() => vinCheckDigit("WVWZZZ1KZ6W000001")).not.toThrow();
    expect(typeof vinCheckDigit("WVWZZZ1KZ6W000001")).toBe("boolean");
  });
});

// ── Shareable-link state encoding ───────────────────────────────────────────
describe("encodeState / decodeState (share links)", () => {
  it("round-trips a calculator state through the URL-safe encoding", () => {
    const state = { price: 8000, transport: 650, year: 2019, engine: 1968, origin: "DE", fuel: "diesel", euro: 6, category: "car" };
    const encoded = encodeState(state);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    const decoded = decodeState(encoded);
    expect(decoded).toEqual({ p: 8000, t: 650, y: 2019, cc: 1968, o: "DE", f: "diesel", e: 6, cat: "car" });
  });

  it("decodeState returns null for garbage input instead of throwing", () => {
    expect(decodeState("not-valid-base64!!")).toBeNull();
  });
});
