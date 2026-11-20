# Methodik

## 1. Rechnung

Wie im Rechenmodell der Bachelorarbeit (`ba-rechenmodell/modell/rechnung.py`):

`Kosten = Σ über alle Bausteine der Stückliste: Menge × Preis`

Die Mengen sind Formeln je Variante aus dem Blatt „Stückliste“, z. B. `L × e × k` für die MS-Leitung. Größen darin:

| Größe | Bedeutung | im Rechner |
|---|---|---|
| P | Speicherleistung in kW | Eingabe |
| Bezugsleistung | bestellte Bezugsleistung (Grundlage BKZ) | P, bei Varianten ohne Netzbezug 0 (wie in der Stückliste) |
| L | Leitungslänge in m | Eingabe (nur bei Varianten mit Leitung) |
| e | Anzahl Leitungsenden | fest je Variante |
| m | Anzahl Haupttransformatoren | fest je Variante |
| S_haupt | Scheinleistung P / cos φ in MVA, cos φ = 0,95 | aus P |
| k | Anzahl MS-Kabelsysteme = aufrunden(P / 12 MW) | aus P |

Min, Typ und Max werden getrennt mit den Preisen Min, Typ und Max des Kostenkatalogs gerechnet. Fehlt Min oder Max, gilt Typ.
`test/pruefe.html` prüft, dass der Rechner ohne Netzgebiet für alle Varianten genau die Summen des Rechenmodells liefert.

## 2. Datenherkunft

**Bachelorarbeit:** Preise (Kostenkatalog), Mengenformeln (Stückliste), Kostengruppen und Quellen kommen nur aus dem
Export des Rechenmodells (`data/modell_export.json`, Datenstand mit Prüfsumme der Excel-Datei). Der Rechner hat keinen eigenen Datenstand.
Quellen ohne öffentlichen Link (Herstellerauskünfte) werden nur als Art genannt.

**Netzkosten-Atlas, je Netzgebiet:** Nur zwei Arten von Bausteinen werden regional ersetzt:

| Baustein | Atlas-Wert | Kennzeichnung | Spanne |
|---|---|---|---|
| K17.3–K17.7 Baukostenzuschuss | veröffentlichter BKZ der passenden Netzebene (`bkz.csv`: HS, HS/MS, MS, MS/NS, NS) | „veröffentlicht“ mit Link zum Preisblatt | keine |
| K17.5 BKZ Mittelspannung, wenn nicht veröffentlicht | Leistungspreis ≥ 2.500 h MS 2026 (Atlas-Proxy, METHODIK Abschnitt 3) | „Schätzung über Leistungspreis“ | 0,5- bis 1,4-fach (Abweichung laut Atlas) |
| K14 MS-Leitung, K15 HS-Leitung | €/m aus dem Netzausbauplan des Netzbetreibers | „Netzausbauplan“ | keine |

Gibt der Atlas für einen Baustein keinen Wert an, gilt der Wert der Bachelorarbeit („BA (keine Atlas-Angabe)“).
Umspannwerke und Ortsnetzstationen aus dem Atlas sind Ausbaukosten des Netzbetreibers (mehrere Transformatoren,
Erweiterungen) und werden nicht für das Kunden-Umspannwerk K07c verwendet; bei Varianten mit K07c erscheint der Atlas-Wert nur als Vergleich.

## 3. Varianten und Geltungsbereich

- **Kostenvergleich (A, B, C1, C2):** wie Kapitel 5 der Bachelorarbeit, Referenzfall 10 MW. Bei anderer Leistung gilt das Ergebnis als grob, weil die Gerätepreise für den 10-MW-Fall erhoben sind.
- **Leitfaden, grob:** weitere Varianten (E3e, E3, E5, E6, E7, M3, M2) mit ihrer Referenzleistung als Voreinstellung.
- **Nur beschrieben:** E1 und E2 (Höchstspannung) ohne Kostenzahl, Untergrenze = BKZ × P; M4, M1d, X1 nur als Text.
- **Leistungsklassen** je Variante (Eingabe wird darauf begrenzt) sind eine Festlegung des Rechners (19.11.2026), keine Aussage der Bachelorarbeit:

| Variante | Leistungsklasse |
|---|---|
| A (E4) | 2–20 MW |
| B (E3_10MW) | 5–60 MW |
| C1, C2 (M1, M1n) | 1–20 MW |
| E3e, E3 | 10–60 MW |
| E5 | 0,5–8 MW |
| E6 | 30–1.000 kW |
| E7 | 30–250 kW |
| M3 | 0,1–10 MW |
| M2 | 10–100 MW |

## 4. Zusammenführung mit dem Atlas

`atlas/` ist eine unveränderte Kopie des Atlas. `src/baue_seite.py` setzt beim Erzeugen von `index.html` nur die Pfade auf `atlas/assets/`,
ändert Titel und Überschrift und fügt das Rechner-Feld unter der Karte und eine Kurzzeile im Steckbrief ein. Der Rechner nutzt aus der Karte
nur `selected`, `select()` und `renderCard()`. Netzbetreiber-Namen sind dieselben wie in der Spalte `VNB` des Atlas.
Für eine Zusammenführung genügen im Atlas `rechner.js`, `assets/rechner_feld.js`, `assets/rechner.css` und `data/rechner_daten.js`.
