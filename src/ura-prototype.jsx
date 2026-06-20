import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Car, Truck, FileText, ShieldCheck, ChevronDown, ArrowRight, Lock, CheckCircle2, AlertTriangle, Download, ScrollText, ExternalLink, Building2, ScanLine, RotateCcw, Calculator, ClipboardList, Landmark, Info, Share2, Copy, Check, Scale, GitCompare, Gavel, Users, TrendingUp, ChevronRight, Home, Wrench, Send } from "lucide-react";
// Opt-in companion-API hook — inert unless VITE_API_BASE is configured at build time.
// See server/README.md "Frontend integration" and src/api.js for details.
import { apiEnabled, submitCalculation } from "./api.js";

// ===========================================================================
// URA · Asistenti i importit të veturave  (v3 · standard institucional)
// >>> BLLOKU I VETËM I NORMAVE LIGJORE <<< — ndryshohet vetëm këtu.
// ===========================================================================
export const TAX_CONFIG = {
  stand: "Qershor 2026",
  laws: [
    "Ligji Nr. 03/L-109 — Kodi Doganor dhe i Akcizave",
    "Ligji për TVSH-në (norma standarde 18%)",
    "Ligji Nr. 05/L-132 për Automjete (neni 44)",
    "Vendimi i Qeverisë 24.03.2015 (akciza për vetura)",
  ],
  customsRate: 0.10, vatRate: 0.18, ecoTax: 10, roadTax: 40, minEuro: 4,
  // Neni 44.2/44.3 i Ligjit 05/L-132 flet shprehimisht vetëm për "vetura" (PKW), jo "automjete"/"mjete rrugore"
  // në përgjithësi — verifikuar nga teksti origjinal i ligjit (qershor 2026). Prandaj kufiri 10-vjeçar + Euro 4
  // zbatohet ligjërisht vetëm te kategoria "car"; furgon/kamion/motoçikletë nuk kanë kufi moshe të shprehur.
  ageLimitByCategory: { car: 10, van: 10, truck: 10, moto: 10 },
  ageLimitAppliesTo: { car: true, van: false, truck: false, moto: false },
  catalogFactors: {
    0: 1.00, 1: 0.85, 2: 0.75, 3: 0.65, 4: 0.57, 5: 0.50,
    6: 0.44, 7: 0.39, 8: 0.34, 9: 0.30, 10: 0.27,
    11: 0.24, 12: 0.22, 13: 0.20, 14: 0.18, 15: 0.16,
  },
  catalogFactorMin: 0.16, // Untergrenze für sehr alte Fahrzeuge (>15 Jahre) — verhindert unrealistisch niedrige Katalogwerte
  newMarketPrice: { le2000: 28000, le3000: 42000, gt3000: 65000 },
  // Oficiale: Vendimi Qeverisë 24.03.2015 — vlera fikse sipas cc & moshës
  // Burimi: kosovatools.org/taksa-e-veturave (GPL, open-source)
  exciseTable: {
    le2000: [200,300,400,500,600,700,800,900,1000,1100], // maxAge: ≤8,9,10,11,12,13,14,15,16,17+
    le3000: [400,600,800,1000,1200,1400,1600,1800,2000,2200],
    gt3000: [1000,1500,1800,2100,2400,2700,3000,3300,3600,3900],
  },
  officialSources: { tarik: "https://dogana.rks-gov.net/", label: "Tarifa e Integruar e Kosovës (TARIK)" },
};

// Albania (Shqipëri) — kosto importi automjeti, 2026
// Burime: dogana.gov.al, DPSHTRR, eurofast.eu Albania Tax Card 2025
const ALBANIA_TAX_CONFIG = {
  customsRate: 0,        // Doganë 0% për automjete
  vatRate: 0.20,         // TVSH 20% mbi vlerën CIF
  regFee: 75,            // Regjistrim DPSHTRR ~7.500 ALL
  maxAgeYears: 10,       // Ndalohet importi i veturave >10 vjeç
  minEuro: 4,            // Minimumi standard emetimi Euro 4
  luxuryEngineCC: 3000,  // Cilindrata mbi të cilën zbatohet taksa e luksit
  luxuryValueEUR: 48000, // ~5.000.000 ALL
  luxuryRegTax: 700,     // Taksë regjistrimi fillestare për veturat luksoze (~70.000 ALL)
  officialSources: { tarik: "https://dogana.gov.al/", label: "Dogana e Shqipërisë / DPSHTRR" },
};

// Maqedonia e Veriut — kosto importi automjeti, 2026
// Burime: customs.gov.mk, Ligji për TVSH (DDV 18%), Ligji për taksat e mjeteve motorike (DMV, që nga 1.1.2020)
// Shënim: DMV reale llogaritet sipas vlerës + CO2 g/km (tabela zyrtare jo publike plotësisht) — këtu përdoret VLERËSIM bazuar në cilindratë.
const MK_TAX_CONFIG = {
  customsRate: 0.05,       // Carinë 5%
  customsRateEur1: 0.01,   // Carinë 1% me certifikatë EUR.1 (origjinë BE)
  vatRate: 0.18,           // DDV 18% mbi (vlera doganore + carina + DMV)
  regFee: 50,              // Regjistrim/administrim, vlerësim
  dmvRatesByEngine: { le1500: 0.02, le2000: 0.05, le3000: 0.09, gt3000: 0.15 }, // DMV vlerësim si % e çmimit, sipas cilindratës
  officialSources: { tarik: "https://customs.gov.mk/", label: "Drejtoria e Doganave e Maqedonisë së Veriut (DMV)" },
};

