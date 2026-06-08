import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Car, Truck, FileText, ShieldCheck, ChevronDown, ArrowRight, Lock, CheckCircle2, AlertTriangle, Download, ScrollText, ExternalLink, Building2, ScanLine, RotateCcw, Calculator, ClipboardList, Landmark, Info, Share2, Copy, Check, Scale, GitCompare, Gavel, Users, TrendingUp, ChevronRight, Home, Wrench } from "lucide-react";

// ===========================================================================
// URA · Asistenti i importit të veturave  (v3 · standard institucional)
// >>> BLLOKU I VETËM I NORMAVE LIGJORE <<< — ndryshohet vetëm këtu.
// ===========================================================================
const TAX_CONFIG = {
  stand: "Qershor 2026",
  laws: [
    "Ligji Nr. 03/L-109 — Kodi Doganor dhe i Akcizave",
    "Ligji për TVSH-në (norma standarde 18%)",
    "Ligji Nr. 05/L-132 për Automjete (neni 44)",
    "Vendimi i Qeverisë 24.03.2015 (akciza për vetura)",
  ],
  customsRate: 0.10, vatRate: 0.18, ecoTax: 10, roadTax: 40, minEuro: 4,
  ageLimitByCategory: { car: 10, van: 10, truck: 10, moto: 10 },
  ageLimitUnverified: { car: false, van: true, truck: true, moto: true },
  catalogFactors: {
    0: 1.00, 1: 0.85, 2: 0.75, 3: 0.65, 4: 0.57, 5: 0.50,
    6: 0.44, 7: 0.39, 8: 0.34, 9: 0.30, 10: 0.27,
  },
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
  // Kia zusätzlich
  U5Y:"Kia(SK)", U6Y:"Kia(SK)",
  // Volvo Cars
  YV2:"Volvo", YV3:"Volvo",
  // USA
  "1HG":"Honda(US)", "1FA":"Ford(US)", "2T1":"Toyota(US)",
  "1G1":"Chevrolet", "1GC":"Chevrolet", "3VW":"VW(MX)",
};

// Modelljahr aus VIN-Zeichen 10 (ISO 3779)
const VIN_YEAR_MAP = {
  A:2010,B:2011,C:2012,D:2013,E:2014,F:2015,G:2016,H:2017,
  J:2018,K:2019,L:2020,M:2021,N:2022,P:2023,R:2024,S:2025,T:2026,
  "1":2001,"2":2002,"3":2003,"4":2004,"5":2005,"6":2006,"7":2007,
  "8":2008,"9":2009,"0":2000,
};

function decodeVinLocal(vin) {
  if (!vin || vin.length !== 17) return null;
  const wmi = vin.slice(0, 3).toUpperCase();
  const make = WMI_BRANDS[wmi] || WMI_BRANDS[vin.slice(0,2)] || null;
  const yearChar = vin[9].toUpperCase();
  const year = VIN_YEAR_MAP[yearChar] || null;
  // Euro-Norm aus Baujahr schätzen
  const euro = !year ? 6 : year >= 2021 ? 6 : year >= 2015 ? 6 : year >= 2011 ? 5 : year >= 2006 ? 4 : year >= 2001 ? 3 : 2;
  return make ? { make, year, euro } : null;
}

const DEMO_VEHICLES = {
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
  ink: "#f4efe6", navy: "#0a0e17", blue: "#c9a65a", blueSoft: "rgba(201,166,90,0.12)",
  green: "#c9a65a", greenDeep: "#a8843c", amber: "#d8a657", amberSoft: "rgba(216,166,87,0.12)",
  red: "#e0736b", redSoft: "rgba(224,115,107,0.12)", paper: "#10141f",
  line: "rgba(244,239,230,0.10)", muted: "#8b8d98", surface: "#141926",
  glass: "rgba(255,255,255,0.04)",
};

const ORIGIN = {
  DE: { flag:"🇩🇪", sq:"Gjermani", sr:"Nemačka", en:"Germany", de:"Deutschland", vatRefund:0.19 },
  CH: { flag:"🇨🇭", sq:"Zvicër", sr:"Švajcarska", en:"Switzerland", de:"Schweiz", vatRefund:0.077 },
  AT: { flag:"🇦🇹", sq:"Austri", sr:"Austrija", en:"Austria", de:"Österreich", vatRefund:0.20 },
  NL: { flag:"🇳🇱", sq:"Holandë", sr:"Holandija", en:"Netherlands", de:"Niederlande", vatRefund:0.21 },
  BE: { flag:"🇧🇪", sq:"Belgjikë", sr:"Belgija", en:"Belgium", de:"Belgien", vatRefund:0.21 },
  FR: { flag:"🇫🇷", sq:"Francë", sr:"Francuska", en:"France", de:"Frankreich", vatRefund:0.20 },
  IT: { flag:"🇮🇹", sq:"Itali", sr:"Italija", en:"Italy", de:"Italien", vatRefund:0.22 },
};
const originName = (k, lang) => ORIGIN[k] ? `${ORIGIN[k].flag} ${ORIGIN[k][lang] || ORIGIN[k].en}` : k;
const FUEL = {
  petrol: { sq: "Benzinë", sr: "Benzin", en: "Petrol", de: "Benzin" },
  diesel: { sq: "Naftë", sr: "Dizel", en: "Diesel", de: "Diesel" },
  hybrid: { sq: "Hibrid", sr: "Hibrid", en: "Hybrid", de: "Hybrid" },
  ev: { sq: "Elektrike", sr: "Električno", en: "Electric", de: "Elektrisch" },
};
const YEAR_WORD = { sq: "vjet", sr: "god.", en: "yrs", de: "Jahre" };

