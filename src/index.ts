import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

interface Steuertermin {
  datum: string; // YYYY-MM-DD
  bezeichnung: string;
  typ: TerminTyp;
  beschreibung: string;
  rhythmus: 'monatlich' | 'quartalsweise' | 'jährlich';
  hinweis?: string;
}

type TerminTyp =
  | 'umsatzsteuer'
  | 'lohnsteuer'
  | 'koerperschaftsteuer'
  | 'einkommensteuer'
  | 'gewerbesteuer'
  | 'sonstige';

// Karenzregel: fällt ein Fristende auf Sa/So/Feiertag, verschiebt es sich
// auf den nächsten Werktag. Wir bilden das durch explizite Datumsangaben ab.

function buildTermine(jahr: number): Steuertermin[] {
  const termine: Steuertermin[] = [];

  // ── Umsatzsteuer-Voranmeldung (monatlich, 10. des Folgemonats) ──────────
  const ustvaMonate = [
    { monat: 1, tag: '10', fuer: 'Dezember' },
    { monat: 2, tag: '10', fuer: 'Januar' },
    { monat: 3, tag: '10', fuer: 'Februar' },
    { monat: 4, tag: '10', fuer: 'März' },
    { monat: 5, tag: '12', fuer: 'April' }, // 10. ist Sa → 12.
    { monat: 6, tag: '10', fuer: 'Mai' },
    { monat: 7, tag: '10', fuer: 'Juni' },
    { monat: 8, tag: '11', fuer: 'Juli' }, // 10. ist So → 11.
    { monat: 9, tag: '10', fuer: 'August' },
    { monat: 10, tag: '10', fuer: 'September' },
    { monat: 11, tag: '10', fuer: 'Oktober' },
    { monat: 12, tag: '10', fuer: 'November' },
  ];

  for (const m of ustvaMonate) {
    const monatStr = String(m.monat).padStart(2, '0');
    termine.push({
      datum: `${m.monat === 1 ? jahr : jahr}-${monatStr}-${m.tag}`,
      bezeichnung: `UStVA ${m.fuer} ${m.monat === 1 ? jahr - 1 : jahr}`,
      typ: 'umsatzsteuer',
      rhythmus: 'monatlich',
      beschreibung: `Umsatzsteuer-Voranmeldung für ${m.fuer} — elektronisch via ELSTER`,
      hinweis: 'Dauerfristverlängerung möglich (+ 1 Monat gegen Sondervorauszahlung)',
    });
  }

  // ── USt-Jahreserklärung ─────────────────────────────────────────────────
  termine.push({
    datum: `${jahr}-07-31`,
    bezeichnung: `USt-Jahreserklärung ${jahr - 1}`,
    typ: 'umsatzsteuer',
    rhythmus: 'jährlich',
    beschreibung: `Umsatzsteuer-Jahreserklärung für ${jahr - 1}`,
    hinweis: 'Mit Steuerberater: Fristverlängerung bis Ende Februar des Folgejahres möglich',
  });

  // ── Lohnsteuer-Anmeldung (monatlich) ───────────────────────────────────
  for (let monat = 1; monat <= 12; monat++) {
    const fuerMonat = monat === 1 ? `Dezember ${jahr - 1}` : `${['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][monat - 1]} ${jahr}`;
    const monatStr = String(monat).padStart(2, '0');
    termine.push({
      datum: `${jahr}-${monatStr}-10`,
      bezeichnung: `Lohnsteuer ${fuerMonat}`,
      typ: 'lohnsteuer',
      rhythmus: 'monatlich',
      beschreibung: `Lohnsteuer-Anmeldung und -Zahlung für ${fuerMonat}`,
      hinweis: 'Kleinstbetriebe (< 1.080 €/Jahr) können quartalsweise anmelden',
    });
  }

  // ── Gewerbesteuer (quartalsweise: 15. Feb, Mai, Aug, Nov) ──────────────
  const gewerbeQuartale = [
    { monat: '02', tag: '17', quartalsbezeichnung: '1. Vorauszahlung' },
    { monat: '05', tag: '15', quartalsbezeichnung: '2. Vorauszahlung' },
    { monat: '08', tag: '15', quartalsbezeichnung: '3. Vorauszahlung' },
    { monat: '11', tag: '17', quartalsbezeichnung: '4. Vorauszahlung' },
  ];
  for (const q of gewerbeQuartale) {
    termine.push({
      datum: `${jahr}-${q.monat}-${q.tag}`,
      bezeichnung: `Gewerbesteuer ${q.quartalsbezeichnung} ${jahr}`,
      typ: 'gewerbesteuer',
      rhythmus: 'quartalsweise',
      beschreibung: `Gewerbesteuer-Vorauszahlung (${q.quartalsbezeichnung}) — Zahlung an Gemeinde`,
      hinweis: 'Höhe richtet sich nach dem Steuermessbetrag des Vorjahres',
    });
  }

  // ── Körperschaftsteuer-Vorauszahlung (quartalsweise) ───────────────────
  const kstQuartale = [
    { monat: '03', tag: '10', label: '1. Quartal' },
    { monat: '06', tag: '10', label: '2. Quartal' },
    { monat: '09', tag: '10', label: '3. Quartal' },
    { monat: '12', tag: '10', label: '4. Quartal' },
  ];
  for (const q of kstQuartale) {
    termine.push({
      datum: `${jahr}-${q.monat}-${q.tag}`,
      bezeichnung: `KSt-Vorauszahlung ${q.label} ${jahr}`,
      typ: 'koerperschaftsteuer',
      rhythmus: 'quartalsweise',
      beschreibung: `Körperschaftsteuer-Vorauszahlung ${q.label} inkl. Solidaritätszuschlag`,
    });
  }

  // ── KSt-Jahreserklärung ─────────────────────────────────────────────────
  termine.push({
    datum: `${jahr}-07-31`,
    bezeichnung: `KSt-Jahreserklärung ${jahr - 1}`,
    typ: 'koerperschaftsteuer',
    rhythmus: 'jährlich',
    beschreibung: `Körperschaftsteuer-Erklärung für ${jahr - 1} — GmbH, UG, AG`,
    hinweis: 'Mit Steuerberater: bis Ende Februar des Folgejahres',
  });

  // ── Einkommensteuer-Vorauszahlung (quartalsweise) ──────────────────────
  const estQuartale = [
    { monat: '03', tag: '10', label: '1. Quartal' },
    { monat: '06', tag: '10', label: '2. Quartal' },
    { monat: '09', tag: '10', label: '3. Quartal' },
    { monat: '12', tag: '10', label: '4. Quartal' },
  ];
  for (const q of estQuartale) {
    termine.push({
      datum: `${jahr}-${q.monat}-${q.tag}`,
      bezeichnung: `ESt-Vorauszahlung ${q.label} ${jahr}`,
      typ: 'einkommensteuer',
      rhythmus: 'quartalsweise',
      beschreibung: `Einkommensteuer-Vorauszahlung ${q.label} — Einzelunternehmer, Freiberufler, GbR`,
    });
  }

  // ── ESt-Jahreserklärung ─────────────────────────────────────────────────
  termine.push({
    datum: `${jahr}-07-31`,
    bezeichnung: `ESt-Jahreserklärung ${jahr - 1}`,
    typ: 'einkommensteuer',
    rhythmus: 'jährlich',
    beschreibung: `Einkommensteuererklärung für ${jahr - 1}`,
    hinweis: 'Pflicht bei selbstständiger Tätigkeit. Mit Steuerberater: bis Ende Februar des Folgejahres',
  });

  // ── Sonstige: Offenlegung Jahresabschluss (GmbH/UG) ────────────────────
  termine.push({
    datum: `${jahr}-12-31`,
    bezeichnung: `Offenlegung Jahresabschluss ${jahr - 1}`,
    typ: 'sonstige',
    rhythmus: 'jährlich',
    beschreibung: `GmbH/UG: Jahresabschluss ${jahr - 1} beim Bundesanzeiger einreichen`,
    hinweis: 'Frist: 12 Monate nach Geschäftsjahresende. Verspätung → Ordnungsgeld ab 2.500 €',
  });

  return termine.sort((a, b) => a.datum.localeCompare(b.datum));
}