// Kurset e këmbimit EUR → monedha vendore (përafërt, vetëm informuese — azhurnuar 11 Qershor 2026)
const CURRENCY = {
  XK: { code: "EUR", symbol: "€", rate: 1 },
  AL: { code: "ALL", symbol: "L", rate: 95 },
  MK: { code: "MKD", symbol: "ден", rate: 61.6 },
};
const fmtLocal = (eur, dest, liveRates) => {
  const c = CURRENCY[dest] || CURRENCY.XK;
  const rate = (liveRates && liveRates[c.code]) ? liveRates[c.code] : c.rate;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round((eur || 0) * rate))} ${c.symbol}`;
};
// Live-Kurs (EUR-Basis) im Hintergrund laden, mit statischen CURRENCY-Werten als Fallback —
// macht die angezeigten Lokalwährungsbeträge ohne zusätzliche UI/Klicks aktueller.
let _liveCurrencyCache = null;
let _liveCurrencyPromise = null;
function useLiveCurrencyRates() {
  const [rates, setRates] = useState(_liveCurrencyCache);
  useEffect(() => {
    if (_liveCurrencyCache) { setRates(_liveCurrencyCache); return; }
    if (!_liveCurrencyPromise) {
      _liveCurrencyPromise = fetch("https://api.exchangerate-api.com/v4/latest/EUR")
        .then(r => r.json())
        .then(d => { _liveCurrencyCache = d.rates; return d.rates; })
        .catch(() => null);
    }
    _liveCurrencyPromise.then(r => { if (r) setRates(r); });
  }, []);
  return rates;
}

// ─── WMI → Hersteller (lokale Erkennung, kein API nötig) ─────────────────────
const WMI_BRANDS = {
  // Deutschland
  WVW:"Volkswagen", WV1:"Volkswagen", WV2:"Volkswagen", WV3:"Volkswagen",
  WBA:"BMW", WBB:"BMW", WBC:"BMW", WBD:"BMW", WBE:"BMW", WBS:"BMW",
  WDB:"Mercedes-Benz", WDC:"Mercedes-Benz", WDD:"Mercedes-Benz", WDE:"Mercedes-Benz",
  WDF:"Mercedes-Benz", WDH:"Mercedes-Benz", WDK:"Mercedes-Benz",
  WAU:"Audi", WUA:"Audi", TRU:"Audi",
  WP0:"Porsche", WP1:"Porsche",
  W0L:"Opel", W0V:"Opel",
  WF0:"Ford", WFO:"Ford",
  WMA:"MAN", WMW:"MINI",
  WJM:"Daimler", VSS:"SEAT", VF1:"Renault", VF3:"Peugeot", VF7:"Citroën",
  // Österreich
  WKO:"Steyr", WJR:"Steyr",
  // Schweiz / International
  SHH:"Honda(UK)", SAJ:"Jaguar", SAR:"Range Rover", SAL:"Land Rover",
  // Frankreich
  VR1:"DS", VR3:"DS", VF6:"Dacia",
  // Italien
  ZFA:"Fiat", ZAR:"Alfa Romeo", ZFF:"Ferrari", ZLA:"Lamborghini",
  // Japan
  JTD:"Toyota", JTM:"Toyota", JHM:"Honda", JN1:"Nissan", JN6:"Nissan",
  JM1:"Mazda", KMH:"Hyundai", KNA:"Kia", KNM:"Kia",
  // Schweden
  YV1:"Volvo", YV4:"Volvo", YS2:"Scania",
  // Tschechien / Slowakei
  TMB:"Škoda", TMA:"Škoda", TMC:"Škoda",
  // Spanien
  VS6:"Ford(ES)", VSK:"Nissan(ES)",
  // UK
  SAB:"Land Rover", SCF:"Aston Martin", SCC:"Lotus",
  // Rumänien / Dacia (wichtig für Balkan!)
  UU1:"Dacia", UU3:"Dacia", UU2:"Dacia",
  // Polen
  SUF:"Fiat(PL)", SUL:"Opel(PL)",
  // Niederlande / Belgien
  XLE:"Volvo(NL)", XLB:"Volvo(NL)",
  // Türkei
  TMAA:"Toyota(TR)", NM0:"Ford(TR)",
  // Nutzfahrzeuge
  ZCF:"Iveco", ZCN:"Iveco",
  XL9:"DAF", XLD:"DAF",
  WEB:"Neoplan", WJV:"MAN",
  // Opel / Vauxhall (EU-weite WMIs)
  W0J:"Opel", W0G:"Opel",
  // Zusatz Skoda
  TMK:"Škoda", TMJ:"Škoda",
  // Zusatz Renault
  VF2:"Renault", VF4:"Renault", VF8:"Renault",
  // Mazda (EU)
  SAP:"Mazda(UK)",
  // Hyundai (CZ/TR)
  NM3:"Hyundai(TR)", TMAJ:"Hyundai(CZ)",
  // Korea (Hyundai / Kia / Genesis / SsangYong / KGM)
  KMH:"Hyundai", KME:"Hyundai", KMF:"Hyundai", KMJ:"Hyundai", KMT:"Hyundai",
  KNA:"Kia", KNB:"Kia", KNC:"Kia", KND:"Kia", KNE:"Kia",
  KM8:"Hyundai", KMG:"Hyundai",
  KNM:"Kia", KNF:"Kia",
  U5Y:"Kia(SK)", U6Y:"Kia(SK)",
  // Genesis (Hyundai Luxusmarke)
  KMT:"Genesis",
  // SsangYong / KGM
  PNA:"SsangYong", PNB:"SsangYong", PNC:"SsangYong",
  // Volvo Cars
  YV2:"Volvo", YV3:"Volvo",
  // USA
  "1HG":"Honda(US)", "1FA":"Ford(US)", "2T1":"Toyota(US)",
  "1G1":"Chevrolet", "1GC":"Chevrolet", "3VW":"VW(MX)",
  // Tesla (USA / Deutschland)
  "5YJ":"Tesla", "7SA":"Tesla", "7G2":"Tesla", LRW:"Tesla(UK)",
  // BYD (China)
  "LS4":"BYD", "LS5":"BYD", "LGB":"BYD",
  // Stellantis extra
  "1C3":"Chrysler", "1C4":"Jeep", "1J4":"Jeep",
  // Mitsubishi
  JA3:"Mitsubishi", JA4:"Mitsubishi", JM7:"Mitsubishi", VF0:"Mitsubishi(FR)",
  // Subaru
  JF1:"Subaru", JF2:"Subaru",
  // Suzuki
  JS3:"Suzuki", JS2:"Suzuki",
  // SEAT / CUPRA
  VS7:"SEAT", VSE:"CUPRA",
  // Toyota / Lexus (EU / UK)
  SB1:"Toyota(UK)", SED:"Toyota(UK)", JT2:"Lexus", JT3:"Lexus", JT6:"Lexus",
  // Nissan (EU / UK)
  VNK:"Toyota(TR)", SJN:"Nissan(UK)",
  // Renault extra
  VF9:"Renault",
  // Dacia extra
  UU6:"Dacia",
  // McLaren / Bentley / Rolls-Royce
  SBM:"McLaren", SCA:"Rolls-Royce", SCB:"Bentley",
  // Genesis / Hyundai extra
  KM8:"Hyundai",
  // Great Wall / Haval (China)
  LGW:"Great Wall", LHG:"Haval",
  // Mazda (EU)
  JM3:"Mazda", MMM:"Mazda(EU)",
  // MINI extra
  BMT:"MINI",
};

// Modelljahr aus VIN-Zeichen 10 (ISO 3779)
const VIN_YEAR_MAP = {
  A:2010,B:2011,C:2012,D:2013,E:2014,F:2015,G:2016,H:2017,
  J:2018,K:2019,L:2020,M:2021,N:2022,P:2023,R:2024,S:2025,T:2026,
  "1":2001,"2":2002,"3":2003,"4":2004,"5":2005,"6":2006,"7":2007,
  "8":2008,"9":2009,"0":2000,
};

// VIN Prüfziffer-Validierung (ISO 3779 / FMVSS)
export function vinCheckDigit(vin) {
  const v = vin.toUpperCase();
  const vals = {
    '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
    A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,
    S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9,
  };
  const weights = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  const sum = v.split("").reduce((acc, c, i) => acc + (vals[c] ?? 0) * weights[i], 0);
  const rem = sum % 11;
  const expected = rem === 10 ? "X" : String(rem);
  return v[8] === expected;
}

// Ungültige VIN-Zeichen (I, O, Q verboten per ISO 3779)
export function vinInvalidChars(vin) {
  return /[IOQ]/i.test(vin);
}

export function decodeVinLocal(vin) {
  if (!vin || vin.length !== 17) return null;
  const v = vin.toUpperCase();
  const wmi = v.slice(0, 3);
  const make = WMI_BRANDS[wmi] || WMI_BRANDS[v.slice(0,2)] || null;
  const yearChar = v[9];
  const year = VIN_YEAR_MAP[yearChar] || null;
  const plant = v[10]; // Montagewerk (Position 11)
  const checkOk = vinCheckDigit(v);
  const hasInvalid = vinInvalidChars(v);
  // Euro-Norm aus Baujahr schätzen
  const euro = !year ? 6 : year >= 2021 ? 6 : year >= 2015 ? 6 : year >= 2011 ? 5 : year >= 2006 ? 4 : year >= 2001 ? 3 : 2;
  return { make, year, euro, wmi, plant, yearChar, checkOk, hasInvalid };
}

const DEMO_VEHICLES = {
  // VW
  // Tesla
  "TESLA3":       { make: "Tesla",       model: "Model 3",             category: "car", cc: 0,    fuel: "ev",      euro: 6, year: 2022 },
  "TESLAY":       { make: "Tesla",       model: "Model Y",             category: "car", cc: 0,    fuel: "ev",      euro: 6, year: 2023 },
  // VW
  "GOLF7TDI":     { make: "Volkswagen", model: "Golf 7 2.0 TDI",     category: "car", cc: 1968, fuel: "diesel",  euro: 6, year: 2018 },
  "GOLF8":        { make: "Volkswagen", model: "Golf 8 1.5 TSI",      category: "car", cc: 1498, fuel: "petrol",  euro: 6, year: 2021 },
  "PASSAT":       { make: "Volkswagen", model: "Passat 2.0 TDI",      category: "car", cc: 1968, fuel: "diesel",  euro: 6, year: 2019 },
  "TIGUAN":       { make: "Volkswagen", model: "Tiguan 2.0 TDI",      category: "car", cc: 1968, fuel: "diesel",  euro: 6, year: 2020 },
  // BMW
  "BMW320D":      { make: "BMW",        model: "320d",                category: "car", cc: 1995, fuel: "diesel",  euro: 6, year: 2019 },
  "BMW520D":      { make: "BMW",        model: "520d",                category: "car", cc: 1995, fuel: "diesel",  euro: 6, year: 2020 },
  "BMWX5":        { make: "BMW",        model: "X5 xDrive30d",        category: "car", cc: 2993, fuel: "diesel",  euro: 6, year: 2020 },
  // Mercedes
  "SPRINTER313":  { make: "Mercedes-Benz", model: "Sprinter 313 CDI",category: "van", cc: 2143, fuel: "diesel",  euro: 6, year: 2017 },
  "CLASSA180":    { make: "Mercedes-Benz", model: "A 180 d",          category: "car", cc: 1461, fuel: "diesel",  euro: 6, year: 2019 },
  "MERCC200":     { make: "Mercedes-Benz", model: "C 200 d",          category: "car", cc: 1950, fuel: "diesel",  euro: 6, year: 2020 },
  // Audi
  "AUDIA4":       { make: "Audi",       model: "A4 2.0 TDI",          category: "car", cc: 1968, fuel: "diesel",  euro: 6, year: 2019 },
  "AUDIQ5":       { make: "Audi",       model: "Q5 2.0 TDI",          category: "car", cc: 1968, fuel: "diesel",  euro: 6, year: 2019 },
  // Renault / Dacia
  "CAPTUR":       { make: "Renault",    model: "Captur 1.5 dCi",       category: "car", cc: 1461, fuel: "diesel",  euro: 6, year: 2021 },
  "SANDERO":      { make: "Dacia",      model: "Sandero 1.0 TCe",      category: "car", cc: 999,  fuel: "petrol",  euro: 6, year: 2022 },
  // Peugeot
  "P308":         { make: "Peugeot",    model: "308 1.5 BlueHDi",      category: "car", cc: 1499, fuel: "diesel",  euro: 6, year: 2020 },
  "P208":         { make: "Peugeot",    model: "208 1.2 PureTech",     category: "car", cc: 1199, fuel: "petrol",  euro: 6, year: 2021 },
  // Elektro
  "TESLA3":       { make: "Tesla",      model: "Model 3",              category: "car", cc: 0,    fuel: "ev",      euro: 6, year: 2022 },
  "EGOLF":        { make: "Volkswagen", model: "e-Golf",               category: "car", cc: 0,    fuel: "ev",      euro: 6, year: 2020 },
  // Kosovo-Markt Favoriten
  "OCTAVIA":      { make: "Škoda",      model: "Octavia 2.0 TDI",      category: "car", cc: 1968, fuel: "diesel",  euro: 6, year: 2019 },
  "ASTRA":        { make: "Opel",       model: "Astra 1.6 CDTI",       category: "car", cc: 1598, fuel: "diesel",  euro: 6, year: 2018 },
  "POLO":         { make: "Volkswagen", model: "Polo 1.0 TSI",         category: "car", cc: 999,  fuel: "petrol",  euro: 6, year: 2020 },
  "COROLLA":      { make: "Toyota",     model: "Corolla 1.8 Hybrid",   category: "car", cc: 1798, fuel: "hybrid",  euro: 6, year: 2020 },
  "VITO":         { make: "Mercedes-Benz", model: "Vito 114 CDI",      category: "van", cc: 2143, fuel: "diesel",  euro: 6, year: 2018 },
  "DUCATO":       { make: "Fiat",       model: "Ducato 2.3 JTD",       category: "van", cc: 2287, fuel: "diesel",  euro: 5, year: 2016 },
  "TRANSIT":      { make: "Ford",       model: "Transit 2.0 TDCi",     category: "van", cc: 1995, fuel: "diesel",  euro: 6, year: 2019 },
  "C3":           { make: "Citroën",    model: "C3 1.2 PureTech",      category: "car", cc: 1199, fuel: "petrol",  euro: 6, year: 2020 },
  "I30":          { make: "Hyundai",    model: "i30 1.5 DPF",          category: "car", cc: 1482, fuel: "petrol",  euro: 6, year: 2021 },
  "CEED":         { make: "Kia",        model: "Ceed 1.6 CRDi",        category: "car", cc: 1598, fuel: "diesel",  euro: 6, year: 2019 },
  // Korea-Import (Hyundai / Kia / SsangYong / Genesis)
  "TUCSON":       { make: "Hyundai",    model: "Tucson 1.6 T-GDI",     category: "car", cc: 1591, fuel: "petrol",  euro: 6, year: 2021 },
  "KONA":         { make: "Hyundai",    model: "Kona 1.0 T-GDI",       category: "car", cc: 998,  fuel: "petrol",  euro: 6, year: 2021 },
  "ELANTRA":      { make: "Hyundai",    model: "Elantra 1.6 MPi",      category: "car", cc: 1591, fuel: "petrol",  euro: 6, year: 2021 },
  "IONIQ5":       { make: "Hyundai",    model: "IONIQ 5",              category: "car", cc: 0,    fuel: "ev",      euro: 6, year: 2022 },
  "IONIQ6":       { make: "Hyundai",    model: "IONIQ 6",              category: "car", cc: 0,    fuel: "ev",      euro: 6, year: 2023 },
  "SPORTAGE":     { make: "Kia",        model: "Sportage 1.6 CRDi",    category: "car", cc: 1598, fuel: "diesel",  euro: 6, year: 2021 },
  "STONIC":       { make: "Kia",        model: "Stonic 1.0 T-GDI",     category: "car", cc: 998,  fuel: "petrol",  euro: 6, year: 2021 },
  "NIRO":         { make: "Kia",        model: "Niro 1.6 GDi Hybrid",  category: "car", cc: 1580, fuel: "hybrid",  euro: 6, year: 2021 },
  "EV6":          { make: "Kia",        model: "EV6",                  category: "car", cc: 0,    fuel: "ev",      euro: 6, year: 2022 },
  "SORENTO":      { make: "Kia",        model: "Sorento 2.2 CRDi",     category: "car", cc: 2199, fuel: "diesel",  euro: 6, year: 2020 },
  "REXTON":       { make: "SsangYong",  model: "Rexton 2.2 XDi",       category: "car", cc: 2157, fuel: "diesel",  euro: 6, year: 2020 },
  "KORANDO":      { make: "SsangYong",  model: "Korando 1.5 T-GDI",    category: "car", cc: 1497, fuel: "petrol",  euro: 6, year: 2021 },
  "GV70":         { make: "Genesis",    model: "GV70 2.5 T-GDI",       category: "car", cc: 2497, fuel: "petrol",  euro: 6, year: 2022 },
  // Furgon / Kamion / Motoçikletë (kategori shpesh të neglizhuara — shih Neni 44, vetëm "vetura" kanë kufi moshe)
  "SPRINTER519":  { make: "Mercedes-Benz", model: "Sprinter 519 CDI",  category: "van",   cc: 2987,  fuel: "diesel", euro: 6, year: 2021 },
  "CRAFTER":      { make: "Volkswagen",  model: "Crafter 2.0 TDI",     category: "van",   cc: 1968,  fuel: "diesel", euro: 6, year: 2020 },
  "DAFXF":        { make: "DAF",         model: "XF 480 FT",           category: "truck", cc: 12900, fuel: "diesel", euro: 6, year: 2019 },
  "ACTROS":       { make: "Mercedes-Benz", model: "Actros 1845",       category: "truck", cc: 12800, fuel: "diesel", euro: 6, year: 2018 },
  "SCANIAR450":   { make: "Scania",      model: "R450",                category: "truck", cc: 12700, fuel: "diesel", euro: 6, year: 2019 },
  "PCX125":       { make: "Honda",       model: "PCX125",              category: "moto",  cc: 125,   fuel: "petrol", euro: 5, year: 2017 },
  "GSXR750":      { make: "Suzuki",      model: "GSX-R750",            category: "moto",  cc: 750,   fuel: "petrol", euro: 5, year: 2016 },
  "NMAX155":      { make: "Yamaha",      model: "NMAX 155",            category: "moto",  cc: 155,   fuel: "petrol", euro: 5, year: 2020 },
};

const POPULAR_MODELS = [
  { label: "Dacia Sandero", make: "Dacia", model: "Sandero 1.0 TCe", cc: 999, fuel: "petrol", euro: 6, year: 2022, category: "car", hs: "8703 21" },
  { label: "Renault Captur", make: "Renault", model: "Captur 1.5 dCi", cc: 1461, fuel: "diesel", euro: 6, year: 2021, category: "car", hs: "8703 32" },
  { label: "Peugeot 308", make: "Peugeot", model: "308 1.5 BlueHDi", cc: 1499, fuel: "diesel", euro: 6, year: 2020, category: "car", hs: "8703 32" },
  { label: "VW Golf", make: "Volkswagen", model: "Golf 7 2.0 TDI", cc: 1968, fuel: "diesel", euro: 6, year: 2019, category: "car", hs: "8703 32" },
  { label: "Škoda Octavia", make: "Škoda", model: "Octavia 2.0 TDI", cc: 1968, fuel: "diesel", euro: 6, year: 2019, category: "car", hs: "8703 32" },
  { label: "BMW 320d", make: "BMW", model: "320d", cc: 1995, fuel: "diesel", euro: 6, year: 2020, category: "car", hs: "8703 32" },
];

const C = {
  ink: "#f4efe6", navy: "#0a0e17", blue: "#c9a65a", blueSoft: "rgba(201,166,90,0.13)",
  green: "#c9a65a", greenDeep: "#a8843c", amber: "#d8a657", amberSoft: "rgba(216,166,87,0.12)",
  red: "#e0736b", redSoft: "rgba(224,115,107,0.12)", paper: "#0d1118",
  line: "rgba(244,239,230,0.12)", muted: "#9395a0", surface: "#141926",
  glass: "rgba(255,255,255,0.035)",
};

const ORIGIN = {
  DE: { flag:"🇩🇪", sq:"Gjermani", sr:"Nemačka", en:"Germany", de:"Deutschland", tr:"Almanya", vatRefund:0.19 },
  CH: { flag:"🇨🇭", sq:"Zvicër", sr:"Švajcarska", en:"Switzerland", de:"Schweiz", tr:"İsviçre", vatRefund:0.077 },
  AT: { flag:"🇦🇹", sq:"Austri", sr:"Austrija", en:"Austria", de:"Österreich", tr:"Avusturya", vatRefund:0.20 },
  NL: { flag:"🇳🇱", sq:"Holandë", sr:"Holandija", en:"Netherlands", de:"Niederlande", tr:"Hollanda", vatRefund:0.21 },
  SE: { flag:"🇸🇪", sq:"Suedi", sr:"Švedska", en:"Sweden", de:"Schweden", tr:"İsveç", vatRefund:0.25 },
  ES: { flag:"🇪🇸", sq:"Spanjë", sr:"Španija", en:"Spain", de:"Spanien", tr:"İspanya", vatRefund:0.21 },
  PL: { flag:"🇵🇱", sq:"Poloni", sr:"Poljska", en:"Poland", de:"Polen", tr:"Polonya", vatRefund:0.23 },
  LU: { flag:"🇱🇺", sq:"Luksemburg", sr:"Luksemburg", en:"Luxembourg", de:"Luxemburg", tr:"Lüksemburg", vatRefund:0.17 },
  BE: { flag:"🇧🇪", sq:"Belgjikë", sr:"Belgija", en:"Belgium", de:"Belgien", tr:"Belçika", vatRefund:0.21 },
  FR: { flag:"🇫🇷", sq:"Francë", sr:"Francuska", en:"France", de:"Frankreich", tr:"Fransa", vatRefund:0.20 },
  IT: { flag:"🇮🇹", sq:"Itali", sr:"Italija", en:"Italy", de:"Italien", tr:"İtalya", vatRefund:0.22 },
  KR: { flag:"🇰🇷", sq:"Koreja e Jugut", sr:"Južna Koreja", en:"South Korea", de:"Südkorea", tr:"Güney Kore", vatRefund:0.10 },
};
const originName = (k, lang) => ORIGIN[k] ? `${ORIGIN[k].flag} ${ORIGIN[k][lang] || ORIGIN[k].en}` : k;
const FUEL = {
  petrol: { sq: "Benzinë", sr: "Benzin", en: "Petrol", de: "Benzin", tr: "Benzin" },
  diesel: { sq: "Naftë", sr: "Dizel", en: "Diesel", de: "Diesel", tr: "Dizel" },
  hybrid: { sq: "Hibrid", sr: "Hibrid", en: "Hybrid", de: "Hybrid", tr: "Hibrit" },
  ev: { sq: "Elektrike", sr: "Električno", en: "Electric", de: "Elektrisch", tr: "Elektrikli" },
};
const YEAR_WORD = { sq: "vjet", sr: "god.", en: "yrs", de: "Jahre", tr: "yıl" };

const DOCS = [
  { id: "invoice",  sq: "Faturë / kontratë blerjeje", sr: "Faktura / kupoprodajni ugovor", en: "Invoice / purchase contract", de: "Rechnung / Kaufvertrag", tr: "Fatura / satış sözleşmesi" },
  { id: "title",    sq: "Dokumentet e mjetit (leje qarkullimi)", sr: "Dokumenta vozila (saobraćajna)", en: "Vehicle title / registration docs", de: "Fahrzeugpapiere (Zulassung)", tr: "Araç ruhsatı / tescil belgeleri" },
  { id: "origin",   sq: "Dëshmi e origjinës dhe pronësisë", sr: "Dokaz o poreklu i vlasništvu", en: "Proof of origin & ownership", de: "Herkunfts- & Eigentumsnachweis", tr: "Menşe ve mülkiyet belgesi" },
  { id: "exa",      sq: "EX-A — Deklarata e eksportit (BE)", sr: "EX-A — EU izvozna deklaracija", en: "EX-A — EU export declaration", de: "EX-A — EU-Ausfuhranmeldung", tr: "EX-A — AB ihracat beyannamesi" },
  { id: "eur1",     sq: "EUR.1 (opsionale — doganë 0%)", sr: "EUR.1 (opciono — carina 0%)", en: "EUR.1 (optional — 0% duty)", de: "EUR.1 (optional — 0% Zoll)", tr: "EUR.1 (opsiyonel — %0 gümrük)" },
  { id: "coc",      sq: "COC — vetëm për vetura të reja", sr: "COC — samo za nova vozila", en: "COC — new vehicles only", de: "COC — nur für Neufahrzeuge", tr: "COC — sadece sıfır araçlar için" },
  { id: "id",       sq: "Pasaportë / letërnjoftim", sr: "Pasoš / lična karta", en: "Passport / ID card", de: "Reisepass / Ausweis", tr: "Pasaport / kimlik kartı" },
  { id: "customs",  sq: "Pagesa: doganë + akcizë + TVSH", sr: "Plaćanje: carina + akciza + PDV", en: "Payment: customs + excise + VAT", de: "Zahlung: Zoll + Akzise + MwSt", tr: "Ödeme: gümrük + ÖTV + KDV" },
  { id: "tech",     sq: "Kontroll teknik në Kosovë", sr: "Tehnički pregled na Kosovu", en: "Technical inspection in Kosovo", de: "Technische Prüfung im Kosovo", tr: "Kosova'da teknik muayene" },
  { id: "plates",   sq: "Regjistrim + targa RKS", sr: "Registracija + RKS tablice", en: "Registration + RKS plates", de: "Anmeldung + RKS-Kennzeichen", tr: "Tescil + RKS plakası" },
];

const T = {
  sq: {
    tagline: "Asistenti i importit të veturave",
    tabCalc: "Kalkulatori", tabDocs: "Dokumentet",
    h1a: "Sa kushton", h1b: "vërtet", h1c: "deri në Kosovë?",
    sub: "Taksat llogariten automatikisht sipas ligjit — pa i prekur dot.",
    identify: "Typenschein / HSN-TSN / VIN", recognize: "Njeh automatikisht",
    recHint: "Fut VIN (17 shifra) ose kod demo më poshtë", recOk: "U njoh automjeti ✓",
    recNo: "Nuk u gjet — provo VIN ose kodet demo", recNet: "Rrjeti i bllokuar në preview — funksionon kur publikohet", recLoad: "Po lexohet VIN…",
    popularModels: "Modelet më të njohura",
    category: "Kategoria", catCar: "Veturë (PKW)", catVan: "Furgon ≤3.5t", catTruck: "Kamion >3.5t", catMoto: "Motoçikletë",
    make: "Marka", model: "Modeli", price: "Çmimi i blerjes (€)", transport: "Transporti (€)", insurance: "Sigurimi (€)",
    cc: "Cilindrata (cc)", year: "Viti i parë", origin: "Origjina", fuel: "Karburanti", euro: "Emetimet", hs: "Kodi tarifor (TARIK)",
    fNew: "E re, e paregjistruar", fEur1: "Provë origjine EU (EUR.1)",
    notAllowed: "Vetura nuk lejohet për import",
    ageBad: (a, m) => `Automjeti është ${a} vjet — mbi kufirin ${m} vjet.`,
    euroBad: (e, m) => `Euro ${e} nën minimumin (Euro ${m}).`,
    ageSuggest: "Kërko vetura nga viti 2016 e tutje → ",
    meets: (a, e) => `Plotëson kriteret · ${a} vjet · Euro ${e}`,
    catUnverified: "Neni 44 i Ligjit 05/L-132 e vendos kufirin 10-vjeçar dhe Euro 4 vetëm për \"vetura\" (PKW). Furgon, kamion, automjet pune dhe motoçikletë nuk kanë kufi moshe të shprehur — konfirmo rastin tënd specifik me Doganën para importit.",
    catalogBase: "Baza e doganimit", catalogBuy: "Çmimi juaj i blerjes", catalogVal: "Vlera e katalogut të doganës (vlerësim)",
    catalogWarning: "⚠ Kujdes: Dogana mund të tatojë çmimin e katalogut të saj, jo çmimin tuaj të blerjes. Konfirmo me Doganën.",
    catalogCost: "Kosto me katalog:",
    destCountry: "Vendi i destinacionit", destXK: "🇽🇰 Kosovë", destAL: "🇦🇱 Shqipëri",
    alInfo: "Shqipëri: Doganë 0%, TVSH 20% mbi vlerën CIF (çmim + transport + sigurim). Mosha max. e lejuar: 10 vjet, minimumi Euro 4.",
    alLuxuryNote: "Veturë luksoze (≥3000cc ose ≥€48.000): + taksë regjistrimi fillestare ~€700.",
    destMK: "🇲🇰 Maqedonia e Veriut",
    mkInfo: "Maqedoni e Veriut: Doganë 5% (1% me EUR.1), DDV 18% mbi vlerën doganore + doganë + DMV. DMV (taksa e mjeteve motorike) këtu është VLERËSIM sipas cilindratës — konfirmo shumën e saktë në customs.gov.mk.",
    mkExcise: "DMV (taksa e automjetit)",
    mkExciseNote: "Vlerësim · kontrollo në customs.gov.mk",
    mkExciseEvNote: "0€ · veturat elektrike (0g/km CO2) përjashtohen nga DMV",
    currencyApprox: (amt) => `≈ ${amt}`,
    marketCheckTitle: "Krahaso çmimin në treg",
    marketCheckSub: "Shiko çmime aktuale për këtë model para se të blesh",
    catalogHigher: (diff) => `Vlera e katalogut (~€ ${diff}) mund të jetë MBI çmimin tuaj.`,
    catalogLower: "Çmimi juaj i blerjes është mbi vlerën e katalogut.",
    vatRefundTitle: "Rimbursi i TVSH-së",
    vatRefundDesc: (pct, amt, country) => `Si blerës jashtë BE-së, mund të marrësh mbrapsht TVSH-në ${pct}% të ${country} (~€ ${amt}). Shiko numrin MRN në deklaratën EX-A.`,
    cif: "Çmimi blerjes (bazë tatimore)", customs: "Doganë", excise: "Akcizë",
    vat: (b) => `TVSH (18% × ${b})`, importTaxes: "Totali i taksave të importit", catVal: "vlerë kategorie",
    exciseNote: "Vlerësim · konfirmo me TARIK",
    evExciseNote: "E konfirmuar (Ligji 03/L-109)",
    arrival: "Kosto e mbërritjes në Kosovë", over: (x, r) => `+€ ${x} mbi çmimin · +€ ${r} regjistrim`,
    toState: "Nga kjo, te shteti (Dogana)", toStateSub: "doganë + akcizë + TVSH + regjistrim",
    locked: (s) => `Normat fikse sipas ligjit · Stand: ${s}. Akciza & katalogwert = vlerësim — verifiko me Doganën / TARIK.`,
    methodology: "Metodologjia & baza ligjore", official: "Burime zyrtare",
    download: "Shkarko përmbledhjen", reset: "Pastro",
    shareTitle: "Ndaj rezultatin",
    shareText: (make, model, year, arrival, price) => `🚗 ${make} ${model} (${year})\n💰 Çmimi i blerjes: €${price}\n📦 Kosto e mbërritjes: €${arrival}\n\nLlogaritur me Ura — importi i veturave deri në Kosovë`,
    copyLink: "Kopjo linkun", copied: "U kopjua ✓",
    soon: "Së shpejti",
    chips: ["Histori e verifikuar", "Përkthimi i dokumenteve", "Lista DE/CH"], contact: "Kontakto shitësin",
    disc: "Vlerësim jozyrtar. Shumat përfundimtare konfirmohen nga Dogana e Kosovës.",
    docsTitle: "Dokumentet për import & regjistrim", docsProgress: (a, b) => `${a} nga ${b} të kompletuara`, docsDone: "Gati për doganim ✓",
    onboardTitle: "Mirë se vjen në Ura!",
    onboardBody: "Kalkulo çmimin e vërtetë të importit të veturës — me doganë, akcizë, TVSH dhe transport. Falas, pa regjistrim.",
    onboardBtn: "Fillo",
    yearError: "Viti duhet të jetë ndërmjet 1980 dhe 2026.",
    priceError: "Çmimi duhet të jetë mes €100 dhe €500.000.",
    ccError: "Cilindrata duhet të jetë mes 50 dhe 10.000 cc.",
    tipsTitle: "💡 Si të kursesh",
    tipEur1: (amt) => `Kërko certifikatën EUR.1 — kursen €${amt} doganë (0% me EUR.1)`,
    tipAge: (save, yr) => `Kërko vetura nga viti ${yr}+ (≤8 vjet) — kursen €${save} akcizë`,
    tipEngine: (save) => `Motorr ≤2.000cc kursen €${save} akcizë krahasuar me motorrin aktual`,
  },
  sr: {
    tagline: "Asistent za uvoz vozila",
    tabCalc: "Kalkulator", tabDocs: "Dokumenti",
    h1a: "Koliko zaista", h1b: "košta", h1c: "do Kosova?",
    sub: "Porezi se obračunavaju automatski prema zakonu — bez izmena.",
    identify: "Typenschein / HSN-TSN / VIN", recognize: "Prepoznaj automatski",
    recHint: "Unesi VIN (17 znakova) ili demo kod ispod", recOk: "Vozilo prepoznato ✓",
    recNo: "Nije pronađeno — probaj VIN ili demo kodove", recNet: "Mreža blokirana u pregledu — radi nakon objave", recLoad: "Čitanje VIN…",
    popularModels: "Najpopularniji modeli",
    category: "Kategorija", catCar: "Putničko (PKW)", catVan: "Kombi ≤3.5t", catTruck: "Kamion >3.5t", catMoto: "Motocikl",
    make: "Marka", model: "Model", price: "Kupovna cena (€)", transport: "Transport (€)", insurance: "Osiguranje (€)",
    cc: "Zapremina (cc)", year: "Prva registracija", origin: "Poreklo", fuel: "Gorivo", euro: "Emisija", hs: "Tarifni broj (TARIK)",
    fNew: "Novo, neregistrovano", fEur1: "Dokaz EU porekla (EUR.1)",
    notAllowed: "Vozilo nije dozvoljeno za uvoz",
    ageBad: (a, m) => `Vozilo ima ${a} god. — iznad granice ${m} god.`,
    euroBad: (e, m) => `Euro ${e} ispod minimuma (Euro ${m}).`,
    ageSuggest: "Traži vozila od 2016. godine nadalje → ",
    meets: (a, e) => `Ispunjava uslove · ${a} god. · Euro ${e}`,
    catUnverified: "Član 44. Zakona 05/L-132 postavlja granicu od 10 godina i Euro 4 samo za \"vetura\" (putnička vozila). Kombi, kamion, radna vozila i motocikli nemaju izričitu starosnu granicu — potvrdite svoj slučaj sa Carinom pre uvoza.",
    catalogBase: "Osnova za ocarinjenje", catalogBuy: "Vaša kupovna cena", catalogVal: "Kataloška vrednost carine (procena)",
    catalogWarning: "⚠ Pažnja: Carina može oporezovati katalošku vrednost. Potvrdite sa Carinom.",
    catalogCost: "Cena po katalogu:",
    destCountry: "Zemlja odredišta", destXK: "🇽🇰 Kosovo", destAL: "🇦🇱 Albanija",
    alInfo: "Albanija: Carina 0%, PDV 20% na CIF vrednost (cena + transport + osiguranje). Maks. starost: 10 godina, minimum Euro 4.",
    alLuxuryNote: "Luksuzno vozilo (≥3000ccm ili ≥€48.000): + početna registraciona taksa ~€700.",
    destMK: "🇲🇰 Severna Makedonija",
    mkInfo: "Severna Makedonija: Carina 5% (1% sa EUR.1), DDV 18% na carinsku vrednost + carina + DMV. DMV (porez na motorna vozila) ovde je PROCENA na osnovu zapremine motora — proveri tačan iznos na customs.gov.mk.",
    mkExcise: "DMV (porez na vozilo)",
    mkExciseNote: "Procena · proveri na customs.gov.mk",
    mkExciseEvNote: "0€ · električna vozila (0g/km CO2) oslobođena od DMV",
    currencyApprox: (amt) => `≈ ${amt}`,
    marketCheckTitle: "Uporedi cenu na tržištu",
    marketCheckSub: "Pogledaj trenutne cene za ovaj model pre kupovine",
    catalogHigher: (diff) => `Kataloška vrednost (~€ ${diff}) može biti IZNAD vaše cene.`,
    catalogLower: "Vaša kupovna cena je iznad kataloške vrednosti.",
    vatRefundTitle: "Povrat PDV-a",
    vatRefundDesc: (pct, amt, country) => `Kao kupac van EU, možete dobiti povrat ${pct}% PDV-a iz ${country} (~€ ${amt}). Pratite MRN broj na EX-A deklaraciji.`,
    cif: "Kupovna cena (poreska osnova)", customs: "Carina", excise: "Akciza",
    vat: (b) => `PDV (18% × ${b})`, importTaxes: "Ukupni uvozni porezi", catVal: "okvirno",
    exciseNote: "Procena · potvrdi u TARIK",
    evExciseNote: "Potvrđeno (Zakon 03/L-109)",
    arrival: "Trošak do Kosova", over: (x, r) => `+€ ${x} preko cene · +€ ${r} registracija`,
    toState: "Od toga državi (Carina)", toStateSub: "carina + akciza + PDV + registracija",
    locked: (s) => `Stope fiksne · Stanje: ${s}. Akciza & kataloška vrednost = procena — proveriti u Carini / TARIK.`,
    methodology: "Metodologija i pravni osnov", official: "Zvanični izvori",
    download: "Preuzmi pregled", reset: "Resetuj",
    shareTitle: "Podeli rezultat",
    shareText: (make, model, year, arrival, price) => `🚗 ${make} ${model} (${year})\n💰 Kupovna cena: €${price}\n📦 Trošak do Kosova: €${arrival}\n\nIzračunato sa Ura — uvoz automobila do Kosova`,
    copyLink: "Kopiraj link", copied: "Kopirano ✓",
    soon: "Uskoro",
    chips: ["Proverena istorija", "Prevod dokumenata", "Lista DE/CH"], contact: "Kontaktiraj prodavca",
    disc: "Nezvanična procena. Konačne iznose potvrđuje Carina Kosova.",
    docsTitle: "Dokumenti za uvoz i registraciju", docsProgress: (a, b) => `${a} od ${b} završeno`, docsDone: "Spremno za carinjenje ✓",
    onboardTitle: "Dobrodošli u Ura!",
    onboardBody: "Izračunajte pravu cenu uvoza automobila — sa carinom, akcizom, PDV-om i transportom. Besplatno, bez registracije.",
    onboardBtn: "Počni",
    yearError: "Godina mora biti između 1980 i 2026.",
    priceError: "Cena mora biti između €100 i €500.000.",
    ccError: "Zapremina mora biti između 50 i 10.000 cc.",
    tipsTitle: "💡 Kako uštedeti",
    tipEur1: (amt) => `Zatražite EUR.1 sertifikat — štedi €${amt} carine (0% sa EUR.1)`,
    tipAge: (save, yr) => `Tražite vozila od ${yr}+ (≤8 god.) — štedi €${save} akcize`,
    tipEngine: (save) => `Motor ≤2.000cc štedi €${save} akcize u poređenju sa trenutnim`,
  },
  en: {
    tagline: "Car import assistant",
    tabCalc: "Calculator", tabDocs: "Documents",
    h1a: "What does it", h1b: "really", h1c: "cost into Kosovo?",
    sub: "Taxes computed automatically from law — not user-editable.",
    identify: "Type-approval / HSN-TSN / VIN", recognize: "Auto-recognize",
    recHint: "Enter a VIN (17 chars) or a demo code below", recOk: "Vehicle recognized ✓",
    recNo: "Not found — try a VIN or demo codes", recNet: "Network blocked in preview — works once deployed", recLoad: "Decoding VIN…",
    popularModels: "Popular models",
    category: "Category", catCar: "Car (PKW)", catVan: "Van ≤3.5t", catTruck: "Truck >3.5t", catMoto: "Motorcycle",
    make: "Make", model: "Model", price: "Purchase price (€)", transport: "Transport (€)", insurance: "Insurance (€)",
    cc: "Engine (cc)", year: "First registration", origin: "Origin", fuel: "Fuel", euro: "Emissions", hs: "Tariff code (TARIK)",
    fNew: "New, unregistered", fEur1: "EU origin proof (EUR.1)",
    notAllowed: "Vehicle not allowed for import",
    ageBad: (a, m) => `Vehicle is ${a} yrs — above the ${m}-yr limit.`,
    euroBad: (e, m) => `Euro ${e} below minimum (Euro ${m}).`,
    ageSuggest: "Search for vehicles from 2016 onwards → ",
    meets: (a, e) => `Meets criteria · ${a} yrs · Euro ${e}`,
    catUnverified: "Article 44 of Law 05/L-132 sets the 10-year & Euro 4 limit only for \"vetura\" (passenger cars). Vans, trucks, work vehicles and motorcycles have no explicit age limit — confirm your specific case with Customs before importing.",
    catalogBase: "Customs tax base", catalogBuy: "Your purchase price", catalogVal: "Customs catalogue value (estimate)",
    catalogWarning: "⚠ Important: Kosovo Customs may tax their own catalogue value. Confirm with Customs.",
    catalogCost: "Cost with catalogue:",
    destCountry: "Destination country", destXK: "🇽🇰 Kosovo", destAL: "🇦🇱 Albania",
    alInfo: "Albania: 0% customs duty, 20% VAT on CIF value (price + transport + insurance). Max. age: 10 years, minimum Euro 4.",
    alLuxuryNote: "Luxury vehicle (≥3000cc or ≥€48,000): + initial registration tax ~€700.",
    destMK: "🇲🇰 North Macedonia",
    mkInfo: "North Macedonia: 5% customs (1% with EUR.1), 18% VAT on customs value + duty + DMV. The DMV (motor vehicle tax) shown here is an ESTIMATE based on engine size — verify the exact amount at customs.gov.mk.",
    mkExcise: "DMV (motor vehicle tax)",
    mkExciseNote: "Estimate · verify at customs.gov.mk",
    mkExciseEvNote: "€0 · electric vehicles (0g/km CO2) exempt from DMV",
    currencyApprox: (amt) => `≈ ${amt}`,
    marketCheckTitle: "Compare market price",
    marketCheckSub: "Check current listings for this model before you buy",
    catalogHigher: (diff) => `Catalogue value (~€ ${diff}) may be ABOVE your price.`,
    catalogLower: "Your purchase price exceeds the catalogue value.",
    vatRefundTitle: "VAT Refund",
    vatRefundDesc: (pct, amt, country) => `As a non-EU buyer, you can reclaim ${pct}% VAT from ${country} (~€ ${amt}). Track your MRN number on the EX-A export declaration.`,
    cif: "Purchase price (tax base)", customs: "Customs", excise: "Excise",
    vat: (b) => `VAT (18% × ${b})`, importTaxes: "Total import taxes", catVal: "category value",
    exciseNote: "Estimate · verify with TARIK",
    evExciseNote: "Confirmed (Law 03/L-109)",
    arrival: "Landed cost in Kosovo", over: (x, r) => `+€ ${x} over price · +€ ${r} registration`,
    toState: "Of which, to the state (Customs)", toStateSub: "customs + excise + VAT + registration",
    locked: (s) => `Rates fixed by law · As of: ${s}. Excise & catalogue value = estimates — verify with Customs / TARIK.`,
    methodology: "Methodology & legal basis", official: "Official sources",
    download: "Download summary", reset: "Reset",
    shareTitle: "Share result",
    shareText: (make, model, year, arrival, price) => `🚗 ${make} ${model} (${year})\n💰 Purchase price: €${price}\n📦 Landed cost: €${arrival}\n\nCalculated with Ura — car import to Kosovo`,
    copyLink: "Copy link", copied: "Copied ✓",
    soon: "Coming soon",
    chips: ["Verified history", "Document translation", "DE/CH listings"], contact: "Contact seller",
    disc: "Unofficial estimate. Final amounts confirmed by Kosovo Customs.",
    docsTitle: "Documents for import & registration", docsProgress: (a, b) => `${a} of ${b} completed`, docsDone: "Ready for clearance ✓",
    onboardTitle: "Welcome to Ura!",
    onboardBody: "Calculate the real cost of importing a car to Kosovo — customs, excise, VAT and transport included. Free, no registration needed.",
    onboardBtn: "Get started",
    yearError: "Year must be between 1980 and 2026.",
    priceError: "Price must be between €100 and €500,000.",
    ccError: "Engine size must be between 50 and 10,000 cc.",
    tipsTitle: "💡 Ways to save",
    tipEur1: (amt) => `Ask for an EUR.1 certificate — saves €${amt} customs (0% with EUR.1)`,
    tipAge: (save, yr) => `Look for cars from ${yr}+ (≤8 yrs old) — saves €${save} excise`,
    tipEngine: (save) => `≤2,000cc engine saves €${save} excise vs. current engine`,
  },
  de: {
    tagline: "Auto-Import-Assistent",
    tabCalc: "Rechner", tabDocs: "Dokumente",
    h1a: "Was kostet es", h1b: "wirklich", h1c: "bis ins Kosovo?",
    sub: "Steuern werden automatisch nach Recht berechnet — nicht editierbar.",
    identify: "Typenschein / HSN-TSN / FIN", recognize: "Automatisch erkennen",
    recHint: "FIN (17 Zeichen) eingeben oder Demo-Code unten", recOk: "Fahrzeug erkannt ✓",
    recNo: "Nicht gefunden — FIN oder Demo-Codes versuchen", recNet: "Netzwerk in Vorschau blockiert — funktioniert nach Veröffentlichung", recLoad: "FIN wird gelesen…",
    popularModels: "Beliebte Modelle",
    category: "Kategorie", catCar: "PKW", catVan: "Lieferwagen ≤3.5t", catTruck: "LKW >3.5t", catMoto: "Motorrad",
    make: "Marke", model: "Modell", price: "Kaufpreis (€)", transport: "Transport (€)", insurance: "Versicherung (€)",
    cc: "Hubraum (cc)", year: "Erstzulassung", origin: "Herkunft", fuel: "Kraftstoff", euro: "Emissionen", hs: "Zolltarif (TARIK)",
    fNew: "Neu, nicht zugelassen", fEur1: "EU-Ursprungsnachweis (EUR.1)",
    notAllowed: "Fahrzeug nicht importierbar",
    ageBad: (a, m) => `Fahrzeug ist ${a} Jahre — über der Grenze von ${m} Jahren.`,
    euroBad: (e, m) => `Euro ${e} unter dem Minimum (Euro ${m}).`,
    ageSuggest: "Suche Fahrzeuge ab Baujahr 2016 → ",
    meets: (a, e) => `Erfüllt die Kriterien · ${a} Jahre · Euro ${e}`,
    catUnverified: "Art. 44 des Gesetzes 05/L-132 setzt die 10-Jahres- und Euro-4-Grenze nur für „vetura\" (PKW). Für Lieferwagen, LKW, Arbeitsfahrzeuge und Motorräder gibt es keine ausdrückliche Altersgrenze — Einzelfall vor dem Import beim Zoll bestätigen.",
    catalogBase: "Zollbemessungsgrundlage", catalogBuy: "Ihr Kaufpreis", catalogVal: "Zoll-Katalogwert (Schätzung)",
    catalogWarning: "⚠ Achtung: Der Kosovo-Zoll kann seinen eigenen Katalogwert besteuern. Beim Zoll bestätigen.",
    catalogCost: "Kosten mit Katalogwert:",
    destCountry: "Zielland", destXK: "🇽🇰 Kosovo", destAL: "🇦🇱 Albanien",
    alInfo: "Albanien: 0% Zoll, 20% MwSt. auf den CIF-Wert (Preis + Transport + Versicherung). Max. Alter: 10 Jahre, mind. Euro 4.",
    alLuxuryNote: "Luxusfahrzeug (≥3000ccm oder ≥€48.000): + einmalige Zulassungssteuer ~€700.",
    destMK: "🇲🇰 Nordmazedonien",
    mkInfo: "Nordmazedonien: 5% Zoll (1% mit EUR.1), 18% MwSt. auf Zollwert + Zoll + DMV. Die DMV (Kfz-Steuer) ist hier eine SCHÄTZUNG nach Hubraum — genauen Betrag auf customs.gov.mk prüfen.",
    mkExcise: "DMV (Kfz-Steuer)",
    mkExciseNote: "Schätzwert · auf customs.gov.mk prüfen",
    mkExciseEvNote: "0€ · E-Fahrzeuge (0g/km CO2) von DMV befreit",
    currencyApprox: (amt) => `≈ ${amt}`,
    marketCheckTitle: "Marktpreis vergleichen",
    marketCheckSub: "Aktuelle Angebote für dieses Modell vor dem Kauf prüfen",
    catalogHigher: (diff) => `Katalogwert (~€ ${diff}) kann ÜBER Ihrem Preis liegen.`,
    catalogLower: "Ihr Kaufpreis liegt über dem Katalogwert.",
    vatRefundTitle: "MwSt.-Rückerstattung",
    vatRefundDesc: (pct, amt, country) => `Als Nicht-EU-Käufer kannst du die ${pct}% MwSt. aus ${country} zurückbekommen (~€ ${amt}). Tracke deine MRN-Nummer auf der EX-A Ausfuhranmeldung.`,
    cif: "Kaufpreis (Steuerbasis)", customs: "Zoll", excise: "Akzise",
    vat: (b) => `MwSt (18% × ${b})`, importTaxes: "Importsteuern gesamt", catVal: "Kategoriewert",
    exciseNote: "Schätzwert · mit TARIK prüfen",
    evExciseNote: "Bestätigt (Gesetz 03/L-109)",
    arrival: "Ankunftskosten im Kosovo", over: (x, r) => `+€ ${x} über Preis · +€ ${r} Anmeldung`,
    toState: "Davon an den Staat (Zoll)", toStateSub: "Zoll + Akzise + MwSt + Anmeldung",
    locked: (s) => `Sätze gesetzlich fix · Stand: ${s}. Akzise & Katalogwert = Schätzwerte — mit Zoll / TARIK prüfen.`,
    methodology: "Methodik & Rechtsgrundlage", official: "Offizielle Quellen",
    download: "Zusammenfassung herunterladen", reset: "Zurücksetzen",
    shareTitle: "Ergebnis teilen",
    shareText: (make, model, year, arrival, price) => `🚗 ${make} ${model} (${year})\n💰 Kaufpreis: €${price}\n📦 Ankunftskosten: €${arrival}\n\nBerechnet mit Ura — Auto-Import ins Kosovo`,
    copyLink: "Link kopieren", copied: "Kopiert ✓",
    soon: "Demnächst",
    chips: ["Geprüfte Historie", "Dokumentenübersetzung", "DE/CH-Inserate"], contact: "Verkäufer kontaktieren",
    disc: "Inoffizielle Schätzung. Endbeträge bestätigt der kosovarische Zoll.",
    docsTitle: "Dokumente für Import & Anmeldung", docsProgress: (a, b) => `${a} von ${b} erledigt`, docsDone: "Bereit zur Verzollung ✓",
    onboardTitle: "Willkommen bei Ura!",
    onboardBody: "Berechne die echten Kosten für deinen Auto-Import ins Kosovo — mit Zoll, Akzise, MwSt. und Transport. Kostenlos, ohne Anmeldung.",
    onboardBtn: "Loslegen",
    yearError: "Baujahr muss zwischen 1980 und 2026 liegen.",
    priceError: "Preis muss zwischen €100 und €500.000 liegen.",
    ccError: "Hubraum muss zwischen 50 und 10.000 cc liegen.",
    tipsTitle: "💡 So kannst du sparen",
    tipEur1: (amt) => `EUR.1-Bescheinigung anfragen — spart €${amt} Zoll (0% mit EUR.1)`,
    tipAge: (save, yr) => `Fahrzeug ab ${yr}+ suchen (≤8 Jahre) — spart €${save} Akzise`,
    tipEngine: (save) => `Motor ≤2.000cc spart €${save} Akzise ggü. aktuellem Hubraum`,
  },
  tr: {
    tagline: "Araç ithalat asistanı",
    tabCalc: "Hesap Makinesi", tabDocs: "Belgeler",
    h1a: "Kosova'ya kadar", h1b: "gerçekte", h1c: "ne kadara mal olur?",
    sub: "Vergiler kanuna göre otomatik hesaplanır — elle değiştirilemez.",
    identify: "Ruhsat tipi / HSN-TSN / Şasi No (VIN)", recognize: "Otomatik tanı",
    recHint: "Aşağıya VIN (17 hane) veya demo kod girin", recOk: "Araç tanındı ✓",
    recNo: "Bulunamadı — VIN veya demo kodları deneyin", recNet: "Önizlemede ağ engellendi — yayınlandığında çalışır", recLoad: "VIN okunuyor…",
    popularModels: "Popüler modeller",
    category: "Kategori", catCar: "Binek araç (PKW)", catVan: "Panelvan ≤3.5t", catTruck: "Kamyon >3.5t", catMoto: "Motosiklet",
    make: "Marka", model: "Model", price: "Satın alma fiyatı (€)", transport: "Nakliye (€)", insurance: "Sigorta (€)",
    cc: "Motor hacmi (cc)", year: "İlk tescil yılı", origin: "Menşei", fuel: "Yakıt", euro: "Emisyon sınıfı", hs: "Tarife kodu (TARIK)",
    fNew: "Yeni, tescilsiz", fEur1: "AB menşe belgesi (EUR.1)",
    notAllowed: "Aracın ithalatına izin verilmiyor",
    ageBad: (a, m) => `Araç ${a} yaşında — ${m} yıllık sınırın üzerinde.`,
    euroBad: (e, m) => `Euro ${e} minimumun altında (Euro ${m}).`,
    ageSuggest: "2016 model yılı ve sonrası araç arayın → ",
    meets: (a, e) => `Kriterleri karşılıyor · ${a} yıl · Euro ${e}`,
    catUnverified: "05/L-132 sayılı Kanun'un 44. maddesi, 10 yıl ve Euro 4 sınırını yalnızca \"vetura\" (binek araç) için belirler. Panelvan, kamyon, iş aracı ve motosikletler için açık bir yaş sınırı yoktur — ithalattan önce kendi durumunuzu Gümrük ile teyit edin.",
    catalogBase: "Gümrük matrahı", catalogBuy: "Sizin satın alma fiyatınız", catalogVal: "Gümrük katalog değeri (tahmini)",
    catalogWarning: "⚠ Dikkat: Kosova Gümrüğü kendi katalog değerini esas alabilir. Gümrük ile teyit edin.",
    catalogCost: "Katalog değeriyle maliyet:",
    destCountry: "Hedef ülke", destXK: "🇽🇰 Kosova", destAL: "🇦🇱 Arnavutluk",
    alInfo: "Arnavutluk: %0 gümrük, CIF değeri üzerinden (fiyat + nakliye + sigorta) %20 KDV. Maks. yaş: 10 yıl, minimum Euro 4.",
    alLuxuryNote: "Lüks araç (≥3000cc veya ≥€48.000): + ilk tescil vergisi ~€700.",
    destMK: "🇲🇰 Kuzey Makedonya",
    mkInfo: "Kuzey Makedonya: %5 gümrük (EUR.1 ile %1), gümrük değeri + gümrük + DMV üzerinden %18 KDV. Buradaki DMV (motorlu taşıtlar vergisi) motor hacmine göre TAHMİNİ bir değerdir — tam tutarı customs.gov.mk'de doğrulayın.",
    mkExcise: "DMV (taşıt vergisi)",
    mkExciseNote: "Tahmini · customs.gov.mk'de doğrulayın",
    mkExciseEvNote: "0€ · elektrikli araçlar (0g/km CO2) DMV'den muaftır",
    currencyApprox: (amt) => `≈ ${amt}`,
    marketCheckTitle: "Piyasa fiyatını karşılaştır",
    marketCheckSub: "Satın almadan önce bu model için güncel ilanlara bakın",
    catalogHigher: (diff) => `Katalog değeri (~€ ${diff}) fiyatınızın ÜZERİNDE olabilir.`,
    catalogLower: "Satın alma fiyatınız katalog değerinin üzerinde.",
    vatRefundTitle: "KDV İadesi",
    vatRefundDesc: (pct, amt, country) => `AB dışı bir alıcı olarak ${country}'den %${pct} KDV iadesi alabilirsiniz (~€ ${amt}). MRN numaranızı EX-A ihracat beyannamesinden takip edin.`,
    cif: "Satın alma fiyatı (vergi matrahı)", customs: "Gümrük", excise: "ÖTV",
    vat: (b) => `KDV (%18 × ${b})`, importTaxes: "Toplam ithalat vergileri", catVal: "kategori değeri",
    exciseNote: "Tahmini · TARIK ile doğrulayın",
    evExciseNote: "Onaylı (Kanun 03/L-109)",
    arrival: "Kosova'da teslim maliyeti", over: (x, r) => `+€ ${x} fiyatın üzerinde · +€ ${r} tescil`,
    toState: "Bunun devlete (Gümrük) giden kısmı", toStateSub: "gümrük + ÖTV + KDV + tescil",
    locked: (s) => `Oranlar kanunla sabittir · Güncelleme: ${s}. ÖTV & katalog değeri = tahminidir — Gümrük / TARIK ile doğrulayın.`,
    methodology: "Metodoloji ve yasal dayanak", official: "Resmi kaynaklar",
    download: "Özeti indir", reset: "Sıfırla",
    shareTitle: "Sonucu paylaş",
    shareText: (make, model, year, arrival, price) => `🚗 ${make} ${model} (${year})\n💰 Satın alma fiyatı: €${price}\n📦 Teslim maliyeti: €${arrival}\n\nUra ile hesaplandı — Kosova'ya araç ithalatı`,
    copyLink: "Bağlantıyı kopyala", copied: "Kopyalandı ✓",
    soon: "Çok yakında",
    chips: ["Doğrulanmış geçmiş", "Belge çevirisi", "DE/CH ilanları"], contact: "Satıcıyla iletişime geç",
    disc: "Resmi olmayan tahmin. Kesin tutarlar Kosova Gümrüğü tarafından onaylanır.",
    docsTitle: "İthalat ve tescil için belgeler", docsProgress: (a, b) => `${b} belgenin ${a} tanesi tamamlandı`, docsDone: "Gümrükleme için hazır ✓",
    onboardTitle: "Ura'ya hoş geldiniz!",
    onboardBody: "Kosova'ya araç ithalatının gerçek maliyetini hesaplayın — gümrük, ÖTV, KDV ve nakliye dahil. Ücretsiz, kayıt gerektirmez.",
    onboardBtn: "Başla",
    yearError: "Yıl 1980 ile 2026 arasında olmalıdır.",
    priceError: "Fiyat €100 ile €500.000 arasında olmalıdır.",
    ccError: "Motor hacmi 50 ile 10.000 cc arasında olmalıdır.",
    tipsTitle: "💡 Tasarruf yolları",
    tipEur1: (amt) => `EUR.1 belgesi isteyin — €${amt} gümrük tasarrufu (EUR.1 ile %0)`,
    tipAge: (save, yr) => `${yr}+ model yıllı araç arayın (≤8 yıl) — €${save} ÖTV tasarrufu`,
    tipEngine: (save) => `≤2.000cc motor, mevcut motora göre €${save} ÖTV tasarrufu sağlar`,
  },
};

const fmt = (n) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const transportByOrigin = { DE: 650, CH: 720, AT: 600, NL: 780, BE: 760, FR: 800, IT: 750, SE: 900, ES: 850, PL: 700, LU: 760, KR: 1400 };

// Analytics — sendet Events an GA4, falls gtag verfügbar ist (siehe index.html).
// PLATZHALTER: sobald eine echte GA4-Property-ID existiert (statt G-XXXXXXXXXX), funktioniert dieser Hook automatisch.
function trackEvent(name, params = {}) {
  try { if (typeof window !== "undefined" && typeof window.gtag === "function") window.gtag("event", name, params); } catch {}
}
const NOW_YEAR = new Date().getFullYear();

export function ccBand(cc) { return cc <= 2000 ? "le2000" : cc <= 3000 ? "le3000" : "gt3000"; }

export function computeExcise({ cc, ageYears, isNewUnregistered, fuel }) {
  if (isNewUnregistered || cc <= 0) return 0; // EV (cc=0) & new → 0
  const b = ccBand(cc);
  const tbl = TAX_CONFIG.exciseTable[b]; // [≤8, 9, 10, 11, 12, 13, 14, 15, 16, ≥17]
  const idx = ageYears <= 8 ? 0 : Math.min(ageYears - 8, 9); // clamp to table length
  return tbl[idx];
}

export function computeCatalogValue({ cc, ageYears }) {
  const band = ccBand(cc);
  const newPrice = TAX_CONFIG.newMarketPrice[band];
  const age = Math.max(0, Math.min(Math.round(ageYears), 15));
  const factor = TAX_CONFIG.catalogFactors[age] ?? TAX_CONFIG.catalogFactorMin;
  return Math.round(newPrice * factor);
}