const DOCS = [
  { id: "invoice",  sq: "Faturë / kontratë blerjeje", sr: "Faktura / kupoprodajni ugovor", en: "Invoice / purchase contract", de: "Rechnung / Kaufvertrag" },
  { id: "title",    sq: "Dokumentet e mjetit (leje qarkullimi)", sr: "Dokumenta vozila (saobraćajna)", en: "Vehicle title / registration docs", de: "Fahrzeugpapiere (Zulassung)" },
  { id: "origin",   sq: "Dëshmi e origjinës dhe pronësisë", sr: "Dokaz o poreklu i vlasništvu", en: "Proof of origin & ownership", de: "Herkunfts- & Eigentumsnachweis" },
  { id: "exa",      sq: "EX-A — Deklarata e eksportit (BE)", sr: "EX-A — EU izvozna deklaracija", en: "EX-A — EU export declaration", de: "EX-A — EU-Ausfuhranmeldung" },
  { id: "eur1",     sq: "EUR.1 (opsionale — doganë 0%)", sr: "EUR.1 (opciono — carina 0%)", en: "EUR.1 (optional — 0% duty)", de: "EUR.1 (optional — 0% Zoll)" },
  { id: "coc",      sq: "COC — vetëm për vetura të reja", sr: "COC — samo za nova vozila", en: "COC — new vehicles only", de: "COC — nur für Neufahrzeuge" },
  { id: "id",       sq: "Pasaportë / letërnjoftim", sr: "Pasoš / lična karta", en: "Passport / ID card", de: "Reisepass / Ausweis" },
  { id: "customs",  sq: "Pagesa: doganë + akcizë + TVSH", sr: "Plaćanje: carina + akciza + PDV", en: "Payment: customs + excise + VAT", de: "Zahlung: Zoll + Akzise + MwSt" },
  { id: "tech",     sq: "Kontroll teknik në Kosovë", sr: "Tehnički pregled na Kosovu", en: "Technical inspection in Kosovo", de: "Technische Prüfung im Kosovo" },
  { id: "plates",   sq: "Regjistrim + targa RKS", sr: "Registracija + RKS tablice", en: "Registration + RKS plates", de: "Anmeldung + RKS-Kennzeichen" },
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
    catUnverified: "Kufiri i moshës për këtë kategori duhet verifikuar me ligjin 05/L-132 / Doganën.",
    catalogBase: "Baza e doganimit", catalogBuy: "Çmimi juaj i blerjes", catalogVal: "Vlera e katalogut të doganës (vlerësim)",
    catalogWarning: "⚠ Kujdes: Dogana mund të tatojë çmimin e katalogut të saj, jo çmimin tuaj të blerjes. Konfirmo me Doganën.",
    catalogHigher: (diff) => `Vlera e katalogut (~€ ${diff}) mund të jetë MBI çmimin tuaj.`,
    catalogLower: "Çmimi juaj i blerjes është mbi vlerën e katalogut.",
    vatRefundTitle: "Rimbursi i TVSH-së",
    vatRefundDesc: (pct, amt, country) => `Si blerës jashtë BE-së, mund të marrësh mbrapsht TVSH-në ${pct}% të ${country} (~€ ${amt}). Shiko numrin MRN në deklaratën EX-A.`,
    cif: "Vlera CIF (bazë doganore)", customs: "Doganë", excise: "Akcizë",
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
    catUnverified: "Starosnu granicu za ovu kategoriju proveriti sa zakonom 05/L-132 / Carinom.",
    catalogBase: "Osnova za ocarinjenje", catalogBuy: "Vaša kupovna cena", catalogVal: "Kataloška vrednost carine (procena)",
    catalogWarning: "⚠ Pažnja: Carina može oporezovati katalošku vrednost. Potvrdite sa Carinom.",
    catalogHigher: (diff) => `Kataloška vrednost (~€ ${diff}) može biti IZNAD vaše cene.`,
    catalogLower: "Vaša kupovna cena je iznad kataloške vrednosti.",
    vatRefundTitle: "Povrat PDV-a",
    vatRefundDesc: (pct, amt, country) => `Kao kupac van EU, možete dobiti povrat ${pct}% PDV-a iz ${country} (~€ ${amt}). Pratite MRN broj na EX-A deklaraciji.`,
    cif: "CIF vrednost (carinska osnova)", customs: "Carina", excise: "Akciza",
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
    catUnverified: "Age limit for this category must be verified with Law 05/L-132 / Customs.",
    catalogBase: "Customs tax base", catalogBuy: "Your purchase price", catalogVal: "Customs catalogue value (estimate)",
    catalogWarning: "⚠ Important: Kosovo Customs may tax their own catalogue value. Confirm with Customs.",
    catalogHigher: (diff) => `Catalogue value (~€ ${diff}) may be ABOVE your price.`,
    catalogLower: "Your purchase price exceeds the catalogue value.",
    vatRefundTitle: "VAT Refund",
    vatRefundDesc: (pct, amt, country) => `As a non-EU buyer, you can reclaim ${pct}% VAT from ${country} (~€ ${amt}). Track your MRN number on the EX-A export declaration.`,
    cif: "CIF value (customs base)", customs: "Customs", excise: "Excise",
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
    catUnverified: "Altersgrenze für diese Kategorie mit Gesetz 05/L-132 / Zoll prüfen.",
    catalogBase: "Zollbemessungsgrundlage", catalogBuy: "Ihr Kaufpreis", catalogVal: "Zoll-Katalogwert (Schätzung)",
    catalogWarning: "⚠ Achtung: Der Kosovo-Zoll kann seinen eigenen Katalogwert besteuern. Beim Zoll bestätigen.",
    catalogHigher: (diff) => `Katalogwert (~€ ${diff}) kann ÜBER Ihrem Preis liegen.`,
    catalogLower: "Ihr Kaufpreis liegt über dem Katalogwert.",
    vatRefundTitle: "MwSt.-Rückerstattung",
    vatRefundDesc: (pct, amt, country) => `Als Nicht-EU-Käufer kannst du die ${pct}% MwSt. aus ${country} zurückbekommen (~€ ${amt}). Tracke deine MRN-Nummer auf der EX-A Ausfuhranmeldung.`,
    cif: "CIF-Wert (Zollbasis)", customs: "Zoll", excise: "Akzise",
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
};