function formatDatum(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function getDaysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function dringlichkeitsBadge(tage: number): string {
  if (tage < 0) return '✓ vergangen';
  if (tage === 0) return '🚨 HEUTE';
  if (tage <= 7) return `⚠️ in ${tage} Tag${tage === 1 ? '' : 'en'}`;
  if (tage <= 30) return `📅 in ${tage} Tagen`;
  return `🗓 in ${tage} Tagen`;
}

const TYP_LABELS: Record<TerminTyp, string> = {
  umsatzsteuer: 'Umsatzsteuer',
  lohnsteuer: 'Lohnsteuer',
  koerperschaftsteuer: 'Körperschaftsteuer',
  einkommensteuer: 'Einkommensteuer',
  gewerbesteuer: 'Gewerbesteuer',
  sonstige: 'Sonstige',
};

// ── MCP Server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'steuertermin-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'steuer_naechste_termine',
      description: 'Zeigt die nächsten deutschen Steuertermine und Finanzamt-Fristen. Perfekt für den Wochenstart oder den Monatsüberblick.',
      inputSchema: {
        type: 'object',
        properties: {
          tage: {
            type: 'number',
            description: 'Wie viele Tage voraus anzeigen (Standard: 60)',
          },
          typ: {
            type: 'string',
            enum: ['umsatzsteuer', 'lohnsteuer', 'koerperschaftsteuer', 'einkommensteuer', 'gewerbesteuer', 'sonstige'],
            description: 'Nur Termine dieses Steuertyps anzeigen (optional)',
          },
        },
      },
    },
    {
      name: 'steuer_jahresuebersicht',
      description: 'Vollständige Übersicht aller Steuertermine für ein Jahr — ideal für Jahresplanung oder Kalenderimport.',
      inputSchema: {
        type: 'object',
        properties: {
          jahr: {
            type: 'number',
            description: 'Kalenderjahr (Standard: aktuelles Jahr)',
          },
          typ: {
            type: 'string',
            enum: ['umsatzsteuer', 'lohnsteuer', 'koerperschaftsteuer', 'einkommensteuer', 'gewerbesteuer', 'sonstige'],
            description: 'Nur Termine dieses Steuertyps anzeigen (optional)',
          },
        },
      },
    },
    {
      name: 'steuer_monat',
      description: 'Alle Steuertermine eines bestimmten Monats auf einen Blick.',
      inputSchema: {
        type: 'object',
        properties: {
          monat: {
            type: 'number',
            description: 'Monat als Zahl (1–12)',
          },
          jahr: {
            type: 'number',
            description: 'Jahr (Standard: aktuelles Jahr)',
          },
        },
        required: ['monat'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const heute = new Date();
  const aktuellesJahr = heute.getFullYear();

  try {
    if (name === 'steuer_naechste_termine') {
      const { tage = 60, typ } = (args ?? {}) as { tage?: number; typ?: TerminTyp };
      const bis = new Date(heute);
      bis.setDate(bis.getDate() + tage);

      const bisString = bis.toISOString().split('T')[0];
      const heuteString = heute.toISOString().split('T')[0];

      let termine = [
        ...buildTermine(aktuellesJahr),
        ...buildTermine(aktuellesJahr + 1),
      ].filter(
        (t) => t.datum >= heuteString && t.datum <= bisString
      );

      if (typ) termine = termine.filter((t) => t.typ === typ);

      if (termine.length === 0) {
        return {
          content: [{ type: 'text', text: `Keine Steuertermine in den nächsten ${tage} Tagen${typ ? ` (Typ: ${TYP_LABELS[typ]})` : ''}.` }],
        };
      }

      const lines = termine.map((t) => {
        const daysUntil = getDaysUntil(t.datum);
        return [
          `**${formatDatum(t.datum)} — ${t.bezeichnung}** ${dringlichkeitsBadge(daysUntil)}`,
          `Typ: ${TYP_LABELS[t.typ]} | ${t.beschreibung}`,
          t.hinweis ? `💡 ${t.hinweis}` : null,
        ]
          .filter(Boolean)
          .join('\n');
      });

      return {
        content: [
          {
            type: 'text',
            text: `**Nächste ${termine.length} Steuertermine (${tage} Tage)**\n\n${lines.join('\n\n')}`,
          },
        ],
      };
    }

    if (name === 'steuer_jahresuebersicht') {
      const { jahr = aktuellesJahr, typ } = (args ?? {}) as { jahr?: number; typ?: TerminTyp };
      let termine = buildTermine(jahr);
      if (typ) termine = termine.filter((t) => t.typ === typ);

      const gruppiertNachMonat = new Map<number, Steuertermin[]>();
      for (const t of termine) {
        const monat = parseInt(t.datum.split('-')[1]);
        if (!gruppiertNachMonat.has(monat)) gruppiertNachMonat.set(monat, []);
        gruppiertNachMonat.get(monat)!.push(t);
      }

      const MONATE = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

      const sections: string[] = [];
      for (const [monat, mTermine] of [...gruppiertNachMonat.entries()].sort((a, b) => a[0] - b[0])) {
        const lines = mTermine.map((t) => `  • ${formatDatum(t.datum)}: ${t.bezeichnung}`);
        sections.push(`**${MONATE[monat]}**\n${lines.join('\n')}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `**Steuertermine ${jahr}**${typ ? ` — ${TYP_LABELS[typ]}` : ''} (${termine.length} Termine)\n\n${sections.join('\n\n')}`,
          },
        ],
      };
    }

    if (name === 'steuer_monat') {
      const { monat, jahr = aktuellesJahr } = (args ?? {}) as { monat: number; jahr?: number };

      if (monat < 1 || monat > 12) {
        return { content: [{ type: 'text', text: 'Monat muss zwischen 1 und 12 liegen.' }] };
      }

      const monatStr = String(monat).padStart(2, '0');
      const termine = buildTermine(jahr).filter((t) => t.datum.startsWith(`${jahr}-${monatStr}`));

      const MONATE = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

      if (termine.length === 0) {
        return { content: [{ type: 'text', text: `Keine Steuertermine im ${MONATE[monat]} ${jahr}.` }] };
      }

      const lines = termine.map((t) => {
        const daysUntil = getDaysUntil(t.datum);
        const badge = daysUntil >= 0 ? ` ${dringlichkeitsBadge(daysUntil)}` : '';
        return [
          `**${formatDatum(t.datum)} — ${t.bezeichnung}**${badge}`,
          `${TYP_LABELS[t.typ]}: ${t.beschreibung}`,
          t.hinweis ? `💡 ${t.hinweis}` : null,
        ]
          .filter(Boolean)
          .join('\n');
      });

      return {
        content: [
          {
            type: 'text',
            text: `**Steuertermine ${MONATE[monat]} ${jahr}** (${termine.length} Termine)\n\n${lines.join('\n\n')}`,
          },
        ],
      };
    }

    return { content: [{ type: 'text', text: `Unbekanntes Tool: ${name}` }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Fehler: ${msg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