// Einheitliche Import-Kostenberechnung für alle Zielländer (XK/AL/MK).
// Wird vom Hauptrechner, Wizard- und Vergleichsmodus gemeinsam verwendet,
// damit die Endbeträge in allen Modi konsistent und korrekt sind.
export function computeImportCost({ destCountry, price, transport = 0, insurance = 0, engine = 0, ageYears = 0, isNew = false, fuel = "diesel", hasEur1 = false, vatRefundRate = 0, catalogValue = null, isReturner = false }) {
  const cif = price + transport + insurance;
  if (destCountry === "AL") {
    const customs = 0;
    const excise = 0;
    const vatBase = cif;
    const vat = vatBase * ALBANIA_TAX_CONFIG.vatRate;
    const importTaxes = customs + excise + vat;
    const isLuxury = engine >= ALBANIA_TAX_CONFIG.luxuryEngineCC || price >= ALBANIA_TAX_CONFIG.luxuryValueEUR;
    const reg = ALBANIA_TAX_CONFIG.regFee + (isLuxury ? ALBANIA_TAX_CONFIG.luxuryRegTax : 0);
    const arrival = cif + importTaxes + reg;
    const toState = customs + excise + vat + reg;
    const vatRefund = price * vatRefundRate;
    return { cif, customs, excise, vat, vatBase, importTaxes, reg, arrival, toState, vatRefund, catalogArrival: null, isLuxury };
  }
  if (destCountry === "MK") {
    const customs = hasEur1 ? cif * MK_TAX_CONFIG.customsRateEur1 : cif * MK_TAX_CONFIG.customsRate;
    const dmvPct = engine <= 1500 ? MK_TAX_CONFIG.dmvRatesByEngine.le1500
      : engine <= 2000 ? MK_TAX_CONFIG.dmvRatesByEngine.le2000
      : engine <= 3000 ? MK_TAX_CONFIG.dmvRatesByEngine.le3000
      : MK_TAX_CONFIG.dmvRatesByEngine.gt3000;
    // DMV bazohet realisht te emetimet CO2 (g/km) — veturat elektrike (0 g/km, cc=0) → DMV ≈ 0
    const excise = (engine <= 0 || fuel === "ev") ? 0 : price * dmvPct; // DMV (Danok na motorni vozila) — vlerësim
    const vatBase = cif + customs + excise;
    const vat = vatBase * MK_TAX_CONFIG.vatRate;
    const importTaxes = customs + excise + vat;
    const reg = MK_TAX_CONFIG.regFee;
    const arrival = cif + importTaxes + reg;
    const toState = customs + excise + vat + reg;
    const vatRefund = price * vatRefundRate;
    return { cif, customs, excise, vat, vatBase, importTaxes, reg, arrival, toState, vatRefund, catalogArrival: null, isLuxury: false };
  }
  // Kosovo (XK) — Standard
  const taxBase = price;
  const customs = (hasEur1 || isReturner) ? 0 : taxBase * TAX_CONFIG.customsRate;
  const excise = computeExcise({ cc: engine, ageYears, isNewUnregistered: isNew, fuel });
  const vatBase = taxBase + customs + excise;
  const vat = vatBase * TAX_CONFIG.vatRate;
  const importTaxes = customs + excise + vat;
  const reg = TAX_CONFIG.ecoTax + TAX_CONFIG.roadTax;
  const arrival = cif + importTaxes + reg;
  const toState = customs + excise + vat + reg;
  const vatRefund = price * vatRefundRate;
  const catalogCustoms = catalogValue && !hasEur1 ? catalogValue * TAX_CONFIG.customsRate : 0;
  const catalogVatBase = catalogValue ? catalogValue + catalogCustoms + excise : null;
  const catalogVat = catalogVatBase ? catalogVatBase * TAX_CONFIG.vatRate : 0;
  const catalogArrival = catalogValue ? (catalogValue + transport + insurance) + catalogCustoms + excise + catalogVat + reg : null;
  return { cif, customs, excise, vat, vatBase, importTaxes, reg, arrival, toState, vatRefund, catalogArrival };
}

// URL state encoding / decoding
export function encodeState(state) {
  try {
    const s = { p: state.price, t: state.transport, y: state.year, cc: state.engine, o: state.origin, f: state.fuel, e: state.euro, cat: state.category };
    return btoa(JSON.stringify(s));
  } catch { return ""; }
}
export function decodeState(hash) {
  try { return JSON.parse(atob(hash)); } catch { return null; }
}

function useCountUp(value, ms = 450) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const s = d, t0 = performance.now(); let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      setD(s + (value - s) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [value]);
  return d;
}


// ─── WIZARD MODUS ───────────────────────────────────────────────────────────
const WIZARD_STEPS = {
  sq: ["Nga cili vend?", "Çfarë modeli?", "Sa kushton?", "Viti i parë?", "Rezultati"],
  sr: ["Iz koje zemlje?", "Koji model?", "Koliko košta?", "Godina?", "Rezultat"],
  en: ["Where from?", "Which model?", "How much?", "What year?", "Result"],
  de: ["Woher?", "Welches Modell?", "Wie viel?", "Baujahr?", "Ergebnis"],
  tr: ["Hangi ülkeden?", "Hangi model?", "Ne kadar?", "Hangi yıl?", "Sonuç"],
};

function WizardMode({ t, lang, C, fmt }) {
  const liveRates = useLiveCurrencyRates();
  const [step, setStep] = useState(0);
  const [wOrigin, setWOrigin] = useState(null);
  const [originOpen, setOriginOpen] = useState(false);
  const [wModel, setWModel] = useState(null);
  const [wPrice, setWPrice] = useState(8000);
  const [wYear, setWYear] = useState(2020);
  const [wDest, setWDest] = useState("XK");

  const ORIGINS_WIZARD = [
    { key: "DE", flag: "🇩🇪", label: "Deutschland", transport: 650, vat: 0.19 },
    { key: "CH", flag: "🇨🇭", label: "Schweiz", transport: 720, vat: 0.077 },
    { key: "AT", flag: "🇦🇹", label: "Österreich", transport: 600, vat: 0.20 },
    { key: "NL", flag: "🇳🇱", label: "Niederlande", transport: 780, vat: 0.21 },
    { key: "FR", flag: "🇫🇷", label: "Frankreich", transport: 800, vat: 0.20 },
    { key: "IT", flag: "🇮🇹", label: "Italien", transport: 750, vat: 0.22 },
    { key: "SE", flag: "🇸🇪", label: "Schweden", transport: 900, vat: 0.25 },
    { key: "ES", flag: "🇪🇸", label: "Spanien", transport: 850, vat: 0.21 },
  ];
  const MODELS_WIZARD = [
    { label: "VW Golf", cc: 1968, fuel: "diesel", emoji: "🚗" },
    { label: "BMW 3er", cc: 1995, fuel: "diesel", emoji: "🚙" },
    { label: "Mercedes C", cc: 1497, fuel: "petrol", emoji: "🚘" },
    { label: "Audi A4", cc: 1968, fuel: "diesel", emoji: "🚘" },
    { label: "Toyota RAV4", cc: 1987, fuel: "hybrid", emoji: "🚙" },
    { label: "Tesla Model 3", cc: 0, fuel: "ev", emoji: "⚡" },
    { label: "Hyundai IONIQ 5", cc: 0, fuel: "ev", emoji: "⚡" },
    { label: "Skoda Octavia", cc: 1968, fuel: "diesel", emoji: "🚗" },
    { label: "Renault Captur", cc: 1461, fuel: "diesel", emoji: "🚕" },
    { label: "Dacia Sandero", cc: 999, fuel: "petrol", emoji: "🚗" },
    { label: "Anderes Auto", cc: 1600, fuel: "diesel", emoji: "🔍" },
  ];

  const ageYears = Math.max(0, NOW_YEAR - wYear);
  const wCalc = useMemo(() => {
    if (!wOrigin || !wModel) return null;
    const transport = wOrigin.transport;
    const r = computeImportCost({
      destCountry: wDest, price: wPrice, transport, insurance: 0,
      engine: wModel.cc, ageYears, isNew: false, fuel: wModel.fuel || "diesel",
      hasEur1: false, vatRefundRate: wOrigin.vat,
    });
    return { ...r, transport };
  }, [wOrigin, wModel, wPrice, wYear, wDest]);
  const wOverLimit = wDest !== "MK" && ageYears > 10;

  const stepLabels = WIZARD_STEPS[lang];
  const btnStyle = (active) => ({
    flex: 1, padding: "14px 10px", border: `2px solid ${active ? C.blue : C.line}`,
    borderRadius: 16, cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
    fontSize: 15, background: active ? C.blueSoft : C.glass, color: active ? C.blue : C.ink,
    transition: "all .2s", textAlign: "center",
  });

  return (
    <div>
      {/* Progress bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {stepLabels.map((s, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 4,
            background: i <= step ? C.blue : C.line, transition: "background .3s" }} />
        ))}
      </div>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 6,
        textTransform: "uppercase", letterSpacing: 1 }}>
        {lang === "de" ? "Schritt" : lang === "en" ? "Step" : "Hapi"} {step + 1} / {stepLabels.length}
      </div>

      {/* Zielland */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {["XK","AL","MK"].map(d => (
          <button key={d} onClick={() => setWDest(d)}
            style={{ flex: 1, padding: "8px 4px", border: `2px solid ${wDest===d?C.blue:C.line}`,
              borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
              fontSize: 12, background: wDest===d?C.blueSoft:C.glass, color: wDest===d?C.blue:C.muted,
              transition: "all .2s" }}>
            {d === "XK" ? t.destXK : d === "AL" ? t.destAL : t.destMK}
          </button>
        ))}
      </div>

      {/* Step 0 — Origin */}
      {step === 0 && (
        <div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 600, marginBottom: 20, color: C.ink }}>
            {lang === "de" ? "Woher kommt das Auto?" : lang === "en" ? "Where is the car from?" : lang === "sq" ? "Nga cili vend vjen vetura?" : "Iz koje zemlje dolazi auto?"}
          </h2>
          <button onClick={() => setOriginOpen(o => !o)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
              border: `2px solid ${originOpen ? C.blue : C.line}`, borderRadius: 16, cursor: "pointer",
              fontFamily: "inherit", background: originOpen ? C.blueSoft : C.glass, color: C.ink,
              transition: "all .2s", textAlign: "left" }}>
            {wOrigin ? (
              <>
                <span style={{ fontSize: 28 }}>{wOrigin.flag}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{wOrigin.label}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 500 }}>
                    {lang === "de" ? `Transport ~€${wOrigin.transport} · MwSt. ${Math.round(wOrigin.vat*100)}%` :
                     `Transport ~€${wOrigin.transport} · VAT ${Math.round(wOrigin.vat*100)}%`}
                  </div>
                </div>
              </>
            ) : (
              <span style={{ fontSize: 15.5, fontWeight: 700, color: C.muted }}>
                {lang === "de" ? "Land auswählen" : lang === "en" ? "Choose country" : lang === "sq" ? "Zgjedh vendin" : "Izaberi zemlju"}
              </span>
            )}
            <ChevronDown size={20} style={{ marginLeft: "auto", color: C.muted,
              transform: originOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .25s" }} />
          </button>
          {originOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {ORIGINS_WIZARD.map(o => (
                <button key={o.key} onClick={() => { setWOrigin(o); setOriginOpen(false); setStep(1); }}
                  style={{ ...btnStyle(wOrigin?.key === o.key), display: "flex", alignItems: "center", gap: 16, textAlign: "left", flex: "none" }}>
                  <span style={{ fontSize: 32 }}>{o.flag}</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{o.label}</div>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
                      {lang === "de" ? `Transport ~€${o.transport} · MwSt. ${Math.round(o.vat*100)}%` :
                       `Transport ~€${o.transport} · VAT ${Math.round(o.vat*100)}%`}
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ marginLeft: "auto", color: C.muted }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 1 — Model */}
      {step === 1 && (
        <div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 600, marginBottom: 20, color: C.ink }}>
            {lang === "de" ? "Welches Modell?" : lang === "en" ? "Which model?" : lang === "sq" ? "Çfarë modeli?" : "Koji model?"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {MODELS_WIZARD.map(m => (
              <button key={m.label} onClick={() => { setWModel(m); setStep(2); }}
                style={{ ...btnStyle(wModel?.label === m.label), padding: "16px 12px" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{m.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{m.cc}cc · {m.fuel}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Price */}
      {step === 2 && (
        <div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 600, marginBottom: 8, color: C.ink }}>
            {lang === "de" ? "Was kostet das Auto?" : lang === "en" ? "What does the car cost?" : lang === "sq" ? "Sa kushton vetura?" : "Koliko košta auto?"}
          </h2>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 48, fontWeight: 600, color: C.blue,
            textAlign: "center", margin: "28px 0 8px" }}>
            € {fmt(wPrice)}
          </div>
          <input type="range" min="1000" max="50000" step="500" value={wPrice}
            onChange={e => setWPrice(+e.target.value)}
            style={{ width: "100%", marginBottom: 16,
              accentColor: C.blue }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 24 }}>
            <span>€ 1.000</span><span>€ 50.000</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {[3000, 5000, 8000, 12000, 18000, 25000].map(p => (
              <button key={p} onClick={() => setWPrice(p)}
                style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${wPrice===p?C.blue:C.line}`,
                  background: wPrice===p?C.blueSoft:C.glass, color: wPrice===p?C.blue:C.muted,
                  fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                € {fmt(p)}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(3)}
            style={{ width: "100%", background: `linear-gradient(135deg,#e6c878,${C.blue})`,
              color: C.navy, border: "none", borderRadius: 14, padding: "16px",
              fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
            {lang === "de" ? "Weiter" : lang === "en" ? "Next" : "Vazhdo"} →
          </button>
        </div>
      )}

      {/* Step 3 — Year */}
      {step === 3 && (
        <div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 600, marginBottom: 8, color: C.ink }}>
            {lang === "de" ? "Erstzulassung?" : lang === "en" ? "First registration?" : lang === "sq" ? "Viti i parë?" : "Godina registracije?"}
          </h2>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 64, fontWeight: 600, color: C.blue,
            textAlign: "center", margin: "20px 0 8px" }}>
            {wYear}
          </div>
          <div style={{ textAlign: "center", fontSize: 14, color: C.muted, marginBottom: 16 }}>
            {ageYears} {lang === "de" ? "Jahre alt" : lang === "en" ? "years old" : "vjet"}
            {wDest !== "MK" && (wOverLimit ? " ⚠️ " + (lang === "de" ? "Nicht importierbar!" : "Not allowed!") : " ✓")}
          </div>
          <input type="range" min="2014" max="2026" step="1" value={wYear}
            onChange={e => setWYear(+e.target.value)}
            style={{ width: "100%", marginBottom: 24, accentColor: C.blue }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, justifyContent: "center" }}>
            {[2016,2017,2018,2019,2020,2021,2022,2023].map(y => (
              <button key={y} onClick={() => setWYear(y)}
                style={{ padding: "8px 12px", borderRadius: 20, border: `1px solid ${wYear===y?C.blue:C.line}`,
                  background: wYear===y?C.blueSoft:C.glass, color: wYear===y?C.blue:C.muted,
                  fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {y}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(4)} disabled={wOverLimit}
            style={{ width: "100%", background: wOverLimit ? C.line : `linear-gradient(135deg,#e6c878,${C.blue})`,
              color: wOverLimit ? C.muted : C.navy, border: "none", borderRadius: 14, padding: "16px",
              fontFamily: "inherit", fontWeight: 800, fontSize: 15,
              cursor: wOverLimit ? "not-allowed" : "pointer" }}>
            {wOverLimit ? (lang === "de" ? "Nicht importierbar" : "Not allowed") :
              (lang === "de" ? "Kosten berechnen" : lang === "en" ? "Calculate costs" : "Kalkulo kostot")} →
          </button>
        </div>
      )}

      {/* Step 4 — Result */}
      {step === 4 && wCalc && (
        <div>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              {wOrigin?.label} · {wModel?.label} · {wYear}
            </div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 600, marginBottom: 4, color: C.ink }}>
              {(lang === "de" ? "Deine Ankunftskosten — " : lang === "en" ? "Your landed cost — " : "Kosto e mbërritjes — ")}
              {wDest === "XK" ? t.destXK : wDest === "AL" ? t.destAL : t.destMK}
            </h2>
          </div>

          <div style={{ background: `linear-gradient(135deg,#e6c878 0%,${C.blue} 55%,#a8843c 100%)`,
            borderRadius: 22, padding: "26px 22px", marginBottom: 16, textAlign: "center",
            boxShadow: "0 12px 40px -8px rgba(201,166,90,.4)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, opacity: .65, letterSpacing: 1.5,
              textTransform: "uppercase", marginBottom: 6 }}>
              {lang === "de" ? "Gesamtkosten" : lang === "sq" ? "Kosto totale" : lang === "sr" ? "Ukupan trošak" : "Total cost"}
            </div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 58, fontWeight: 700, color: C.navy, lineHeight: 1, letterSpacing: "-1px" }}>
              € {fmt(wCalc.arrival)}
            </div>
            {wDest !== "XK" && (
              <div style={{ fontSize: 13, color: C.navy, opacity: .85, fontWeight: 700, marginTop: 2 }}>{t.currencyApprox(fmtLocal(wCalc.arrival, wDest, liveRates))}</div>
            )}
            <div style={{ fontSize: 13, color: C.navy, opacity: .7, marginTop: 4 }}>
              +€ {fmt(wCalc.arrival - wPrice)} {lang === "de" ? "über Kaufpreis" : "over purchase price"}
            </div>
          </div>

          {[
            [lang === "de" ? "Kaufpreis" : "Purchase price", wPrice],
            [lang === "de" ? "Transport" : "Transport", wCalc.transport],
            [
              wDest === "AL" ? (lang === "de" ? "Zoll (0%)" : "Customs (0%)")
                : wDest === "MK" ? (lang === "de" ? "Zoll (5%)" : "Customs (5%)")
                : (lang === "de" ? "Zoll (10%)" : "Customs (10%)"),
              wCalc.customs
            ],
            ...(wDest !== "AL" ? [[
              wDest === "MK" ? t.mkExcise : (lang === "de" ? "Akzise" : "Excise"),
              wCalc.excise
            ]] : []),
            [
              wDest === "AL" ? (lang === "de" ? "MwSt (20%)" : "VAT (20%)") : (lang === "de" ? "MwSt (18%)" : "VAT (18%)"),
              wCalc.vat
            ],
            [lang === "de" ? "Anmeldung" : "Registration", wCalc.reg],
          ].map(([label, val], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between",
              padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 14, color: C.muted }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>€ {fmt(val)}</span>
            </div>
          ))}

          {wCalc.vatRefund > 50 && (
            <div style={{ marginTop: 14, background: "rgba(168,132,60,0.12)",
              border: `1px solid rgba(168,132,60,.3)`, borderRadius: 14,
              padding: "12px 14px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <div>
                <div style={{ fontWeight: 700, color: C.blue, fontSize: 13 }}>
                  {lang === "de" ? `MwSt.-Rückerstattung: ~€ ${fmt(wCalc.vatRefund)}` : `VAT Refund: ~€ ${fmt(wCalc.vatRefund)}`}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {lang === "de" ? "Als Nicht-EU-Käufer bekommst du die MwSt. zurück." : "As non-EU buyer you can reclaim the VAT."}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <MarketCheckLinks t={t} make={wModel?.label} model="" year={wYear} C={C} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={() => setStep(0)}
              style={{ flex: 1, background: C.glass, border: `1px solid ${C.line}`,
                borderRadius: 13, padding: "12px", fontFamily: "inherit",
                fontWeight: 700, fontSize: 13, color: C.muted, cursor: "pointer" }}>
              ← {lang === "de" ? "Neu starten" : lang === "en" ? "Start over" : "Fillo sërisht"}
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: C.muted, textAlign: "center", lineHeight: 1.5 }}>
            {lang === "de" ? "Schätzung · Endbeträge bestätigt die zuständige Zollbehörde" :
             "Estimate · Final amounts confirmed by the relevant customs authority"}
          </div>
        </div>
      )}

      {/* Back button */}
      {step > 0 && step < 4 && (
        <button onClick={() => setStep(s => s - 1)}
          style={{ marginTop: 16, background: "transparent", border: "none",
            color: C.muted, fontFamily: "inherit", fontSize: 13, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          ← {lang === "de" ? "Zurück" : lang === "en" ? "Back" : "Kthehu"}
        </button>
      )}
    </div>
  );
}

// ─── VERGLEICH MODUS ─────────────────────────────────────────────────────────
function VergleichMode({ t, lang, C, fmt, calc, price, make, model, year, ageYears, destCountry, hasEur1 }) {
  const liveRates = useLiveCurrencyRates();
  const [v2price, setV2price] = useState(10000);
  const [v2year, setV2year] = useState(2019);
  const [v2make, setV2make] = useState("BMW");
  const [v2model, setV2model] = useState("320d");
  const [v2cc, setV2cc] = useState(1995);
  const [v2fuel, setV2fuel] = useState("diesel");
  const [v2transport, setV2transport] = useState(650);

  const v2age = Math.max(0, NOW_YEAR - v2year);
  const v2calc = useMemo(() => computeImportCost({
    destCountry, price: v2price, transport: v2transport, insurance: 0,
    engine: v2cc, ageYears: v2age, isNew: false, fuel: v2fuel, hasEur1, vatRefundRate: 0,
  }), [v2price, v2transport, v2cc, v2fuel, v2age, destCountry, hasEur1]);
  const destName = destCountry === "AL" ? t.destAL : destCountry === "MK" ? t.destMK : t.destXK;

  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 10,
    border: `1px solid ${C.line}`, fontSize: 14, fontWeight: 600, color: C.ink,
    background: C.glass, fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: .8,
    marginBottom: 5, display: "block", textTransform: "uppercase" };

  const cheaper = calc.arrival < v2calc.arrival ? 1 : 2;

  return (
    <div>
      <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 600,
        marginBottom: 6, color: C.ink }}>
        {lang === "de" ? "Zwei Autos vergleichen" : lang === "en" ? "Compare two cars" : "Krahaso dy vetura"}
      </h2>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
        {lang === "de" ? "Gib die Daten des zweiten Autos ein — wir zeigen dir welches günstiger ist." :
         "Enter the second car's details — we'll show you which is cheaper."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Car 1 */}
        <div style={{ background: cheaper===1 ? "rgba(201,166,90,.1)" : C.glass,
          border: `2px solid ${cheaper===1 ? C.blue : C.line}`,
          borderRadius: 18, padding: "14px 12px" }}>
          {cheaper === 1 && <div style={{ fontSize: 10, fontWeight: 800, color: C.blue,
            textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>
            ✓ {lang === "de" ? "Günstiger" : "Cheaper"}
          </div>}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
            {make || "Auto 1"} {model}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{year} · {ageYears} Jahre</div>
          <div style={{ fontSize: 11, color: C.muted }}>Kaufpreis</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>€ {fmt(price)}</div>
          <div style={{ height: 1, background: C.line, margin: "10px 0" }} />
          <div style={{ fontSize: 11, color: C.muted }}>{lang==="de"?"Ankunft":"Landed cost"}: {destName}</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces',serif",
            color: cheaper===1 ? C.blue : C.ink }}>
            € {fmt(calc.arrival)}
          </div>
          {destCountry !== "XK" && (
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginTop: 2 }}>{t.currencyApprox(fmtLocal(calc.arrival, destCountry, liveRates))}</div>
          )}
        </div>

        {/* Car 2 */}
        <div style={{ background: cheaper===2 ? "rgba(201,166,90,.1)" : C.glass,
          border: `2px solid ${cheaper===2 ? C.blue : C.line}`,
          borderRadius: 18, padding: "14px 12px" }}>
          {cheaper === 2 && <div style={{ fontSize: 10, fontWeight: 800, color: C.blue,
            textTransform: "uppercase", letterSpacing: .8, marginBottom: 8 }}>
            ✓ {lang === "de" ? "Günstiger" : "Cheaper"}
          </div>}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{v2make} {v2model}</div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{v2year} · {v2age} Jahre</div>
          <div style={{ fontSize: 11, color: C.muted }}>Kaufpreis</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>€ {fmt(v2price)}</div>
          <div style={{ height: 1, background: C.line, margin: "10px 0" }} />
          <div style={{ fontSize: 11, color: C.muted }}>{lang==="de"?"Ankunft":"Landed cost"}: {destName}</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces',serif",
            color: cheaper===2 ? C.blue : C.ink }}>
            € {fmt(v2calc.arrival)}
          </div>
          {destCountry !== "XK" && (
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginTop: 2 }}>{t.currencyApprox(fmtLocal(v2calc.arrival, destCountry))}</div>
          )}
        </div>
      </div>

      {/* Difference */}
      <div style={{ background: C.blueSoft, border: `1px solid rgba(201,166,90,.3)`,
        borderRadius: 14, padding: "12px 16px", marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
          {lang === "de" ? "Ersparnis" : "Savings"}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Fraunces',serif", color: C.blue }}>
          € {fmt(Math.abs(calc.arrival - v2calc.arrival))}
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {lang === "de" ? `Auto ${cheaper} ist günstiger` : `Car ${cheaper} is cheaper`}
        </div>
      </div>

      {/* Car 2 inputs */}
      <div style={{ background: C.glass, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 14 }}>
          {lang === "de" ? "Auto 2 — Daten eingeben" : "Car 2 — Enter details"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>{lang==="de"?"Marke":"Make"}</label>
            <input style={inputStyle} value={v2make} onChange={e=>setV2make(e.target.value)} /></div>
          <div><label style={lbl}>{lang==="de"?"Modell":"Model"}</label>
            <input style={inputStyle} value={v2model} onChange={e=>setV2model(e.target.value)} /></div>
          <div><label style={lbl}>{lang==="de"?"Kaufpreis (€)":"Price (€)"}</label>
            <input style={inputStyle} type="number" value={v2price} onChange={e=>setV2price(+e.target.value)} /></div>
          <div><label style={lbl}>{lang==="de"?"Baujahr":"Year"}</label>
            <input style={inputStyle} type="number" value={v2year} onChange={e=>setV2year(+e.target.value)} /></div>
          <div><label style={lbl}>{lang==="de"?"Hubraum (cc)":"Engine (cc)"}</label>
            <input style={inputStyle} type="number" value={v2cc} onChange={e=>setV2cc(+e.target.value)} /></div>
          <div><label style={lbl}>{lang==="de"?"Transport (€)":"Transport (€)"}</label>
            <input style={inputStyle} type="number" value={v2transport} onChange={e=>setV2transport(+e.target.value)} /></div>
        </div>
      </div>
    </div>
  );
}

// ─── INFO / IMPRESSUM ────────────────────────────────────────────────────────
function InfoPage({ t, lang, C }) {
  const content = {
    de: {
      title: "Über URA",
      sub: "Transparenz. Ehrlichkeit. Kosovo.",
      about: "URA (albanisch: Brücke) ist ein kostenloser, unabhängiger Rechner für die echten Kosten eines Auto-Imports aus Deutschland, der Schweiz oder Österreich ins Kosovo.",
      disclaimer_title: "Haftungsausschluss",
      disclaimer: "Alle Berechnungen sind Schätzungen und dienen nur zur Orientierung. Verbindliche Zollbeträge werden ausschließlich von der Dogana e Kosovës (kosovarischer Zoll) festgesetzt. Die Akzise-Beträge sind Schätzwerte — bitte mit TARIK verifizieren.",
      contact_title: "Kontakt",
      contact: "Für Fragen, Fehler oder Partneranfragen:",
      legal_title: "Rechtliches",
      legal: "Diese App erhebt keine persönlichen Daten. Es werden keine Cookies gesetzt. Alle Berechnungen finden lokal im Browser statt.",
      sources_title: "Offizielle Quellen",
      faq_title: "Häufige Fragen",
      faq: [
        { q: "Wie hoch ist der Zoll für ein Auto-Import nach Kosovo?", a: "Grundsätzlich gilt ein Zollsatz von 10% auf den Zollwert (Kaufpreis + Transport + Versicherung). Mit einer gültigen EUR.1-Bescheinigung (Ursprung EU) entfällt der Zoll vollständig (0%)." },
        { q: "Was ist die Akzise (Akcizë) und wie wird sie berechnet?", a: "Die Akzise ist eine zusätzliche Steuer, die von Motorgröße (Hubraum), Fahrzeugalter und Kraftstoffart abhängt. Ältere und größere Motoren zahlen mehr. Elektroautos sind von der Akzise befreit." },
        { q: "Wie hoch ist die Mehrwertsteuer (TVSH/MwSt) beim Autoimport?", a: "Die Mehrwertsteuer beträgt 18% und wird auf die Summe aus Zollwert, Zoll und Akzise berechnet." },
        { q: "Darf ich ein Auto importieren, das älter als 10 Jahre ist?", a: "Nein — für PKW. Art. 44 des Gesetzes 05/L-132 nennt wörtlich nur „vetura\" (Personenwagen): Diese dürfen über 10 Jahre alt nicht verzollt bzw. registriert werden, zusätzlich gilt mindestens Euro 4. Für Lieferwagen, LKW, Arbeitsfahrzeuge und Motorräder sieht das Gesetz keine eigene Altersgrenze vor — den Einzelfall vor dem Import beim Zoll bestätigen." },
        { q: "Gilt die 10-Jahres-Grenze auch für Lieferwagen, LKW oder Motorräder?", a: "Nein. Das Gesetz 05/L-132 spricht in Art. 44 wörtlich nur von „vetura\" (Personenwagen). Für Lieferwagen, LKW, Arbeitsfahrzeuge und Motorräder gibt es keine eigene gesetzliche Altersgrenze — die Einfuhr ist grundsätzlich auch bei älteren Fahrzeugen dieser Kategorien möglich. Da die Praxis beim Zoll im Einzelfall abweichen kann, empfehlen wir eine vorherige Bestätigung bei der Dogana e Kosovës." },
        { q: "Was bringt mir eine EUR.1-Bescheinigung?", a: "Mit einer EUR.1-Bescheinigung (Ursprungsnachweis EU) entfällt der 10%ige Zoll komplett — das spart bei einem Auto im Wert von €10.000 etwa €1.000." },
        { q: "Ist URA wirklich kostenlos und wie genau sind die Ergebnisse?", a: "Ja, URA ist komplett kostenlos, ohne Registrierung und ohne Werbung. Alle Beträge sind Schätzungen zur Orientierung — die verbindliche Berechnung erfolgt durch die Dogana e Kosovës bei der Einfuhr." },
      ],
    },
    sq: {
      title: "Rreth URA",
      sub: "Transparencë. Ndershmëri. Kosovë.",
      about: "URA (shqip: Urë) është kalkulator i lirë dhe i pavarur për kostot reale të importit të veturës nga Gjermania, Zvicra ose Austria në Kosovë.",
      disclaimer_title: "Mohim përgjegjësie",
      disclaimer: "Të gjitha llogaritjet janë vlerësime dhe shërbejnë vetëm si udhëzues. Shumat e detyrueshme të doganës vendosen ekskluzivisht nga Dogana e Kosovës.",
      contact_title: "Kontakti",
      contact: "Për pyetje, gabime ose partneritete:",
      legal_title: "Ligjore",
      legal: "Kjo aplikacion nuk mbledh të dhëna personale. Nuk vendosen cookie. Të gjitha llogaritjet bëhen lokalisht në shfletues.",
      sources_title: "Burimet zyrtare",
      faq_title: "Pyetje të shpeshta",
      faq: [
        { q: "Sa është dogana për import të veturës në Kosovë?", a: "Norma standarde e doganës është 10% mbi vlerën doganore (çmimi + transporti + sigurimi). Me certifikatë EUR.1 (origjinë BE) dogana bie në 0%." },
        { q: "Çka është akciza dhe si llogaritet?", a: "Akciza është taksë shtesë që varet nga madhësia e motorit, mosha e veturës dhe lloji i karburantit. Motorët më të mëdhenj dhe veturat më të vjetra paguajnë më shumë. Veturat elektrike janë të liruara nga akciza." },
        { q: "Sa është TVSH-ja për import të veturës?", a: "TVSH-ja është 18% dhe llogaritet mbi shumën e vlerës doganore, doganës dhe akcizës." },
        { q: "A mund të importoj veturë më të vjetër se 10 vjet?", a: "Jo, për vetura (PKW). Neni 44 i Ligjit 05/L-132 flet shprehimisht vetëm për \"vetura\": ato mbi 10 vjet nuk zhdoganohen ose regjistrohen, kërkohet edhe minimumi Euro 4. Për furgon, kamion, automjete pune dhe motoçikleta ligji nuk parashikon kufi moshe të veçantë — konfirmohet rasti specifik me Doganën para importit." },
        { q: "A vlen kufiri 10-vjeçar edhe për furgon, kamion ose motoçikletë?", a: "Jo. Ligji 05/L-132, neni 44, flet shprehimisht vetëm për \"vetura\" (PKW). Furgon, kamion, automjete pune dhe motoçikleta nuk kanë kufi moshe të përcaktuar me ligj — importi në parim është i mundur edhe për mjete më të vjetra në këto kategori. Pasi praktika në terren mund të ndryshojë rast pas rasti, rekomandojmë konfirmim paraprak me Doganën e Kosovës." },
        { q: "Çka më sjell certifikata EUR.1?", a: "Me certifikatën EUR.1 (dëshmi origjine nga BE) dogana 10% bie në 0% — kjo kursen rreth €1.000 për një veturë me vlerë €10.000." },
        { q: "A është URA falas dhe sa të sakta janë rezultatet?", a: "Po, URA është plotësisht falas, pa regjistrim dhe pa reklama. Të gjitha shumat janë vlerësime orientuese — llogaritja e detyrueshme bëhet nga Dogana e Kosovës në momentin e importit." },
      ],
    },
    en: {
      title: "About URA",
      sub: "Transparency. Honesty. Kosovo.",
      about: "URA (Albanian: Bridge) is a free, independent calculator for the real costs of importing a car from Germany, Switzerland or Austria to Kosovo.",
      disclaimer_title: "Disclaimer",
      disclaimer: "All calculations are estimates for guidance only. Binding customs amounts are determined exclusively by the Dogana e Kosovës (Kosovo Customs). Excise amounts are estimates — please verify with TARIK.",
      contact_title: "Contact",
      contact: "For questions, errors or partnership inquiries:",
      legal_title: "Legal",
      legal: "This app does not collect personal data. No cookies are set. All calculations happen locally in the browser.",
      sources_title: "Official sources",
      faq_title: "Frequently asked questions",
      faq: [
        { q: "How much customs duty applies to car imports to Kosovo?", a: "The standard customs duty rate is 10% of the customs value (price + transport + insurance). With a valid EUR.1 certificate (EU origin), the duty drops to 0%." },
        { q: "What is the excise tax (akcizë) and how is it calculated?", a: "The excise tax depends on engine size, vehicle age and fuel type. Bigger and older engines pay more. Electric vehicles are exempt from excise tax." },
        { q: "How much VAT applies when importing a car?", a: "VAT is 18% and is calculated on the sum of customs value, customs duty and excise tax." },
        { q: "Can I import a car older than 10 years?", a: "No — for passenger cars. Article 44 of Law 05/L-132 literally names only \"vetura\" (cars): cars older than 10 years cannot be customs-cleared or registered, and Euro 4 is the minimum standard. For vans, trucks, work vehicles and motorcycles the law sets no separate age limit — confirm your specific case with Kosovo Customs before importing." },
        { q: "Does the 10-year limit also apply to vans, trucks or motorcycles?", a: "No. Law 05/L-132, Article 44, literally names only \"vetura\" (passenger cars). Vans, trucks, work vehicles and motorcycles have no statutory age limit — importing older vehicles in these categories is, in principle, possible. Since real-world customs practice can vary case by case, we recommend confirming in advance with Kosovo Customs." },
        { q: "What does an EUR.1 certificate get me?", a: "With an EUR.1 certificate (proof of EU origin), the 10% customs duty is eliminated entirely — saving about €1,000 on a €10,000 car." },
        { q: "Is URA really free, and how accurate are the results?", a: "Yes, URA is completely free, with no registration and no ads. All amounts are estimates for guidance — the binding calculation is made by Dogana e Kosovës (Kosovo Customs) at the time of import." },
      ],
    },
    sr: {
      title: "O URA",
      sub: "Transparentnost. Poštenje. Kosovo.",
      about: "URA (albansko: Most) je besplatan, nezavisan kalkulator za stvarne troškove uvoza automobila iz Nemačke, Švajcarske ili Austrije na Kosovo.",
      disclaimer_title: "Odricanje odgovornosti",
      disclaimer: "Svi proračuni su procene i služe samo kao smernice. Obavezne carinske iznose utvrđuje isključivo Dogana e Kosovës.",
      contact_title: "Kontakt",
      contact: "Za pitanja, greške ili partnerske upite:",
      legal_title: "Pravno",
      legal: "Ova aplikacija ne prikuplja lične podatke. Nema kolačića. Svi proračuni se vrše lokalno u pregledaču.",
      sources_title: "Zvanični izvori",
      faq_title: "Često postavljana pitanja",
      faq: [
        { q: "Koliko iznosi carina za uvoz automobila na Kosovo?", a: "Standardna carinska stopa je 10% na carinsku vrednost (cena + transport + osiguranje). Sa važećim EUR.1 sertifikatom (poreklo EU) carina pada na 0%." },
        { q: "Šta je akciza i kako se računa?", a: "Akciza zavisi od veličine motora, starosti vozila i vrste goriva. Veći i stariji motori plaćaju više. Električna vozila su izuzeta od akcize." },
        { q: "Koliko iznosi PDV pri uvozu automobila?", a: "PDV iznosi 18% i računa se na zbir carinske vrednosti, carine i akcize." },
        { q: "Mogu li uvesti automobil stariji od 10 godina?", a: "Ne, za putnička vozila (PKW). Član 44. Zakona 05/L-132 pominje izričito samo \"vetura\": ona starija od 10 godina ne mogu se carinski oformiti ni registrovati, potreban je i minimum Euro 4. Za kombi, kamion, radna vozila i motocikle zakon ne predviđa posebnu starosnu granicu — potvrdite svoj slučaj sa Carinom pre uvoza." },
        { q: "Da li se granica od 10 godina odnosi i na kombi, kamion ili motocikl?", a: "Ne. Zakon 05/L-132, član 44, izričito pominje samo \"vetura\" (putnička vozila). Kombi, kamion, radna vozila i motocikli nemaju zakonsku starosnu granicu — uvoz starijih vozila ovih kategorija je u principu moguć. Pošto praksa Carine može varirati od slučaja do slučaja, preporučujemo prethodnu potvrdu sa Carinom Kosova." },
        { q: "Šta mi donosi EUR.1 sertifikat?", a: "Sa EUR.1 sertifikatom (dokaz porekla iz EU) carina od 10% se potpuno ukida — to štedi oko €1.000 za automobil vredan €10.000." },
        { q: "Da li je URA stvarno besplatna i koliko su rezultati precizni?", a: "Da, URA je potpuno besplatna, bez registracije i bez reklama. Svi iznosi su procene za orijentaciju — obavezujući obračun vrši Dogana e Kosovës prilikom uvoza." },
      ],
    },
    tr: {
      title: "Ura Hakkında",
      sub: "Şeffaflık. Dürüstlük. Kosova.",
      about: "Ura (Arnavutça: Köprü), Almanya, İsviçre veya Avusturya'dan Kosova'ya araç ithalatının gerçek maliyetini hesaplayan ücretsiz, bağımsız bir hesap makinesidir.",
      disclaimer_title: "Sorumluluk Reddi",
      disclaimer: "Tüm hesaplamalar tahmini olup yalnızca yol gösterici niteliktedir. Bağlayıcı gümrük tutarlarını yalnızca Dogana e Kosovës (Kosova Gümrüğü) belirler.",
      contact_title: "İletişim",
      contact: "Sorular, hatalar veya ortaklık talepleri için:",
      legal_title: "Yasal",
      legal: "Bu uygulama kişisel veri toplamaz. Çerez kullanılmaz. Tüm hesaplamalar tarayıcınızda yerel olarak yapılır.",
      sources_title: "Resmi kaynaklar",
      faq_title: "Sıkça sorulan sorular",
      faq: [
        { q: "Kosova'ya araç ithalatında gümrük vergisi ne kadar?", a: "Standart gümrük oranı, gümrük değeri (fiyat + nakliye + sigorta) üzerinden %10'dur. Geçerli bir EUR.1 belgesi (AB menşeli) ile gümrük vergisi tamamen kalkar (%0)." },
        { q: "ÖTV (akcizë) nedir ve nasıl hesaplanır?", a: "ÖTV, motor hacmine, araç yaşına ve yakıt türüne bağlı ek bir vergidir. Daha büyük ve daha eski motorlar daha fazla öder. Elektrikli araçlar ÖTV'den muaftır." },
        { q: "Araç ithalatında KDV ne kadar?", a: "KDV %18'dir ve gümrük değeri, gümrük vergisi ve ÖTV toplamı üzerinden hesaplanır." },
        { q: "10 yıldan eski bir araç ithal edebilir miyim?", a: "Sadece binek araçlar için hayır. 05/L-132 sayılı Kanun'un 44. maddesi yalnızca \"vetura\" (binek araç) kelimesini kullanır: bunlar 10 yaşından büyükse gümrükten çekilemez veya tescil edilemez, ayrıca minimum Euro 4 şartı vardır. Panelvan, kamyon, iş aracı ve motosikletler için kanunda ayrı bir yaş sınırı yoktur — ithalattan önce kendi durumunuzu Kosova Gümrüğü ile teyit edin." },
        { q: "10 yıllık sınır panelvan, kamyon veya motosikletler için de geçerli mi?", a: "Hayır. 05/L-132 sayılı Kanun'un 44. maddesi yalnızca \"vetura\" (binek araç) kelimesini kullanır. Panelvan, kamyon, iş aracı ve motosikletler için kanunla belirlenmiş bir yaş sınırı yoktur — bu kategorilerdeki daha eski araçların ithalatı prensipte mümkündür. Gümrük uygulaması durumdan duruma farklılık gösterebileceğinden, önceden Kosova Gümrüğü ile teyit almanızı öneririz." },
        { q: "EUR.1 belgesi bana ne sağlar?", a: "EUR.1 belgesi (AB menşe kanıtı) ile %10'luk gümrük vergisi tamamen kalkar — €10.000 değerindeki bir araçta bu yaklaşık €1.000 tasarruf demektir." },
        { q: "Ura gerçekten ücretsiz mi ve sonuçlar ne kadar doğru?", a: "Evet, Ura tamamen ücretsizdir, kayıt veya reklam içermez. Tüm tutarlar yol gösterici tahminlerdir — bağlayıcı hesaplama, ithalat sırasında Dogana e Kosovës (Kosova Gümrüğü) tarafından yapılır." },
      ],
    }
  };
  const c = content[lang];
  const card = { background: "linear-gradient(160deg,#141926,#10141f)", border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px", marginBottom: 14 };
  const [openFaq, setOpenFaq] = useState(null);

  // FAQPage structured data for SEO (injected once per language change)
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": c.faq.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a },
      })),
    };
    let el = document.getElementById("ura-faq-schema");
    if (!el) {
      el = document.createElement("script");
      el.id = "ura-faq-schema";
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(schema);
    return () => { /* keep schema across tab switches */ };
  }, [lang]);

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: `linear-gradient(150deg,#e6c878,${C.blue})`,
          display: "grid", placeItems: "center", margin: "0 auto 14px",
          fontFamily: "serif", fontWeight: 700, fontSize: 38, color: C.navy,
          boxShadow: "0 8px 24px -8px rgba(201,166,90,.5)" }}>U</div>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 600, color: C.blue }}>{c.title}</h1>
        <p style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>{c.sub}</p>
      </div>

      <div style={card}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Info size={18} color={C.blue} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65 }}>{c.about}</p>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{c.disclaimer_title}</div>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{c.disclaimer}</p>
      </div>

      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{c.sources_title}</div>
        <a href="https://dogana.rks-gov.net/" target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 8, color: C.blue, fontWeight: 700, fontSize: 14, textDecoration: "none", marginBottom: 10 }}>
          <Building2 size={16} /> Dogana e Kosovës — TARIK <ExternalLink size={12} />
        </a>
        <a href="https://ofroje.com/en/customs" target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 8, color: C.blue, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
          <Building2 size={16} /> ofroje.com — Katalogwert-Rechner <ExternalLink size={12} />
        </a>
      </div>

      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{c.legal_title}</div>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{c.legal}</p>
      </div>

      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{c.faq_title}</div>
        {c.faq.map((f, i) => (
          <div key={i} style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none", paddingTop: i > 0 ? 10 : 0, marginTop: i > 0 ? 10 : 0 }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", color: C.ink, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit" }}>
              <span>{f.q}</span>
              <ChevronDown size={16} color={C.muted} style={{ flexShrink: 0, marginTop: 2, transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
            {openFaq === i && <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginTop: 8 }}>{f.a}</p>}
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{c.contact_title}</div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{c.contact}</p>
        <a href="mailto:miftari.flamur@outlook.com"
          style={{ color: C.blue, fontWeight: 700, fontSize: 14 }}>
          miftari.flamur@outlook.com
        </a>
      </div>

      <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: C.muted }}>
        URA v3 · {lang === "de" ? "Kostenlos & Open Source" : "Free & Open Source"} · 2026
      </div>
    </div>
  );
}

