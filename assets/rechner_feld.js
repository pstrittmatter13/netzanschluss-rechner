/* Netzanschluss-Rechner – Feld unter der Karte und Kurzzeile im Steckbrief.
 * Nutzt aus Daniels Karte (index.html des Atlas) nur: selected, select(n), renderCard(), fmt().
 * Rechnung: rechner.js (window.Rechner).
 */
(function () {
  "use strict";
  const R = window.Rechner;
  const FARBE = {
    "Baukostenzuschuss": "--lv1", "Schaltanlagen und Stationen": "--lv4", "Umspannung": "--lv5",
    "Anschlussleitung": "--lv6", "NS-Anschluss": "--lv3", "Sekundärtechnik und Nachweise": "--nodata",
  };
  const de = (v, f = 0) => v == null ? "–" : v.toLocaleString("de-DE", {minimumFractionDigits: f, maximumFractionDigits: f});
  const eur = v => v >= 1e6 ? de(v / 1e6, 2) + " Mio. €" : v >= 1e4 ? de(Math.round(v / 1000), 0) + " T€" : de(v, 0) + " €";
  const leistung = kw => kw >= 1000 ? de(kw / 1000, kw % 1000 ? 1 : 0) + " MW" : de(kw, 0) + " kW";
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

  // ---------- Zustand ----------
  let st = {v: "E4", P: 10000, L: 500, vnb: ""};
  try { const s = JSON.parse(localStorage.getItem("nar1") || "{}"); if (R.VARIANTEN[s.v] || R.NUR_TEXT[s.v]) st = Object.assign(st, s); } catch (e) {}
  const speichere = () => { try { localStorage.setItem("nar1", JSON.stringify({v: st.v, P: st.P, L: st.L})); } catch (e) {} };

  // ---------- Gerüst ----------
  const sec = document.getElementById("rechner");
  const optVar = (ids, label) => `<optgroup label="${label}">` + ids.map(v => {
    const cfg = R.VARIANTEN[v], ref = R.varianten[v], t = R.NUR_TEXT[v];
    const name = t ? t.name : (ref.kurzname || ref.bezeichnung);
    return `<option value="${v}">${cfg && cfg.kurz ? cfg.kurz + " · " : ""}${esc(name)} (${v})</option>`;
  }).join("") + "</optgroup>";
  const ids = g => Object.keys(R.VARIANTEN).filter(v => R.VARIANTEN[v].gruppe === g);
  sec.innerHTML = `
    <h2 id="rh">Netzanschluss-Rechner</h2>
    <p class="lead">Investitionskosten des Netzanschlusses eines Batteriespeichers vom Ausgang des Speichersystems bis zum Netzanschlusspunkt, einschließlich Baukostenzuschuss (BKZ). Wechselrichter und Mittelspannungstransformatoren des Speichers zählen nicht. Mit gewähltem Netzgebiet gelten BKZ und Leitungskosten je Meter aus dem Atlas, alle übrigen Preise aus der Bachelorarbeit.</p>
    <div class="rgrid">
      <div class="panel" aria-labelledby="reh">
        <h3 id="reh">Eingaben</h3>
        <label class="rfeld"><span class="lab">Variante</span>
          <select id="r-var">${optVar(ids("vergleich"), "Kostenvergleich (A/B/C)")}${optVar(ids("leitfaden"), "Leitfaden, grob")}${optVar(Object.keys(R.NUR_TEXT), "Nur beschrieben, ohne Kostenzahl")}</select></label>
        <p class="rnote" id="r-vtext"></p>
        <label class="rfeld" id="r-pfeld"><span class="lab">Leistung <span id="r-pspan"></span></span>
          <span class="rzeile"><input type="range" id="r-prange" step="any"><input type="number" id="r-p" inputmode="decimal" aria-label="Leistung in kW"><span class="einh">kW</span></span></label>
        <label class="rfeld" id="r-lfeld"><span class="lab">Leitungslänge zum Netzanschlusspunkt</span>
          <span class="rzeile"><input type="range" id="r-lrange" min="0" max="5000" step="50"><input type="number" id="r-l" min="0" step="10" inputmode="decimal" aria-label="Leitungslänge in m"><span class="einh">m</span></span></label>
        <label class="rfeld"><span class="lab">Netzgebiet (Netzbetreiber)</span>
          <select id="r-vnb"><option value="">– ohne: Werte der Bachelorarbeit –</option>${R.netzbetreiber.map(n => `<option>${esc(n)}</option>`).join("")}</select></label>
        <p class="rnote">Netzgebiet auch per Klick auf die Karte wählbar.</p>
        <button type="button" class="rbtn" id="r-ref">Referenzfall: A, 10 MW, 500 m, ohne Netzgebiet</button>
      </div>
      <div class="panel" aria-labelledby="rergh" aria-live="polite">
        <h3 id="rergh">Ergebnis</h3>
        <div id="r-erg"></div>
      </div>
      <div class="panel wide" aria-labelledby="rslh">
        <div class="ph"><h3 id="rslh">Stückliste – was man braucht</h3><span class="lab" id="r-slsum"></span></div>
        <div class="rtbl" id="r-sl" role="table"></div>
        <p class="note2" id="r-stand"></p>
      </div>
    </div>`;
  const $ = id => document.getElementById(id);

  // ---------- Eingaben ----------
  function grenzen() {
    const cfg = R.VARIANTEN[st.v];
    return cfg ? [cfg.min, cfg.max] : [1000, 1000000];
  }
  function setzeEingaben() {
    $("r-var").value = st.v;
    const [lo, hi] = grenzen();
    st.P = Math.min(hi, Math.max(lo, st.P));
    // Regler logarithmisch über die Leistungsklasse
    $("r-prange").min = Math.log10(lo); $("r-prange").max = Math.log10(hi); $("r-prange").value = Math.log10(st.P);
    $("r-p").min = lo; $("r-p").max = hi; $("r-p").value = Math.round(st.P);
    $("r-pspan").textContent = `(Leistungsklasse ${leistung(lo)} – ${leistung(hi)})`;
    const ref = R.varianten[st.v];
    const mitL = !R.NUR_TEXT[st.v] && ref && ref.L != null;
    $("r-lfeld").hidden = !mitL;
    $("r-l").value = Math.round(st.L); $("r-lrange").value = Math.min(5000, st.L);
    $("r-vnb").value = st.vnb;
    const t = R.NUR_TEXT[st.v];
    $("r-vtext").textContent = t ? t.text : ref ? `${ref.bezeichnung} · Netzebene ${ref.netzebene}` : "";
    $("r-pfeld").hidden = !!(t && !t.bkz);
  }
  $("r-var").addEventListener("change", e => {
    st.v = e.target.value;
    const ref = R.varianten[st.v];
    if (ref && ref.P) st.P = ref.P;                    // Referenzleistung der Variante
    if (ref && ref.L != null) st.L = ref.L;
    aktualisiere();
  });
  $("r-prange").addEventListener("input", e => { st.P = Math.round(Math.pow(10, +e.target.value) / 10) * 10; aktualisiere(); });
  $("r-p").addEventListener("change", e => { st.P = +e.target.value || st.P; aktualisiere(); });
  $("r-lrange").addEventListener("input", e => { st.L = +e.target.value; aktualisiere(); });
  $("r-l").addEventListener("change", e => { st.L = Math.max(0, +e.target.value || 0); aktualisiere(); });
  $("r-vnb").addEventListener("change", e => { st.vnb = e.target.value; zurKarte(); aktualisiere(); });
  $("r-ref").addEventListener("click", () => { st = Object.assign(st, {v: "E4", P: 10000, L: 500, vnb: ""}); zurKarte(); aktualisiere(); });

  // ---------- Kopplung mit der Karte ----------
  function zurKarte() {
    if (typeof select !== "function") return;
    const ziel = st.vnb || null;
    if (ziel && selected !== ziel) select(ziel);
    else if (!ziel && selected && !selected.startsWith("id:")) select(selected);   // select() schaltet um → abwählen
  }
  function vonKarte() {
    const n = typeof selected === "undefined" ? null : selected;
    const neu = n && R.netzbetreiber.includes(n) ? n : "";
    if (neu !== st.vnb) { st.vnb = neu; aktualisiere(); } else kurzzeile();
  }
  if (typeof renderCard === "function") {
    const original = renderCard;
    renderCard = function () { original(); vonKarte(); };          // eslint-disable-line no-global-assign
  }

  // ---------- Ausgabe ----------
  function ergebnis() {
    if (R.NUR_TEXT[st.v]) return null;
    return R.kosten(st.v, st.P, st.L, st.vnb || null);
  }
  function zeichne(e) {
    const erg = $("r-erg"), sl = $("r-sl");
    if (!e) {
      const t = R.NUR_TEXT[st.v], u = R.untergrenze(st.v, st.P);
      erg.innerHTML = `<p class="rgross">keine Kostenzahl</p><p>${esc(t.text)}</p>` +
        (u ? `<div class="kv"><span class="k">Untergrenze: BKZ ${u.bkz} × ${leistung(st.P)}</span><span class="v">${eur(u.summe)}</span><span></span>
              <span class="k">BKZ (Wert der BA)</span><span class="v">${de(u.eurJeKW, 2)} €/kW</span><span></span></div>` +
              `<p class="rnote">${u.quellen.map(q => q.link ? `<a href="${esc(q.link)}" target="_blank" rel="noopener">${esc(q.titel)}</a>` : esc(q.titel)).join(" · ")}</p>` : "");
      sl.innerHTML = `<p class="rnote">Für diese Variante gibt es keine Stückliste mit Kosten.</p>`;
      $("r-slsum").textContent = "";
      return;
    }
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const reihen = R.gruppenReihenfolge.filter(g => e.gruppen[g] > 0);
    const balken = reihen.map(g => `<span style="flex:${e.gruppen[g]};background:var(${FARBE[g]})" title="${esc(g)}: ${eur(e.gruppen[g])}"></span>`).join("");
    const legende = reihen.map(g => `<span><i style="background:var(${FARBE[g]})"></i>${esc(g)} <b>${de(e.gruppen[g] / e.summe.typ * 100, 0)} %</b></span>`).join("");
    erg.innerHTML = `
      <div class="rkopf"><span class="pill ${e.geltung.startsWith("Kostenvergleich") ? "ok" : "grob"}">${esc(e.geltung)}</span></div>
      <p class="rgross">${eur(e.summe.typ)}</p>
      <p class="rspanne">Spanne ${eur(e.summe.min)} – ${eur(e.summe.max)} · typisch ${de(e.jeKW.typ, 0)} €/kW (${de(e.jeKW.min, 0)}–${de(e.jeKW.max, 0)})</p>
      <p class="rnote">${e.kurz ? "Option " + e.kurz + " · " : ""}${esc(e.bezeichnung)} · ${leistung(e.P)}${e.mitLeitung ? " · " + de(e.L, 0) + " m Leitung" : ""} · ${e.vnb ? esc(e.vnb) : "ohne Netzgebiet (Werte der BA)"}</p>
      <div class="rbar" role="img" aria-label="Anteile der Kostengruppen">${balken}</div>
      <div class="rleg">${legende}</div>
      ${e.vergleichUW ? `<p class="rnote">Zum Vergleich: ${de(e.vergleichUW.mio, 1)} Mio. € je Umspannwerk im Netzausbauplan des Netzbetreibers. ${esc(e.vergleichUW.text)}</p>` : ""}
      ${e.hinweise.map(h => `<p class="rhinweis">${esc(h)}</p>`).join("")}`;
    $("r-slsum").textContent = `${e.bausteine.length} Bausteine · Summe ${eur(e.summe.typ)}`;
    const herkunft = b => {
      const cls = b.herkunft === "veröffentlicht" || b.herkunft === "Netzausbauplan" ? "reg" : b.herkunft.startsWith("Schätzung") ? "proxy" : "ba";
      const text = b.herkunft === "veröffentlicht" ? "Atlas: veröffentlicht" : b.herkunft === "Netzausbauplan" ? "Atlas: Netzausbauplan" : b.herkunft.startsWith("Schätzung") ? "Atlas: Schätzung über Leistungspreis" : b.herkunft;
      return `<span class="hk ${cls}">${esc(text)}</span>`;
    };
    const belege = b => b.beleg ? `<a href="${esc(b.beleg)}" target="_blank" rel="noopener">Preisblatt</a>`
      : b.quellen.map(q => q.link ? `<a href="${esc(q.link)}" target="_blank" rel="noopener" title="${esc(q.titel)}">${q.id}</a>` : `<span title="${esc(q.titel)}">${q.id}</span>`).join(" ");
    sl.innerHTML = `<div class="tr th" role="row"><span role="columnheader">Baustein</span><span role="columnheader">Menge</span><span role="columnheader">Preis (typ.)</span><span role="columnheader">Kosten typ.</span><span role="columnheader">Spanne</span><span role="columnheader">Herkunft · Datenqualität</span><span role="columnheader">Quelle</span></div>` +
      e.bausteine.map(b => `<div class="tr" role="row">
        <span role="cell"><i style="background:var(${FARBE[b.gruppe]})"></i><b>${b.id}</b> ${esc(b.name)}</span>
        <span role="cell" class="num" title="Mengenformel: ${esc(b.formel)}">${de(b.menge, b.menge % 1 ? 1 : 0)}</span>
        <span role="cell" class="num">${de(b.preis.typ, b.preis.typ < 1000 ? 2 : 0)} ${esc(b.einheit)}</span>
        <span role="cell" class="num">${eur(b.kosten.typ)}</span>
        <span role="cell" class="num">${b.kosten.min === b.kosten.max ? "–" : eur(b.kosten.min) + " – " + eur(b.kosten.max)}</span>
        <span role="cell">${herkunft(b)} <small>${esc(b.datenqualitaet || "")}</small></span>
        <span role="cell">${belege(b)}</span></div>`).join("");
  }
  function kurzzeile() {
    const card = document.getElementById("card");
    if (!card || !st.vnb || typeof selected === "undefined" || selected !== st.vnb) return;
    const e = ergebnis();
    let z = card.querySelector(".rkurz");
    if (!z) { z = document.createElement("p"); z.className = "rkurz"; card.appendChild(z); }
    z.innerHTML = e ? `<b>Rechner</b> · ${e.kurz ? "Option " + e.kurz : esc(st.v)}, ${leistung(e.P)}${e.mitLeitung ? ", " + de(e.L, 0) + " m" : ""}: <b>${eur(e.summe.typ)}</b> (${eur(e.summe.min)} – ${eur(e.summe.max)}) <a href="#rechner">Details ↓</a>`
      : `<b>Rechner</b> · ${esc(st.v)}: keine Kostenzahl <a href="#rechner">Details ↓</a>`;
  }
  function aktualisiere() {
    setzeEingaben();
    let e = null;
    try { e = ergebnis(); } catch (err) { $("r-erg").innerHTML = `<p class="rhinweis">${esc(err.message)}</p>`; return; }
    zeichne(e);
    kurzzeile();
    speichere();
  }
  $("r-stand").innerHTML = `Kostendaten: Rechenmodell der Bachelorarbeit, ${esc(R.datenstand.replace(/^Excel .*?· geändert/, "Datenstand"))}. ` +
    `Regionale Werte: <a href="https://github.com/Signenum/netzkosten-atlas">Netzkosten-Atlas Deutschland</a> (Daniel Maier, CC BY-NC 4.0), Commit ${esc(R.atlas.commit)} vom ${esc(R.atlas.datum)}. ` +
    `Spanne: Min/Max der BA je Baustein; regionale Werte ohne Spanne, Schätzungen über den Leistungspreis mit 0,5–1,4-fach. Methodik: <a href="https://github.com/pstrittmatter13/netzanschluss-rechner/blob/main/METHODIK.md">METHODIK.md</a>.`;
  vonKarte();
  aktualisiere();
})();
