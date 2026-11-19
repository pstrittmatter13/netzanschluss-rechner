"""Erzeugt data/rechner_daten.js und index.html.

1. Kostendaten: Export des BA-Rechenmodells (ba-rechenmodell/ergebnisse/rechner_export.json, entsteht bei
   `python -m modell.rechne`) → Kopie data/modell_export.json. Kein eigener Datenstand im Rechner.
2. Regionale Werte je Netzbetreiber aus der Atlas-Kopie (atlas/data/vnb_kennwerte.csv, atlas/data/bkz.csv).
3. data/rechner_daten.js = beides als JavaScript (damit index.html auch ohne Server, direkt aus dem Ordner läuft).
4. index.html = atlas/index.html (Daniels Karte, unverändert) + Pfade auf atlas/assets + Rechner-Feld.

Aufruf im Projektordner:   python src/baue_seite.py [Pfad zu rechner_export.json]
Benötigt: Python 3.9+ (nur Standardbibliothek).
"""
import csv
import json
import re
import sys
from pathlib import Path

PROJEKT = Path(__file__).resolve().parent.parent
ATLAS = PROJEKT / "atlas"
EXPORT_STANDARD = PROJEKT.parent / "ba-rechenmodell" / "ergebnisse" / "rechner_export.json"

# BKZ-Netzebene im Atlas (bkz.csv) → Baustein im BA-Kostenkatalog
BKZ_EBENE = {"HS": "K17.3", "HS/MS": "K17.4", "MS": "K17.5", "MS/NS": "K17.6", "NS": "K17.7"}


def zahl(x):
    x = (x or "").strip()
    return round(float(x), 2) if x else None


def lies_modell(pfad):
    modell = json.loads(Path(pfad).read_text(encoding="utf-8"))
    # Quellen ohne öffentlichen Link (z. B. Angebote per E-Mail) nur als Art nennen, nicht mit Namen
    for q in modell["quellen"].values():
        if not str(q.get("link") or "").startswith("http"):
            q["titel"], q["link"] = "nicht veröffentlichte Angabe (Herstellerauskunft)", None
    return modell


def lies_atlas():
    vnb = {}
    with open(ATLAS / "data" / "vnb_kennwerte.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            vnb[r["VNB"]] = {
                "bl": r["Bundesland"], "typ": r["Netztyp"],
                "ms": zahl(r["MS-Leitung €/m"]), "ns": zahl(r["NS-Leitung €/m"]), "hs": zahl(r["HS-Leitung €/m"]),
                "ons": zahl(r["ONS T€/Stück"]), "uw": zahl(r["UW Mio. €/UW"]),
                "bkz_ms": zahl(r["BKZ MS €/kW"]), "bkz_ms_basis": r["BKZ-Basis"] or None, "bkz": {}}
    with open(ATLAS / "data" / "bkz.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            k = BKZ_EBENE.get(r["Netzebene"])
            if k and r["VNB"] in vnb and zahl(r["BKZ_EUR_kW"]) is not None:
                vnb[r["VNB"]]["bkz"][k] = {"w": zahl(r["BKZ_EUR_kW"]), "stand": r["Stand"] or None,
                                           "quelle": r["Quelle"] or None}
    herkunft = dict(z.split(":", 1) for z in (ATLAS / "HERKUNFT.txt").read_text(encoding="utf-8").splitlines()[1:] if ":" in z)
    return {"commit": herkunft["Commit"].strip()[:7], "datum": herkunft["Datum"].strip()[:10], "vnb": vnb}


def baue_index():
    t = (ATLAS / "index.html").read_text(encoding="utf-8")
    t = re.sub(r'(src|href)="assets/', r'\1="atlas/assets/', t)
    t = t.replace("<title>Netzkosten-Atlas Deutschland</title>",
                  "<title>Netzanschluss-Rechner</title>", 1)
    t = t.replace("<h1>Netzkosten-Atlas Deutschland</h1>",
                  '<h1>Netzanschluss-Rechner</h1>\n    <p class="sub">Batteriespeicher: Kosten des Netzanschlusses nach Variante, '
                  'Leistung, Leitungslänge und Netzgebiet · Karte: Netzkosten-Atlas Deutschland (Daniel Maier)</p>', 1)
    t = t.replace('<section class="dev" aria-labelledby="devh">',
                  '<section class="dev" aria-labelledby="rh" id="rechner"></section>\n\n'
                  '<section class="dev" aria-labelledby="devh">', 1)
    feld = ('<link rel="stylesheet" href="assets/rechner.css">\n'
            '<script src="data/rechner_daten.js"></script>\n'
            '<script src="rechner.js"></script>\n'
            '<script src="assets/rechner_feld.js"></script>\n')
    t = t.replace("\n<footer", "\n" + feld + "\n<footer", 1)
    t = t.replace("<footer", '<footer style="max-width:1400px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left,0px));'
                  'font-size:12px;color:#5b6660;line-height:1.5">Netzanschluss-Rechner · Paul Schneider-Strittmatter · Kostendaten aus der '
                  'Bachelorarbeit (HTWG Konstanz) · <a href="https://github.com/pstrittmatter13/netzanschluss-rechner">Quellcode und Methodik</a> · '
                  'CC BY-NC 4.0</footer>\n<footer', 1)
    assert t.count("rechner_feld.js") == 1 and 'id="rechner"' in t, "Einfügestellen in atlas/index.html nicht gefunden"
    (PROJEKT / "index.html").write_text(t, encoding="utf-8")


def main():
    export = Path(sys.argv[1]) if len(sys.argv) > 1 else EXPORT_STANDARD
    modell = lies_modell(export)
    (PROJEKT / "data").mkdir(exist_ok=True)
    (PROJEKT / "data" / "modell_export.json").write_text(json.dumps(modell, ensure_ascii=False, indent=1), encoding="utf-8")
    atlas = lies_atlas()
    daten = {"modell": modell, "atlas": atlas}
    (PROJEKT / "data" / "rechner_daten.js").write_text(
        "// erzeugt mit src/baue_seite.py – nicht von Hand ändern\nwindow.RECHNER_DATEN = "
        + json.dumps(daten, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    baue_index()
    print("Modell:", modell["datenstand"])
    print("Atlas: ", atlas["commit"], atlas["datum"], len(atlas["vnb"]), "Netzbetreiber")


if __name__ == "__main__":
    main()