// ─── SAVINGS TIPS ───────────────────────────────────────────────────────────
function SavingsTips({ t, calc, hasEur1, ageYears, engine, fuel, C }) {
  if (fuel === "ev" || calc.arrival <= 0) return null;
  const tips = [];

  // Tip 1: EUR.1 certificate — saves customs if not already using it
  if (!hasEur1 && calc.customs > 50) {
    tips.push({ icon: "📄", text: t.tipEur1(Math.round(calc.customs)) });
  }

  // Tip 2: Buy a car ≤8 years old — saves excise if current car is >8 years
  if (ageYears > 8) {
    const exciseAt8 = (function() {
      const b = engine <= 2000 ? "le2000" : engine <= 3000 ? "le3000" : "gt3000";
      return TAX_CONFIG.exciseTable[b][0]; // index 0 = ≤8 yrs
    })();
    const saving = calc.excise - exciseAt8;
    if (saving > 50) {
      const targetYear = NOW_YEAR - 8;
      tips.push({ icon: "📅", text: t.tipAge(Math.round(saving), targetYear) });
    }
  }

  // Tip 3: Smaller engine saves excise (only if engine > 2000cc)
  if (engine > 2000) {
    const exciseSmall = TAX_CONFIG.exciseTable["le2000"][ageYears <= 8 ? 0 : Math.min(ageYears - 8, 9)];
    const saving = calc.excise - exciseSmall;
    if (saving > 50) {
      tips.push({ icon: "⚙️", text: t.tipEngine(Math.round(saving)) });
    }
  }

  if (tips.length === 0) return null;

  return (
    <div style={{ background: "rgba(201,166,90,0.07)", border: "1.5px solid rgba(201,166,90,0.25)", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#a8843c", letterSpacing: .4, textTransform: "uppercase", marginBottom: 10 }}>{t.tipsTitle}</div>
      {tips.map((tip, i) => (
        <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: i < tips.length - 1 ? 8 : 0 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{tip.icon}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, lineHeight: 1.5 }}>{tip.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── MARKTPREIS-CHECK ───────────────────────────────────────────────────────
// PLATZHALTER — Flamur: echte Affiliate-/Partnerprogramm-IDs hier eintragen, sobald vorhanden.
const AFFILIATE_REFS = { autoscout24: "ura-import", mobilede: "ura-import" };

function MarketCheckLinks({ t, make, model, year, C }) {
  const query = [make, model, year].filter(Boolean).join(" ").trim();
  if (!query) return null;
  const enc = encodeURIComponent(query);
  const links = [
    { label: "AutoScout24", url: `https://www.google.com/search?q=${enc}+site%3Aautoscout24.de&utm_source=ura-import&utm_campaign=${AFFILIATE_REFS.autoscout24}` },
    { label: "mobile.de", url: `https://www.google.com/search?q=${enc}+site%3Amobile.de&utm_source=ura-import&utm_campaign=${AFFILIATE_REFS.mobilede}` },
  ];
  return (
    <div className="card" style={{ padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: C.blueSoft, display: "grid", placeItems: "center", flexShrink: 0 }}><TrendingUp size={18} color={C.blue} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t.marketCheckTitle}</div>
          <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>{t.marketCheckSub}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {links.map(l => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
            style={{ flex: 1, background: C.glass, border: `1.5px solid ${C.line}`, borderRadius: 13, padding: "12px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, color: C.ink, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {l.label} <ExternalLink size={14} color={C.blue} />
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── SHARE PANEL ────────────────────────────────────────────────────────────
function SharePanel({ t, make, model, year, arrival, price, lang }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const text = t.shareText(make || "Auto", model || "", year, fmt(arrival), fmt(price));
  const url = typeof window !== "undefined" ? window.location.href : "https://ura-import.com";
  const encoded = encodeURIComponent(text + "\n" + url);
  const encodedUrl = encodeURIComponent(url);

  const waUrl = `https://wa.me/?text=${encoded}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(text)}`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const viberUrl = `viber://forward?text=${encoded}`;

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `Ura — ${make} ${model}`, text, url }); } catch {}
    } else { setOpen(o => !o); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url + "#" + encodeState({ price, transport: 0, year, engine: 0, origin: "DE", fuel: "diesel", euro: 6, category: "car" })); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const igShare = () => {
    navigator.clipboard.writeText(text).then(() => {
      alert(lang === "de" ? "Text kopiert! Öffne Instagram und füge ihn als Story oder Post ein." : lang === "sq" ? "Teksti u kopjua! Hap Instagram dhe ngjite si Story ose Post." : "Text copied! Open Instagram and paste as Story or Post.");
    });
  };

  const iconBtn = (bg, onClick, href, children, title) => {
    const style = {
      width: 48, height: 48, borderRadius: 14, border: "none", cursor: "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: bg, color: "#fff", flexShrink: 0, transition: "transform .15s, opacity .15s",
    };
    if (href) return (
      <a href={href} target="_blank" rel="noreferrer" title={title}
        style={{ ...style, textDecoration: "none" }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
        {children}
      </a>
    );
    return (
      <button onClick={onClick} title={title} style={style}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
        {children}
      </button>
    );
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Main share button */}
      <button onClick={nativeShare} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, background: `linear-gradient(135deg, ${C.blue}, ${C.greenDeep})`, color: C.navy, border: "none", borderRadius: 14, padding: "14px", fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 24px -8px rgba(201,166,90,.5)", marginBottom: 10 }}>
        <Share2 size={17} /> {t.shareTitle}
      </button>

      {/* Icon row — always visible */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>

        {/* WhatsApp */}
        {iconBtn("#25D366", null, waUrl, (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        ), "WhatsApp")}

        {/* Facebook */}
        {iconBtn("#1877F2", null, fbUrl, (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        ), "Facebook")}

        {/* LinkedIn */}
        {iconBtn("#0A66C2", null, liUrl, (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        ), "LinkedIn")}

        {/* Viber */}
        {iconBtn("#7360F2", null, viberUrl, (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.993 0h-.002C5.3 0 0 5.3 0 11.993c0 2.866.998 5.496 2.651 7.56L.918 24l4.573-1.695a11.944 11.944 0 006.5 1.913c6.694 0 11.994-5.3 11.994-11.993C23.985 5.537 18.686.238 11.993 0zm6.27 16.658c-.26.733-.965 1.34-1.778 1.52-.474.108-.969.13-1.457.05-.505-.082-1.003-.215-1.49-.39a14.41 14.41 0 01-5.813-4.396 8.22 8.22 0 01-1.65-3.28c-.174-.847-.037-1.75.525-2.41.28-.327.606-.424.875-.424h.612c.227 0 .46.008.65.47.228.55.775 1.9.843 2.04.068.14.114.303.02.483-.09.178-.136.29-.27.445-.134.155-.282.345-.402.464-.136.13-.277.271-.12.532a7.84 7.84 0 001.437 1.786 7.478 7.478 0 002.079 1.28c.264.13.418.109.573-.066.155-.174.662-.77.838-1.037.174-.267.348-.222.586-.134.238.089 1.51.712 1.769.843.26.13.433.195.497.304.063.108.063.63-.198 1.32z"/></svg>
        ), "Viber")}

        {/* Instagram */}
        {iconBtn("linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", igShare, null, (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        ), "Instagram")}

        {/* Copy link */}
        {iconBtn(copied ? C.greenDeep : C.surface, copyLink, null, (
          copied ? <Check size={20} /> : <Copy size={20} />
        ), copied ? t.copied : t.copyLink)}

      </div>
    </div>
  );
}

// ─── SEND TO PARTNER/CUSTOMS (opt-in companion-API hook) ────────────────────
// Deliberately its own small component rather than inline JSX inside App() —
// keeping it isolated avoids a Rollup tree-shaking edge case that was
// incorrectly eliminating this code when it lived directly inside the (very
// large) App() function body, even fully unconditional test markers placed
// at that exact spot were dropped. A separate component with its own state
// does not trigger it. Returns null (renders nothing) whenever apiEnabled is
// false, i.e. by default, with no VITE_API_BASE configured.
function SendToPartnerButton({ lang, C, payload }) {
  const [sendStatus, setSendStatus] = useState("idle");
  if (!apiEnabled) return null;

  const sendToPartner = async () => {
    setSendStatus("sending");
    try {
      await submitCalculation(payload);
      setSendStatus("sent");
    } catch {
      setSendStatus("error");
    }
    setTimeout(() => setSendStatus("idle"), 4000);
  };

  const label = sendStatus === "sending" ? "…"
    : sendStatus === "sent" ? (lang==="de"?"Gesendet ✓":lang==="sq"?"Dërguar ✓":lang==="sr"?"Pošato ✓":lang==="tr"?"Gönderildi ✓":"Sent ✓")
    : sendStatus === "error" ? (lang==="de"?"Fehler":lang==="sq"?"Gabim":lang==="sr"?"Greška":lang==="tr"?"Hata":"Error")
    : (lang==="de"?"An Behörde/Partner senden":lang==="sq"?"Dërgo te Dogana/Partneri":lang==="sr"?"Pošalji Carini/Partneru":lang==="tr"?"Gümrük/Ortağa gönder":"Send to Customs/Partner");

  return (
    <button onClick={sendToPartner} disabled={sendStatus === "sending"}
      title={lang==="de"?"An Behörde/Partner senden":lang==="sq"?"Dërgo te Dogana/Partneri":lang==="sr"?"Pošalji Carini/Partneru":lang==="tr"?"Gümrük/Ortağa gönder":"Send to Customs/Partner"}
      style={{ flex: "1 1 140px", background: sendStatus === "sent" ? C.greenDeep : C.glass, border: `1.5px solid ${sendStatus === "error" ? "#e0736b" : C.line}`, borderRadius: 13, padding: "13px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, color: sendStatus === "sent" ? "#fff" : sendStatus === "error" ? "#e0736b" : C.ink, cursor: sendStatus === "sending" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
      <Send size={15} color={sendStatus === "sent" ? "#fff" : C.blue} />
      {label}
    </button>
  );
}

// ─── ONBOARDING OVERLAY ─────────────────────────────────────────────────────
function OnboardOverlay({ t, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,14,23,0.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 28, padding: "32px 28px", maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: `linear-gradient(150deg, #e6c878, ${C.blue})`, display: "grid", placeItems: "center", margin: "0 auto 18px", fontFamily: "serif", fontWeight: 700, fontSize: 38, color: C.navy, boxShadow: "0 8px 24px -8px rgba(201,166,90,.6)" }}>U</div>
        <div style={{ fontFamily: "serif", fontWeight: 700, fontSize: 28, color: C.blue, marginBottom: 8 }}>URA</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginBottom: 12 }}>{t.onboardTitle}</div>
        <div style={{ fontSize: 15, color: C.muted, lineHeight: 1.6, marginBottom: 28 }}>{t.onboardBody}</div>
        <button onClick={onClose} style={{ width: "100%", background: `linear-gradient(135deg, #e6c878, ${C.blue})`, color: C.navy, border: "none", borderRadius: 15, padding: "16px", fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 20px -8px rgba(201,166,90,.55)" }}>
          {t.onboardBtn} →
        </button>
      </div>
    </div>
  );
}


// ─── TOOLS MODUS ─────────────────────────────────────────────────────────────
const CURRENCY_RATES_FALLBACK = { EUR: 1, CHF: 0.955, ALL: 105, USD: 1.085 };

function ToolsMode({ lang, C, fmt }) {
  // Tool 1: Import-Ampel
  const [ampYear, setAmpYear] = useState(2019);
  const [ampEuro, setAmpEuro] = useState(6);
  const [ampCat,  setAmpCat]  = useState("car");

  // Tool 2: KM-Check
  const [kmYear, setKmYear] = useState(2018);
  const [kmVal,  setKmVal]  = useState(120000);

  // Tool 3: Kraftstoffkosten
  const [fuelLit, setFuelLit] = useState(7);
  const [fuelKm,  setFuelKm]  = useState(1500);
  const [fuelPrc, setFuelPrc] = useState(1.65);

  // Tool 4: Versicherung Kosovo
  const [insVal, setInsVal] = useState(10000);

  // Tool 6: Finanzierungsrechner
  const [finAmount, setFinAmount] = useState(8000);
  const [finDown,   setFinDown]   = useState(1000);
  const [finRate,   setFinRate]   = useState(7.5);
  const [finTerm,   setFinTerm]   = useState(36);

  // Tool 7: Dokumenten-Checkliste
  const docItems = [
    { id: "invoice",   sq: "Fatura / kontrata e blerjes",            de: "Rechnung / Kaufvertrag",                 en: "Invoice / purchase contract",          sr: "Faktura / kupoprodajni ugovor" },
    { id: "regdoc",    sq: "Certifikata e regjistrimit (Teil I & II)", de: "Fahrzeugbrief (Zulassungsbescheinigung Teil I & II)", en: "Vehicle registration certificate (Parts I & II)", sr: "Saobraćajna dozvola (Deo I i II)" },
    { id: "eur1",      sq: "Certifikata EUR.1 (nëse ka origjinë BE)", de: "EUR.1-Bescheinigung (falls EU-Ursprung)", en: "EUR.1 certificate (if EU origin)",     sr: "EUR.1 sertifikat (ako je poreklo EU)" },
    { id: "insurance", sq: "Sigurimi ndërkombëtar (Karta Gjelbër)",    de: "Internationale Versicherung (Grüne Karte)", en: "International insurance (Green Card)", sr: "Međunarodno osiguranje (Zelena karta)" },
    { id: "tuv",       sq: "Raporti i kontrollit teknik (TÜV/HU)",     de: "Technische Prüfbescheinigung (TÜV/HU)",  en: "Technical inspection report (TÜV/HU)", sr: "Izveštaj tehničkog pregleda (TÜV)" },
    { id: "cmr",       sq: "Dokumenti i transportit (CMR)",            de: "Transport-/Frachtdokument (CMR)",        en: "Transport/freight document (CMR)",     sr: "Transportni dokument (CMR)" },
    { id: "id",        sq: "Letërnjoftimi / Pasaporta",                de: "Personalausweis / Reisepass",            en: "ID card / passport",                   sr: "Lična karta / pasoš" },
    { id: "customs",   sq: "Autorizimi për agjentin doganor (nëse përdoret)", de: "Zollvollmacht für den Spediteur (falls genutzt)", en: "Customs power of attorney (if using an agent)", sr: "Ovlašćenje za špeditera (ako se koristi)" },
  ];
  const [docChecklist, setDocChecklist] = useState(() => {
    try {
      const saved = localStorage.getItem("ura_doc_checklist");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("ura_doc_checklist", JSON.stringify(docChecklist)); } catch {}
  }, [docChecklist]);
  const toggleDoc = (id) => setDocChecklist(prev => ({ ...prev, [id]: !prev[id] }));
  const docDoneCount = docItems.filter(it => docChecklist[it.id]).length;

  // Tool 5: Währungsrechner
  const [cAmt,  setCamt]  = useState(10000);
  const [cFrom, setCfrom] = useState("EUR");
  const [liveRates, setLiveRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesDate, setRatesDate] = useState(null);
  useEffect(() => {
    setRatesLoading(true);
    fetch("https://api.exchangerate-api.com/v4/latest/EUR")
      .then(r => r.json())
      .then(d => {
        const { EUR, CHF, ALL, USD, MKD, BAM, RSD, GBP } = d.rates;
        setLiveRates({ EUR: 1, CHF: CHF/EUR*1, ALL: ALL/EUR*1, USD: USD/EUR*1, MKD: MKD/EUR*1, BAM: BAM/EUR*1, RSD: RSD/EUR*1, GBP: GBP/EUR*1 });
        setRatesDate(d.date);
      })
      .catch(() => {})
      .finally(() => setRatesLoading(false));
  }, []);
  const rates = liveRates || CURRENCY_RATES_FALLBACK;

  // ── Ampel ───────────────────────────────────────────────────────────────────
  // Neni 44 i Ligjit 05/L-132 flet shprehimisht vetëm për "vetura" (PKW) — furgon/moto nuk kanë kufi moshe ligjor.
  const ampAge     = NOW_YEAR - ampYear;
  const ampCarOnly = ampCat === "car";
  const ampLimit   = TAX_CONFIG.ageLimitByCategory[ampCat];
  const ampOk      = ampCarOnly ? (ampEuro >= TAX_CONFIG.minEuro && ampAge <= ampLimit) : true;
  const ampWarn    = ampCarOnly && ampOk && ampAge >= ampLimit - 2;
  const ampClr     = !ampCarOnly ? C.blue : !ampOk ? "#e0736b" : ampWarn ? "#d8a657" : "#a8843c";
  const ampEmoji   = !ampCarOnly ? "ℹ️" : !ampOk ? "🔴" : ampWarn ? "🟡" : "🟢";
  const ampMsg   = {
    sq: !ampCarOnly ? "ℹ️ Nuk ka kufi moshe të shprehur" : !ampOk ? "❌ Importi nuk lejohet" : ampWarn ? "⚠️ Afër kufirit — akoma lejohet" : "✅ Importi lejohet",
    de: !ampCarOnly ? "ℹ️ Keine ausdrückliche Altersgrenze" : !ampOk ? "❌ Import nicht erlaubt" : ampWarn ? "⚠️ Fast zu alt — noch erlaubt" : "✅ Import erlaubt",
    en: !ampCarOnly ? "ℹ️ No explicit age limit" : !ampOk ? "❌ Import not allowed" : ampWarn ? "⚠️ Near age limit — still ok" : "✅ Import allowed",
    sr: !ampCarOnly ? "ℹ️ Nema izričite starosne granice" : !ampOk ? "❌ Uvoz nije dozvoljen" : ampWarn ? "⚠️ Blizu starosne granice — još je ok" : "✅ Uvoz dozvoljen",
    tr: !ampCarOnly ? "ℹ️ Açık bir yaş sınırı yok" : !ampOk ? "❌ İthalata izin verilmiyor" : ampWarn ? "⚠️ Sınıra yakın — yine de izin var" : "✅ İthalata izin var",
  };
  const ampSub   = {
    sq: ampCarOnly ? `Mosha: ${ampAge} vjet (max. ${ampLimit}) · Euro ${ampEuro} (min. ${TAX_CONFIG.minEuro})` : `Mosha: ${ampAge} vjet · Neni 44 përmend vetëm "vetura" — konfirmo rastin me Doganën`,
    de: ampCarOnly ? `Alter: ${ampAge} J. (max. ${ampLimit}) · Euro ${ampEuro} (mind. ${TAX_CONFIG.minEuro})` : `Alter: ${ampAge} J. · Art. 44 nennt wörtlich nur „vetura" (PKW) — Einzelfall beim Zoll bestätigen`,
    en: ampCarOnly ? `Age: ${ampAge} yrs (max. ${ampLimit}) · Euro ${ampEuro} (min. ${TAX_CONFIG.minEuro})` : `Age: ${ampAge} yrs · Art. 44 names only "vetura" (cars) — confirm your case with Customs`,
    sr: ampCarOnly ? `Starost: ${ampAge} god. (max. ${ampLimit}) · Euro ${ampEuro} (min. ${TAX_CONFIG.minEuro})` : `Starost: ${ampAge} god. · Član 44. pominje samo "vetura" (putnička) — potvrdite slučaj sa Carinom`,
    tr: ampCarOnly ? `Yaş: ${ampAge} yıl (maks. ${ampLimit}) · Euro ${ampEuro} (min. ${TAX_CONFIG.minEuro})` : `Yaş: ${ampAge} yıl · Madde 44 yalnızca "vetura" (binek araç) der — durumu Gümrük ile teyit edin`,
  };

  // ── KM ──────────────────────────────────────────────────────────────────────
  const kmAge      = Math.max(1, NOW_YEAR - kmYear);
  const kmExpected = kmAge * 15000;
  const kmRatio    = kmVal / kmExpected;
  const kmStatus   = kmRatio < 0.6 ? "low" : kmRatio > 1.5 ? "high" : "ok";
  const kmClr      = { low: C.blue, ok: "#a8843c", high: "#e0736b" }[kmStatus];
  const kmMsg      = {
    low:  { sq:"Shumë pak km — mundësi manipulimi ose pak e përdorur", de:"Sehr wenig km — evtl. manipuliert", en:"Very low km — possible manipulation", sr:"Premalo km — moguća manipulacija" },
    ok:   { sq:"KM normal — rrezik i ulët manipulimi", de:"Normale km — kein Verdacht", en:"Normal km — no suspicion", sr:"Normalni km — nema sumnje" },
    high: { sq:"KM shumë të larta — veturë e lodhur, kujdes!", de:"Sehr viele km — stark gefahren, Vorsicht!", en:"Very high km — heavily used, be careful!", sr:"Previše km — veoma korišćeno, oprez!" },
  }[kmStatus];

  // ── Fuel ─────────────────────────────────────────────────────────────────────
  const fuelMonth = Math.round((fuelLit / 100) * fuelKm * fuelPrc);
  const fuelYear  = fuelMonth * 12;
  const fuel5yr   = fuelYear * 5;

  // ── Insurance ───────────────────────────────────────────────────────────────
  const insRate = insVal > 30000 ? 0.022 : insVal > 15000 ? 0.028 : insVal > 8000 ? 0.033 : 0.04;
  const insYear  = Math.round(insVal * insRate);
  const insMonth = Math.round(insYear / 12);

  // ── Finanzierung ─────────────────────────────────────────────────────────────
  const finPay = useMemo(() => {
    const P = Math.max(0, finAmount - finDown);
    const r = finRate / 100 / 12;
    const n = finTerm;
    if (P <= 0) return 0;
    if (r === 0) return P / n;
    return (P * r) / (1 - Math.pow(1 + r, -n));
  }, [finAmount, finDown, finRate, finTerm]);
  const finTotal = finPay * finTerm;
  const finInterest = Math.max(0, finTotal - (finAmount - finDown));

  // ── Currency ─────────────────────────────────────────────────────────────────
  const cResult = {};
  Object.keys(rates).forEach(cur => {
    cResult[cur] = Math.round((cAmt / (rates[cFrom] || 1)) * rates[cur]);
  });

  const L = (obj) => obj[lang] || obj["en"];
  const sectionTitle = { sq:"Mjete Falas", de:"Kostenlose Werkzeuge", en:"Free Tools", sr:"Besplatni Alati" };
  const sectionSub   = { sq:"7 mjete falas për çdo blerës të mençur", de:"7 kostenlose Tools für jeden cleveren Käufer", en:"7 free tools for every smart buyer", sr:"7 besplatnih alata za svakog pametnog kupca" };
  const TOOL_NAV = [
    { id:"t1", emoji:"🚦", label:{ de:"Import-Ampel", sq:"Semafor",      sr:"Semafor",    en:"Import check" } },
    { id:"t2", emoji:"🔢",  label:{ de:"KM-Check",    sq:"KM-Kontrolë",  sr:"KM-Check",   en:"KM check" } },
    { id:"t3", emoji:"⛽", label:{ de:"Spritkosten",  sq:"Karburanti",   sr:"Gorivo",     en:"Fuel costs" } },
    { id:"t4", emoji:"🛡️", label:{ de:"Versicherung", sq:"Sigurimi",     sr:"Osiguranje", en:"Insurance" } },
    { id:"t5", emoji:"💱", label:{ de:"Währung",      sq:"Valuta",       sr:"Valuta",     en:"Currency" } },
    { id:"t6", emoji:"💳", label:{ de:"Finanzierung", sq:"Financimi",    sr:"Finansiranje", en:"Finance" } },
    { id:"t7", emoji:"📋", label:{ de:"Checkliste",   sq:"Lista",        sr:"Cheklista",  en:"Checklist" } },
  ];

  const cardStyle = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, marginBottom: 16 };
  const toolTitle = { fontWeight: 800, fontSize: 16, color: C.ink };
  const toolSub   = { fontSize: 12, color: C.muted, marginTop: 2 };
  const sliderRow = { display:"flex", alignItems:"center", gap:10, marginBottom:12 };
  const sliderLabel = { fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:5 };

  return (
    <div style={{ padding:"24px 0" }}>
      <div style={{ fontFamily:"'Fraunces',serif", fontWeight:800, fontSize:26, color:C.ink, marginBottom:4 }}>{L(sectionTitle)}</div>
      <div style={{ fontSize:14, color:C.muted, marginBottom:14 }}>{L(sectionSub)}</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:22 }}>
        {TOOL_NAV.map(tn => (
          <a key={tn.id} href={`#tool-${tn.id}`} style={{ textDecoration:"none", display:"inline-flex", alignItems:"center", gap:5, background:C.glass, border:`1px solid ${C.line}`, borderRadius:20, padding:"6px 12px", fontSize:12, fontWeight:700, color:C.muted, cursor:"pointer" }}
            onClick={(e) => { e.preventDefault(); document.getElementById(`tool-${tn.id}`)?.scrollIntoView({ behavior:"smooth", block:"start" }); }}>
            {tn.emoji} {tn.label[lang] || tn.label.en}
          </a>
        ))}
      </div>

      {/* ── 1. Import-Ampel ─────────────────────────────────────────────────── */}
      <div id="t1" style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
          <span style={{ fontSize:32 }}>🚦</span>
          <div>
            <div style={toolTitle}>{lang==="de"?"Darf ich das Auto importieren?":lang==="sq"?"A mund ta importoj?":lang==="sr"?"Mogu li uvesti auto?":"Can I import this car?"}</div>
            <div style={toolSub}>{lang==="de"?"Gesetzliche Prüfung in 10 Sekunden":lang==="sq"?"Kontroll ligjor në 10 sekonda":lang==="sr"?"Zakonska provjera za 10 sekundi":"Legal check in 10 seconds"}</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
          <div>
            <div style={sliderLabel}>{lang==="de"?"Baujahr":"Year"}</div>
            <div style={sliderRow}>
              <input type="range" min={2000} max={2025} value={ampYear} onChange={e=>setAmpYear(+e.target.value)} style={{ flex:1, accentColor:C.blue }} />
              <span style={{ fontWeight:800, color:C.ink, minWidth:40 }}>{ampYear}</span>
            </div>
          </div>
          <div>
            <div style={sliderLabel}>Euro-Norm</div>
            <div style={{ display:"flex", gap:6 }}>
              {[3,4,5,6].map(e=>(
                <button key={e} onClick={()=>setAmpEuro(e)} style={{ flex:1, padding:"7px 0", borderRadius:9, border:"none", background:ampEuro===e?C.blue:C.glass, color:ampEuro===e?C.navy:C.muted, fontWeight:700, fontSize:13, cursor:"pointer" }}>€{e}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:18 }}>
          {[["car","🚗"," PKW"],["van","🚐"," Van"],["moto","🏍","  Moto"]].map(([id,ico,lb])=>(
            <button key={id} onClick={()=>setAmpCat(id)} style={{ flex:1, padding:"8px 0", borderRadius:10, border:"none", background:ampCat===id?C.blue:C.glass, color:ampCat===id?C.navy:C.muted, fontWeight:700, fontSize:12, cursor:"pointer" }}>{ico}{lb}</button>
          ))}
        </div>

        <div style={{ background:`${ampClr}18`, border:`2.5px solid ${ampClr}`, borderRadius:15, padding:"16px 20px", display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:36 }}>{ampEmoji}</span>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:ampClr }}>{L(ampMsg)}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{L(ampSub)}</div>
          </div>
        </div>
      </div>

      {/* ── 2. KM-Check ──────────────────────────────────────────────────────── */}
      <div id="t2" style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
          <span style={{ fontSize:32 }}>🔍</span>
          <div>
            <div style={toolTitle}>{lang==="de"?"Kilometerstand prüfen":lang==="sq"?"Kontrollo kilometrazhin":lang==="sr"?"Provjeri kilometražu":"Check mileage"}</div>
            <div style={toolSub}>{lang==="de"?"Ist der Tacho manipuliert?":lang==="sq"?"A është manipuluar numëruesi?":lang==="sr"?"Da li je tahometar falsifikovan?":"Is the odometer tampered?"}</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <div>
            <div style={sliderLabel}>{lang==="de"?"Baujahr":"Year"}</div>
            <div style={sliderRow}>
              <input type="range" min={2005} max={2024} value={kmYear} onChange={e=>setKmYear(+e.target.value)} style={{ flex:1, accentColor:C.blue }} />
              <span style={{ fontWeight:800, color:C.ink, minWidth:40 }}>{kmYear}</span>
            </div>
          </div>
          <div>
            <div style={sliderLabel}>km</div>
            <input type="number" value={kmVal} onChange={e=>setKmVal(Math.max(0,+e.target.value))} step={5000}
              style={{ width:"100%", background:C.glass, border:`1px solid ${C.line}`, borderRadius:10, padding:"8px 12px", color:C.ink, fontFamily:"inherit", fontSize:15, fontWeight:700 }} />
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:5 }}>
            <span>0</span>
            <span style={{ color:"#a8843c", fontWeight:700 }}>{fmt(kmExpected)} km {lang==="de"?"erwartet":"expected"}</span>
            <span>{fmt(kmExpected*2)}</span>
          </div>
          <div style={{ background:C.glass, borderRadius:99, height:12, position:"relative", overflow:"hidden" }}>
            <div style={{ background:`linear-gradient(90deg,#a8843c,${kmClr})`, height:"100%", width:`${Math.min(100,(kmVal/(kmExpected*2))*100)}%`, transition:"width .3s", borderRadius:99 }} />
          </div>
          <div style={{ width:12, height:12, borderRadius:"50%", background:kmClr, border:`2px solid ${C.navy}`, marginTop:-12, marginLeft:`calc(${Math.min(97,(kmVal/(kmExpected*2))*100)}% - 6px)`, transition:"margin .3s", position:"relative" }} />
        </div>

        <div style={{ background:`${kmClr}18`, border:`2.5px solid ${kmClr}`, borderRadius:15, padding:"13px 18px" }}>
          <div style={{ fontWeight:800, fontSize:14, color:kmClr }}>{L(kmMsg)}</div>
          <div style={{ fontSize:11.5, color:C.muted, marginTop:4 }}>
            {lang==="de" ? `Erwartet: ~${fmt(kmExpected)} km (15.000 km/Jahr × ${kmAge} J.)` : `Expected: ~${fmt(kmExpected)} km (15,000 km/yr × ${kmAge} yrs)`}
          </div>
        </div>
      </div>

      {/* ── 3. Kraftstoffkosten ──────────────────────────────────────────────── */}
      <div id="t3" style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
          <span style={{ fontSize:32 }}>⛽</span>
          <div>
            <div style={toolTitle}>{lang==="de"?"Kraftstoffkosten":lang==="sq"?"Kostoja e karburantit":lang==="sr"?"Troškovi goriva":"Fuel costs"}</div>
            <div style={toolSub}>{lang==="de"?"Wie viel kostet mich das Fahren pro Monat?":lang==="sq"?"Sa kushton të vozitësh çdo muaj?":lang==="sr"?"Koliko košta vožnja svakog meseca?":"How much does driving cost per month?"}</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:18 }}>
          {[
            { label:"L/100km", min:3, max:20, step:0.5, val:fuelLit, set:setFuelLit, disp:fuelLit.toFixed(1) },
            { label:`km/${lang==="de"?"Monat":"month"}`, min:300, max:5000, step:100, val:fuelKm, set:setFuelKm, disp:fuelKm },
            { label:"€/Liter", min:1.0, max:2.8, step:0.05, val:fuelPrc, set:setFuelPrc, disp:fuelPrc.toFixed(2) },
          ].map(s=>(
            <div key={s.label}>
              <div style={sliderLabel}>{s.label}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.val} onChange={e=>s.set(+e.target.value)} style={{ flex:1, accentColor:C.blue }} />
                <span style={{ fontWeight:800, color:C.ink, minWidth:34, textAlign:"right" }}>{s.disp}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {[
            { label:lang==="de"?"Monat":"Month", val:fuelMonth },
            { label:lang==="de"?"Jahr":"Year",   val:fuelYear  },
            { label:"5 "+( lang==="de"?"Jahre":"Years"), val:fuel5yr },
          ].map(({label,val})=>(
            <div key={label} style={{ background:C.glass, borderRadius:14, padding:"14px 10px", textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{label}</div>
              <div style={{ fontWeight:800, fontSize:20, color:C.blue }}>€{fmt(val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Kosovo Versicherung ───────────────────────────────────────────── */}
      <div id="t4" style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
          <span style={{ fontSize:32 }}>🛡️</span>
          <div>
            <div style={toolTitle}>{lang==="de"?"Kosovo-Versicherung":lang==="sq"?"Sigurimi në Kosovë":lang==="sr"?"Osiguranje na Kosovu":"Kosovo Insurance"}</div>
            <div style={toolSub}>{lang==="de"?"Grobe Schätzung der Jahresprämie":lang==="sq"?"Vlerësim i primit vjetor":lang==="sr"?"Gruba procjena godišnje premije":"Rough annual premium estimate"}</div>
          </div>
        </div>

        <div style={{ marginBottom:18 }}>
          <div style={sliderLabel}>{lang==="de"?"Fahrzeugwert":lang==="sq"?"Vlera e veturës":lang==="sr"?"Vrijednost vozila":"Vehicle value"} (€)</div>
          <div style={sliderRow}>
            <input type="range" min={1000} max={80000} step={500} value={insVal} onChange={e=>setInsVal(+e.target.value)} style={{ flex:1, accentColor:C.blue }} />
            <span style={{ fontWeight:800, color:C.ink, minWidth:80 }}>€{fmt(insVal)}</span>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ background:C.glass, borderRadius:14, padding:"16px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{lang==="de"?"Monatlich":lang==="sq"?"Mujore":"Monthly"}</div>
            <div style={{ fontWeight:800, fontSize:26, color:C.blue }}>€{insMonth}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>~{(insRate*100).toFixed(1)}% {lang==="de"?"des Wertes/Jahr":"of value/yr"}</div>
          </div>
          <div style={{ background:C.glass, borderRadius:14, padding:"16px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{lang==="de"?"Jährlich":lang==="sq"?"Vjetore":"Yearly"}</div>
            <div style={{ fontWeight:800, fontSize:26, color:C.blue }}>€{fmt(insYear)}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>{lang==="de"?"Schätzung Kosovo":"Kosovo estimate"}</div>
          </div>
        </div>
        <div style={{ fontSize:11, color:C.muted, marginTop:12 }}>⚠️ {lang==="de"?"Schätzwert. Exakte Prämie beim Versicherungsanbieter anfragen.":lang==="sq"?"Vlerësim. Çmimin exact pyesni kompaninë e sigurimit.":"Estimate only — get exact quotes from insurers."}</div>
      </div>

      {/* ── 5. Währungsrechner ───────────────────────────────────────────────── */}
      <div id="t5" style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
          <span style={{ fontSize:32 }}>💱</span>
          <div>
            <div style={toolTitle}>{lang==="de"?"Währungsrechner":lang==="sq"?"Konvertuesi i valutave":lang==="sr"?"Kalkulator valuta":"Currency converter"}</div>
            <div style={toolSub}>EUR · CHF · ALL · USD · GBP · MKD · BAM · RSD</div>
          </div>
        </div>
        <div style={{ fontSize:11, color: liveRates ? "#a8843c" : C.muted, fontWeight:700, marginBottom:16 }}>
          {ratesLoading ? "⏳ " + (lang==="de"?"Lade Live-Kurse…":lang==="sq"?"Duke ngarkuar kurset…":"Loading live rates…")
            : liveRates ? "🟢 " + (lang==="de"?"Live-Kurs":"Kurs live") + " · " + ratesDate
            : "⚠️ " + (lang==="de"?"Offline-Richtwerte":"Offline fallback rates")}
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
          <input type="number" value={cAmt} onChange={e=>setCamt(Math.max(0,+e.target.value))}
            style={{ flex:"1 1 120px", background:C.glass, border:`1px solid ${C.line}`, borderRadius:10, padding:"11px 14px", color:C.ink, fontFamily:"inherit", fontSize:18, fontWeight:700 }} />
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {Object.keys(rates).map(cur=>(
              <button key={cur} onClick={()=>setCfrom(cur)} style={{ padding:"9px 13px", borderRadius:9, border:"none", background:cFrom===cur?C.blue:C.glass, color:cFrom===cur?C.navy:C.muted, fontWeight:700, fontSize:13, cursor:"pointer" }}>{cur}</button>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {Object.entries(cResult).filter(([cur])=>cur!==cFrom).map(([cur,val])=>(
            <div key={cur} style={{ background:C.glass, borderRadius:12, padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14, fontWeight:700, color:C.muted }}>{cur}</span>
              <span style={{ fontSize:20, fontWeight:800, color:C.ink }}>{fmt(val)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6. Finanzierungsrechner ─────────────────────────────────────────── */}
      <div id="t6" style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
          <span style={{ fontSize:32 }}>🏦</span>
          <div>
            <div style={toolTitle}>{lang==="de"?"Finanzierungsrechner":lang==="sq"?"Llogaritja e kredisë":lang==="sr"?"Kalkulator kredita":"Loan calculator"}</div>
            <div style={toolSub}>{lang==="de"?"Monatliche Rate für deinen Autokredit":lang==="sq"?"Këstet mujore për kredinë e veturës":lang==="sr"?"Mesečna rata za auto kredit":"Monthly installment for your car loan"}</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          <div>
            <div style={sliderLabel}>{lang==="de"?"Kreditbetrag":lang==="sq"?"Shuma e kredisë":lang==="sr"?"Iznos kredita":"Loan amount"} (€)</div>
            <div style={sliderRow}>
              <input type="range" min={500} max={40000} step={250} value={finAmount} onChange={e=>setFinAmount(+e.target.value)} style={{ flex:1, accentColor:C.blue }} />
              <span style={{ fontWeight:800, color:C.ink, minWidth:70, textAlign:"right" }}>€{fmt(finAmount)}</span>
            </div>
          </div>
          <div>
            <div style={sliderLabel}>{lang==="de"?"Anzahlung":lang==="sq"?"Pagesa fillestare":lang==="sr"?"Učešće":"Down payment"} (€)</div>
            <div style={sliderRow}>
              <input type="range" min={0} max={Math.max(0, finAmount)} step={250} value={Math.min(finDown, finAmount)} onChange={e=>setFinDown(+e.target.value)} style={{ flex:1, accentColor:C.blue }} />
              <span style={{ fontWeight:800, color:C.ink, minWidth:70, textAlign:"right" }}>€{fmt(finDown)}</span>
            </div>
          </div>
          <div>
            <div style={sliderLabel}>{lang==="de"?"Zinssatz":lang==="sq"?"Norma e interesit":lang==="sr"?"Kamatna stopa":"Interest rate"} (%/{lang==="de"?"Jahr":"yr"})</div>
            <div style={sliderRow}>
              <input type="range" min={0} max={20} step={0.5} value={finRate} onChange={e=>setFinRate(+e.target.value)} style={{ flex:1, accentColor:C.blue }} />
              <span style={{ fontWeight:800, color:C.ink, minWidth:50, textAlign:"right" }}>{finRate.toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <div style={sliderLabel}>{lang==="de"?"Laufzeit":lang==="sq"?"Afati":lang==="sr"?"Period":"Term"} ({lang==="de"?"Monate":lang==="sq"?"muaj":lang==="sr"?"meseci":"months"})</div>
            <div style={sliderRow}>
              <input type="range" min={6} max={84} step={6} value={finTerm} onChange={e=>setFinTerm(+e.target.value)} style={{ flex:1, accentColor:C.blue }} />
              <span style={{ fontWeight:800, color:C.ink, minWidth:50, textAlign:"right" }}>{finTerm}</span>
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          <div style={{ background:C.glass, borderRadius:14, padding:"14px 10px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{lang==="de"?"Monatsrate":lang==="sq"?"Kësti mujor":lang==="sr"?"Mesečna rata":"Monthly"}</div>
            <div style={{ fontWeight:800, fontSize:20, color:C.blue }}>€{fmt(Math.round(finPay))}</div>
          </div>
          <div style={{ background:C.glass, borderRadius:14, padding:"14px 10px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{lang==="de"?"Gesamtkosten":lang==="sq"?"Kostoja totale":lang==="sr"?"Ukupan trošak":"Total cost"}</div>
            <div style={{ fontWeight:800, fontSize:20, color:C.ink }}>€{fmt(Math.round(finTotal + finDown))}</div>
          </div>
          <div style={{ background:C.glass, borderRadius:14, padding:"14px 10px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:5 }}>{lang==="de"?"Zinsen gesamt":lang==="sq"?"Interesi total":lang==="sr"?"Ukupna kamata":"Total interest"}</div>
            <div style={{ fontWeight:800, fontSize:20, color:"#d8a657" }}>€{fmt(Math.round(finInterest))}</div>
          </div>
        </div>
        <div style={{ fontSize:11, color:C.muted, marginTop:12 }}>⚠️ {lang==="de"?"Schätzung. Tatsächliche Konditionen hängen von der Bank ab.":lang==="sq"?"Vlerësim. Kushtet aktuale varen nga banka.":lang==="sr"?"Procena. Stvarni uslovi zavise od banke.":"Estimate only. Actual terms depend on the bank."}</div>
      </div>

      {/* ── 7. Dokumenten-Checkliste ─────────────────────────────────────────── */}
      <div id="t7" style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
          <span style={{ fontSize:32 }}>📋</span>
          <div>
            <div style={toolTitle}>{lang==="de"?"Dokumenten-Checkliste":lang==="sq"?"Lista e dokumenteve":lang==="sr"?"Lista dokumenata":"Document checklist"}</div>
            <div style={toolSub}>{lang==="de"?"Was du für die Zollanmeldung brauchst":lang==="sq"?"Çka të duhet për zhdoganim":lang==="sr"?"Šta vam je potrebno za carinjenje":"What you need for customs clearance"}</div>
          </div>
        </div>

        <div style={{ background:C.glass, borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.muted }}>{lang==="de"?"Fortschritt":lang==="sq"?"Progresi":lang==="sr"?"Napredak":"Progress"}</span>
          <span style={{ fontSize:15, fontWeight:800, color: docDoneCount === docItems.length ? "#a8843c" : C.blue }}>{docDoneCount} / {docItems.length}</span>
        </div>

        {docItems.map((it) => (
          <label key={it.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"8px 0", borderTop:`1px solid ${C.line}`, cursor:"pointer" }}>
            <input type="checkbox" checked={!!docChecklist[it.id]} onChange={() => toggleDoc(it.id)} style={{ marginTop:3, width:16, height:16, accentColor:C.blue, flexShrink:0 }} />
            <span style={{ fontSize:13, color: docChecklist[it.id] ? C.muted : C.ink, textDecoration: docChecklist[it.id] ? "line-through" : "none" }}>{lang==="de"?it.de:lang==="sq"?it.sq:lang==="sr"?it.sr:it.en}</span>
          </label>
        ))}
        <div style={{ fontSize:11, color:C.muted, marginTop:12 }}>ℹ️ {lang==="de"?"Allgemeine Orientierung. Je nach Fall können weitere Dokumente nötig sein — Auskunft bei der Dogana e Kosovës.":lang==="sq"?"Orientim i përgjithshëm. Në varësi të rastit mund të kërkohen dokumente shtesë — kontaktoni Doganën e Kosovës.":lang==="sr"?"Opšta orijentacija. U zavisnosti od slučaja mogu biti potrebni dodatni dokumenti — informacije u Carini Kosova.":"General guidance only. Additional documents may be required depending on your case — check with Dogana e Kosovës."}</div>
      </div>

    </div>
  );
}


// ─── MAIN APP ────────────────────────────────────────────────────────────────

function ResultsDonut({ segments, total }) {
  const R = 48, cx = 60, cy = 60;
  const circ = 2 * Math.PI * R;
  const GAP = 2.5;
  let px = 0;
  const arcs = segments.map((s) => {
    const len = Math.max(0, (s.val / total) * circ - GAP);
    const arc = { ...s, len, off: circ / 4 - px };
    px += (s.val / total) * circ;
    return arc;
  }).filter(a => a.len > 1);
  return (
    <svg width={120} height={120} viewBox="0 0 120 120" style={{ display: "block", flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={13} />
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={R} fill="none"
          stroke={a.color} strokeWidth={13}
          strokeDasharray={`${a.len} ${circ}`}
          strokeDashoffset={a.off}
          style={{ transition: "stroke-dasharray .5s ease" }}
        />
      ))}
    </svg>
  );
}


// ── PIN Gate ─────────────────────────────────────────────────────────────────
const _K = [51,53,54,57]; // obfuscated PIN digits (3569)
const _PK = "ura_unlocked_v1";

function PinGate({ children }) {
  const PIN = _K.map(c => String.fromCharCode(c)).join("");
  const [unlocked, setUnlocked] = React.useState(() => {
    try { return localStorage.getItem(PIN + _PK) === "1"; }
    catch { return false; }
  });
  const [val, setVal] = React.useState("");
  const [err, setErr] = React.useState(false);
  const [shake, setShake] = React.useState(false);

  if (unlocked) return children;

  const attempt = () => {
    if (val.trim() === PIN) {
      try { localStorage.setItem(PIN + _PK, "1"); } catch {}
      setUnlocked(true);
    } else {
      setErr(true);
      setShake(true);
      setVal("");
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setErr(false), 2000);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0e17", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @keyframes pgShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        @keyframes pgFade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .pg-box { animation: pgFade .5s cubic-bezier(.22,1,.36,1) both; }
        .pg-shake { animation: pgShake .45s cubic-bezier(.22,1,.36,1); }
        .pg-input:focus { outline: none; border-color: #c9a65a !important; box-shadow: 0 0 0 3px rgba(201,166,90,.15); }
      `}</style>
      <div className={"pg-box" + (shake ? " pg-shake" : "")} style={{
        background: "linear-gradient(160deg, #141926, #0d1118)",
        border: "1px solid rgba(244,239,230,0.12)", borderRadius: 24,
        padding: "40px 36px", maxWidth: 360, width: "100%", textAlign: "center",
        boxShadow: "0 8px 40px -8px rgba(0,0,0,.7)"
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 15, margin: "0 auto 20px",
          background: "linear-gradient(145deg, #e6c878, #c9a65a 55%, #a8843c)",
          display: "grid", placeItems: "center",
          boxShadow: "0 6px 18px -4px rgba(201,166,90,.5)",
          fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 26, color: "#0a0e17"
        }}>U</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#f4efe6", marginBottom: 6 }}>URA</div>
        <div style={{ fontSize: 12.5, color: "#9395a0", fontWeight: 500, marginBottom: 28 }}>
          Privater Bereich — PIN eingeben
        </div>
        <input
          className="pg-input"
          type="password"
          inputMode="numeric"
          maxLength={8}
          placeholder="••••"
          value={val}
          onChange={e => { setVal(e.target.value); setErr(false); }}
          onKeyDown={e => e.key === "Enter" && attempt()}
          style={{
            width: "100%", padding: "13px 16px", borderRadius: 13,
            border: `1.5px solid ${err ? "#e0736b" : "rgba(244,239,230,0.15)"}`,
            background: "rgba(255,255,255,0.04)", color: "#f4efe6",
            fontSize: 20, fontWeight: 600, textAlign: "center",
            fontFamily: "inherit", boxSizing: "border-box",
            letterSpacing: 6, marginBottom: 12,
            transition: "border-color .15s, box-shadow .15s"
          }}
          autoFocus
        />
        {err && (
          <div style={{ fontSize: 12, color: "#e0736b", fontWeight: 600, marginBottom: 10 }}>
            Falscher PIN — bitte nochmal versuchen
          </div>
        )}
        <button onClick={attempt} style={{
          width: "100%", padding: "13px", borderRadius: 13, border: "none",
          background: "#c9a65a", color: "#0a0e17", fontSize: 14, fontWeight: 800,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 4px 14px -4px rgba(201,166,90,.5)",
          transition: "opacity .15s"
        }}>
          Entsperren
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const liveRates = useLiveCurrencyRates();
  const [lang, setLang] = useState("sq");
  const t = T[lang];
  const [tab, setTab] = useState("calc");
  const [showOnboard, setShowOnboard] = useState(false);

  // Check first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem("ura_visited")) {
        setShowOnboard(true);
        localStorage.setItem("ura_visited", "1");
      }
    } catch {}
  }, []);

  // In-App-Banner bei Gesetzesänderungen — Ersatz für echte Push-Notifications (kein Backend nötig).
  // Vergleicht TAX_CONFIG.stand mit dem zuletzt gesehenen Stand im Browser; zeigt Banner nur bei Änderung.
  const [showLawBanner, setShowLawBanner] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem("ura_law_stand");
      if (seen && seen !== TAX_CONFIG.stand) setShowLawBanner(true);
      else if (!seen) localStorage.setItem("ura_law_stand", TAX_CONFIG.stand);
    } catch {}
  }, []);
  const dismissLawBanner = () => {
    setShowLawBanner(false);
    try { localStorage.setItem("ura_law_stand", TAX_CONFIG.stand); } catch {}
  };

  // PWA: Service Worker registrieren
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/ura-import/sw.js").catch(() => {});
    }
  }, []);

  // PWA: Install-Prompt abfangen
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowInstall(false);
  };

  const [ident, setIdent] = useState("");
  const [recMsg, setRecMsg] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [category, setCategory] = useState("car");
  const [make, setMake] = useState("Volkswagen");
  const [model, setModel] = useState("Golf 7 2.0 TDI");
  const [price, setPrice] = useState(8000);
  const [transport, setTransport] = useState(650);
  const [transportTouched, setTransportTouched] = useState(false);
  const [insurance, setInsurance] = useState(0);
  const [engine, setEngine] = useState(1968);
  const [year, setYear] = useState(2018);
  const [origin, setOrigin] = useState("DE");
  const [destCountry, setDestCountry] = useState("XK");
  const [fuel, setFuel] = useState("diesel");
  const [euro, setEuro] = useState(6);
  const [hs, setHs] = useState("8703 32");
  const [isNew, setIsNew] = useState(false);
  const [hasEur1, setHasEur1] = useState(false);
  const [isReturner, setIsReturner] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [leadModal,    setLeadModal]    = useState(null);
  const [savedCalcs, setSavedCalcs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ura_saved_calcs") || "[]"); } catch { return []; }
  });
  const [showSaved, setShowSaved] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [docChecks, setDocChecks] = useState({});

  // Validation errors
  const [errors, setErrors] = useState({});

  useEffect(() => { if (!transportTouched) setTransport(transportByOrigin[origin]); }, [origin, transportTouched]);

  // URL state: load from hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const s = decodeState(hash);
      if (s) {
        if (s.p) setPrice(s.p);
        if (s.t) setTransport(s.t);
        if (s.y) setYear(s.y);
        if (s.cc) setEngine(s.cc);
        if (s.o) setOrigin(s.o);
        if (s.f) setFuel(s.f);
        if (s.e) setEuro(s.e);
        if (s.cat) setCategory(s.cat);
      }
    }
  }, []);

  // Update URL hash on key changes
  useEffect(() => {
    const encoded = encodeState({ price, transport, year, engine, origin, fuel, euro, category });
    if (encoded) window.history.replaceState(null, "", "#" + encoded);
  }, [price, transport, year, engine, origin, fuel, euro, category]);

  // Input validation
  const validate = useCallback((field, val) => {
    const errs = { ...errors };
    if (field === "year") { if (val < 1980 || val > NOW_YEAR) errs.year = t.yearError; else delete errs.year; }
    if (field === "price") { if (val < 100 || val > 500000) errs.price = t.priceError; else delete errs.price; }
    if (field === "engine") { if (val < 50 || val > 10000) errs.engine = t.ccError; else delete errs.engine; }
    setErrors(errs);
  }, [errors, t]);

  const cap = (s) => s ? s.charAt(0) + s.slice(1).toLowerCase() : s;
  const applyVehicle = (v) => {
    setMake(v.make); setModel(v.model); setCategory(v.category); setEngine(v.cc);
    setFuel(v.fuel); setEuro(v.euro); setYear(v.year);
    setHs(v.hs || (v.category === "van" ? "8704" : "8703 32"));
    setRecMsg({ ok: true });
  };

  const recognize = async (raw) => {
    const key = (typeof raw === "string" ? raw : ident).toUpperCase().replace(/[^A-Z0-9]/g, "");

    // 1. Demo-Fahrzeuge (sofort, kein API)
    let v = DEMO_VEHICLES[key];
    if (!v && key) v = Object.entries(DEMO_VEHICLES).find(([k]) => key.includes(k) || k.includes(key))?.[1];
    if (v) { applyVehicle(v); setRecMsg({ ok: true, detected: { make: true, model: true, year: true, engine: true, fuel: true } }); return; }

    if (key.length !== 17) { setRecMsg({ ok: false }); return; }

    setRecLoading(true); setRecMsg(null);

    // 2. Lokale WMI-Erkennung (sofort, offline)
    const local = decodeVinLocal(key);
    if (local?.make) {
      setMake(local.make);
      if (local.year) setYear(local.year);
      if (local.euro) setEuro(local.euro);
    }

    // 3. NHTSA API für vollständige Daten
    try {
      const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${key}?format=json`);
      const d = (await r.json())?.Results?.[0] || {};
      if (d.Make || d.Model) {
        if (d.Make) setMake(cap(d.Make));
        if (d.Model) setModel(d.Model);
        if (d.ModelYear) setYear(+d.ModelYear);
        if (d.DisplacementCC) setEngine(Math.round(+d.DisplacementCC));
        const f = (d.FuelTypePrimary || "").toLowerCase();
        if (f.includes("diesel")) setFuel("diesel");
        else if (f.includes("electric")) setFuel("ev");
        else if (f.includes("hybrid")) setFuel("hybrid");
        else if (f.includes("gas") || f.includes("petrol")) setFuel("petrol");
        const bc = (d.BodyClass || "").toLowerCase();
        if (bc.includes("van") || bc.includes("cargo")) setCategory("van");
        else if (bc.includes("truck")) setCategory("truck");
        else if (bc.includes("motorcycle")) setCategory("moto");
        else setCategory("car");
        // Euro-Norm aus Baujahr wenn NHTSA nichts liefert
        const y = d.ModelYear ? +d.ModelYear : local?.year;
        if (y) setEuro(y >= 2021 ? 6 : y >= 2015 ? 6 : y >= 2011 ? 5 : y >= 2006 ? 4 : y >= 2001 ? 3 : 2);
        setRecMsg({ ok: true, detected: {
          make: !!(d.Make), model: !!(d.Model), year: !!(d.ModelYear),
          engine: !!(d.DisplacementCC && +d.DisplacementCC > 0), fuel: !!(d.FuelTypePrimary)
        }});
      } else if (local?.make) {
        setRecMsg({ ok: true, partial: true, detected: { make: true, model: false, year: !!(local?.year), engine: false, fuel: false } });
      } else {
        setRecMsg({ ok: false });
      }
    } catch {
      if (local?.make) setRecMsg({ ok: true, partial: true, detected: { make: true, model: false, year: !!(local?.year), engine: false, fuel: false } });
      else setRecMsg({ ok: false, net: true });
    }
    setRecLoading(false);
  };

  const ageYears = Math.max(0, NOW_YEAR - year);
  const ageLimit = TAX_CONFIG.ageLimitByCategory[category];
  const ageLimitApplies = TAX_CONFIG.ageLimitAppliesTo[category];
  // Furgon/kamion/motoçikletë nuk preken nga Neni 44 (vetëm "vetura") — shfaq shënim informativ, jo bllokim.
  const ageUnverified = destCountry === "XK" && !ageLimitApplies;
  const legal = useMemo(() => {
    const p = [];
    if (destCountry === "AL") {
      if (ageYears > ALBANIA_TAX_CONFIG.maxAgeYears) p.push(t.ageBad(ageYears, ALBANIA_TAX_CONFIG.maxAgeYears));
      if (euro < ALBANIA_TAX_CONFIG.minEuro) p.push(t.euroBad(euro, ALBANIA_TAX_CONFIG.minEuro));
    } else if (destCountry === "MK") {
      // Asnjë kufizim moshe/normash i konfirmuar zyrtarisht ende — shih panelin informues
    } else if (ageLimitApplies) {
      if (ageYears > ageLimit) p.push(t.ageBad(ageYears, ageLimit));
      if (euro < TAX_CONFIG.minEuro) p.push(t.euroBad(euro, TAX_CONFIG.minEuro));
    }
    return p;
  }, [ageYears, euro, lang, ageLimit, ageLimitApplies, destCountry]);

  const catalogValue = useMemo(() => {
    if (isNew || engine <= 0 || destCountry === "AL" || destCountry === "MK") return null;
    return computeCatalogValue({ cc: engine, ageYears });
  }, [engine, ageYears, isNew, destCountry]);

  const calc = useMemo(() => computeImportCost({
    destCountry, price, transport, insurance, engine, ageYears, isNew, fuel, hasEur1,
    vatRefundRate: ORIGIN[origin]?.vatRefund || 0, catalogValue, isReturner,
  }), [price, transport, insurance, engine, ageYears, isNew, fuel, hasEur1, catalogValue, origin, destCountry, isReturner]);

  const animatedTotal = useCountUp(calc.arrival);
  const catalogHigher = catalogValue && (catalogValue > price);

  const saveCalc = () => {
    const entry = {
      id: Date.now(),
      make, model, year, price, fuel, destCountry, engine, euro,
      arrival: calc.arrival, customs: calc.customs, excise: calc.excise, vat: calc.vat,
      isReturner, hasEur1,
    };
    setSavedCalcs(prev => {
      const updated = [entry, ...prev].slice(0, 5);
      try { localStorage.setItem("ura_saved_calcs", JSON.stringify(updated)); } catch {}
      return updated;
    });
    setShowSaved(true);
  };
  const deleteSavedCalc = (id) => {
    setSavedCalcs(prev => {
      const updated = prev.filter(c => c.id !== id);
      try { localStorage.setItem("ura_saved_calcs", JSON.stringify(updated)); } catch {}
      return updated;
    });
  };
  const loadSavedCalc = (c) => {
    setMake(c.make); setModel(c.model); setYear(c.year); setPrice(c.price);
    setFuel(c.fuel); setDestCountry(c.destCountry); setEngine(c.engine); setEuro(c.euro);
    setIsReturner(c.isReturner || false); setHasEur1(c.hasEur1 || false);
  };
  const catalogDiff = catalogHigher ? fmt(catalogValue) : null;

  const downloadSummary = () => {
    const html = `<!doctype html><meta charset="utf-8"><title>URA — ${make} ${model}</title>
<style>body{font:14px system-ui;color:#0c1322;max-width:620px;margin:40px auto;padding:0 20px}h1{font-size:22px;font-family:Georgia,serif;color:#0a0e17}h2{font-size:14px;color:#6a7488;font-weight:600;margin-top:-8px}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:9px 0;border-bottom:1px solid #e6eaf1}td:last-child{text-align:right;font-weight:700}.tot{background:linear-gradient(135deg,#c9a65a,#a8843c);color:#0a0e17;padding:14px;border-radius:10px;display:flex;justify-content:space-between;margin-top:16px;font-size:18px;font-weight:800}.refund{background:#e8f8f0;border:1px solid #a8d8b8;border-radius:8px;padding:10px 14px;font-size:12px;color:#1a7a44;margin-top:10px}small{color:#6a7488}</style>
<h1>URA — ${make} ${model}</h1><h2>${ageYears} ${YEAR_WORD[lang]} · Euro ${euro} · ${engine}cc · ${ORIGIN[origin][lang]}</h2>
<small>${t.locked(TAX_CONFIG.stand)}</small>
<table>
<tr><td>${t.catalogBuy}</td><td>€ ${fmt(price)}</td></tr>
<tr><td>${t.cif}</td><td>€ ${fmt(price)}</td></tr>
<tr><td>${t.customs}${hasEur1 ? " (EUR.1 · 0%)" : " (10%)"}</td><td>€ ${fmt(calc.customs)}</td></tr>
<tr><td>${t.excise}</td><td>€ ${fmt(calc.excise)}</td></tr>
<tr><td>${t.vat(fmt(calc.vatBase))}</td><td>€ ${fmt(calc.vat)}</td></tr>
<tr><td>${t.importTaxes}</td><td>€ ${fmt(calc.importTaxes)}</td></tr>
<tr><td>${t.toState}</td><td>€ ${fmt(calc.toState)}</td></tr>
</table>
<div class="tot"><span>${t.arrival}</span><span>€ ${fmt(calc.arrival)}</span></div>
${calc.vatRefund > 50 ? `<div class="refund">💡 ${t.vatRefundDesc(Math.round((ORIGIN[origin]?.vatRefund || 0) * 100), fmt(calc.vatRefund), ORIGIN[origin][lang])}</div>` : ""}
<p><small>${t.disc}<br>${TAX_CONFIG.laws.join(" · ")}</small></p>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a"); a.href = url; a.download = "ura-permbledhje.html"; a.click(); URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setIdent(""); setRecMsg(null); setCategory("car"); setMake(""); setModel(""); setPrice(0);
    setTransport(0); setTransportTouched(true); setInsurance(0); setEngine(0);
    setYear(NOW_YEAR); setOrigin("DE"); setFuel("diesel"); setEuro(4);
    setHs(""); setIsNew(false); setHasEur1(false); setErrors({}); setDestCountry("XK");
  };

  const inputBox = { width: "100%", padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${C.line}`, fontSize: 14.5, fontWeight: 500, color: C.ink, outline: "none", background: "rgba(255,255,255,0.03)", fontFamily: "inherit", boxSizing: "border-box", transition: "border-color .15s, box-shadow .15s" };
  const inputErr = { ...inputBox, borderColor: C.red, boxShadow: "0 0 0 3px rgba(224,115,107,.12)" };
  const lbl = { fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: .4, marginBottom: 6, display: "block" };
  const Select = ({ value, onChange, children, label }) => (
    <div style={{ position: "relative" }}>
      <select aria-label={label} style={{ ...inputBox, appearance: "none", cursor: "pointer" }} value={value} onChange={onChange}>{children}</select>
      <ChevronDown size={16} style={{ position: "absolute", right: 12, top: 14, color: C.muted, pointerEvents: "none" }} />
    </div>
  );

  // ── Responsive CSS ──────────────────────────────────────────────────────────
  const responsiveCSS = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
    @keyframes uraRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    @keyframes uraGlow{0%,100%{opacity:.5}50%{opacity:.9}}
    @keyframes uraPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.015)}}
    .ura-rise { animation: uraRise .5s cubic-bezier(.22,1,.36,1) both; }
    .card {
      background: linear-gradient(160deg, ${C.surface} 0%, ${C.paper} 100%);
      border: 1px solid ${C.line};
      border-radius: 20px;
      box-shadow: 0 8px 32px -8px rgba(0,0,0,.5), 0 1px 0 rgba(255,255,255,.04) inset;
    }
    select:focus, input:focus { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px rgba(201,166,90,.12); }
    button:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 3px; }
    .ura-page {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: ${C.navy};
      min-height: 100vh;
      color: ${C.ink};
      position: relative;
      overflow-x: hidden;
      padding: 24px 16px 56px;
    }
    .ura-outer { max-width: 560px; margin: 0 auto; position: relative; }
    .ura-header-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .ura-logo-box {
      width: 44px; height: 44px; border-radius: 13px;
      background: linear-gradient(145deg, #e6c878, ${C.blue} 55%, ${C.greenDeep});
      display: grid; place-items: center; color: ${C.navy};
      font-family: 'Fraunces', serif; font-weight: 700; font-size: 22px; flex-shrink: 0;
      box-shadow: 0 6px 18px -4px rgba(201,166,90,.5), inset 0 1px 0 rgba(255,255,255,.35);
    }
    .ura-wordmark { font-family: 'Fraunces', serif; font-weight: 700; font-size: 23px; letter-spacing: .3px; line-height: 1; }
    .ura-tagline { font-size: 11.5px; color: ${C.muted}; font-weight: 500; letter-spacing: .2px; margin-top: 3px; }
    .ura-h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: clamp(22px,5vw,32px); line-height: 1.15; margin: 0; letter-spacing: -.4px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-grid .full { grid-column: 1 / -1; }
    .calc-layout { display: block; }
    .mobile-legality { display: block; }
    .desktop-legality { display: none; }
    select option { background: ${C.surface}; color: ${C.ink}; }
    .ura-section-label {
      font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
      color: ${C.muted}; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
    }
    .ura-section-label::after { content: ""; flex: 1; height: 1px; background: ${C.line}; }
    .ura-chip {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; font-weight: 600; color: ${C.muted};
      background: rgba(255,255,255,.04); border: 1px solid ${C.line};
      border-radius: 20px; padding: 4px 10px; letter-spacing: .1px;
    }

    @media (min-width: 640px) {
      .ura-page { padding: 32px 28px 60px; }
      .ura-outer { max-width: 700px; }
      .ura-logo-box { width: 50px; height: 50px; font-size: 25px; border-radius: 15px; }
      .ura-wordmark { font-size: 27px; }
      .ura-tagline { font-size: 12.5px; }
      .ura-tabs button { flex: 1 1 0 !important; font-size: 11.5px !important; }
    }

    @media (max-width: 639px) {
      .ura-tabs button { font-size: 10px !important; padding: 8px 2px !important; gap: 3px !important; }
    }

    @media (max-width: 380px) {
      .ura-tabs button { flex-basis: 47% !important; font-size: 10px !important; }
    }

    @media (min-width: 1024px) {
      .ura-page { padding: 40px 40px 64px; }
      .ura-outer { max-width: 1180px; }
      .ura-header-bar { margin-bottom: 28px; }
      .ura-logo-box { width: 56px; height: 56px; font-size: 28px; border-radius: 17px; }
      .ura-wordmark { font-size: 31px; }
      .calc-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; }
      .calc-left { position: sticky; top: 24px; }
      .mobile-legality { display: none; }
      .desktop-legality { display: block; }
    }

    @media (min-width: 1400px) {
      .ura-outer { max-width: 1320px; }
      .calc-layout { gap: 36px; }
    }

    .card { transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s cubic-bezier(.22,1,.36,1); }
    @media (hover: hover) {
      .card:hover { transform: translateY(-2px); box-shadow: 0 16px 48px -12px rgba(0,0,0,.65), 0 1px 0 rgba(255,255,255,.06) inset; }
    }

    @media print {
      .ura-page { background: #fff !important; padding: 10px !important; }
      [data-print-hide] { display: none !important; }
      .card { box-shadow: none !important; border: 1px solid #ddd !important; }
      .ura-outer { max-width: 100% !important; }
    }

    /* ── 2026 utilities ── */
    .ura-gradient-text {
      background: linear-gradient(120deg, #e6c878 0%, #c9a65a 40%, #f0d898 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .ura-dot-grid {
      background-image: radial-gradient(circle, rgba(244,239,230,0.06) 1px, transparent 1px);
      background-size: 28px 28px;
    }
    .card::before {
      content: ""; display: block; position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(201,166,90,0.35), transparent);
      border-radius: 20px 20px 0 0;
    }
    .card { position: relative; }
    @keyframes uraGlowPulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }

  `;

  const rows = [
    { label: t.cif, val: price, icon: <Car size={15} />, strong: true },
    { label: t.customs, val: calc.customs, hint: hasEur1 ? "0% · EUR.1" : "10% · Kaufpreis" },
    { label: t.excise, val: calc.excise, hint: fuel === "ev" ? t.evExciseNote : t.exciseNote, flag: true },
    { label: t.vat(fmt(calc.vatBase)), val: calc.vat },
  ];
  const SEG_COLORS = ["#f0d898","#e6c878","#c9a65a","#b8924a","#a8843c","#8a6a2e"];
  const costSegments = [
    { val: price, color: SEG_COLORS[0] },
    { val: (transport||0)+(insurance||0), color: SEG_COLORS[1] },
    { val: calc.customs, color: SEG_COLORS[2] },
    { val: calc.excise, color: SEG_COLORS[3] },
    { val: calc.vat, color: SEG_COLORS[4] },
    { val: calc.reg, color: SEG_COLORS[5] },
  ].filter(s => s.val > 0);
  const costRows = [
    { label: t.catalogBuy, val: price, color: SEG_COLORS[0], strong: true },
    { label: lang==="de"?"Transport + Versicherung":lang==="sq"?"Transport + Sigurimi":lang==="sr"?"Transport + Osiguranje":"Transport + Insurance", val: (transport||0)+(insurance||0), color: SEG_COLORS[1] },
    { label: t.customs, val: calc.customs, color: SEG_COLORS[2], hint: destCountry === "AL" ? "0% · CIF" : destCountry === "MK" ? (hasEur1 ? "1% · EUR.1" : "5% · CIF") : (hasEur1?"0% · EUR.1":"10% · Kaufpreis") },
    { label: destCountry === "MK" ? t.mkExcise : t.excise, val: calc.excise, color: SEG_COLORS[3], hint: destCountry === "MK" ? (fuel==="ev"?t.mkExciseEvNote:t.mkExciseNote) : (fuel==="ev"?t.evExciseNote:t.exciseNote), flag: true },
    { label: t.vat(fmt(calc.vatBase)), val: calc.vat, color: SEG_COLORS[4] },
    { label: lang==="de"?"Anmeldung":lang==="sq"?"Regjistrimi":lang==="sr"?"Registracija":"Registration", val: calc.reg, color: SEG_COLORS[5] },
  ].filter(r => r.val > 0);

  const tabs = [
    { id: "wizard",  label: lang==="de"?"Startseite":lang==="en"?"Home":lang==="sq"?"Kryefaqja":"Početna", icon: <Home size={15} /> },
    { id: "calc",    label: t.tabCalc,                                                                   icon: <Calculator size={15} /> },
    { id: "compare", label: lang==="de"?"Vergleich":lang==="en"?"Compare":lang==="sq"?"Krahaso":"Poredi",icon: <GitCompare size={15} /> },
    { id: "tools",   label: lang==="de"?"Werkzeuge":lang==="en"?"Tools":lang==="sq"?"Mjete":"Alati",     icon: <Wrench size={15} /> },
    { id: "docs",    label: t.tabDocs,                                                                   icon: <ClipboardList size={15} /> },
    { id: "info",    label: lang==="de"?"Info":"Info",                                                   icon: <Gavel size={15} /> },
    { id: "partner", label: lang==="de"?"Partner":lang==="en"?"Partners":lang==="sq"?"Partnerë":"Partneri", icon: <Building2 size={15} /> },
  ];
  const docDone = DOCS.filter((d) => docChecks[d.id]).length;

  // ── Reusable blocks ─────────────────────────────────────────────────────────
  const LegalityBlock = () => legal.length > 0 ? (
    <div role="alert" style={{ background: C.redSoft, border: `1px solid rgba(224,115,107,.4)`, borderRadius: 16, padding: "13px 15px", marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <AlertTriangle size={18} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 800, color: C.red, fontSize: 13.5, marginBottom: 3 }}>{t.notAllowed}</div>
          {legal.map((p, i) => <div key={i} style={{ fontSize: 12.5, color: C.red, fontWeight: 600, lineHeight: 1.45 }}>{p}</div>)}
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid rgba(224,115,107,.2)`, fontSize: 12.5, color: C.muted, fontWeight: 600 }}>
        💡 {t.ageSuggest}
        <a href="https://www.autoscout24.de" target="_blank" rel="noreferrer" style={{ color: C.blue, textDecoration: "none", fontWeight: 700 }}>AutoScout24 <ExternalLink size={11} style={{ verticalAlign: "middle" }} /></a>
      </div>
    </div>
  ) : (
    <div style={{ background: C.blueSoft, border: `1px solid rgba(201,166,90,.35)`, borderRadius: 16, padding: "11px 15px", marginBottom: 14, display: "flex", gap: 9, alignItems: "center" }}>
      <CheckCircle2 size={17} color={C.greenDeep} />
      <span style={{ fontSize: 13, fontWeight: 700, color: C.greenDeep }}>{t.meets(ageYears, euro)}</span>
    </div>
  );

  const ResultsBlock = () => (<>
    {ageUnverified && (
      <div style={{ background: C.amberSoft, border: `1px solid #f0d9a8`, borderRadius: 14, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 9, alignItems: "flex-start" }}>
        <AlertTriangle size={15} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: C.amber, fontWeight: 700, lineHeight: 1.45 }}>{t.catUnverified}</span>
      </div>
    )}
    {isReturner && destCountry === "XK" && (
      <div style={{ marginBottom: 14, background: "rgba(34,197,94,0.08)", border: "1.5px solid rgba(34,197,94,0.3)", borderRadius: 14, padding: "12px 15px" }}>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🏠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#a8843c", marginBottom: 4 }}>
              {lang==="de"?"Rückkehrer-Zollbefreiung aktiv":lang==="sq"?"Lirim doganor për kthyes aktiv":lang==="sr"?"Oslobođenje od carine za povratnike aktivno":"Returnee customs exemption active"}
            </div>
            <div style={{ fontSize: 11.5, color: "#a8843c", fontWeight: 600, lineHeight: 1.55, opacity: 0.85 }}>
              {lang==="de"?"Art. 39 ZGB-Kosovo: Personen die min. 2 Jahre im Ausland lebten dürfen 1 Fahrzeug zollfrei einführen. Bedingungen: mind. 2 Jahre Auslandsaufenthalt, kein Wiederverkauf für 2 Jahre, nur 1 Fahrzeug/Person, Nachweis bei der Dogana e Kosovës erforderlich."
              :lang==="sq"?"Neni 39 KDK: Personat që kanë jetuar min. 2 vjet jashtë vendit mund të importojnë 1 automjet pa doganë. Kushte: min. 2 vjet jashtë, pa rishitje për 2 vjet, vetëm 1 automjet/person, dëshmi e nevojshme te Dogana e Kosovës."
              :lang==="sr"?"Čl. 39 ZCK: Lica koja su živela min. 2 godine u inostranstvu mogu uvesti 1 vozilo bez carine. Uslovi: min. 2 god. u inostranstvu, bez preprodaje 2 god., samo 1 vozilo/osobi, dokaz potreban pri Carini Kosova."
              :"Art. 39 Kosovo Customs Law: Persons who lived abroad for min. 2 years may import 1 vehicle duty-free. Conditions: min. 2 years abroad, no resale for 2 years, 1 vehicle per person, proof required at Dogana e Kosovës."}
            </div>
          </div>
        </div>
      </div>
    )}
    {origin === "KR" && !isNew && destCountry === "XK" && (
      <div style={{ marginBottom: 14, background: "rgba(201,166,90,0.08)", border: "1.5px solid rgba(201,166,90,0.25)", borderRadius: 14, padding: "11px 15px", display: "flex", gap: 9, alignItems: "flex-start" }}>
        <Info size={15} color={C.blue} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: C.blue, fontWeight: 700, lineHeight: 1.5 }}>
          🇰🇷 {lang === "de" ? "Kosovo Dogana bewertet koreanische Fahrzeuge zum Kaufpreis — kein Katalogwert." : lang === "sq" ? "Dogana e Kosovës vlerëson vetura koreane sipas çmimit të blerjes — pa vlerë katalogu." : lang === "sr" ? "Kosovska carina vrednuje korejska vozila po kupovnoj ceni — bez kataloške vrednosti." : "Kosovo Customs values Korean cars at purchase price — no catalog valuation applied."}
        </span>
      </div>
    )}
    {!isNew && catalogValue && origin !== "KR" && (
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => setShowCatalog(s => !s)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: catalogHigher ? "rgba(216,166,87,0.14)" : C.glass, border: `1px solid ${catalogHigher ? "rgba(216,166,87,.5)" : C.line}`, borderRadius: 14, padding: "12px 15px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: catalogHigher ? C.amber : C.muted }}>
          <Info size={15} color={catalogHigher ? C.amber : C.muted} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: "left" }}>{catalogHigher ? t.catalogHigher(catalogDiff) : t.catalogLower}</span>
          <ChevronDown size={14} style={{ transform: showCatalog ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
        </button>
        {showCatalog && (
          <div className="card" style={{ padding: "14px 16px", marginTop: 8, borderRadius: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, lineHeight: 1.6, marginBottom: 10 }}>{t.catalogWarning}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: C.muted }}>{t.catalogBuy}</span><span>€ {fmt(price)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: catalogHigher ? C.amber : C.muted }}>{t.catalogVal}</span>
                <span style={{ color: catalogHigher ? C.amber : C.ink }}>€ {fmt(catalogValue)}</span>
              </div>
              {catalogHigher && calc.catalogArrival && (<>
                <div style={{ height: 1, background: C.line, margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: C.amber }}>{t.arrival} (katalog ~)</span>
                  <span style={{ color: C.amber }}>€ {fmt(calc.catalogArrival)}</span>
                </div>
              </>)}
            </div>
          </div>
        )}
      </div>
    )}
    <div className="card ura-rise" style={{ padding: 0, overflow: "hidden", marginBottom: 14, animationDelay: ".24s" }}>
      {/* Header: donut + animated total */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 20px 14px", flexWrap: "wrap" }}>
        {calc.arrival > 0 && <ResultsDonut segments={costSegments} total={calc.arrival} />}
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>{t.arrival}</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(28px,4vw,38px)", color: C.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>€ {fmt(animatedTotal)}</div>
          {destCountry !== "XK" && (
            <div style={{ fontSize: 12.5, color: C.blue, fontWeight: 700, marginTop: 4 }}>{t.currencyApprox(fmtLocal(calc.arrival, destCountry, liveRates))}</div>
          )}
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginTop: 8 }}>{t.over(fmt(calc.arrival - price - calc.reg), fmt(calc.reg))}</div>
        </div>
      </div>
      {/* Divider */}
      <div style={{ height: 1, background: C.line, margin: "0 20px" }} />
      {/* Enhanced cost rows */}
      <div style={{ padding: "10px 20px 14px" }}>
        {costRows.map((r, i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: i < costRows.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: r.color, flexShrink: 0, marginRight: 10 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: r.strong ? 700 : 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums", minWidth: 72, textAlign: "right", flexShrink: 0 }}>€ {fmt(r.val)}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: r.color, minWidth: 34, textAlign: "right", opacity: 0.85, flexShrink: 0 }}>{calc.arrival > 0 ? Math.round(r.val / calc.arrival * 100) : 0}%</span>
            </div>
            {r.hint && <div style={{ marginTop: 5, marginLeft: 19 }}><span style={{ fontSize: 10.5, color: r.flag ? (fuel==="ev"?C.greenDeep:C.amber) : C.muted, fontWeight: 700, background: r.flag ? (fuel==="ev"?C.blueSoft:C.amberSoft) : C.paper, padding: "2px 7px", borderRadius: 8, display: "inline-block" }}>{r.hint}</span></div>}
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0 2px", borderTop: `1px solid ${C.line}`, marginTop: 2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.muted }}>{t.importTaxes}</span>
          <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: C.muted }}>€ {fmt(calc.importTaxes)}</span>
        </div>
        {/* Proportion bar */}
        {calc.arrival > 0 && (
          <div style={{ height: 6, borderRadius: 4, overflow: "hidden", display: "flex", margin: "8px 0 2px", gap: 1 }}>
            {costSegments.map((s, i) => (
              <div key={i} style={{ flex: s.val / calc.arrival, background: s.color, opacity: 0.75, minWidth: s.val/calc.arrival > 0.01 ? 3 : 0 }} />
            ))}
          </div>
        )}
      </div>
      {/* Total gradient footer */}
      <div style={{ background: `linear-gradient(135deg,#e6c878,${C.blue} 60%,${C.greenDeep})`, color: C.navy, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, opacity: .7, letterSpacing: 1, textTransform: "uppercase" }}>{t.arrival}</div>
          <div style={{ fontSize: 12, opacity: .75, fontWeight: 700, marginTop: 3 }}>{t.over(fmt(calc.arrival - price - calc.reg), fmt(calc.reg))}</div>
        </div>
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(26px,3.5vw,36px)", fontVariantNumeric: "tabular-nums" }}>€ {fmt(animatedTotal)}</div>
      </div>
    </div>
    {calc.vatRefund > 50 && (
      <div style={{ background: "rgba(168,132,60,0.12)", border: `1px solid rgba(168,132,60,0.35)`, borderRadius: 16, padding: "13px 15px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ fontSize: 20, flexShrink: 0 }}>💡</div>
        <div>
          <div style={{ fontWeight: 800, color: C.blue, fontSize: 13, marginBottom: 3 }}>{t.vatRefundTitle}: ~€ {fmt(calc.vatRefund)}</div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, lineHeight: 1.5 }}>{t.vatRefundDesc(Math.round((ORIGIN[origin]?.vatRefund || 0) * 100), fmt(calc.vatRefund), ORIGIN[origin][lang])}</div>
        </div>
      </div>
    )}
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: C.blueSoft, display: "grid", placeItems: "center", flexShrink: 0 }}><Landmark size={18} color={C.blue} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{t.toState}</div>
        <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>{t.toStateSub}</div>
      </div>
      <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 20, color: C.blue, fontVariantNumeric: "tabular-nums" }}>€ {fmt(calc.toState)}</div>
    </div>
    <SavingsTips t={t} calc={calc} hasEur1={hasEur1} ageYears={ageYears} engine={engine} fuel={fuel} C={C} />
    {fuel === "ev" && destCountry === "XK" && (
      <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 24 }}>⚡</span>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#a8843c" }}>
            {lang==="de"?"Elektrofahrzeug — Steuervorteile":lang==="sq"?"Automjet elektrik — Avantazhe tatimore":lang==="sr"?"Električno vozilo — Poreske prednosti":"Electric vehicle — Tax benefits"}
          </div>
        </div>
        {(() => {
          const dieselExcise = computeExcise({ cc: engine || 1968, ageYears, isNewUnregistered: isNew, fuel: "diesel" });
          const saved = dieselExcise;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(34,197,94,0.1)", borderRadius: 10, padding: "8px 12px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#a8843c" }}>
                  {lang==="de"?"✅ Akzise-Befreiung (0%)":lang==="sq"?"✅ Liri nga akciza (0%)":lang==="sr"?"✅ Oslobođenje od akcize (0%)":"✅ Excise exemption (0%)"}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#a8843c" }}>€ 0</span>
              </div>
              {saved > 0 && (
                <div style={{ fontSize: 12, color: "#a8843c", fontWeight: 700, padding: "0 4px" }}>
                  💡 {lang==="de"?`Ersparnis vs. Diesel (${engine||1968}cc, ${ageYears}J.): ca. € ${fmt(Math.round(saved))}`:lang==="sq"?`Kursim vs. naftë (${engine||1968}cc, ${ageYears}v.): ~€ ${fmt(Math.round(saved))}`:lang==="sr"?`Ušteda vs. dizel (${engine||1968}cc, ${ageYears}g.): ~€ ${fmt(Math.round(saved))}`:`Savings vs. diesel (${engine||1968}cc, ${ageYears}yr): ~€ ${fmt(Math.round(saved))}`}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: "#16a34a", fontWeight: 600, lineHeight: 1.5, borderTop: "1px solid rgba(34,197,94,0.2)", paddingTop: 8, marginTop: 2 }}>
                {lang==="de"?"⚠️ Elektrofahrzeuge müssen TÜV-geprüft sein und das Ladekabel mitgeliefert werden. Batterie-Gesundheit (State of Health) prüfen lassen vor dem Kauf."
                :lang==="sq"?"⚠️ Automjetet elektrike duhet të kenë kontroll teknik (TÜV) dhe kabllon e karikimit. Kontrolloni gjendjen e baterisë (State of Health) para blerjes."
                :lang==="sr"?"⚠️ Električna vozila moraju imati tehnički pregled (TÜV) i kabl za punjenje. Proverite zdravlje baterije (State of Health) pre kupovine."
                :"⚠️ Electric vehicles must have a technical inspection (TÜV) and charging cable. Check battery health (State of Health) before purchase."}
              </div>
            </div>
          );
        })()}
      </div>
    )}
    <MarketCheckLinks t={t} make={make} model={model} year={year} C={C} />
    <SharePanel t={t} make={make} model={model} year={year} arrival={calc.arrival} price={price} lang={lang} />
    {savedCalcs.length > 0 && (
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => setShowSaved(s => !s)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: C.glass, border: `1px solid ${C.line}`, borderRadius: 14, padding: "11px 15px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: C.ink }}>
          💾 {lang==="de"?`Gespeicherte Berechnungen (${savedCalcs.length})`:lang==="sq"?`Llogaritjet e ruajtura (${savedCalcs.length})`:lang==="sr"?`Sačuvane kalkulacije (${savedCalcs.length})`:`Saved calculations (${savedCalcs.length})`}
          <ChevronDown size={15} style={{ marginLeft: "auto", transform: showSaved ? "rotate(180deg)" : "none", transition: "transform .2s", color: C.muted }} />
        </button>
        {showSaved && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {savedCalcs.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.glass, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px" }}>
                <button onClick={() => loadSavedCalc(c)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", padding: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{c.make} {c.model} · {c.year}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>€ {fmt(Math.round(c.arrival))} {c.isReturner ? "🏠" : ""}{c.hasEur1 ? " EUR.1" : ""} · {c.fuel.toUpperCase()}</div>
                </button>
                <button onClick={() => deleteSavedCalc(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16, padding: "0 4px", lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      <button onClick={() => { trackEvent("export_pdf", { make, model, year }); document.title = `URA — ${make||"Auto"} ${model} ${year}`; window.print(); }} style={{ flex: "1 1 120px", background: "linear-gradient(135deg,#e6c878,#c9a65a)", color: "#0a0e17", border: "none", borderRadius: 13, padding: "13px", fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 4px 14px -4px rgba(201,166,90,.45)" }}>
        <FileText size={15} /> {lang==="de"?"Als PDF speichern":lang==="sq"?"Ruaj si PDF":lang==="sr"?"Sačuvaj kao PDF":"Save as PDF"}
      </button>
      <button onClick={downloadSummary} style={{ flex: "1 1 100px", background: C.glass, border: `1.5px solid ${C.line}`, borderRadius: 13, padding: "13px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, color: C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <Download size={15} color={C.blue} /> {t.download}
      </button>
      <button onClick={saveCalc} title={lang==="de"?"Berechnung speichern":lang==="sq"?"Ruaj llogaritjen":lang==="sr"?"Sačuvaj kalkulaciju":"Save"} style={{ background: C.glass, border: `1.5px solid ${C.line}`, borderRadius: 13, padding: "13px 15px", fontFamily: "inherit", fontWeight: 700, fontSize: 14, color: C.blue, cursor: "pointer", display: "flex", alignItems: "center" }}>💾</button>
      <SendToPartnerButton lang={lang} C={C}
        payload={{ make, model, year, category, price, transport, insurance, engine, euro, fuel, origin, destCountry, hasEur1, isReturner,
          result: { arrival: calc.arrival, customs: calc.customs, excise: calc.excise, vat: calc.vat, toState: calc.toState },
          lawStand: TAX_CONFIG.stand }} />
      <button onClick={resetAll} style={{ background: C.glass, border: `1.5px solid ${C.line}`, borderRadius: 13, padding: "13px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
        <RotateCcw size={14} color={C.muted} /> {t.reset}
      </button>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 9, background: C.glass, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 15px", marginBottom: 12 }}>
      <Lock size={15} color={C.muted} style={{ flexShrink: 0 }} />
      <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, lineHeight: 1.45 }}>{t.locked(TAX_CONFIG.stand)}</div>
    </div>
    <button onClick={() => setShowMethod(s => !s)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: C.glass, border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: C.ink }}>
      <ScrollText size={16} color={C.blue} /> {t.methodology}
      <ChevronDown size={16} style={{ marginLeft: "auto", transform: showMethod ? "rotate(180deg)" : "none", transition: "transform .2s", color: C.muted }} />
    </button>
    {showMethod && (
      <div className="card" style={{ padding: 18, marginTop: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 600, lineHeight: 1.6 }}>
          {TAX_CONFIG.laws.map((l, i) => <div key={i}>• {l}</div>)}
        </div>
        <div style={{ height: 1, background: C.line, margin: "14px 0" }} />
        <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 8 }}>{t.official}</div>
        <a href={TAX_CONFIG.officialSources.tarik} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: C.blue, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
          <Building2 size={14} /> {TAX_CONFIG.officialSources.label} <ExternalLink size={12} />
        </a>
        <div style={{ marginTop: 14, background: C.amberSoft, color: C.amber, borderRadius: 12, padding: "11px 13px", fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{t.disc}</div>
      </div>
    )}
    <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, letterSpacing: .4, textTransform: "uppercase", margin: "22px 0 10px" }}>{t.soon}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
      {[<ShieldCheck size={14} />, <FileText size={14} />, <Truck size={14} />].map((ic, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: C.glass, border: `1.5px dashed ${C.line}`, color: C.muted, fontSize: 12.5, fontWeight: 700, padding: "9px 13px", borderRadius: 22 }}>{ic} {t.chips[i]}</span>
      ))}
    </div>
    <button disabled={legal.length > 0} style={{ marginTop: 16, width: "100%", background: legal.length ? C.line : `linear-gradient(135deg,#e6c878,${C.blue})`, color: legal.length ? C.muted : C.navy, border: "none", borderRadius: 15, padding: "16px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 15, cursor: legal.length ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: legal.length ? "none" : "0 12px 28px -10px rgba(201,166,90,.6)", letterSpacing: .2 }}>
      {t.contact} <ArrowRight size={17} />
    </button>
  </>);

  return (
    <PinGate>
    <div lang={lang} className="ura-page ura-dot-grid">
      <style>{responsiveCSS}</style>
      {showOnboard && <OnboardOverlay t={t} onClose={() => setShowOnboard(false)} />}
      {showInstall && (
        <div style={{ position: "fixed", bottom: 80, left: 12, right: 12, zIndex: 999, background: "linear-gradient(135deg,#1a2236,#141926)", border: `1.5px solid ${C.blue}`, borderRadius: 18, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,.6)" }}>
          <div className="ura-logo-box" style={{ width: 38, height: 38, fontSize: 18, flexShrink: 0 }}>U</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{lang==="de"?"App installieren":lang==="sq"?"Instalo aplikacionin":lang==="sr"?"Instaliraj aplikaciju":"Install App"}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{lang==="de"?"Zum Startbildschirm hinzufügen — kein App Store nötig":lang==="sq"?"Shto në ekranin kryesor — pa App Store":lang==="sr"?"Dodaj na početni ekran":"Add to home screen — no App Store needed"}</div>
          </div>
          <button onClick={handleInstall} style={{ background: C.blue, color: C.navy, border: "none", borderRadius: 10, padding: "9px 14px", fontFamily: "inherit", fontWeight: 800, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>{lang==="de"?"Installieren":lang==="sq"?"Instalo":"Install"}</button>
          <button onClick={() => setShowInstall(false)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: "4px 6px", lineHeight: 1 }}>✕</button>
        </div>
      )}
      {showLawBanner && (
        <div style={{ position: "fixed", top: 12, left: 12, right: 12, zIndex: 999, background: "linear-gradient(135deg,#2a2210,#1f1a0c)", border: `1.5px solid ${C.amber}`, borderRadius: 18, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,.6)" }}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>⚖️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{lang==="de"?"Rechtliche Angaben aktualisiert":lang==="sq"?"Të dhënat ligjore u përditësuan":lang==="sr"?"Pravni podaci ažurirani":"Legal information updated"}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{lang==="de"?`Stand: ${TAX_CONFIG.stand} — bitte prüfe deine letzte Berechnung erneut.`:lang==="sq"?`Përditësuar: ${TAX_CONFIG.stand} — kontrollo përsëri llogaritjen tënde të fundit.`:lang==="sr"?`Ažurirano: ${TAX_CONFIG.stand} — provjerite ponovo svoju posljednju kalkulaciju.`:`Updated: ${TAX_CONFIG.stand} — please re-check your last calculation.`}</div>
          </div>
          <button onClick={dismissLawBanner} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: "4px 6px", lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
      )}
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "70vw", height: "45vh", maxWidth: 800, background: "radial-gradient(ellipse,rgba(201,166,90,.13) 0%,transparent 70%)", pointerEvents: "none", animation: "uraGlowPulse 8s ease-in-out infinite", zIndex: 0 }} />
      <div style={{ position: "fixed", top: "30vh", left: "10%", width: "30vw", height: "30vh", background: "radial-gradient(ellipse,rgba(99,102,241,.06) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: "20vh", right: "8%", width: "25vw", height: "25vh", background: "radial-gradient(ellipse,rgba(201,166,90,.07) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div className="ura-outer">

        <header className="ura-header-bar ura-rise">
          <div className="ura-logo-box">U</div>
          <div>
            <div className="ura-wordmark">URA</div>
            <div className="ura-tagline">{t.tagline}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 3, background: C.glass, border: `1px solid ${C.line}`, borderRadius: 11, padding: 3 }}>
            {["sq", "sr", "en", "de", "tr"].map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-label={`Language ${l}`} style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 11.5, padding: "6px 9px", borderRadius: 8, background: lang === l ? C.blue : "transparent", color: lang === l ? C.navy : C.muted, transition: "all .2s" }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </header>

        <div className="ura-rise ura-tabs" style={{ display: "flex", flexWrap: "wrap", gap: 4, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}`, borderRadius: 16, padding: "4px", marginBottom: 22, animationDelay: ".05s" }}>
          {tabs.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: "1 1 30%", minWidth: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: tab === tb.id ? 700 : 500, fontSize: 11, padding: "9px 4px", borderRadius: 12, background: tab === tb.id ? C.blue : "transparent", color: tab === tb.id ? C.navy : C.muted, transition: "all .2s cubic-bezier(.22,1,.36,1)", boxShadow: tab === tb.id ? "0 4px 12px -4px rgba(201,166,90,.5)" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".1px" }}>{tb.icon} {tb.label}</button>
          ))}
        </div>

        {tab === "wizard" && (
          <div>
            {/* ── Hero ── */}
            <div style={{ background: "linear-gradient(135deg,rgba(201,166,90,.09) 0%,rgba(20,25,38,0) 60%)", border: `1px solid rgba(201,166,90,0.2)`, borderRadius: 22, padding: "26px 22px 20px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(201,166,90,.5),transparent)" }} />
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(201,166,90,0.12)", border: "1px solid rgba(201,166,90,0.2)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2 }}>
                  <Car size={22} color="#c9a65a" />
                </div>
                <div>
                  <div className="ura-gradient-text" style={{ fontFamily: "'Fraunces',serif", fontWeight: 800, fontSize: 22, lineHeight: 1.15 }}>
                    {lang==="de"?"Was kostet dein Auto wirklich bis Kosovo?":lang==="sq"?"Sa kushton vërtet vetura deri në Kosovë?":lang==="sr"?"Koliko zaista košta auto do Kosova?":"What does your car really cost to Kosovo?"}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginTop: 5, letterSpacing: ".1px" }}>
                    {lang==="de"?"Zoll · Akzise · MwSt. · Transport — alles in 30 Sekunden":lang==="sq"?"Dogana · Akciza · TVSH · Transport — gjithçka brenda 30 sekondave":lang==="sr"?"Carina · Akciza · PDV · Transport — sve za 30 sekundi":"Customs · Excise · VAT · Transport — everything in 30 seconds"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { icon: "✓", text: lang==="de"?"Kostenlos":lang==="sq"?"Falas":lang==="sr"?"Besplatno":"Free" },
                  { icon: "✓", text: lang==="de"?"Kein Login":lang==="sq"?"Pa regjistrim":lang==="sr"?"Bez registracije":"No sign-up" },
                  { icon: "✓", text: "XK · AL · MK" },
                  { icon: "✓", text: lang==="de"?"Offizielle Akzise-Tabelle":lang==="sq"?"Tabelë zyrtare akcize":lang==="sr"?"Zvanična tabela akcize":"Official excise table" },
                ].map((b, i) => (
                  <span key={i} className="ura-chip">{b.icon} {b.text}</span>
                ))}
              </div>
              <button onClick={() => setTab("calc")} style={{ marginTop: 16, width: "100%", background: "linear-gradient(135deg,#e6c878,#c9a65a 50%,#b8963e)", color: C.navy, border: "none", borderRadius: 13, padding: "13px", fontFamily: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px -4px rgba(201,166,90,.5)", transition: "opacity .15s, transform .15s", letterSpacing: ".2px" }}>
                <Calculator size={16} /> {lang==="de"?"Profi-Rechner öffnen":lang==="sq"?"Hap kalkulatorin profesional":lang==="sr"?"Otvori profesionalni kalkulator":"Open advanced calculator"}
              </button>
            </div>
            <WizardMode t={t} lang={lang} C={C} fmt={fmt} />
          </div>
        )}

        {tab === "compare" && (
          <VergleichMode t={t} lang={lang} C={C} fmt={fmt}
            calc={calc} price={price} make={make} model={model}
            year={year} ageYears={ageYears} destCountry={destCountry} hasEur1={hasEur1} />
        )}

        {tab === "tools" && (
          <ToolsMode lang={lang} C={C} fmt={fmt} />
        )}

        {tab === "info" && (
          <InfoPage t={t} lang={lang} C={C} />
        )}

        {tab === "calc" && (
          <div className="calc-layout">
            <div className="calc-left">
              <h1 className="ura-h1">{t.h1a} <span style={{ color: C.blue }}>{t.h1b}</span> {t.h1c}</h1>
              <p style={{ color: C.muted, fontSize: 14, margin: "8px 0 18px", fontWeight: 500, lineHeight: 1.55 }}>{t.sub}</p>
              <div className="ura-rise" style={{ marginBottom: 14, animationDelay: ".08s" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{t.popularModels}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {POPULAR_MODELS.map((m) => (
                    <button key={m.label} onClick={() => applyVehicle(m)}
                      style={{ background: C.glass, border: `1px solid ${C.line}`, borderRadius: 20, padding: "7px 13px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: C.muted, cursor: "pointer", transition: "all .2s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blue; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.muted; }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card ura-rise" style={{ padding: 18, marginBottom: 14, animationDelay: ".12s" }}>
                <label style={lbl}>{t.identify}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ ...inputBox, flex: 1, fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase" }}
                    value={ident}
                    placeholder="WVWZZZ... / GOLF7TDI"
                    maxLength={17}
                    onChange={(e) => { setIdent(e.target.value.toUpperCase()); setRecMsg(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") recognize(); }}
                  />
                  <button onClick={() => recognize()} disabled={recLoading} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: recLoading ? C.muted : C.blue, color: C.navy, border: "none", borderRadius: 12, padding: "0 16px", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, cursor: recLoading ? "wait" : "pointer", whiteSpace: "nowrap" }}><ScanLine size={16} /> {recLoading ? t.recLoad : t.recognize}</button>
                </div>

                {/* ── VIN Struktur-Visualizer ── */}
                {ident.replace(/[^A-Z0-9]/g,"").length === 17 && (() => {
                  const v = ident.replace(/[^A-Z0-9]/g,"").toUpperCase();
                  const local = decodeVinLocal(v);
                  const checkOk = local?.checkOk;
                  const hasInvalid = /[IOQ]/.test(v);
                  const segments = [
                    { chars: v.slice(0,3),  color: "#e6c878", label: lang==="de"?"Hersteller (WMI)":lang==="sq"?"Prodhuesi (WMI)":lang==="sr"?"Proizvođač (WMI)":"Manufacturer (WMI)", tip: local?.make || "?" },
                    { chars: v.slice(3,9),  color: "#c9a65a", label: lang==="de"?"Fahrzeugmerkmale (VDS)":lang==="sq"?"Karakteristikat (VDS)":lang==="sr"?"Karakteristike (VDS)":"Vehicle Descriptor (VDS)", tip: lang==="de"?"Modell, Motor, Karosserie":lang==="sq"?"Model, motor, karrocerinë":lang==="sr"?"Model, motor, karoserija":"Model, engine, body" },
                    { chars: v.slice(9,10), color: "#a8843c", label: lang==="de"?"Modelljahr":lang==="sq"?"Viti":lang==="sr"?"Godište":"Model Year", tip: local?.year ? String(local.year) : "?" },
                    { chars: v.slice(10,11),color: "#8a6a2e", label: lang==="de"?"Werk":lang==="sq"?"Fabrika":lang==="sr"?"Fabrika":"Plant", tip: local?.plant || "?" },
                    { chars: v.slice(11,17),color: "#9395a0", label: lang==="de"?"Seriennummer":lang==="sq"?"Numri serial":lang==="sr"?"Serijski broj":"Serial No.", tip: "" },
                  ];
                  return (
                    <div style={{ marginTop: 12, background: "#0a0e1780", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 1, marginBottom: 8, fontFamily: "monospace", fontSize: 13, fontWeight: 800 }}>
                        {segments.map((seg, si) => seg.chars.split("").map((ch, ci) => (
                          <span key={`${si}-${ci}`} style={{ background: seg.color + "25", color: seg.color, border: `1px solid ${seg.color}50`, borderRadius: 4, width: 20, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{ch}</span>
                        )))}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        {segments.map((seg, si) => (
                          <div key={si} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, display: "inline-block" }} />
                            <span style={{ fontSize: 10, color: seg.color, fontWeight: 700 }}>{seg.label}{seg.tip ? `: ${seg.tip}` : ""}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: checkOk ? "#a8843c" : "#e0736b", background: checkOk ? "#a8843c15" : "#e0736b15", borderRadius: 8, padding: "3px 8px" }}>
                          {checkOk ? (lang==="de"?"✅ Prüfziffer OK":lang==="sq"?"✅ Shifra kontrolluese OK":lang==="sr"?"✅ Kontrolna cifra OK":"✅ Check digit OK") : (lang==="de"?"⚠️ Prüfziffer ungültig":lang==="sq"?"⚠️ Shifra kontrolluese gabim":lang==="sr"?"⚠️ Kontrolna cifra neispravna":"⚠️ Check digit invalid")}
                        </span>
                        {hasInvalid && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#e0736b", background: "#e0736b15", borderRadius: 8, padding: "3px 8px" }}>
                            {lang==="de"?"⚠️ I/O/Q verboten in VIN":lang==="sq"?"⚠️ I/O/Q nuk lejohen në VIN":lang==="sr"?"⚠️ I/O/Q zabranjeni u VIN":"⚠️ I/O/Q not allowed in VIN"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 8, color: recMsg ? (recMsg.ok ? C.greenDeep : C.red) : C.muted }}>
                  {recLoading ? t.recLoad : recMsg ? (recMsg.ok ? (recMsg.partial ? (lang==="de"?"⚡ Hersteller erkannt":lang==="sq"?"⚡ Prodhuesi u njoh":lang==="sr"?"⚡ Proizvođač prepoznat":"⚡ Make recognized") : t.recOk) : recMsg.net ? t.recNet : t.recNo) : t.recHint}
                </div>
                {recMsg?.ok && recMsg?.detected && (
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {[
                      { key: "make",   label: lang==="de"?"Hersteller":lang==="sq"?"Prodhuesi":lang==="sr"?"Marka":"Make" },
                      { key: "model",  label: lang==="de"?"Modell":lang==="sq"?"Modeli":lang==="sr"?"Model":"Model" },
                      { key: "year",   label: lang==="de"?"Baujahr":lang==="sq"?"Viti":lang==="sr"?"Godište":"Year" },
                      { key: "engine", label: lang==="de"?"Hubraum (ccm)":lang==="sq"?"Cilindrata (ccm)":lang==="sr"?"Zapremina (ccm)":"Engine (cc)" },
                      { key: "fuel",   label: lang==="de"?"Kraftstoff":lang==="sq"?"Karburanti":lang==="sr"?"Gorivo":"Fuel" },
                    ].map(({ key, label }) => {
                      const hit = recMsg.detected[key];
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 7, background: hit ? `${C.greenDeep}15` : `${C.red}12`, border: `1px solid ${hit ? C.greenDeep : C.red}40`, borderRadius: 9, padding: "7px 10px" }}>
                          <span style={{ fontSize: 14 }}>{hit ? "✅" : "✏️"}</span>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>{label}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: hit ? C.greenDeep : C.amber }}>
                              {hit ? (lang==="de"?"Erkannt":lang==="sq"?"Njohur":lang==="sr"?"Prepoznato":"Detected") : (lang==="de"?"Bitte eingeben":lang==="sq"?"Shto manualisht":lang==="sr"?"Unesite ručno":"Enter manually")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {["SANDERO","TUCSON","SPORTAGE","GOLF7TDI","P308","BMW320D","EV6","IONIQ5","OCTAVIA","CAPTUR","TESLA3"].map((k) => (
                    <button key={k} onClick={() => { setIdent(k); recognize(k); }} style={{ background: C.glass, border: `1px solid ${C.blue}`, borderRadius: 20, padding: "6px 12px", fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: C.blue, cursor: "pointer", letterSpacing: .5 }}>{k}</button>
                  ))}
                </div>

                {/* ── HSN-TSN Info ── */}
                <details style={{ marginTop: 12 }}>
                  <summary style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, cursor: "pointer", userSelect: "none" }}>
                    ℹ️ {lang==="de"?"Was ist HSN-TSN / Typenschein?":lang==="sq"?"Çfarë është HSN-TSN / Typenschein?":lang==="sr"?"Šta je HSN-TSN / Typenschein?":"What is HSN-TSN / Type Certificate?"}
                  </summary>
                  <div style={{ marginTop: 8, fontSize: 11.5, color: C.muted, lineHeight: 1.6, background: C.glass, borderRadius: 10, padding: "10px 12px" }}>
                    {lang==="de" ? <>
                      <b style={{ color: C.ink }}>HSN</b> = Herstellerschlüsselnummer (4-stellig) · <b style={{ color: C.ink }}>TSN</b> = Typschlüsselnummer (3-stellig)<br/>
                      Beispiel im Fahrzeugschein (Feld 2.1 + 2.2): <code style={{ background:"#ffffff10", padding:"1px 5px", borderRadius:4 }}>0005 ABB</code><br/>
                      Die FIN (Fahrzeug-Identifizierungsnummer) = VIN, 17 Zeichen, steht im Fahrzeugbrief unter Feld E.<br/>
                      <span style={{ color: C.amber }}>⚠️ Für die Einfuhr nach Kosovo/AL/MK benötigst du den <b>Zulassungsbescheinigung Teil II</b> (Fahrzeugbrief) im Original.</span>
                    </> : lang==="sq" ? <>
                      <b style={{ color: C.ink }}>HSN</b> = kodi i prodhuesit (4 shifra) · <b style={{ color: C.ink }}>TSN</b> = kodi i tipit (3 shifra) — nga letrat gjermane të veturës<br/>
                      FIN (Fahrzeug-Identifizierungsnummer) = VIN, 17 karaktere, ndodhet në fushën E të librezës<br/>
                      <span style={{ color: C.amber }}>⚠️ Për import duhet origjinali i <b>Zulassungsbescheinigung Teil II</b> (libreza e veturës).</span>
                    </> : lang==="sr" ? <>
                      <b style={{ color: C.ink }}>HSN</b> = šifra proizvođača (4 cifre) · <b style={{ color: C.ink }}>TSN</b> = šifra tipa (3 cifre) — iz nemačkih dokumenata vozila<br/>
                      FIN = VIN, 17 znakova, nalazi se u polju E saobraćajne dozvole<br/>
                      <span style={{ color: C.amber }}>⚠️ Za uvoz je potreban original <b>Zulassungsbescheinigung Teil II</b>.</span>
                    </> : <>
                      <b style={{ color: C.ink }}>HSN</b> = Manufacturer key (4 digits) · <b style={{ color: C.ink }}>TSN</b> = Type key (3 digits) — from German vehicle documents<br/>
                      FIN = VIN, 17 characters, found in field E of the vehicle registration certificate<br/>
                      <span style={{ color: C.amber }}>⚠️ For import you need the original <b>Zulassungsbescheinigung Teil II</b> (vehicle title).</span>
                    </>}
                  </div>
                </details>
              </div>
              <div className="card ura-rise" style={{ padding: 18, marginBottom: 16, animationDelay: ".18s" }}>
                {/* ── Basis-Felder (immer sichtbar) ── */}
                <div className="form-grid">
                  <div><label style={lbl}>{t.destCountry}</label><Select label={t.destCountry} value={destCountry} onChange={(e) => { setDestCountry(e.target.value); trackEvent("select_destination", { destination: e.target.value }); }}><option value="XK">{t.destXK}</option><option value="AL">{t.destAL}</option><option value="MK">{t.destMK}</option></Select></div>
                  <div><label style={lbl}>{t.price}</label><input style={errors.price ? inputErr : inputBox} type="number" value={price} onChange={(e) => { const v = +e.target.value; setPrice(v); validate("price", v); }} />{errors.price && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{errors.price}</div>}</div>
                  <div><label style={lbl}>{t.year}</label><input style={errors.year ? inputErr : inputBox} type="number" value={year} onChange={(e) => { const v = +e.target.value; setYear(v); validate("year", v); }} />{errors.year && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{errors.year}</div>}</div>
                  <div><label style={lbl}>{t.engine}</label><input style={errors.engine ? inputErr : inputBox} type="number" value={engine} onChange={(e) => { const v = +e.target.value; setEngine(v); validate("engine", v); }} />{errors.engine && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{errors.engine}</div>}</div>
                  <div><label style={lbl}>{t.fuel}</label><Select label={t.fuel} value={fuel} onChange={(e) => setFuel(e.target.value)}><option value="petrol">{FUEL.petrol[lang]}</option><option value="diesel">{FUEL.diesel[lang]}</option><option value="hybrid">{FUEL.hybrid[lang]}</option><option value="ev">{FUEL.ev[lang]}</option></Select></div>
                  <div><label style={lbl}>{t.transport}</label><input style={inputBox} type="number" value={transport} onChange={(e) => { setTransport(+e.target.value); setTransportTouched(true); }} /></div>
                </div>

                {/* ── Toggles ── */}
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {origin !== "KR" && destCountry !== "AL" && <Toggle on={hasEur1} set={setHasEur1} label={t.fEur1} />}
                  <Toggle on={isNew} set={setIsNew} label={t.fNew} />
                  {destCountry === "XK" && <Toggle on={isReturner} set={(v) => { setIsReturner(v); if (v) setHasEur1(false); }} label={lang==="de"?"🏠 Rückkehrer":lang==="sq"?"🏠 Kthyes":lang==="sr"?"🏠 Povratnik":"🏠 Returnee"} />}
                </div>

                {/* ── Erweitert-Toggle ── */}
                <button onClick={() => setShowAdvanced(s => !s)} style={{ marginTop: 14, width: "100%", background: "none", border: `1px dashed ${C.line}`, borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
                  <ChevronDown size={13} style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                  {showAdvanced
                    ? (lang==="de"?"Weniger Felder":lang==="sq"?"Më pak fusha":lang==="sr"?"Manje polja":"Fewer fields")
                    : (lang==="de"?"Erweitert (Marke, Modell, Herkunft…)":lang==="sq"?"Avancuar (Marka, Modeli, Origjina…)":lang==="sr"?"Napredno (Marka, Model, Poreklo…)":"Advanced (Make, Model, Origin…)")}
                </button>

                {/* ── Erweiterte Felder ── */}
                {showAdvanced && (
                  <div style={{ marginTop: 10 }}>
                    <div className="form-grid">
                      <div><label style={lbl}>{t.make}</label><input style={inputBox} value={make} onChange={(e) => setMake(e.target.value)} /></div>
                      <div><label style={lbl}>{t.model}</label><input style={inputBox} value={model} onChange={(e) => setModel(e.target.value)} /></div>
                      <div><label style={lbl}>{t.category}</label><Select label={t.category} value={category} onChange={(e) => { setCategory(e.target.value); trackEvent("select_category", { category: e.target.value }); }}><option value="car">{t.catCar}</option><option value="van">{t.catVan}</option><option value="truck">{t.catTruck}</option><option value="moto">{t.catMoto}</option></Select></div>
                      <div><label style={lbl}>{t.origin}</label><Select label={t.origin} value={origin} onChange={(e) => { setOrigin(e.target.value); if (e.target.value === "KR") setHasEur1(false); }}>{Object.keys(ORIGIN).map(k => <option key={k} value={k}>{originName(k, lang)}</option>)}</Select></div>
                      <div><label style={lbl}>{t.euro}</label><input style={inputBox} type="number" min={1} max={7} value={euro} onChange={(e) => setEuro(+e.target.value)} /></div>
                      <div><label style={lbl}>{t.insurance}</label><input style={inputBox} type="number" value={insurance} onChange={(e) => setInsurance(+e.target.value)} /></div>
                      <div><label style={lbl}>{t.hs}</label><input style={inputBox} value={hs} onChange={(e) => setHs(e.target.value)} /></div>
                    </div>
                    {origin === "KR" && (
                      <div style={{ marginTop: 8, fontSize: 11.5, color: "#d8a657", fontWeight: 600, background: "#d8a65718", borderRadius: 10, padding: "7px 11px" }}>
                        🇰🇷 {lang === "de" ? "Korea-Import: kein EUR.1 — 10% Zoll gilt" : lang === "sq" ? "Import nga Koreja: pa EUR.1 — zbatohet doganë 10%" : lang === "sr" ? "Uvoz iz Koreje: bez EUR.1 — važi carina 10%" : "Korea import: EUR.1 not applicable — 10% customs applies"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="calc-right">
              {legal.length > 0 && (
                <div style={{ background: `${C.red}18`, border: `1.5px solid ${C.red}`, borderRadius: 16, padding: "14px 18px", marginBottom: 14 }}>
                  {legal.map((w, i) => <div key={i} style={{ color: C.red, fontSize: 13, fontWeight: 700, display: "flex", gap: 8, alignItems: "flex-start" }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{w}</div>)}
                </div>
              )}
              <div className="ura-rise" style={{ background: C.glass, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 16px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", animationDelay: ".1s" }}>
                <CheckCircle2 size={14} style={{ color: C.green, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>{lang==="de" ? `Erfüllt Kriterien · ${ageYears} J. · Euro ${euro}` : lang==="sq" ? `Plotëson kriteret · ${ageYears} vjet · Euro ${euro}` : `Meets criteria · ${ageYears} yrs · Euro ${euro}`}</span>
              </div>
              {destCountry === "AL" && (
                <div style={{ marginBottom: 14, background: "rgba(201,166,90,0.08)", border: "1.5px solid rgba(201,166,90,0.25)", borderRadius: 14, padding: "11px 15px", display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <Info size={15} color="#c9a65a" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "#c9a65a", fontWeight: 700, lineHeight: 1.5 }}>
                    🇦🇱 {t.alInfo}{calc.isLuxury ? " " + t.alLuxuryNote : ""}
                  </span>
                </div>
              )}
              {destCountry === "MK" && (
                <div style={{ marginBottom: 14, background: "rgba(201,166,90,0.08)", border: "1.5px solid rgba(201,166,90,0.25)", borderRadius: 14, padding: "11px 15px", display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <Info size={15} color="#c9a65a" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "#c9a65a", fontWeight: 700, lineHeight: 1.5 }}>
                    🇲🇰 {t.mkInfo}
                  </span>
                </div>
              )}
              {origin === "KR" && !isNew && destCountry === "XK" && (
                <div style={{ marginBottom: 14, background: "rgba(201,166,90,0.08)", border: "1.5px solid rgba(201,166,90,0.25)", borderRadius: 14, padding: "11px 15px", display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <Info size={15} color={C.blue} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: C.blue, fontWeight: 700, lineHeight: 1.5 }}>
                    🇰🇷 {lang === "de" ? "Kosovo Dogana bewertet koreanische Fahrzeuge zum Kaufpreis — kein Katalogwert." : lang === "sq" ? "Dogana e Kosovës vlerëson vetura koreane sipas çmimit të blerjes — pa vlerë katalogu." : lang === "sr" ? "Kosovska carina vrednuje korejska vozila po kupovnoj ceni — bez kataloške vrednosti." : "Kosovo Customs values Korean cars at purchase price — no catalog valuation applied."}
                  </span>
                </div>
              )}
              {catalogHigher && origin !== "KR" && (
                <button onClick={() => setShowCatalog(!showCatalog)} style={{ width: "100%", background: `${C.blue}12`, border: `1.5px solid ${C.blue}44`, borderRadius: 14, padding: "11px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>ℹ️ {t.catalogHigher(fmt(catalogValue))}</span>
                  <ChevronDown size={14} style={{ color: C.blue, transform: showCatalog ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </button>
              )}
              {showCatalog && catalogValue && origin !== "KR" && (
                <div className="ura-rise" style={{ background: C.glass, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{t.catalogWarning}</div>
                  {calc.catalogArrival && <div style={{ marginTop: 10, fontWeight: 700, color: C.ink, fontSize: 14 }}>{t.catalogCost} <span style={{ color: C.blue }}>€{fmt(calc.catalogArrival)}</span></div>}
                </div>
              )}
              <div className="card ura-rise" style={{ marginBottom: 14, animationDelay: ".05s" }}>
                <div style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <Car size={16} style={{ color: C.muted }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>{t.cif}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 15, color: C.ink }}>€ {fmt(price)}</span>
                  </div>
                  {((transport||0)+(insurance||0)) > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <Truck size={16} style={{ color: C.muted }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>
                      {lang==="de"?"Transport + Versicherung":lang==="sq"?"Transport + Sigurimi":lang==="sr"?"Transport + Osiguranje":"Transport + Insurance"}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted, background: C.glass, borderRadius: 6, padding: "2px 8px" }}>
                      {lang==="de"?"0% · nicht besteuert":lang==="sq"?"0% · pa tatim":lang==="sr"?"0% · bez poreza":"0% · not taxed"}
                    </span>
                    <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 15, color: C.ink }}>€ {fmt((transport||0)+(insurance||0))}</span>
                  </div>
                  )}
                  <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.ink, flex: 1 }}>{t.customs}</span>
                      <span style={{ fontSize: 12, color: C.muted, background: C.glass, borderRadius: 6, padding: "2px 8px" }}>{destCountry === "AL" ? "0% · CIF" : destCountry === "MK" ? (hasEur1 ? "1% · EUR.1" : "5% · CIF") : (hasEur1 ? "0% · EUR.1" : "10% · Kaufpreis")}</span>
                      <span style={{ fontWeight: 800, color: C.ink }}>€ {fmt(calc.customs)}</span>
                    </div>
                    {destCountry === "MK" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.ink, flex: 1 }}>{t.mkExcise}</span>
                      <span style={{ fontSize: 11, color: fuel==="ev" ? C.greenDeep : C.amber, background: fuel==="ev" ? C.blueSoft : C.amberSoft, borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>{fuel==="ev" ? t.mkExciseEvNote : t.mkExciseNote}</span>
                      <span style={{ fontWeight: 800, color: C.ink }}>€ {fmt(calc.excise)}</span>
                    </div>
                    )}
                    {destCountry !== "AL" && destCountry !== "MK" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.ink, flex: 1 }}>{t.excise}</span>
                      <span style={{ fontSize: 11, color: C.amber, background: C.amberSoft, borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>{t.exciseNote}</span>
                      <span style={{ fontWeight: 800, color: C.ink }}>€ {fmt(calc.excise)}</span>
                    </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.ink, flex: 1 }}>{typeof t.vat === "function" ? t.vat(fmt(calc.vatBase)) : t.vat}</span>
                      <span style={{ fontWeight: 800, color: C.ink }}>€ {fmt(calc.vat)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
                      <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>{t.importTaxes}</span>
                      <span style={{ fontWeight: 800, color: C.ink }}>€ {fmt(calc.importTaxes)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ background: `linear-gradient(135deg,#1a2236,#0f172a)`, borderRadius: "0 0 22px 22px", padding: "18px 20px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{t.arrival}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>{t.over(fmt(calc.arrival - price - calc.reg), fmt(calc.reg))}</div>
                  <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 46, color: C.blue, letterSpacing: -1 }}>€ {fmt(Math.round(animatedTotal))}</div>
                  {destCountry !== "XK" && (
                    <div style={{ fontSize: 13, color: C.muted, fontWeight: 700, marginTop: 4 }}>{t.currencyApprox(fmtLocal(calc.arrival, destCountry, liveRates))}</div>
                  )}
                </div>
              </div>
              {calc.vatRefund > 0 && (
                <div className="ura-rise" style={{ background: `${C.blue}10`, border: `1.5px solid ${C.blue}44`, borderRadius: 16, padding: "14px 18px", marginBottom: 14, animationDelay: ".15s" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.blue, marginBottom: 4 }}>💡 {t.vatRefundTitle} ~€{fmt(Math.round(calc.vatRefund))}</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>{t.vatRefundDesc(ORIGIN[origin]?.vatRefundPct || 0, fmt(Math.round(calc.vatRefund)), ORIGIN[origin]?.name || "")}</div>
                </div>
              )}
              <button onClick={() => setShowMethod(!showMethod)} style={{ width: "100%", background: "transparent", border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showMethod ? 0 : 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>{t.methodology}</span>
                <ChevronDown size={13} style={{ color: C.muted, transform: showMethod ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
              {showMethod && (
                <div className="ura-rise" style={{ background: C.glass, border: `1px solid ${C.line}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "14px 16px", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>{t.locked(TAX_CONFIG.stand)}</div>
                  <a href={TAX_CONFIG.officialSources.tarik} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, fontWeight: 700, color: C.blue, textDecoration: "none" }}><ExternalLink size={12} /> {TAX_CONFIG.officialSources.label}</a>
                </div>
              )}
              <SharePanel t={t} lang={lang} C={C} price={price} transport={transport} year={year} engine={engine} origin={origin} fuel={fuel} euro={euro} category={category} />
            </div>
          </div>
        )}

        {tab === "partner" && (
          <PartnerPage lang={lang} C={C} make={make} model={model} year={year} price={price} engine={engine} fuel={fuel} destCountry={destCountry} fmt={fmt} onQuote={setLeadModal} />
        )}

        {tab === "docs" && (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{t.docsTitle}</h2>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>{"Dokumentet e nevojshme për procedurën e importit."}</p>
            <div className="card" style={{ padding: "8px 0" }}>
              {DOCS.map((d, i) => {
                const on = !!docChecks[d.id];
                return (
                  <button key={d.id} onClick={() => setDocChecks(c => ({ ...c, [d.id]: !c[d.id] }))} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: i < DOCS.length - 1 ? `1px solid ${C.line}` : "none", padding: "13px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: `1.5px solid ${on ? C.green : C.muted}`, background: on ? C.green : "transparent", color: C.navy, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800 }}>{on ? "✓" : ""}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: on ? C.muted : C.ink, textDecoration: on ? "line-through" : "none" }}>{d[lang]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {leadModal && <LeadModal data={leadModal} onClose={() => setLeadModal(null)} C={C} lang={lang} fmt={fmt} />}
      </div>
    </div>
    </PinGate>
  );
}


// ── FM-International AG Partner Page ────────────────────────────────────────

// ── Partner Page ─────────────────────────────────────────────────────────────
function PartnerPage({ lang, C, make, model, year, price, engine, fuel, destCountry, fmt, onQuote }) {

  const t = {
    de: {
      headline:  "Partner & Dienstleister",
      sub:       "Geprüfte Unternehmen für Transport, Zollabwicklung und Finanzierung.",
      featured:  "Empfohlener Partner",
      transport: "🚚 Transport-Netzwerke",
      tSub:      "Fahrzeugtransport CH / DE / AT → XK / AL / MK — Schweizer Diaspora-Spezialisten",
      sped:      "📋 Spediteure & Zollagenturen",
      sSub:      "Zollabwicklung, HS-Code, EUR.1, Lagerlogistik",
      finance:   "💳 Finanzinstitute",
      fSub:      "KFZ-Kredite und Fahrzeugfinanzierung",
      insurance: "🛡️ Versicherungen",
      iSub:      "KFZ-Haftpflicht & Kasko für importierte Fahrzeuge",
      visit:     "Website",
      quote:     "Anfrage senden",
      become:    "Partner werden",
      becomeD:   "Ihr Unternehmen hier präsentieren",
      demo:      "DEMO",
      note:      "* FM-International AG ist eine fiktive Demo-Firma. Alle anderen Unternehmen sind real. Versicherungspartner sind noch Platzhalter — Slots frei.",
    },
    en: {
      headline:  "Partners & Service Providers",
      sub:       "Verified companies for transport, customs clearance, and financing.",
      featured:  "Featured Partner",
      transport: "🚚 Transport Networks",
      tSub:      "Vehicle transport CH / DE / AT → XK / AL / MK — Swiss diaspora specialists",
      sped:      "📋 Freight Forwarders & Customs Agents",
      sSub:      "Customs clearance, HS code, EUR.1, warehouse logistics",
      finance:   "💳 Financial Institutions",
      fSub:      "Car loans and vehicle financing",
      insurance: "🛡️ Insurance Providers",
      iSub:      "Car liability & comprehensive insurance for imported vehicles",
      visit:     "Website",
      quote:     "Send inquiry",
      become:    "Become a partner",
      becomeD:   "List your company here",
      demo:      "DEMO",
      note:      "* FM-International AG is a fictional demo company. All other companies are real. Insurance partners are still placeholders — slots open.",
    },
    sq: {
      headline:  "Partnerë & Ofrues Shërbimesh",
      sub:       "Kompani të verifikuara për transport, doganë dhe financim.",
      featured:  "Partner i Rekomanduar",
      transport: "🚚 Rrjete Transporti",
      tSub:      "Transport automjetesh CH / DE / AT → XK / AL / MK — Specialistë diasporës zvicerane",
      sped:      "📋 Spedicionerë & Agjenci Doganore",
      sSub:      "Procedura doganore, kodi HS, EUR.1, logjistikë magazinuese",
      finance:   "💳 Institucione Financiare",
      fSub:      "Kredi dhe financim automjeti",
      insurance: "🛡️ Sigurime",
      iSub:      "Sigurim përgjegjësie & kasko për automjete të importuara",
      visit:     "Faqja",
      quote:     "Dërgo kërkesë",
      become:    "Bëhu partner",
      becomeD:   "Prezanto kompaninë tënde këtu",
      demo:      "DEMO",
      note:      "* FM-International AG është kompani fiktive demo. Të gjitha kompanitë e tjera janë reale. Partnerët e sigurimit janë ende vende të lira (placeholder).",
    },
    sr: {
      headline:  "Partneri & Pružaoci Usluga",
      sub:       "Provjerene kompanije za transport, carinjenje i finansiranje.",
      featured:  "Preporučeni Partner",
      transport: "🚚 Transportne Mreže",
      tSub:      "Transport vozila CH / DE / AT → XK / AL / MK — švicarski specijalisti dijaspore",
      sped:      "📋 Špediteri & Carinski Agenti",
      sSub:      "Carinjenje, HS kod, EUR.1, skladišna logistika",
      finance:   "💳 Finansijske Institucije",
      fSub:      "Auto krediti i finansiranje vozila",
      insurance: "🛡️ Osiguranja",
      iSub:      "Auto osiguranje i kasko za uvezena vozila",
      visit:     "Web stranica",
      quote:     "Pošalji upit",
      become:    "Postani partner",
      becomeD:   "Predstavite vašu kompaniju ovdje",
      demo:      "DEMO",
      note:      "* FM-International AG je fiktivna demo kompanija. Sve ostale kompanije su realne. Partneri za osiguranje su jos placeholderi — slotovi slobodni.",
    },
    tr: {
      headline:  "Ortaklar & Hizmet Sağlayıcılar",
      sub:       "Nakliye, gümrükleme ve finansman için doğrulanmış şirketler.",
      featured:  "Önerilen Ortak",
      transport: "🚚 Nakliye Ağları",
      tSub:      "Araç nakliyesi CH / DE / AT → XK / AL / MK — İsviçre diasporası uzmanları",
      sped:      "📋 Nakliyeciler & Gümrük Acenteleri",
      sSub:      "Gümrükleme, HS kodu, EUR.1, depo lojistiği",
      finance:   "💳 Finans Kuruluşları",
      fSub:      "Araç kredisi ve finansmanı",
      insurance: "🛡️ Sigorta Şirketleri",
      iSub:      "İthal araçlar için trafik sigortası & kasko",
      visit:     "Web sitesi",
      quote:     "Talep gönder",
      become:    "Ortak olun",
      becomeD:   "Şirketinizi burada tanıtın",
      demo:      "DEMO",
      note:      "* FM-International AG hayali bir demo şirkettir. Diğer tüm şirketler gerçektir. Sigorta ortakları henüz yer tutucudur — slotlar boş.",
    },
  };
  const L = t[lang] || t.de;

  const carData = { make, model, year, price, engine, fuel, destCountry };

  const TRANSPORT = [
    {
      name:"Gani Transport GmbH",
      hq:"Zürich, Schweiz",
      email:"info@ganitransport.ch",
      url:"https://www.ganitransport.ch",
      tag:{
        de:"CH→XK/AL/MK · Wöchentliche Direktfahrten · Türzustellung",
        en:"CH→XK/AL/MK · weekly direct runs · door-to-door",
        sq:"CH→XK/AL/MK · udhëtime direkte javore · dorëzim derë-më-derë",
        sr:"CH→XK/AL/MK · sedmične direktne vožnje · dostava od vrata do vrata",
      },
      accent:"#c9a65a", init:"GT",
    },
    {
      name:"Abedini Transport",
      hq:"Zürich, Schweiz",
      email:"info@abeldinITransport.ch",
      url:"https://www.abedinItransport.ch",
      tag:{
        de:"CH→XK/AL/MK · Fahrzeugtransport & Umzugsgut · GPS-Tracking",
        en:"CH→XK/AL/MK · vehicle transport & removals · GPS tracking",
        sq:"CH→XK/AL/MK · transport automjetesh & shpërngulje · GPS",
        sr:"CH→XK/AL/MK · transport vozila i selidbe · GPS praćenje",
      },
      accent:"#c9a65a", init:"AB",
    },
    {
      name:"Drita Transport GmbH",
      hq:"Basel, Schweiz",
      email:"info@dritatransport.ch",
      url:"https://www.dritatransport.ch",
      tag:{
        de:"CH→XK/AL · Diaspora-Spezialist · KFZ + Pakete + Möbel",
        en:"CH→XK/AL · diaspora specialist · cars + parcels + furniture",
        sq:"CH→XK/AL · specialist diaspora · vetura + paketa + mobilje",
        sr:"CH→XK/AL · specijalista dijaspore · vozila + paketi + namještaj",
      },
      accent:"#c9a65a", init:"DR",
    },
    {
      name:"Arber Transport AG",
      hq:"Bern, Schweiz",
      email:"info@arbertransport.ch",
      url:"https://www.arbertransport.ch",
      tag:{
        de:"CH→XK/AL/MK · KFZ-Überführung & Vollladung · seit 2005",
        en:"CH→XK/AL/MK · vehicle delivery & full loads · since 2005",
        sq:"CH→XK/AL/MK · dorëzim automjetesh & ngarkesë e plotë · që nga 2005",
        sr:"CH→XK/AL/MK · dostava vozila i puni teret · od 2005.",
      },
      accent:"#c9a65a", init:"AR",
    },
  ];

  const SPEDITION = [
    {
      name:"GEIDA sh.p.k.",
      hq:"Tirana, Shqipëri",
      email:"info@geida.al",
      url:"https://www.geida.al",
      tag:{
        de:"Albanischer Zoll-Spezialist · HS-Code, EUR.1, Importdokumente",
        en:"Albanian customs specialist · HS code, EUR.1, import docs",
        sq:"Specialist doganor shqiptar · kodi HS, EUR.1, dokumenta importi",
        sr:"Albanski carinski specijalista · HS kod, EUR.1, uvozni dokumenti",
      },
      accent:"#c9a65a", init:"GD",
    },
    {
      name:"Albanet Shpedicion",
      hq:"Durrës, Shqipëri",
      email:"info@albanet.al",
      url:"https://www.albanet.al",
      tag:{
        de:"Hafen Durrës · Vollservice Zoll & Lagerlogistik AL",
        en:"Port of Durrës · full-service customs & warehouse AL",
        sq:"Porti Durrës · shërbim i plotë doganor & logjistikë magazinuese AL",
        sr:"Luka Durrës · kompletna carinska usluga i skladišna logistika AL",
      },
      accent:"#c9a65a", init:"AN",
    },
    {
      name:"Euro-Sped Albania",
      hq:"Tirana, Shqipëri",
      email:"info@eurosped.al",
      url:"https://www.eurosped.al",
      tag:{
        de:"Zollabwicklung & Spedition AL/XK/MK · EUR.1-Begleitung",
        en:"Customs & freight AL/XK/MK · EUR.1 support",
        sq:"Dogana & spedicion AL/XK/MK · mbështetje EUR.1",
        sr:"Carina & špedicija AL/XK/MK · podrška EUR.1",
      },
      accent:"#c9a65a", init:"ES",
    },
    {
      name:"Kosovo Spedicion",
      hq:"Prishtinë, Kosovë",
      email:"info@kosovospedicion.com",
      url:"https://www.kosovospedicion.com",
      tag:{
        de:"Lokale Zollagentur XK · alle Grenzübergänge Kosovo",
        en:"Local customs agency XK · all Kosovo border crossings",
        sq:"Agjenci doganore lokale XK · të gjitha pikat kufitare të Kosovës",
        sr:"Lokalna carinska agencija XK · svi granični prelazi Kosova",
      },
      accent:"#c9a65a", init:"KS",
    },
  ];

  const FINANCE = [
    {
      name:"BKT — Banka Kombëtare",
      hq:"Tirana, Shqipëri",
      email:"info@bkt.com.al",
      url:"https://www.bkt.com.al",
      tag:{
        de:"Albaniens größte Bank · KFZ-Kredit & Leasing für Import",
        en:"Albania's largest bank · car loan & leasing for imports",
        sq:"Banka më e madhe e Shqipërisë · kredi & leasing auto për import",
        sr:"Najveca albanska banka · auto kredit & lizing za uvoz",
      },
      accent:"#c9a65a", init:"BKT",
    },
    {
      name:"Credins Bank",
      hq:"Tirana, Shqipëri",
      email:"info@credinsbank.com",
      url:"https://www.credinsbank.com",
      tag:{
        de:"Zweitgrößte albanische Bank · schnelle KFZ-Kreditvergabe",
        en:"2nd largest Albanian bank · fast car loan approval",
        sq:"Banka e dytë më e madhe shqiptare · miratim i shpejtë i kredisë auto",
        sr:"2. najveca albanska banka · brzo odobrenje auto kredita",
      },
      accent:"#c9a65a", init:"CR",
    },
    {
      name:"BPB Bank Kosovo",
      hq:"Prishtinë, Kosovë",
      email:"info@bankbpb.com",
      url:"https://www.bankbpb.com",
      tag:{
        de:"Kosovos größte lokal geführte Bank · KFZ-Finanzierung XK",
        en:"Kosovo's largest locally-run bank · vehicle financing XK",
        sq:"Banka më e madhe me menaxhim lokal në Kosovë · financim automjeti XK",
        sr:"Najveca lokalno vođena banka Kosova · finansiranje vozila XK",
      },
      accent:"#c9a65a", init:"BPB",
    },
    {
      name:"Raiffeisen Bank Albania",
      hq:"Tirana, Shqipëri",
      email:"info@raiffeisen.al",
      url:"https://www.raiffeisen.al",
      tag:{
        de:"Marktführer AL · günstiger Auto-Kredit, schnelle Auszahlung",
        en:"Market leader AL · competitive car loan, fast disbursement",
        sq:"Lider tregu AL · kredi auto konkurruese, disbursim i shpejtë",
        sr:"Lider tržišta AL · povoljni auto kredit, brza isplata",
      },
      accent:"#c9a65a", init:"RB",
    },
  ];

  // PLATZHALTER — Flamur: hier echte Versicherungspartner eintragen (Name, HQ, E-Mail, URL, Tagline je Sprache).
  const INSURANCE = [
    {
      name:"[Platzhalter] Versicherungspartner 1",
      hq:"—",
      email:"partner@ura-import.info",
      url:"#",
      tag:{
        de:"Slot frei · KFZ-Haftpflicht & Kasko für importierte Fahrzeuge",
        en:"Slot open · car liability & comprehensive insurance for imports",
        sq:"Vend i lirë · sigurim përgjegjësie & kasko për automjete të importuara",
        sr:"Slot slobodan · auto osiguranje i kasko za uvezena vozila",
      },
      accent:"#8a93a6", init:"?",
    },
    {
      name:"[Platzhalter] Versicherungspartner 2",
      hq:"—",
      email:"partner@ura-import.info",
      url:"#",
      tag:{
        de:"Slot frei · grenzüberschreitende Versicherung Schweiz/EU → Kosovo",
        en:"Slot open · cross-border insurance Switzerland/EU → Kosovo",
        sq:"Vend i lirë · sigurim ndërkufitar Zvicër/BE → Kosovë",
        sr:"Slot slobodan · prekogranično osiguranje Švajcarska/EU → Kosovo",
      },
      accent:"#8a93a6", init:"?",
    },
  ];

  // ── Category icon helper ────────────────────────────────────────────────
  const CatIcon = ({ cat, accent, size=22 }) => {
    const s = { color: accent };
    if (cat === "transport") return <Truck size={size} style={s} />;
    if (cat === "sped")      return <ClipboardList size={size} style={s} />;
    if (cat === "insurance") return <ShieldCheck size={size} style={s} />;
    return <Landmark size={size} style={s} />;
  };

  // ── Section divider ──────────────────────────────────────────────────────
  const SectionHeader = ({ title, sub, cat }) => {
    const accent = "#c9a65a";
    return (
      <div style={{ display:"flex", alignItems:"center", gap:14, marginTop:40, marginBottom:20 }}>
        <div style={{ width:40, height:40, borderRadius:12, background:`${accent}12`, border:`1.5px solid ${accent}25`, display:"grid", placeItems:"center", flexShrink:0 }}>
          <CatIcon cat={cat} accent={accent} size={18} />
        </div>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.ink, letterSpacing:-.2 }}>{title}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:1 }}>{sub}</div>
        </div>
      </div>
    );
  };

  // ── Company card ─────────────────────────────────────────────────────────
  const CompanyCard = ({ co, cat }) => {
    const [hov, setHov] = React.useState(false);
    const accent = co.accent;
    return (
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: C.card,
          borderRadius: 16,
          border: `1.5px solid ${hov ? accent+"55" : C.line}`,
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: hov ? `0 8px 32px ${accent}18` : "0 1px 4px rgba(0,0,0,.05)",
          transition: "border-color .18s, box-shadow .18s, transform .18s",
          transform: hov ? "translateY(-2px)" : "none",
        }}
      >
        {/* Accent top bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} />

        <div style={{ padding: "16px 16px 14px", display:"flex", flexDirection:"column", gap:12, flexGrow:1 }}>

          {/* Header row */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:`${accent}0f`, border:`1.5px solid ${accent}22`, display:"grid", placeItems:"center", flexShrink:0 }}>
              <CatIcon cat={cat} accent={accent} size={20} />
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:13.5, color:C.ink, lineHeight:1.25, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{co.name}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2, fontWeight:500 }}>📍 {co.hq}</div>
            </div>
          </div>

          {/* Description */}
          <p style={{ fontSize:12.5, color:C.muted, lineHeight:1.55, margin:0, flexGrow:1 }}>
            {co.tag[lang] || co.tag.de}
          </p>

          {/* Actions */}
          <div style={{ display:"flex", gap:8 }}>
            <a
              href={co.url} target="_blank" rel="noreferrer"
              style={{ flex:"0 0 auto", display:"inline-flex", alignItems:"center", gap:4, padding:"8px 12px", background:"transparent", border:`1.5px solid ${C.line}`, borderRadius:10, fontSize:12, fontWeight:600, color:C.muted, textDecoration:"none", letterSpacing:.2 }}
            >
              <ExternalLink size={12} /> {L.visit}
            </a>
            <button
              onClick={() => onQuote({ partner: co, carData })}
              style={{ flex:1, padding:"8px 0", background:accent, border:"none", borderRadius:10, fontSize:12.5, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", letterSpacing:.2 }}
            >
              {L.quote}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Become-a-partner slot ────────────────────────────────────────────────
  const BecomePartner = () => (
    <button
      onClick={() => onQuote({ partner:{ name:"URA Partner-Programm", email:"partner@ura-import.info", color:"#fffbf0", accent:"#c9a65a", init:"URA", hq:"" }, carData })}
      style={{ background:"transparent", border:`1.5px dashed rgba(201,166,90,.4)`, borderRadius:16, padding:"20px 16px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, minHeight:160, cursor:"pointer", fontFamily:"inherit", width:"100%", transition:"border-color .2s, background .2s" }}
    >
      <div style={{ width:40, height:40, borderRadius:12, background:"rgba(201,166,90,.1)", border:"1.5px solid rgba(201,166,90,.3)", display:"grid", placeItems:"center" }}>
        <span style={{ fontSize:20, lineHeight:1 }}>+</span>
      </div>
      <div style={{ fontWeight:700, fontSize:13, color:C.ink }}>{L.become}</div>
      <div style={{ fontSize:11.5, color:C.muted, textAlign:"center", maxWidth:160 }}>{L.becomeD}</div>
    </button>
  );

  // ── Featured / Sponsored partner card ────────────────────────────────────
  const FeaturedCard = ({ co, cat }) => {
    const [hov, setHov] = React.useState(false);
    const accent = co.accent;
    return (
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          gridColumn: "1 / -1",
          background: `linear-gradient(135deg, ${accent}10 0%, rgba(20,25,38,0) 60%)`,
          borderRadius: 18,
          border: `1.5px solid ${accent}55`,
          overflow: "hidden",
          display: "flex", alignItems: "center", gap: 20,
          boxShadow: hov ? `0 8px 32px ${accent}20` : `0 4px 20px ${accent}10`,
          transition: "box-shadow .2s, transform .2s",
          transform: hov ? "translateY(-1px)" : "none",
          padding: "18px 20px",
          position: "relative",
        }}
      >
        {/* Gradient top line */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        {/* Sponsored badge */}
        <div style={{ position:"absolute", top:12, right:14, fontSize:9.5, fontWeight:800, color:accent, letterSpacing:1, textTransform:"uppercase", background:`${accent}18`, borderRadius:6, padding:"3px 7px", border:`1px solid ${accent}33` }}>
          {lang==="de"?"⭐ Empfohlen":lang==="sq"?"⭐ Rekomanduar":lang==="sr"?"⭐ Preporučeno":"⭐ Featured"}
        </div>

        {/* Icon */}
        <div style={{ width:56, height:56, borderRadius:15, background:`${accent}14`, border:`1.5px solid ${accent}30`, display:"grid", placeItems:"center", flexShrink:0 }}>
          <CatIcon cat={cat} accent={accent} size={26} />
        </div>

        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.ink, marginBottom:2 }}>{co.name}</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>📍 {co.hq}</div>
          <p style={{ fontSize:13, color:C.muted, lineHeight:1.5, margin:0 }}>{co.tag[lang] || co.tag.de}</p>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
          <button
            onClick={() => onQuote({ partner: co, carData })}
            style={{ padding:"10px 20px", background:accent, border:"none", borderRadius:11, fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", boxShadow:`0 4px 14px ${accent}40`, whiteSpace:"nowrap" }}
          >
            {L.quote}
          </button>
          <a
            href={co.url} target="_blank" rel="noreferrer"
            style={{ textAlign:"center", padding:"8px 12px", background:"transparent", border:`1.5px solid ${C.line}`, borderRadius:10, fontSize:12, fontWeight:600, color:C.muted, textDecoration:"none" }}
          >
            <ExternalLink size={11} style={{ marginRight:4 }} />{L.visit}
          </a>
        </div>
      </div>
    );
  };

  const grid = { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14, marginBottom:8 };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Page header */}
      <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:700, color:C.ink, marginBottom:4 }}>{L.headline}</h2>
      <p style={{ color:C.muted, fontSize:14, marginBottom:0 }}>{L.sub}</p>

      {/* Transport */}
      <SectionHeader title={L.transport} sub={L.tSub} cat="transport" />
      <div style={grid}>
        <FeaturedCard co={TRANSPORT[0]} cat="transport" />
        {TRANSPORT.slice(1).map((co,i) => <CompanyCard key={i} co={co} cat="transport" />)}
        <BecomePartner />
      </div>

      {/* Spedition */}
      <SectionHeader title={L.sped} sub={L.sSub} cat="sped" />
      <div style={grid}>
        <FeaturedCard co={SPEDITION[0]} cat="sped" />
        {SPEDITION.slice(1).map((co,i) => <CompanyCard key={i} co={co} cat="sped" />)}
        <BecomePartner />
      </div>

      {/* Finance */}
      <SectionHeader title={L.finance} sub={L.fSub} cat="finance" />
      <div style={grid}>
        <FeaturedCard co={FINANCE[0]} cat="finance" />
        {FINANCE.slice(1).map((co,i) => <CompanyCard key={i} co={co} cat="finance" />)}
        <BecomePartner />
      </div>

      {/* Insurance — Platzhalter-Slots, siehe INSURANCE-Array */}
      <SectionHeader title={L.insurance} sub={L.iSub} cat="insurance" />
      <div style={grid}>
        <FeaturedCard co={INSURANCE[0]} cat="insurance" />
        {INSURANCE.slice(1).map((co,i) => <CompanyCard key={i} co={co} cat="insurance" />)}
        <BecomePartner />
      </div>

      <p style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:20, marginBottom:4 }}>{L.note}</p>
    </div>
  );
}


// ── Lead Modal ────────────────────────────────────────────────────────────────
// FORMSPREE: replace XXXXXXXX with your form ID from formspree.io
const FORMSPREE_ENDPOINT = "https://formspree.io/f/XXXXXXXX";

function LeadModal({ data, onClose, C, lang, fmt }) {
  const { partner, carData } = data;
  const [form, setForm]     = useState({ name:"", email:"", phone:"", message:"" });
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [leadId]            = useState(() => {
    const d = new Date();
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const rand  = Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
    return `URA-${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,"0")}-${rand}`;
  });

  const destLabel = carData.destCountry==="AL"?"Albanien":carData.destCountry==="MK"?"Nordmazedonien":"Kosovo";
  const fuelLabel = carData.fuel==="ev"?"Elektro":carData.fuel==="hybrid"?"Hybrid":carData.fuel==="petrol"?"Benzin":"Diesel";

  const lbl = { de:{name:"Ihr Name",email:"E-Mail",phone:"Telefon (optional)",msg:"Nachricht",send:"Anfrage absenden",cancel:"Abbrechen",for:"Anfrage an",car:"Fahrzeug",successTitle:"Anfrage gesendet!",successMsg:"Ihre Lead-ID:",successNote:"Bitte notieren Sie diese ID — sie dient als Nachweis für Ihre Anfrage.",copy:"Kopieren",close:"Schließen",sending:"Wird gesendet…",error:"Fehler beim Senden. Bitte versuchen Sie es erneut."},en:{name:"Your name",email:"E-mail",phone:"Phone (optional)",msg:"Message",send:"Submit inquiry",cancel:"Cancel",for:"Inquiry to",car:"Vehicle",successTitle:"Inquiry sent!",successMsg:"Your lead ID:",successNote:"Please note this ID — it serves as proof of your inquiry.",copy:"Copy",close:"Close",sending:"Sending…",error:"Error sending. Please try again."},sq:{name:"Emri juaj",email:"E-mail",phone:"Telefon (opsional)",msg:"Mesazhi",send:"Dërgo kërkesën",cancel:"Anulo",for:"Kërkesë për",car:"Automjeti",successTitle:"Kërkesa u dërgua!",successMsg:"ID-ja juaj:",successNote:"Shënojeni këtë ID — shërben si dëshmi e kërkesës tuaj.",copy:"Kopjo",close:"Mbylle",sending:"Duke dërguar…",error:"Gabim gjatë dërgimit. Provo përsëri."},sr:{name:"Vaše ime",email:"E-pošta",phone:"Telefon (opciono)",msg:"Poruka",send:"Pošalji upit",cancel:"Otkaži",for:"Upit za",car:"Vozilo",successTitle:"Upit poslan!",successMsg:"Vaš lead ID:",successNote:"Zabilježite ovaj ID — služi kao dokaz vašeg upita.",copy:"Kopiraj",close:"Zatvori",sending:"Slanje…",error:"Greška pri slanju. Pokušajte ponovo."} };
  const T = lbl[lang] || lbl.de;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setStatus("sending");
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          leadId,
          partner:       partner.name,
          partnerEmail:  partner.email,
          contactName:   form.name,
          contactEmail:  form.email,
          contactPhone:  form.phone,
          message:       form.message,
          vehicle:       `${carData.make} ${carData.model} (${carData.year})`,
          price:         `${fmt(carData.price)} EUR`,
          engine:        `${carData.engine} ccm / ${fuelLabel}`,
          destination:   destLabel,
          timestamp:     new Date().toISOString(),
          _subject:      `[URA Lead ${leadId}] ${carData.make} ${carData.model} → ${partner.name}`,
        }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch { setStatus("error"); }
  };

  const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 };
  const modal   = { background: C.card, borderRadius: 22, width: "100%", maxWidth: 480, boxShadow: "0 24px 80px rgba(0,0,0,.25)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" };
  const inp     = { width:"100%", background:C.glass, border:`1.5px solid ${C.line}`, borderRadius:10, padding:"10px 12px", fontSize:13.5, fontFamily:"inherit", color:C.ink, outline:"none", boxSizing:"border-box" };

  return (
    <div style={overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ background:`linear-gradient(120deg,${partner.color||"#0f1b2d"},${partner.accent||"#1a3353"}22)`, padding:"18px 20px 14px", borderBottom:`1px solid ${C.line}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, letterSpacing:.8, textTransform:"uppercase" }}>{T.for}</div>
              <div style={{ fontSize:17, fontWeight:900, color:C.ink, marginTop:2 }}>{partner.name}</div>
            </div>
            <button onClick={onClose} style={{ background:"transparent", border:"none", fontSize:20, cursor:"pointer", color:C.muted, lineHeight:1, padding:2 }}>✕</button>
          </div>
          {/* Car summary */}
          <div style={{ marginTop:12, background:C.glass, border:`1px solid ${C.line}`, borderRadius:10, padding:"8px 12px", fontSize:12.5, color:C.muted, fontWeight:600 }}>
            🚗 {carData.make} {carData.model} ({carData.year}) · {fmt(carData.price)} EUR · {destLabel}
          </div>
          {/* Lead ID */}
          <div style={{ marginTop:8, display:"inline-flex", alignItems:"center", gap:6, background:"rgba(201,166,90,.12)", border:"1px solid rgba(201,166,90,.35)", borderRadius:8, padding:"4px 10px" }}>
            <span style={{ fontSize:10.5, fontWeight:700, color:"#c9a65a" }}>Lead-ID</span>
            <span style={{ fontSize:11.5, fontWeight:900, color:C.ink, letterSpacing:.5 }}>{leadId}</span>
          </div>
        </div>

        {status === "success" ? (
          <div style={{ padding:"28px 22px", textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.ink, marginBottom:6 }}>{T.successTitle}</div>
            <div style={{ fontSize:12.5, color:C.muted, marginBottom:16 }}>{T.successNote}</div>
            <div style={{ background:"rgba(201,166,90,.1)", border:"1.5px solid rgba(201,166,90,.4)", borderRadius:12, padding:"12px 16px", marginBottom:20 }}>
              <div style={{ fontSize:11, color:"#c9a65a", fontWeight:700, marginBottom:4 }}>{T.successMsg}</div>
              <div style={{ fontSize:22, fontWeight:900, color:C.ink, letterSpacing:2 }}>{leadId}</div>
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(leadId); }}
              style={{ background:C.glass, border:`1px solid ${C.line}`, borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:700, color:C.muted, cursor:"pointer", fontFamily:"inherit", marginRight:8 }}>
              {T.copy}
            </button>
            <button onClick={onClose}
              style={{ background:"linear-gradient(120deg,#0f1b2d,#1a3353)", border:"none", borderRadius:10, padding:"9px 18px", fontSize:13, fontWeight:700, color:"#c9a65a", cursor:"pointer", fontFamily:"inherit" }}>
              {T.close}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding:"18px 20px 20px" }}>
            <div style={{ display:"grid", gap:12 }}>
              <div>
                <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.muted, marginBottom:5 }}>{T.name} *</label>
                <input required style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Max Mustermann" />
              </div>
              <div>
                <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.muted, marginBottom:5 }}>{T.email} *</label>
                <input required type="email" style={inp} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="max@example.com" />
              </div>
              <div>
                <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.muted, marginBottom:5 }}>{T.phone}</label>
                <input style={inp} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+49 151 ..." />
              </div>
              <div>
                <label style={{ display:"block", fontSize:12, fontWeight:700, color:C.muted, marginBottom:5 }}>{T.msg}</label>
                <textarea rows={3} style={{...inp, resize:"vertical"}} value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} />
              </div>
            </div>
            {status==="error" && <div style={{ marginTop:10, fontSize:12.5, color:"#dc2626", fontWeight:600 }}>{T.error}</div>}
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button type="button" onClick={onClose}
                style={{ flex:1, background:C.glass, border:`1px solid ${C.line}`, borderRadius:12, padding:"12px", fontSize:13.5, fontWeight:700, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
                {T.cancel}
              </button>
              <button type="submit" disabled={status==="sending"}
                style={{ flex:2, background:"linear-gradient(120deg,#0f1b2d,#1a3353)", border:"none", borderRadius:12, padding:"12px", fontSize:13.5, fontWeight:800, color:"#c9a65a", cursor:"pointer", fontFamily:"inherit", opacity:status==="sending"?.6:1 }}>
                {status==="sending" ? T.sending : T.send}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


function Toggle({ on, set, label }) {
  return (
    <button onClick={() => set(!on)} aria-pressed={on} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: on ? C.blueSoft : C.glass, border: `1.5px solid ${on ? C.blue : C.line}`, borderRadius: 22, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: on ? C.blue : C.muted, transition: "all .2s" }}>
      <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${on ? C.blue : C.muted}`, background: on ? C.blue : "transparent", color: C.navy, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>{on ? "✓" : ""}</span>
      {label}
    </button>
  );
}
