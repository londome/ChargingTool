import { useState } from 'react';
import { BookOpen, ChevronRight, Zap, Truck, BarChart3, BatteryCharging, Gauge, ArrowRight, Info, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  articles: Article[];
}

interface Article {
  id: string;
  title: string;
  content: React.ReactNode;
}

// ─── Inhalte ──────────────────────────────────────────────────────────────────

const sections: Section[] = [
  {
    id: 'einstieg',
    title: 'Erste Schritte',
    icon: BookOpen,
    color: '#0079C0',
    articles: [
      {
        id: 'was-ist-fleetiq',
        title: 'Was ist FleetIQ?',
        content: (
          <div className="space-y-4">
            <p>
              <strong>FleetIQ</strong> ist eine Analyse-Plattform von iE2S, die Unternehmen dabei unterstützt,
              ihre Fahrzeugflotten schrittweise zu elektrifizieren. Die Plattform bietet vier spezialisierte
              Analyse-Module, die je nach Fragestellung eingesetzt werden können.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: '🚛', title: 'Flottenelektrifizierung', desc: 'Welche Fahrzeuge können durch EVs ersetzt werden? TCO- und CO₂-Vergleich.' },
                { icon: '📍', title: 'Reichweiten-Simulator', desc: 'Reale Reichweite unter verschiedenen Bedingungen simulieren.' },
                { icon: '⚡', title: 'Ladeoptimierung', desc: 'Ladezeiten optimieren, Stromkosten senken, Netzbelastung reduzieren.' },
                { icon: '🔁', title: 'Bidirektionales Laden', desc: 'V2G-Arbitrage: Strom günstig laden, teuer zurückspeisen.' },
              ].map(m => (
                <div key={m.title} className="flex gap-3 p-3 bg-[#e6f3fc] rounded border border-[#BAE6FF]">
                  <span className="text-xl">{m.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-[#001141]">{m.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'projekt-erstellen',
        title: 'Ein Projekt erstellen',
        content: (
          <div className="space-y-4">
            <p>Jede Analyse beginnt mit einem <strong>Projekt</strong>. Ein Projekt enthält alle Informationen über Ihre Flotte, Routen und Szenarien.</p>
            <ol className="space-y-3">
              {[
                { step: '1', title: 'Dashboard öffnen', desc: 'Klicken Sie auf „Neues Projekt" oder „Analyse starten".' },
                { step: '2', title: 'Modul auswählen', desc: 'Wählen Sie das passende Analyse-Modul für Ihre Fragestellung.' },
                { step: '3', title: 'Projektdaten eingeben', desc: 'Name, Branche, Land und Depot-Standort erfassen.' },
                { step: '4', title: 'Flotte erfassen', desc: 'Fahrzeugtypen, Anzahl und Einsatzprofil eingeben.' },
                { step: '5', title: 'Routen definieren', desc: 'Tourdaten manuell eingeben oder als CSV hochladen.' },
                { step: '6', title: 'Simulation starten', desc: 'Szenarien konfigurieren und Analyse ausführen.' },
              ].map(s => (
                <li key={s.step} className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-[#0079C0] text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
                  <div>
                    <p className="text-sm font-medium text-[#001141]">{s.title}</p>
                    <p className="text-xs text-slate-500">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ),
      },
      {
        id: 'daten-eingabe',
        title: 'Daten eingeben: manuell vs. CSV',
        content: (
          <div className="space-y-4">
            <p>FleetIQ bietet zwei Wege zur Dateneingabe:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 border rounded space-y-2">
                <p className="font-medium text-[#001141] text-sm">✍️ Manuelle Eingabe</p>
                <p className="text-xs text-slate-500">Ideal für kleinere Flotten oder erste Schätzungen. Sie geben Distanz, Fahrten pro Jahr und Fahrzeugtyp direkt ein.</p>
                <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                  <li>Schneller Einstieg</li>
                  <li>Keine Datei erforderlich</li>
                  <li>Default: 250 Fahrten/Jahr</li>
                </ul>
              </div>
              <div className="p-4 border rounded space-y-2">
                <p className="font-medium text-[#001141] text-sm">📁 CSV-Upload</p>
                <p className="text-xs text-slate-500">Für präzise Analysen mit realen Tourdaten. Jede Zeile entspricht einer tatsächlichen Fahrt mit Datum, Distanz und Fahrzeug-ID.</p>
                <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                  <li>Höchste Genauigkeit</li>
                  <li>Beliebig viele Routen</li>
                  <li>Automatische Jahresaggregation</li>
                </ul>
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              <strong>Hinweis:</strong> Bei CSV-Upload entspricht jede Zeile einer realen Fahrt (trips_per_year = 1).
              Bei manueller Eingabe multipliziert das System die Kosten mit der angegebenen Jahresfahrtenanzahl.
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: 'flottenelektrifizierung',
    title: 'Modul: Flottenelektrifizierung',
    icon: Truck,
    color: '#043F2E',
    articles: [
      {
        id: 'wie-funktioniert',
        title: 'Wie funktioniert die Simulation?',
        content: (
          <div className="space-y-4">
            <p>Die Flottenelektrifizierungs-Simulation vergleicht für jede Route die Kosten und CO₂-Emissionen eines Verbrennungsfahrzeugs (ICE) mit einem passenden Elektrofahrzeug (EV).</p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#001141]">Berechnungslogik:</p>
              <div className="bg-slate-50 rounded p-3 font-mono text-xs space-y-1 text-slate-700">
                <p>ICE-Kosten = (km / 100) × Verbrauch_l × Dieselpreis × Fahrten/Jahr</p>
                <p>EV-Kosten = (km / 100) × Verbrauch_kWh × Strompreis × Fahrten/Jahr</p>
                <p>Einsparung = ICE-Kosten − EV-Kosten</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#001141]">Machbarkeit (SOC-Analyse):</p>
              <p className="text-xs text-slate-500">Das System prüft, ob das EV die Route schafft, ohne unter den konfigurierten Min-SOC zu fallen. Ist das nicht möglich, wird die Route als „nicht machbar" markiert.</p>
            </div>
          </div>
        ),
      },
      {
        id: 'ergebnisse-lesen',
        title: 'Ergebnisse verstehen',
        content: (
          <div className="space-y-4">
            <p>Die Ergebnisseite zeigt vier Hauptbereiche:</p>
            <div className="space-y-3">
              {[
                { title: 'KPI-Karten', desc: 'Schnellübersicht: Gesamteinsparung, CO₂-Reduktion, Machbarkeitsquote und Anzahl der simulierten Routen.' },
                { title: 'Flottenergebnisse', desc: 'Für jede Route: ICE- vs. EV-Kosten, Energiebedarf, CO₂ und Machbarkeitsstatus.' },
                { title: 'Tourenanalyse', desc: 'Detaillierte Ansicht pro Tour mit Zeitfenster, SOC-Verlauf und Ladeplanung.' },
                { title: 'Infrastruktur', desc: 'Geschätzte Anzahl benötigter Ladepunkte, Anschlussleistung und Installationskosten.' },
              ].map(i => (
                <div key={i.title} className="flex gap-2 items-start">
                  <CheckCircle2 className="h-4 w-4 text-[#043F2E] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#001141]">{i.title}</p>
                    <p className="text-xs text-slate-500">{i.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'szenarien',
        title: 'Szenarien und Annahmen',
        content: (
          <div className="space-y-4">
            <p>Szenarien ermöglichen den Vergleich verschiedener wirtschaftlicher Annahmen für dieselbe Flotte.</p>
            <div className="space-y-2">
              {[
                { label: 'Strompreis (€/kWh)', desc: 'Typisch 0,20–0,35 €/kWh für Gewerbekunden in Deutschland.' },
                { label: 'Dieselpreis (€/L)', desc: 'Aktuell ca. 1,60–1,80 €/L. Default: 1,75 €/L.' },
                { label: 'Anschaffungsart', desc: 'Kauf, Leasing oder Miete – beeinflusst die TCO-Berechnung.' },
                { label: 'Wallbox-Preis (€)', desc: 'Kosten pro Ladepunkt inkl. Installation. Default: 1.200 €.' },
              ].map(p => (
                <div key={p.label} className="flex gap-3 p-2 border rounded text-xs">
                  <Info className="h-3.5 w-3.5 text-[#0079C0] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-[#001141]">{p.label}: </span>
                    <span className="text-slate-500">{p.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: 'reichweiten',
    title: 'Modul: Reichweiten-Simulator',
    icon: Gauge,
    color: '#0079C0',
    articles: [
      {
        id: 'reichweiten-intro',
        title: 'Was simuliert der Reichweiten-Simulator?',
        content: (
          <div className="space-y-4">
            <p>Der Reichweiten-Simulator berechnet die <strong>reale Reichweite</strong> eines Elektrofahrzeugs unter tatsächlichen Betriebsbedingungen — weit präziser als die WLTP-Herstellerangabe.</p>
            <p className="text-sm font-medium text-[#001141]">Einflussfaktoren:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '🌡️', label: 'Temperatur', desc: 'Kälte erhöht den Verbrauch stark (Batterie + Heizung).' },
                { icon: '📦', label: 'Beladung', desc: 'Mehr Gewicht = mehr Energiebedarf.' },
                { icon: '🛣️', label: 'Fahrprofil', desc: 'Anteil Stadt / Landstraße / Autobahn.' },
                { icon: '❄️', label: 'Klimaanlage / Heizung', desc: 'HVAC kann 10–30% mehr Energie verbrauchen.' },
              ].map(f => (
                <div key={f.label} className="flex gap-2 p-2 bg-slate-50 rounded border text-xs">
                  <span>{f.icon}</span>
                  <div>
                    <p className="font-medium text-[#001141]">{f.label}</p>
                    <p className="text-slate-500">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'reichweiten-ergebnis',
        title: 'Ergebnisse interpretieren',
        content: (
          <div className="space-y-4">
            <p>Das Ergebnis zeigt für jedes simulierte EV-Modell, ob die Route unter den gewählten Bedingungen machbar ist.</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 p-2 bg-[#e8f5f0] rounded border border-green-200">
                <span className="text-green-600 font-bold">✓ Machbar</span>
                <span className="text-slate-500 text-xs">Das Fahrzeug erreicht das Ziel mit ausreichend Restladung.</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                <span className="text-amber-600 font-bold">⚠ Grenzwertig</span>
                <span className="text-slate-500 text-xs">Reichweite reicht, aber der SOC-Puffer ist knapp.</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                <span className="text-red-600 font-bold">✗ Nicht machbar</span>
                <span className="text-slate-500 text-xs">Das Fahrzeug würde die Route ohne Zwischenladen nicht abschließen.</span>
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: 'ladeoptimierung',
    title: 'Modul: Ladeoptimierung',
    icon: Zap,
    color: '#0079C0',
    articles: [
      {
        id: 'ladeopt-intro',
        title: 'Was optimiert dieses Modul?',
        content: (
          <div className="space-y-4">
            <p>Das Ladeoptimierungsmodul plant den <strong>optimalen Ladezeitpunkt</strong> für jedes Fahrzeug der Flotte — basierend auf variablen Strompreisen und der verfügbaren Netzanschlussleistung (GCP).</p>
            <div className="p-3 bg-[#e6f3fc] rounded border border-[#BAE6FF] text-xs text-slate-700 space-y-2">
              <p><strong>Ziel:</strong> Minimierung der Gesamtstromkosten, ohne dass ein Fahrzeug zu spät geladen wird.</p>
              <p><strong>Nebenbedingung:</strong> Die gleichzeitige Ladeleistung aller Fahrzeuge darf die maximale Anschlussleistung nicht überschreiten.</p>
              <p><strong>Preisquelle:</strong> ENTSO-E Day-Ahead Preise (15-Minuten-Intervalle, 96 Werte pro Tag).</p>
            </div>
            <p className="text-xs text-slate-500">Das Ergebnis zeigt den optimierten Ladeplan im Vergleich zum unkontrollierten Sofortladen und die erzielten Kosteneinsparungen.</p>
          </div>
        ),
      },
      {
        id: 'ladeopt-gcp',
        title: 'Was ist der GCP (Grid Connection Point)?',
        content: (
          <div className="space-y-4">
            <p>Der <strong>GCP (Grid Connection Point)</strong> ist die maximale elektrische Leistung, die Ihr Depot gleichzeitig aus dem Stromnetz beziehen darf — typischerweise vertraglich mit dem Netzbetreiber vereinbart.</p>
            <div className="space-y-2 text-xs text-slate-600">
              <p>Beispiel: GCP = 100 kW bedeutet, dass maximal 100 kW gleichzeitig geladen werden kann, egal wie viele Fahrzeuge angeschlossen sind.</p>
              <p>Das Optimierungsmodul verteilt die verfügbare Leistung intelligent auf alle Fahrzeuge, um Kosteneinsparungen zu maximieren und gleichzeitig rechtzeitig alle Fahrzeuge zu laden.</p>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: 'bidirektional',
    title: 'Modul: Bidirektionales Laden',
    icon: BatteryCharging,
    color: '#7c3aed',
    articles: [
      {
        id: 'v2g-intro',
        title: 'Was ist V2G (Vehicle-to-Grid)?',
        content: (
          <div className="space-y-4">
            <p><strong>V2G (Vehicle-to-Grid)</strong> ermöglicht es, gespeicherte Energie aus der Fahrzeugbatterie ins Stromnetz zurückzuspeisen — und so von Preisschwankungen zu profitieren.</p>
            <div className="p-3 bg-purple-50 rounded border border-purple-200 text-xs space-y-1">
              <p>🔋 <strong>Laden:</strong> Strom günstig kaufen, wenn die Preise niedrig sind.</p>
              <p>⚡ <strong>Entladen:</strong> Strom teuer zurückspeisen, wenn die Preise hoch sind.</p>
              <p>✅ <strong>Pflichtladung:</strong> Immer sichergestellt, dass das Fahrzeug für die nächste Tour bereit ist.</p>
            </div>
          </div>
        ),
      },
      {
        id: 'v2g-mehrwert',
        title: 'Was bedeutet "V2G Mehrwert"?',
        content: (
          <div className="space-y-4">
            <p>Der <strong>V2G Mehrwert</strong> gibt an, wie viel das bidirektionale Laden im Vergleich zum einfachen kontrollierten Laden spart (oder zusätzlich verdient).</p>
            <div className="bg-slate-50 rounded p-3 font-mono text-xs space-y-1 text-slate-700">
              <p>V2G Mehrwert = Ladekosten (nur laden) − Gesamtladekosten (V2G) + V2G-Erlöse</p>
            </div>
            <p className="text-xs text-slate-500">Ein positiver Wert bedeutet, dass V2G wirtschaftlich vorteilhaft ist. Ein negativer Wert tritt auf, wenn die Batteriedegradation durch Zyklen die Erlöse übersteigt — dies wird im Modul durch den Zyklen-Indikator angezeigt.</p>
          </div>
        ),
      },
    ],
  },
  {
    id: 'faq',
    title: 'Häufige Fragen (FAQ)',
    icon: Info,
    color: '#C45600',
    articles: [
      {
        id: 'faq-genauigkeit',
        title: 'Wie genau sind die Ergebnisse?',
        content: (
          <div className="space-y-3 text-sm text-slate-600">
            <p>FleetIQ liefert <strong>Richtwerte für strategische Entscheidungen</strong>, keine exakten Betriebskostenabrechnungen. Die Genauigkeit hängt von der Qualität der eingegebenen Daten ab:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Reale Tour-CSV-Daten → hohe Genauigkeit (~10% Abweichung)</li>
              <li>Manuelle Durchschnittsdistanz → grobe Schätzung (~20–30% Abweichung)</li>
            </ul>
            <p className="text-xs">Für verbindliche Investitionsentscheidungen empfehlen wir, die Ergebnisse mit einem iE2S-Berater zu besprechen.</p>
          </div>
        ),
      },
      {
        id: 'faq-daten',
        title: 'Werden meine Daten gespeichert?',
        content: (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Alle Daten (Projekte, Flotten, Simulationsergebnisse) werden in einer lokalen Datenbank auf dem Server gespeichert, auf dem FleetIQ betrieben wird. Es werden keine Daten an externe Dienste übermittelt.</p>
            <p className="text-xs">Ausnahme: ENTSO-E-Preisabfragen (für Lade- und Arbitragemodule) werden über die öffentliche ENTSO-E API abgerufen.</p>
          </div>
        ),
      },
      {
        id: 'faq-csv',
        title: 'Welches CSV-Format wird erwartet?',
        content: (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Das CSV-Format für Tourdaten erwartet folgende Spalten:</p>
            <div className="bg-slate-50 rounded p-3 font-mono text-xs space-y-1 text-slate-700">
              <p>vehicle_id, date, start_time, end_time, distance_km</p>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p><strong>vehicle_id:</strong> Eindeutige Fahrzeugkennung (z.B. "LKW-01")</p>
              <p><strong>date:</strong> Datum im Format YYYY-MM-DD</p>
              <p><strong>start_time / end_time:</strong> Uhrzeit im Format HH:MM</p>
              <p><strong>distance_km:</strong> Tagesstrecke in Kilometern</p>
            </div>
          </div>
        ),
      },
      {
        id: 'faq-modelle',
        title: 'Wie viele EV-Modelle sind verfügbar?',
        content: (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Die Fahrzeugbibliothek umfasst derzeit <strong>über 160 Modelle</strong>, unterteilt in:</p>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li>Kleinwagen & Kompakt-PKW (city cars bis Mittelklasse)</li>
              <li>Premium & SUV (BMW, Mercedes, Audi, Tesla, Porsche…)</li>
              <li>Kleintransporter (small van / medium van)</li>
              <li>Großtransporter (large van, z.B. eSprinter, E-Transit)</li>
              <li>Leicht- und Mittel-LKW (7,5t – 18t)</li>
              <li>Schwer-LKW / Fernverkehr (eActros, FH Electric, Scania BEV…)</li>
            </ul>
            <p className="text-xs">Die Bibliothek wird regelmäßig mit neuen Modellen aktualisiert.</p>
          </div>
        ),
      },
    ],
  },
];

// ─── Komponente ───────────────────────────────────────────────────────────────

export default function Benutzerhandbuch() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [activeArticle, setActiveArticle] = useState(sections[0].articles[0].id);

  const currentSection = sections.find(s => s.id === activeSection)!;
  const currentArticle = currentSection.articles.find(a => a.id === activeArticle)!;

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    setActiveArticle(sections.find(s => s.id === sectionId)!.articles[0].id);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-light text-[#001141]">Benutzerhandbuch</h1>
        <p className="text-sm text-slate-500 mt-1">Alles, was Sie über FleetIQ wissen müssen</p>
      </div>

      <div className="flex gap-6" style={{ minHeight: '70vh' }}>

        {/* Linke Navigationsleiste */}
        <div className="w-64 shrink-0 space-y-1">
          {sections.map(section => (
            <div key={section.id}>
              <button
                onClick={() => handleSectionClick(section.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors',
                  activeSection === section.id
                    ? 'bg-[#001141] text-white font-normal'
                    : 'text-[#001141] hover:bg-[#e6f3fc]'
                )}
              >
                <section.icon className="h-4 w-4 shrink-0" style={{ color: activeSection === section.id ? 'white' : section.color }} />
                <span>{section.title}</span>
                {activeSection === section.id && <ChevronRight className="h-3 w-3 ml-auto" />}
              </button>

              {/* Artikel unter aktiver Section */}
              {activeSection === section.id && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {section.articles.map(article => (
                    <button
                      key={article.id}
                      onClick={() => setActiveArticle(article.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left transition-colors',
                        activeArticle === article.id
                          ? 'bg-[#e6f3fc] text-[#0079C0] font-medium'
                          : 'text-slate-500 hover:text-[#001141] hover:bg-slate-100'
                      )}
                    >
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      {article.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Hauptinhalt */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="py-6 px-8">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
                <span>{currentSection.title}</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-[#001141]">{currentArticle.title}</span>
              </div>

              {/* Titel */}
              <h2 className="text-xl font-light text-[#001141] mb-4 pb-3 border-b">
                {currentArticle.title}
              </h2>

              {/* Inhalt */}
              <div className="text-sm text-slate-600 leading-relaxed">
                {currentArticle.content}
              </div>

              {/* Navigation vor/zurück */}
              <div className="flex justify-between mt-8 pt-4 border-t">
                {(() => {
                  // Vorheriger Artikel
                  const allArticles = sections.flatMap(s => s.articles.map(a => ({ ...a, sectionId: s.id })));
                  const currentIdx = allArticles.findIndex(a => a.id === activeArticle);
                  const prev = allArticles[currentIdx - 1];
                  const next = allArticles[currentIdx + 1];
                  return (
                    <>
                      <div>
                        {prev && (
                          <button
                            onClick={() => { handleSectionClick(prev.sectionId); setActiveArticle(prev.id); }}
                            className="text-xs text-[#0079C0] hover:underline flex items-center gap-1"
                          >
                            ← {prev.title}
                          </button>
                        )}
                      </div>
                      <div>
                        {next && (
                          <button
                            onClick={() => { handleSectionClick(next.sectionId); setActiveArticle(next.id); }}
                            className="text-xs text-[#0079C0] hover:underline flex items-center gap-1"
                          >
                            {next.title} →
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
