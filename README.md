# Steuertermin MCP

MCP-Server für deutsche Steuertermine und Finanzamt-Fristen. Kein Login, keine API, keine Konfiguration — einfach installieren und fragen.

---

## Tools

| Tool | Beschreibung |
|------|-------------|
| `steuer_naechste_termine` | Nächste Fristen (konfigurierbar: X Tage voraus, nach Typ filtern) |
| `steuer_jahresuebersicht` | Alle Termine eines Jahres, nach Monat gegliedert |
| `steuer_monat` | Alle Termine eines bestimmten Monats |

**Abgedeckte Steuerarten:**
- Umsatzsteuer-Voranmeldung (monatlich) + Jahreserklärung
- Lohnsteuer-Anmeldung (monatlich)
- Gewerbesteuer-Vorauszahlung (quartalsweise)
- Körperschaftsteuer-Vorauszahlung + Jahreserklärung
- Einkommensteuer-Vorauszahlung + Jahreserklärung
- Offenlegung Jahresabschluss (GmbH/UG)

---

## Installation

```bash
git clone https://github.com/altovate-GmbH/steuertermin-mcp.git
cd steuertermin-mcp
npm install
npm run build
claude mcp add steuertermin node /absoluter/pfad/zu/steuertermin-mcp/dist/index.js
```

---

## Beispiel-Prompts

```
Was sind meine nächsten Steuertermine?
```

```
Zeig mir alle Steuertermine im Juli.
```

```
Welche Umsatzsteuer-Fristen habe ich noch dieses Jahr?
```

```
Erstelle mir eine Jahresübersicht aller Steuertermine 2026.
```

---

## Hinweise

- Termine berechnen sich dynamisch für das aktuelle und nächste Jahr
- Karenzregel (Verschiebung auf Werktag bei Sa/So) ist für 2026 eingearbeitet
- Kein Ersatz für Steuerberatung — bei konkreten Fällen immer Steuerberater fragen

---

## License

MIT — Built by [Alexander Buchmann](https://altovate.de) / [Altovate GmbH](https://altovate.de)