const fmt = (n) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const transportByOrigin = { DE: 650, CH: 720, AT: 600, NL: 780, BE: 760, FR: 800, IT: 750 };
const NOW_YEAR = 2026;

function ccBand(cc) { return cc <= 2000 ? "le2000" : cc <= 3000 ? "le3000" : "gt3000"; }

function computeExcise({ cc, ageYears, isNewUnregistered, fuel }) {
  if (isNewUnregistered || cc <= 0) return 0; // EV (cc=0) & new → 0
  const b = ccBand(cc);
  const tbl = TAX_CONFIG.exciseTable[b]; // [≤8, 9, 10, 11, 12, 13, 14, 15, 16, ≥17]
  const idx = ageYears <= 8 ? 0 : Math.min(ageYears - 8, 9); // clamp to table length
  return tbl[idx];
}

function computeCatalogValue({ cc, ageYears }) {
  const band = ccBand(cc);
  const newPrice = TAX_CONFIG.newMarketPrice[band];
  const age = Math.min(ageYears, 10);
  const factor = TAX_CONFIG.catalogFactors[age] ?? TAX_CONFIG.catalogFactors[10];
  return Math.round(newPrice * factor);
}

// URL state encoding / decoding
function encodeState(state) {
  try {
    const s = { p: state.price, t: state.transport, y: state.year, cc: state.engine, o: state.origin, f: state.fuel, e: state.euro, cat: state.category };
    return btoa(JSON.stringify(s));
  } catch { return ""; }
}
function decodeState(hash) {
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
};

