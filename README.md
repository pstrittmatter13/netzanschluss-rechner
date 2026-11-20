# Netzanschluss-Rechner

Was kostet der Netzanschluss eines Batteriespeichers? Der Rechner schätzt die Investitionskosten vom Ausgang
des Speichersystems bis zum Netzanschlusspunkt, einschließlich Baukostenzuschuss (BKZ), aus

- **Variante** (A eigener MS-Anschluss am Umspannwerk, B eigener HS-Anschluss, C1/C2 Co-Location am EE-Park, weitere Varianten als grober Leitfaden),
- **Leistung**, **Leitungslänge** und
- **Netzgebiet** (Netzbetreiber, per Klick auf die Karte).

Ergebnis: Kosten typisch mit Spanne Min–Max, Anteile der Kostengruppen und eine Stückliste mit Menge, Preis,
Herkunft und Quelle je Baustein.

Kostendaten und Rechnung stammen aus der Bachelorarbeit *Technisch-ökonomischer Vergleich von
Netzanschlusskonzepten für Batteriespeichersysteme* (Paul Schneider-Strittmatter, HTWG Konstanz). Karte und regionale Werte
stammen aus dem [Netzkosten-Atlas Deutschland](https://github.com/Signenum/netzkosten-atlas) von Daniel Maier.

## Benutzung

Offline: Repository herunterladen und `index.html` im Browser öffnen. Alle Daten, d3.js und Schriften liegen im
Repository, es werden keine Inhalte von Drittanbietern geladen.

## Inhalt

| Pfad | Inhalt |
|---|---|
| `index.html` | Karte des Atlas mit Rechner-Feld (erzeugt von `src/baue_seite.py`) |
| `rechner.js` | Rechnung, Schnittstelle `Rechner.kosten(variante, P_kW, L_m, vnb)` |
| `assets/rechner_feld.js`, `assets/rechner.css` | Oberfläche des Rechners |
| `data/modell_export.json` | Kostenkatalog, Stückliste und Datenstand aus dem Rechenmodell der Bachelorarbeit |
| `data/rechner_daten.js` | Modell-Export und regionale Atlas-Werte für den Browser (erzeugt) |
| `atlas/` | Netzkosten-Atlas, unveränderte Kopie (Commit und Datum in `atlas/HERKUNFT.txt`) |
| `src/hole_atlas.py` | kopiert den Atlas nach `atlas/` |
| `src/baue_seite.py` | erzeugt `data/rechner_daten.js` und `index.html` |
| `test/pruefe.html` | prüft `rechner.js` gegen die Kontrollsummen des Rechenmodells |
| `METHODIK.md` | Rechnung, Datenherkunft, Grenzen |

## Aktualisieren

1. Rechenmodell laufen lassen (`python -m modell.rechne` in `ba-rechenmodell`), es schreibt `ergebnisse/rechner_export.json`.
2. Bei neuem Atlas-Stand: `python src/hole_atlas.py`.
3. `python src/baue_seite.py` (liest standardmäßig `../ba-rechenmodell/ergebnisse/rechner_export.json`).
4. `test/pruefe.html` über einen lokalen Webserver öffnen (`python -m http.server`), Ergebnis muss „alle Varianten stimmen“ lauten.

Benötigt Python 3.9+ (nur Standardbibliothek) und git.

## Grenzen

- Gerätepreise gelten für den Referenzfall 10 MW. Bei anderer Leistung ist das Ergebnis grob; die Leistung ist je Variante auf eine Leistungsklasse begrenzt.
- Höchstspannung (E1, E2) ohne Kostenzahl, nur Baukostenzuschuss als Untergrenze.
- Regionale Werte nur für die im Atlas erfassten Netzbetreiber; sonst gelten die Werte der Bachelorarbeit.
- Keine Gewähr. Maßgeblich sind die Preisblätter und Angebote der Netzbetreiber und Hersteller.

Details in [METHODIK.md](METHODIK.md).

## Quellen und Lizenzen

- Kostendaten: Rechenmodell der Bachelorarbeit, Quellen je Baustein in der Stückliste
- Karte, Netzgebiete, BKZ und Netzausbau-Kennwerte: Netzkosten-Atlas Deutschland, Daniel Maier, CC BY-NC 4.0; Geobasisdaten © GeoBasis-DE / BKG 2026 (dl-de/by-2-0), siehe `atlas/README.md`
- d3.js 7.8.5 (ISC), Schriften Barlow, Barlow Semi Condensed, JetBrains Mono (SIL Open Font License), siehe `atlas/assets/`

Dieses Werk steht unter **CC BY-NC 4.0** ([LICENSE](LICENSE)): Nutzung, Weitergabe und Bearbeitung mit Namensnennung, nicht kommerziell.

Autor: Paul Schneider-Strittmatter · Keine Gewähr für Richtigkeit und Vollständigkeit.
