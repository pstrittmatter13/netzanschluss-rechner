/* Netzanschluss-Rechner – Rechnung (Schnittstelle zum Atlas).
 *
 *   Rechner.kosten(variante, P_kW, L_m, vnb) → Ergebnis mit Summe Min/Typ/Max, Bausteinen und Stückliste
 *
 * Gleiche Rechnung wie ba-rechenmodell (modell/rechnung.py): Kosten = Σ Menge × Preis über die Stückliste,
 * Mengenformeln und Preise kommen aus dem Modell-Export (window.RECHNER_DATEN.modell).
 * Regional ersetzt werden nur BKZ (K17.x) und Leitung €/m (K14 MS, K15 HS) aus dem Netzkosten-Atlas.
 * Läuft im Browser (window.Rechner) und in Node (module.exports) ohne weitere Bibliotheken.
 */
(function (global) {
  "use strict";

  const D = global.RECHNER_DATEN;
  const M = D.modell, A = D.atlas;
  const KONST = M.konstanten;

  /* Varianten im Tool. Festlegung des Tools (19.11.2026): Leistungsklasse je Variante in kW.
     A/B/C = Kostenvergleich der BA bei 10 MW; übrige = Leitfaden, grob. */
  const VARIANTEN = {
    S3b:     {gruppe: "vergleich", kurz: "A",  min: 2000,  max: 20000},
    S2_10MW: {gruppe: "vergleich", kurz: "B",  min: 5000,  max: 60000},
    S8a:     {gruppe: "vergleich", kurz: "C1", min: 1000,  max: 20000},
    S8a_N:   {gruppe: "vergleich", kurz: "C2", min: 1000,  max: 20000},
    S1:      {gruppe: "leitfaden", min: 10000, max: 60000},
    S2:      {gruppe: "leitfaden", min: 10000, max: 60000},
    S3a:     {gruppe: "leitfaden", min: 500,   max: 8000},
    S4:      {gruppe: "leitfaden", min: 30,    max: 1000},
    S5:      {gruppe: "leitfaden", min: 30,    max: 250},
    S6:      {gruppe: "leitfaden", min: 100,   max: 10000},
    S9:      {gruppe: "leitfaden", min: 10000, max: 100000},
  };
  /* Nur als Text (keine Kostenzahl), Variantenliste v2. */
  const NUR_TEXT = {
    S0:  {name: "Eigener Anschluss Höchstspannung", text: "In der Bachelorarbeit ohne Kostenzahl. Als Untergrenze dient der Baukostenzuschuss des Übertragungsnetzbetreibers.", bkz: "K17.1"},
    S0b: {name: "HS-Sammelschiene im ÜNB-Umspannwerk (HöS/HS)", text: "In der Bachelorarbeit nur qualitativ. Als Untergrenze dient der Baukostenzuschuss der Umspannebene HöS/HS.", bkz: "K17.2"},
    S7:  {name: "Mitnutzung NS-Anschluss (hinter dem Zähler)", text: "In der Bachelorarbeit nur qualitativ: Mitnutzung eines bestehenden Niederspannungsanschlusses (Haushalt, Gewerbe)."},
    S8b: {name: "Co-Location EE-Park, DC-gekoppelt", text: "In der Bachelorarbeit nur qualitativ, als Sonderfall von C1."},
    S10: {name: "Schwarmspeicher und Energy Sharing", text: "In der Bachelorarbeit nur zur Abgrenzung, keine eigene Anschlussart."},
  };
  const BKZ = ["K17.1", "K17.2", "K17.3", "K17.4", "K17.5", "K17.6", "K17.7"];
  const LEITUNG = {K14: "ms", K15: "hs"};               // Baustein → Atlas-Spalte €/m (NAP)
  const PROXY_SPANNE = [0.5, 1.4];                      // Atlas METHODIK 3: veröff. BKZ = 0,5–1,4 × Proxy

  /* Mengenformel aus der Excel („L × e × k“, „max(Bezugsleistung − 30; 0)“) → Funktion. Nur bekannte Namen. */
  const NAMEN = ["P", "Bezugsleistung", "L", "e", "m", "S_haupt", "k", "max"];
  const formelCache = {};
  function formel(text) {
    if (formelCache[text]) return formelCache[text];
    const js = String(text).replace(/×/g, "*").replace(/−/g, "-").replace(/;/g, ",");
    const fremd = (js.match(/[A-Za-z_][A-Za-z_0-9]*/g) || []).filter(n => !NAMEN.includes(n));
    if (fremd.length || /[^A-Za-z_0-9\s.+\-*/(),]/.test(js)) throw new Error("Unbekannte Mengenformel: " + text);
    const f = new Function("g", "with (g) { return (" + js + "); }");
    return (formelCache[text] = g => Number(f(Object.assign({max: Math.max}, g))));
  }

  function kenngroessen(ref, P, L) {
    const bezugAnteil = ref.P ? (ref.Bezugsleistung == null ? 1 : ref.Bezugsleistung / ref.P) : 1;
    return {
      P: P, Bezugsleistung: P * bezugAnteil, L: L, e: ref.e, m: ref.m == null ? 0 : ref.m,
      S_haupt: P / 1000 / KONST.COS_PHI, k: Math.max(1, Math.ceil(P / 1000 / KONST.P_KABEL_MW)),
    };
  }

  /* Preis eines Bausteins: BA-Wert oder regionaler Atlas-Wert. Gibt {min,typ,max,herkunft,beleg} zurück. */
  function preis(id, vnb) {
    const b = M.bausteine[id];
    const ba = {min: b.min ?? b.typ, typ: b.typ, max: b.max ?? b.typ, herkunft: "BA", beleg: null};
    const v = vnb && A.vnb[vnb];
    if (!v) return ba;
    if (BKZ.includes(id)) {
      const pub = v.bkz[id];
      if (pub) return {min: pub.w, typ: pub.w, max: pub.w, herkunft: "veröffentlicht", beleg: pub.quelle, stand: pub.stand};
      if (id === "K17.5" && v.bkz_ms != null) {
        if (/veröff/.test(v.bkz_ms_basis || ""))
          return {min: v.bkz_ms, typ: v.bkz_ms, max: v.bkz_ms, herkunft: "veröffentlicht", beleg: null};
        return {min: v.bkz_ms * PROXY_SPANNE[0], typ: v.bkz_ms, max: v.bkz_ms * PROXY_SPANNE[1], herkunft: "Schätzung über Leistungspreis", beleg: null};
      }
      return Object.assign(ba, {herkunft: "BA (keine Atlas-Angabe)"});
    }
    if (LEITUNG[id]) {
      const w = v[LEITUNG[id]];
      if (w != null) return {min: w, typ: w, max: w, herkunft: "Netzausbauplan", beleg: null};
      return Object.assign(ba, {herkunft: "BA (keine Atlas-Angabe)"});
    }
    return ba;
  }

  function quellen(id) {
    return String(M.bausteine[id].quelle || "").split(/,\s*/).filter(q => M.quellen[q]).map(q => Object.assign({id: q}, M.quellen[q]));
  }

  function kosten(variante, P, L, vnb) {
    const ref = M.varianten[variante], cfg = VARIANTEN[variante];
    if (!ref || !cfg) throw new Error("Variante nicht im Rechner: " + variante);
    const hinweise = [];
    const Pk = Math.min(cfg.max, Math.max(cfg.min, Number(P) || ref.P));
    if (Pk !== Number(P)) hinweise.push(`Leistung auf die Leistungsklasse der Variante begrenzt (${cfg.min.toLocaleString("de-DE")}–${cfg.max.toLocaleString("de-DE")} kW).`);
    const mitLeitung = ref.L != null;
    const Lm = mitLeitung ? Math.max(0, Number(L) || 0) : 0;
    const g = kenngroessen(ref, Pk, Lm);
    if (vnb && !A.vnb[vnb]) hinweise.push("Für dieses Netzgebiet hat der Atlas keine Kennwerte; es gelten die Werte der BA.");

    const bausteine = [];
    for (const [id, f] of Object.entries(ref.mengen)) {
      const b = M.bausteine[id];
      if (!b || !b.gruppe) continue;                     // wie rechnung.kosten: ohne Kostengruppe zählt nicht
      const menge = formel(f)(g);
      if (!menge) continue;
      const p = preis(id, vnb);
      bausteine.push({
        id, name: b.name, gruppe: b.gruppe, einheit: b.einheit, formel: f, menge,
        preis: {min: p.min, typ: p.typ, max: p.max},
        kosten: {min: menge * p.min, typ: menge * p.typ, max: menge * p.max},
        herkunft: p.herkunft, beleg: p.beleg, datenqualitaet: p.herkunft === "BA" || p.herkunft.startsWith("BA ") ? b.datenqualitaet : (p.herkunft === "Schätzung über Leistungspreis" ? "abgeleitet" : "belegt"),
        quellen: p.herkunft.startsWith("BA") ? quellen(id) : [],
      });
    }
    const summe = {min: 0, typ: 0, max: 0};
    const gruppen = {};
    for (const b of bausteine) {
      for (const s of ["min", "typ", "max"]) summe[s] += b.kosten[s];
      gruppen[b.gruppe] = (gruppen[b.gruppe] || 0) + b.kosten.typ;
    }
    const geltung = cfg.gruppe === "vergleich"
      ? (Pk === ref.P ? "Kostenvergleich der BA (Referenzfall 10 MW)" : "grob: Gerätepreise gelten für den 10-MW-Fall")
      : "Leitfaden, grob";
    if (cfg.gruppe === "vergleich" && Pk !== ref.P) hinweise.push("Gerätepreise der BA gelten für 10 MW; bei anderer Leistung ist das Ergebnis grob.");
    const v = vnb && A.vnb[vnb];
    const vergleichUW = v && v.uw != null && ref.mengen.K07c
      ? {mio: v.uw, text: "Atlas-Umspannwerk (Netzausbauplan) = Ausbaukosten des Netzbetreibers, nicht Kunden-Umspannwerk; nur Vergleich, nicht gerechnet."}
      : null;
    return {variante, kurz: cfg.kurz || null, name: ref.kurzname || ref.bezeichnung, bezeichnung: ref.bezeichnung, netzebene: ref.netzebene,
      P: Pk, L: Lm, mitLeitung, vnb: v ? vnb : null, kenngroessen: g,
      summe, jeKW: {min: summe.min / Pk, typ: summe.typ / Pk, max: summe.max / Pk},
      gruppen, bausteine, geltung, hinweise, vergleichUW};
  }

  /* Untergrenze für Varianten ohne Kostenzahl: BKZ × P (S0, S0b). */
  function untergrenze(variante, P) {
    const t = NUR_TEXT[variante];
    if (!t || !t.bkz) return null;
    const b = M.bausteine[t.bkz];
    return {bkz: t.bkz, eurJeKW: b.typ, summe: b.typ * P, quellen: quellen(t.bkz)};
  }

  global.Rechner = {
    kosten, untergrenze, VARIANTEN, NUR_TEXT,
    gruppenReihenfolge: Object.keys(M.gruppen),
    varianten: M.varianten, datenstand: M.datenstand, atlas: {commit: A.commit, datum: A.datum},
    netzbetreiber: Object.keys(A.vnb).sort((a, b) => a.localeCompare(b, "de")),
  };
  if (typeof module !== "undefined") module.exports = global.Rechner;
})(typeof window !== "undefined" ? window : globalThis);