function WizardMode({ t, lang, C, fmt }) {
  const [step, setStep] = useState(0);
  const [wOrigin, setWOrigin] = useState(null);
  const [wModel, setWModel] = useState(null);
  const [wPrice, setWPrice] = useState(8000);
  const [wYear, setWYear] = useState(2020);

  const ORIGINS_WIZARD = [
    { key: "DE", flag: "🇩🇪", label: "Deutschland", transport: 650, vat: 0.19 },
    { key: "CH", flag: "🇨🇭", label: "Schweiz", transport: 720, vat: 0.077 },
    { key: "AT", flag: "🇦🇹", label: "Österreich", transport: 600, vat: 0.20 },
  ];
  const MODELS_WIZARD = [
    { label: "VW Golf", cc: 1968, fuel: "diesel", emoji: "🚗" },
    { label: "BMW 3er", cc: 1995, fuel: "diesel", emoji: "🚙" },
    { label: "Mercedes C", cc: 1497, fuel: "petrol", emoji: "🚘" },
    { label: "Renault Captur", cc: 1461, fuel: "diesel", emoji: "🚕" },
    { label: "Dacia Sandero", cc: 999, fuel: "petrol", emoji: "🚗" },
    { label: "Anderes Auto", cc: 1600, fuel: "diesel", emoji: "🔍" },
  ];

  const ageYears = Math.max(0, 2026 - wYear);
  const wCalc = useMemo(() => {
    if (!wOrigin || !wModel) return null;
    const transport = wOrigin.transport;
    const cif = wPrice + transport;
    const customs = cif * 0.10;
    const excise = computeExcise({ cc: wModel.cc, ageYears, isNewUnregistered: false, fuel: wModel.fuel || "diesel" });
    const vatBase = cif + customs + excise;
    const vat = vatBase * 0.18;
    const reg = 50;
    const arrival = cif + customs + excise + vat + reg;
    const vatRefund = wPrice * wOrigin.vat;
    return { cif, customs, excise, vat, arrival, vatRefund, reg, transport };
  }, [wOrigin, wModel, wPrice, wYear]);

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

      {/* Step 0 — Origin */}
      {step === 0 && (
        <div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 600, marginBottom: 20, color: C.ink }}>
            {lang === "de" ? "Woher kommt das Auto?" : lang === "en" ? "Where is the car from?" : lang === "sq" ? "Nga cili vend vjen vetura?" : "Iz koje zemlje dolazi auto?"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ORIGINS_WIZARD.map(o => (
              <button key={o.key} onClick={() => { setWOrigin(o); setStep(1); }}
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
            {ageYears > 10 ? " ⚠️ " + (lang === "de" ? "Nicht importierbar!" : "Not allowed!") : " ✓"}
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
          <button onClick={() => setStep(4)} disabled={ageYears > 10}
            style={{ width: "100%", background: ageYears > 10 ? C.line : `linear-gradient(135deg,#e6c878,${C.blue})`,
              color: ageYears > 10 ? C.muted : C.navy, border: "none", borderRadius: 14, padding: "16px",
              fontFamily: "inherit", fontWeight: 800, fontSize: 15,
              cursor: ageYears > 10 ? "not-allowed" : "pointer" }}>
            {ageYears > 10 ? (lang === "de" ? "Nicht importierbar" : "Not allowed") :
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
              {lang === "de" ? "Deine Ankunftskosten im Kosovo" : lang === "en" ? "Your landed cost in Kosovo" : "Kosto e mbërritjes në Kosovë"}
            </h2>
          </div>

          <div style={{ background: `linear-gradient(135deg,#e6c878,${C.blue} 60%,#a8843c)`,
            borderRadius: 20, padding: "22px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.navy, opacity: .7, letterSpacing: 1,
              textTransform: "uppercase", marginBottom: 4 }}>
              {lang === "de" ? "Gesamtkosten" : "Total"}
            </div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 52, fontWeight: 600, color: C.navy }}>
              € {fmt(wCalc.arrival)}
            </div>
            <div style={{ fontSize: 13, color: C.navy, opacity: .7, marginTop: 4 }}>
              +€ {fmt(wCalc.arrival - wPrice)} {lang === "de" ? "über Kaufpreis" : "over purchase price"}
            </div>
          </div>

          {[
            [lang === "de" ? "Kaufpreis" : "Purchase price", wPrice],
            [lang === "de" ? "Transport" : "Transport", wCalc.transport],
            [lang === "de" ? "Zoll (10%)" : "Customs (10%)", wCalc.customs],
            [lang === "de" ? "Akzise" : "Excise", wCalc.excise],
            [lang === "de" ? "MwSt (18%)" : "VAT (18%)", wCalc.vat],
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

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setStep(0)}
              style={{ flex: 1, background: C.glass, border: `1px solid ${C.line}`,
                borderRadius: 13, padding: "12px", fontFamily: "inherit",
                fontWeight: 700, fontSize: 13, color: C.muted, cursor: "pointer" }}>
              ← {lang === "de" ? "Neu starten" : lang === "en" ? "Start over" : "Fillo sërisht"}
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: C.muted, textAlign: "center", lineHeight: 1.5 }}>
            {lang === "de" ? "Schätzung · Endbeträge bestätigt der kosovarische Zoll" :
             "Estimate · Final amounts confirmed by Kosovo Customs"}
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
function VergleichMode({ t, lang, C, fmt, calc, price, make, model, year, ageYears }) {
  const [v2price, setV2price] = useState(10000);
  const [v2year, setV2year] = useState(2019);
  const [v2make, setV2make] = useState("BMW");
  const [v2model, setV2model] = useState("320d");
  const [v2cc, setV2cc] = useState(1995);
  const [v2fuel, setV2fuel] = useState("diesel");
  const [v2transport, setV2transport] = useState(650);

  const v2age = Math.max(0, 2026 - v2year);
  const v2calc = useMemo(() => {
    const cif = v2price + v2transport;
    const customs = cif * 0.10;
    const excise = computeExcise({ cc: v2cc, ageYears: v2age, isNewUnregistered: false, fuel: v2fuel });
    const vatBase = cif + customs + excise;
    const vat = vatBase * 0.18;
    const reg = 50;
    const arrival = cif + customs + excise + vat + reg;
    return { cif, customs, excise, vat, arrival, reg };
  }, [v2price, v2transport, v2cc, v2fuel, v2year]);

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
          <div style={{ fontSize: 11, color: C.muted }}>Ankunft Kosovo</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces',serif",
            color: cheaper===1 ? C.blue : C.ink }}>
            € {fmt(calc.arrival)}
          </div>
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
          <div style={{ fontSize: 11, color: C.muted }}>Ankunft Kosovo</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces',serif",
            color: cheaper===2 ? C.blue : C.ink }}>
            € {fmt(v2calc.arrival)}
          </div>
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
    }
  };
  const c = content[lang];
  const card = { background: "linear-gradient(160deg,#141926,#10141f)", border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 18px", marginBottom: 14 };

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
    <div style={{ background: "rgba(16,185,129,0.07)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#059669", letterSpacing: .4, textTransform: "uppercase", marginBottom: 10 }}>{t.tipsTitle}</div>
      {tips.map((tip, i) => (
        <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: i < tips.length - 1 ? 8 : 0 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{tip.icon}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, lineHeight: 1.5 }}>{tip.text}</span>
        </div>
      ))}
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
  const ampAge   = NOW_YEAR - ampYear;
  const ampLimit = TAX_CONFIG.ageLimitByCategory[ampCat];
  const ampOk    = ampEuro >= TAX_CONFIG.minEuro && ampAge <= ampLimit;
  const ampWarn  = ampOk && ampAge >= ampLimit - 2;
  const ampClr   = !ampOk ? "#ef4444" : ampWarn ? "#f59e0b" : "#22c55e";
  const ampEmoji = !ampOk ? "🔴" : ampWarn ? "🟡" : "🟢";
  const ampMsg   = {
    sq: !ampOk ? "❌ Importi nuk lejohet" : ampWarn ? "⚠️ Afër kufirit — akoma lejohet" : "✅ Importi lejohet",
    de: !ampOk ? "❌ Import nicht erlaubt" : ampWarn ? "⚠️ Fast zu alt — noch erlaubt" : "✅ Import erlaubt",
    en: !ampOk ? "❌ Import not allowed" : ampWarn ? "⚠️ Near age limit — still ok" : "✅ Import allowed",
    sr: !ampOk ? "❌ Uvoz nije dozvoljen" : ampWarn ? "⚠️ Blizu starosne granice — još je ok" : "✅ Uvoz dozvoljen",
  };
  const ampSub   = {
    sq: `Mosha: ${ampAge} vjet (max. ${ampLimit}) · Euro ${ampEuro} (min. ${TAX_CONFIG.minEuro})`,
    de: `Alter: ${ampAge} J. (max. ${ampLimit}) · Euro ${ampEuro} (mind. ${TAX_CONFIG.minEuro})`,
    en: `Age: ${ampAge} yrs (max. ${ampLimit}) · Euro ${ampEuro} (min. ${TAX_CONFIG.minEuro})`,
    sr: `Starost: ${ampAge} god. (max. ${ampLimit}) · Euro ${ampEuro} (min. ${TAX_CONFIG.minEuro})`,
  };

  // ── KM ──────────────────────────────────────────────────────────────────────
  const kmAge      = Math.max(1, NOW_YEAR - kmYear);
  const kmExpected = kmAge * 15000;
  const kmRatio    = kmVal / kmExpected;
  const kmStatus   = kmRatio < 0.6 ? "low" : kmRatio > 1.5 ? "high" : "ok";
  const kmClr      = { low: C.blue, ok: "#22c55e", high: "#ef4444" }[kmStatus];
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

  // ── Currency ─────────────────────────────────────────────────────────────────
  const cResult = {};
  Object.keys(rates).forEach(cur => {
    cResult[cur] = Math.round((cAmt / (rates[cFrom] || 1)) * rates[cur]);
  });

  const L = (obj) => obj[lang] || obj["en"];
  const sectionTitle = { sq:"Mjete Falas", de:"Kostenlose Werkzeuge", en:"Free Tools", sr:"Besplatni Alati" };
  const sectionSub   = { sq:"5 mjete falas për çdo blerës të mençur", de:"5 kostenlose Tools für jeden cleveren Käufer", en:"5 free tools for every smart buyer", sr:"5 besplatnih alata za svakog pametnog kupca" };

  const cardStyle = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, marginBottom: 16 };
  const toolTitle = { fontWeight: 800, fontSize: 16, color: C.ink };
  const toolSub   = { fontSize: 12, color: C.muted, marginTop: 2 };
  const sliderRow = { display:"flex", alignItems:"center", gap:10, marginBottom:12 };
  const sliderLabel = { fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:5 };

  return (
    <div style={{ padding:"24px 0" }}>
      <div style={{ fontFamily:"'Fraunces',serif", fontWeight:800, fontSize:26, color:C.ink, marginBottom:4 }}>{L(sectionTitle)}</div>
      <div style={{ fontSize:14, color:C.muted, marginBottom:28 }}>{L(sectionSub)}</div>

      {/* ── 1. Import-Ampel ─────────────────────────────────────────────────── */}
      <div style={cardStyle}>
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
      <div style={cardStyle}>
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
            <span style={{ color:"#22c55e", fontWeight:700 }}>{fmt(kmExpected)} km {lang==="de"?"erwartet":"expected"}</span>
            <span>{fmt(kmExpected*2)}</span>
          </div>
          <div style={{ background:C.glass, borderRadius:99, height:12, position:"relative", overflow:"hidden" }}>
            <div style={{ background:`linear-gradient(90deg,#22c55e,${kmClr})`, height:"100%", width:`${Math.min(100,(kmVal/(kmExpected*2))*100)}%`, transition:"width .3s", borderRadius:99 }} />
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
      <div style={cardStyle}>
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
      <div style={cardStyle}>
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
      <div style={cardStyle}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
          <span style={{ fontSize:32 }}>💱</span>
          <div>
            <div style={toolTitle}>{lang==="de"?"Währungsrechner":lang==="sq"?"Konvertuesi i valutave":lang==="sr"?"Kalkulator valuta":"Currency converter"}</div>
            <div style={toolSub}>EUR · CHF · ALL · USD · GBP · MKD · BAM · RSD</div>
          </div>
        </div>
        <div style={{ fontSize:11, color: liveRates ? "#22c55e" : C.muted, fontWeight:700, marginBottom:16 }}>
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

    </div>
  );
}


// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
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
  const [fuel, setFuel] = useState("diesel");
  const [euro, setEuro] = useState(6);
  const [hs, setHs] = useState("8703 32");
  const [isNew, setIsNew] = useState(false);
  const [hasEur1, setHasEur1] = useState(false);
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
  const ageUnverified = TAX_CONFIG.ageLimitUnverified[category];
  const legal = useMemo(() => {
    const p = [];
    if (ageYears > ageLimit) p.push(t.ageBad(ageYears, ageLimit));
    if (euro < TAX_CONFIG.minEuro) p.push(t.euroBad(euro, TAX_CONFIG.minEuro));
    return p;
  }, [ageYears, euro, lang, ageLimit]);

  const catalogValue = useMemo(() => {
    if (isNew || engine <= 0) return null;
    return computeCatalogValue({ cc: engine, ageYears });
  }, [engine, ageYears, isNew]);

  const calc = useMemo(() => {
    const cif = price + transport + insurance;
    const customs = hasEur1 ? 0 : cif * TAX_CONFIG.customsRate;
    const excise = computeExcise({ cc: engine, ageYears, isNewUnregistered: isNew, fuel });
    const vatBase = cif + customs + excise;
    const vat = vatBase * TAX_CONFIG.vatRate;
    const importTaxes = customs + excise + vat;
    const reg = TAX_CONFIG.ecoTax + TAX_CONFIG.roadTax;
    const arrival = cif + importTaxes + reg;
    const toState = customs + excise + vat + reg;
    const vatRefund = price * (ORIGIN[origin]?.vatRefund || 0);
    const catalogCif = catalogValue ? (catalogValue + transport + insurance) : null;
    const catalogCustoms = catalogCif && !hasEur1 ? catalogCif * TAX_CONFIG.customsRate : 0;
    const catalogVatBase = catalogCif ? catalogCif + catalogCustoms + excise : null;
    const catalogVat = catalogVatBase ? catalogVatBase * TAX_CONFIG.vatRate : 0;
    const catalogArrival = catalogCif ? catalogCif + catalogCustoms + excise + catalogVat + reg : null;
    return { cif, customs, excise, vat, vatBase, importTaxes, reg, arrival, toState, vatRefund, catalogArrival };
  }, [price, transport, insurance, engine, ageYears, isNew, fuel, hasEur1, catalogValue, origin]);

  const animatedTotal = useCountUp(calc.arrival);
  const catalogHigher = catalogValue && (catalogValue > price);
  const catalogDiff = catalogHigher ? fmt(catalogValue) : null;

  const downloadSummary = () => {
    const html = `<!doctype html><meta charset="utf-8"><title>URA — ${make} ${model}</title>
<style>body{font:14px system-ui;color:#0c1322;max-width:620px;margin:40px auto;padding:0 20px}h1{font-size:22px;font-family:Georgia,serif;color:#0a0e17}h2{font-size:14px;color:#6a7488;font-weight:600;margin-top:-8px}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:9px 0;border-bottom:1px solid #e6eaf1}td:last-child{text-align:right;font-weight:700}.tot{background:linear-gradient(135deg,#c9a65a,#a8843c);color:#0a0e17;padding:14px;border-radius:10px;display:flex;justify-content:space-between;margin-top:16px;font-size:18px;font-weight:800}.refund{background:#e8f8f0;border:1px solid #a8d8b8;border-radius:8px;padding:10px 14px;font-size:12px;color:#1a7a44;margin-top:10px}small{color:#6a7488}</style>
<h1>URA — ${make} ${model}</h1><h2>${ageYears} ${YEAR_WORD[lang]} · Euro ${euro} · ${engine}cc · ${ORIGIN[origin][lang]}</h2>
<small>${t.locked(TAX_CONFIG.stand)}</small>
<table>
<tr><td>${t.catalogBuy}</td><td>€ ${fmt(price)}</td></tr>
<tr><td>${t.cif}</td><td>€ ${fmt(calc.cif)}</td></tr>
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
    setHs(""); setIsNew(false); setHasEur1(false); setErrors({});
  };

  const inputBox = { width: "100%", padding: "12px 14px", borderRadius: 13, border: `1.5px solid ${C.line}`, fontSize: 15, fontWeight: 600, color: C.ink, outline: "none", background: C.glass, fontFamily: "inherit", boxSizing: "border-box" };
  const inputErr = { ...inputBox, borderColor: C.red };
  const lbl = { fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 7, display: "block", textTransform: "uppercase" };
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
    @keyframes uraRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    @keyframes uraGlow{0%,100%{opacity:.5}50%{opacity:.9}}
    .ura-rise { animation: uraRise .7s cubic-bezier(.16,1,.3,1) both; }
    .card {
      background: linear-gradient(160deg, ${C.surface}, ${C.paper});
      border: 1px solid ${C.line};
      border-radius: 22px;
      box-shadow: 0 24px 60px -20px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.04);
    }
    select:focus, input:focus { border-color: ${C.blue} !important; background: rgba(201,166,90,.06); }
    button:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
    .ura-page {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: ${C.navy};
      min-height: 100vh;
      color: ${C.ink};
      position: relative;
      overflow-x: hidden;
      padding: 24px 16px 48px;
    }
    .ura-outer { max-width: 560px; margin: 0 auto; position: relative; }
    .ura-header-bar { display: flex; align-items: center; gap: 13px; margin-bottom: 22px; flex-wrap: wrap; }
    .ura-logo-box {
      width: 46px; height: 46px; border-radius: 14px;
      background: linear-gradient(150deg, #e6c878, ${C.blue} 55%, ${C.greenDeep});
      display: grid; place-items: center; color: ${C.navy};
      font-family: 'Fraunces', serif; font-weight: 700; font-size: 24px; flex-shrink: 0;
      box-shadow: 0 8px 22px -6px rgba(201,166,90,.55), inset 0 1px 0 rgba(255,255,255,.4);
    }
    .ura-wordmark { font-family: 'Fraunces', serif; font-weight: 700; font-size: 24px; letter-spacing: .5px; line-height: 1; }
    .ura-tagline { font-size: 12px; color: ${C.muted}; font-weight: 500; letter-spacing: .3px; margin-top: 2px; }
    .ura-h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: clamp(24px,5vw,34px); line-height: 1.1; margin: 0; letter-spacing: -.3px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .form-grid .full { grid-column: 1 / -1; }
    .calc-layout { display: block; }
    .mobile-legality { display: block; }
    .desktop-legality { display: none; }
    select option { background: ${C.surface}; color: ${C.ink}; }

    @media (min-width: 640px) {
      .ura-page { padding: 32px 28px 56px; }
      .ura-outer { max-width: 680px; }
      .ura-logo-box { width: 52px; height: 52px; font-size: 26px; border-radius: 16px; }
      .ura-wordmark { font-size: 28px; }
      .ura-tagline { font-size: 13px; }
    }

    @media (min-width: 1024px) {
      .ura-page { padding: 40px 40px 60px; }
      .ura-outer { max-width: 1160px; }
      .ura-header-bar { margin-bottom: 28px; }
      .ura-logo-box { width: 58px; height: 58px; font-size: 30px; border-radius: 18px; }
      .ura-wordmark { font-size: 32px; }
      .calc-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; }
      .calc-left { position: sticky; top: 24px; }
      .mobile-legality { display: none; }
      .desktop-legality { display: block; }
    }

    @media (min-width: 1400px) {
      .ura-outer { max-width: 1300px; }
      .calc-layout { gap: 36px; }
    }

    .card { transition: box-shadow .2s; }
    @media (hover: hover) {
      .card:hover { box-shadow: 0 28px 70px -20px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06); }
    }
  `;

  const rows = [
    { label: t.cif, val: calc.cif, icon: <Car size={15} />, strong: true },
    { label: t.customs, val: calc.customs, hint: hasEur1 ? "0% · EUR.1" : "10% · CIF" },
    { label: t.excise, val: calc.excise, hint: fuel === "ev" ? t.evExciseNote : t.exciseNote, flag: true },
    { label: t.vat(fmt(calc.vatBase)), val: calc.vat },
  ];

  const tabs = [
    { id: "wizard",  label: lang==="de"?"Einfach":lang==="en"?"Easy":lang==="sq"?"Lehtë":"Lako",       icon: <Home size={15} /> },
    { id: "calc",    label: t.tabCalc,                                                                   icon: <Calculator size={15} /> },
    { id: "compare", label: lang==="de"?"Vergleich":lang==="en"?"Compare":lang==="sq"?"Krahaso":"Poredi",icon: <GitCompare size={15} /> },
    { id: "tools",   label: lang==="de"?"Werkzeuge":lang==="en"?"Tools":lang==="sq"?"Mjete":"Alati",     icon: <Wrench size={15} /> },
    { id: "docs",    label: t.tabDocs,                                                                   icon: <ClipboardList size={15} /> },
    { id: "info",    label: lang==="de"?"Info":"Info",                                                   icon: <Gavel size={15} /> },
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
    {!isNew && catalogValue && (
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
      <div style={{ padding: "16px 18px 8px" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, paddingRight: 8 }}>
              {r.icon && <span style={{ color: C.muted }}>{r.icon}</span>}
              <span style={{ fontSize: 13.5, fontWeight: r.strong ? 700 : 600, color: C.ink }}>{r.label}</span>
              {r.hint && <span style={{ fontSize: 10.5, color: r.flag ? (fuel === "ev" ? C.greenDeep : C.amber) : C.muted, fontWeight: 700, background: r.flag ? (fuel === "ev" ? C.blueSoft : C.amberSoft) : C.paper, padding: "2px 7px", borderRadius: 8, whiteSpace: "nowrap" }}>{r.hint}</span>}
            </div>
            <span style={{ fontSize: 14.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>€ {fmt(r.val)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0 4px" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.muted }}>{t.importTaxes}</span>
          <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: C.muted }}>€ {fmt(calc.importTaxes)}</span>
        </div>
        {/* Cost proportion bar */}
        {calc.arrival > 0 && (() => {
          const total = calc.arrival;
          const segments = [
            { val: price, color: C.blue, opacity: .85 },
            { val: (transport || 0) + (insurance || 0), color: "#6366f1", opacity: .75 },
            { val: calc.customs, color: "#f59e0b", opacity: .9 },
            { val: calc.excise, color: "#ef4444", opacity: .85 },
            { val: calc.vat, color: "#8b5cf6", opacity: .8 },
            { val: calc.reg, color: C.greenDeep, opacity: .8 },
          ].filter(s => s.val > 0);
          return (
            <div style={{ height: 8, borderRadius: 6, overflow: "hidden", display: "flex", margin: "6px 0 8px", gap: 1 }}>
              {segments.map((s, i) => (
                <div key={i} style={{ flex: s.val / total, background: s.color, opacity: s.opacity, minWidth: s.val / total > 0.01 ? 3 : 0 }} />
              ))}
            </div>
          );
        })()}
      </div>
      <div style={{ background: `linear-gradient(135deg,#e6c878,${C.blue} 60%,${C.greenDeep})`, color: C.navy, padding: "20px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, opacity: .7, letterSpacing: 1, textTransform: "uppercase" }}>{t.arrival}</div>
          <div style={{ fontSize: 12, opacity: .75, fontWeight: 700, marginTop: 3 }}>{t.over(fmt(calc.arrival - price), fmt(calc.reg))}</div>
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
    <SharePanel t={t} make={make} model={model} year={year} arrival={calc.arrival} price={price} lang={lang} />
    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
      <button onClick={downloadSummary} style={{ flex: 1, background: C.glass, border: `1.5px solid ${C.line}`, borderRadius: 13, padding: "13px", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, color: C.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Download size={16} color={C.blue} /> {t.download}</button>
      <button onClick={resetAll} style={{ background: C.glass, border: `1.5px solid ${C.line}`, borderRadius: 13, padding: "13px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}><RotateCcw size={16} color={C.muted} /> {t.reset}</button>
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
    <div lang={lang} className="ura-page">
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
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "60vw", height: "40vh", maxWidth: 700, background: `radial-gradient(circle,rgba(201,166,90,.15),transparent 70%)`, pointerEvents: "none", animation: "uraGlow 6s ease-in-out infinite", zIndex: 0 }} />
      <div className="ura-outer">

        <header className="ura-header-bar ura-rise">
          <div className="ura-logo-box">U</div>
          <div>
            <div className="ura-wordmark">URA</div>
            <div className="ura-tagline">{t.tagline}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 3, background: C.glass, border: `1px solid ${C.line}`, borderRadius: 11, padding: 3 }}>
            {["sq", "sr", "en", "de"].map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-label={`Language ${l}`} style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 11.5, padding: "6px 9px", borderRadius: 8, background: lang === l ? C.blue : "transparent", color: lang === l ? C.navy : C.muted, transition: "all .2s" }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </header>

        <div className="ura-rise" style={{ display: "flex", gap: 5, background: C.glass, border: `1px solid ${C.line}`, borderRadius: 15, padding: 4, marginBottom: 24, animationDelay: ".05s" }}>
          {tabs.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 11, padding: "10px 4px", borderRadius: 11, background: tab === tb.id ? C.blue : "transparent", color: tab === tb.id ? C.navy : C.muted, transition: "all .25s", boxShadow: tab === tb.id ? "0 6px 16px -6px rgba(201,166,90,.6)" : "none" }}>{tb.icon} {tb.label}</button>
          ))}
        </div>

        {tab === "wizard" && (
          <WizardMode t={t} lang={lang} C={C} fmt={fmt} />
        )}

        {tab === "compare" && (
          <VergleichMode t={t} lang={lang} C={C} fmt={fmt}
            calc={calc} price={price} make={make} model={model}
            year={year} ageYears={ageYears} />
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
                  <input style={{ ...inputBox, flex: 1 }} value={ident} placeholder="WVWZZZ... / GOLF7TDI" onChange={(e) => { setIdent(e.target.value); setRecMsg(null); }} />
                  <button onClick={() => recognize()} disabled={recLoading} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: recLoading ? C.muted : C.blue, color: C.navy, border: "none", borderRadius: 12, padding: "0 16px", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, cursor: recLoading ? "wait" : "pointer", whiteSpace: "nowrap" }}><ScanLine size={16} /> {recLoading ? t.recLoad : t.recognize}</button>
                </div>
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
                  {["SANDERO","GOLF7TDI","P308","BMW320D","OCTAVIA","CAPTUR","TESLA3","SPRINTER313"].map((k) => (
                    <button key={k} onClick={() => { setIdent(k); recognize(k); }} style={{ background: C.glass, border: `1px solid ${C.blue}`, borderRadius: 20, padding: "6px 12px", fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: C.blue, cursor: "pointer", letterSpacing: .5 }}>{k}</button>
                  ))}
                </div>
              </div>
              <div className="card ura-rise" style={{ padding: 18, marginBottom: 16, animationDelay: ".18s" }}>
                <div className="form-grid">
                  <div><label style={lbl}>{t.category}</label><Select label={t.category} value={category} onChange={(e) => setCategory(e.target.value)}><option value="car">{t.catCar}</option><option value="van">{t.catVan}</option><option value="truck">{t.catTruck}</option><option value="moto">{t.catMoto}</option></Select></div>
                  <div><label style={lbl}>{t.year}</label><input style={errors.year ? inputErr : inputBox} type="number" value={year} onChange={(e) => { const v = +e.target.value; setYear(v); validate("year", v); }} />{errors.year && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{errors.year}</div>}</div>
                  <div><label style={lbl}>{t.make}</label><input style={inputBox} value={make} onChange={(e) => setMake(e.target.value)} /></div>
                  <div><label style={lbl}>{t.model}</label><input style={inputBox} value={model} onChange={(e) => setModel(e.target.value)} /></div>
                        <div><label style={lbl}>{t.engine}</label><input style={errors.engine ? inputErr : inputBox} type="number" value={engine} onChange={(e) => { const v = +e.target.value; setEngine(v); validate("engine", v); }} />{errors.engine && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{errors.engine}</div>}</div>
                  <div><label style={lbl}>{t.fuel}</label><Select label={t.fuel} value={fuel} onChange={(e) => setFuel(e.target.value)}><option value="petrol">{FUEL.petrol[lang]}</option><option value="diesel">{FUEL.diesel[lang]}</option><option value="hybrid">{FUEL.hybrid[lang]}</option><option value="ev">{FUEL.ev[lang]}</option></Select></div>
                  <div><label style={lbl}>{t.origin}</label><Select label={t.origin} value={origin} onChange={(e) => setOrigin(e.target.value)}>{Object.keys(ORIGIN).map(k => <option key={k} value={k}>{originName(k, lang)}</option>)}</Select></div>
                  <div><label style={lbl}>{t.euro}</label><input style={inputBox} type="number" min={1} max={7} value={euro} onChange={(e) => setEuro(+e.target.value)} /></div>
                  <div><label style={lbl}>{t.hs}</label><input style={inputBox} value={hs} onChange={(e) => setHs(e.target.value)} /></div>
                </div>
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Toggle on={hasEur1} set={setHasEur1} label={t.fEur1} />
                  <Toggle on={isNew} set={setIsNew} label={t.fNew} />
                </div>
              </div>
              <div className="card ura-rise" style={{ padding: 18, marginBottom: 16, animationDelay: ".22s" }}>
                <div className="form-grid">
                  <div><label style={lbl}>{t.price}</label><input style={errors.price ? inputErr : inputBox} type="number" value={price} onChange={(e) => { const v = +e.target.value; setPrice(v); validate("price", v); }} />{errors.price && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{errors.price}</div>}</div>
                  <div><label style={lbl}>{t.transport}</label><input style={inputBox} type="number" value={transport} onChange={(e) => { setTransport(+e.target.value); setTransportTouched(true); }} /></div>
                  <div><label style={lbl}>{t.insurance}</label><input style={inputBox} type="number" value={insurance} onChange={(e) => setInsurance(+e.target.value)} /></div>
                </div>
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
              {catalogHigher && (
                <button onClick={() => setShowCatalog(!showCatalog)} style={{ width: "100%", background: `${C.blue}12`, border: `1.5px solid ${C.blue}44`, borderRadius: 14, padding: "11px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>ℹ️ {t.catalogHigher(fmt(catalogValue))}</span>
                  <ChevronDown size={14} style={{ color: C.blue, transform: showCatalog ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </button>
              )}
              {showCatalog && catalogValue && (
                <div className="ura-rise" style={{ background: C.glass, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{t.catalogWarning}</div>
                  {calc.catalogArrival && <div style={{ marginTop: 10, fontWeight: 700, color: C.ink, fontSize: 14 }}>{"Kosto me katalog:"} <span style={{ color: C.blue }}>€{fmt(calc.catalogArrival)}</span></div>}
                </div>
              )}
              <div className="card ura-rise" style={{ marginBottom: 14, animationDelay: ".05s" }}>
                <div style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <Car size={16} style={{ color: C.muted }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>{t.cif}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 15, color: C.ink }}>€ {fmt(calc.cif)}</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.ink, flex: 1 }}>{t.customs}</span>
                      <span style={{ fontSize: 12, color: C.muted, background: C.glass, borderRadius: 6, padding: "2px 8px" }}>10% · CIF</span>
                      <span style={{ fontWeight: 800, color: C.ink }}>€ {fmt(calc.customs)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.ink, flex: 1 }}>{t.excise}</span>
                      <span style={{ fontSize: 11, color: "#f59e0b", background: "#f59e0b18", borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>{t.exciseNote}</span>
                      <span style={{ fontWeight: 800, color: C.ink }}>€ {fmt(calc.excise)}</span>
                    </div>
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
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>{t.over(fmt(calc.importTaxes), fmt(calc.reg))}</div>
                  <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 46, color: C.blue, letterSpacing: -1 }}>€ {fmt(Math.round(animatedTotal))}</div>
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
      