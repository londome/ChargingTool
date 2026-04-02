# Flottenelektrifizierung – Analyse-Plattform

Eine professionelle Web-Applikation zur Analyse und Bewertung der Elektrifizierung von Unternehmensflotten.

## Voraussetzungen

- **Node.js** 18 oder höher
- **npm** 9 oder höher
- **PostgreSQL** 14 oder höher (oder Docker)
- **Git**

## Installation

### 1. Repository klonen

```bash
git clone <repository-url>
cd fleet-electrification
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example backend/.env
```

Öffnen Sie `backend/.env` und passen Sie die Werte an Ihre Umgebung an.

### 3. Datenbank einrichten

#### Option A: Mit Docker (empfohlen)

```bash
docker-compose up -d
```

#### Option B: Lokale PostgreSQL-Installation

Erstellen Sie eine Datenbank und einen Benutzer:

```sql
CREATE DATABASE fleetdb;
CREATE USER fleetuser WITH ENCRYPTED PASSWORD 'fleetpass';
GRANT ALL PRIVILEGES ON DATABASE fleetdb TO fleetuser;
```

### 4. Datenbankschema und Seed-Daten laden

```bash
cd backend
psql -h localhost -U fleetuser -d fleetdb -f src/database/schema.sql
psql -h localhost -U fleetuser -d fleetdb -f src/database/seed.sql
```

### 5. Backend-Abhängigkeiten installieren und starten

```bash
cd backend
npm install
npm run dev
```

Der Backend-Server startet auf `http://localhost:3001`.

### 6. Frontend-Abhängigkeiten installieren und starten

```bash
cd frontend
npm install
npm run dev
```

Das Frontend startet auf `http://localhost:5173`.

## Umgebungsvariablen

| Variable | Beschreibung | Standardwert |
|---|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindungs-URL | `postgresql://fleetuser:fleetpass@localhost:5432/fleetdb` |
| `PORT` | Backend-Port | `3001` |
| `CORS_ORIGIN` | Erlaubter Frontend-Ursprung | `http://localhost:5173` |
| `NODE_ENV` | Umgebung (development/production) | `development` |

## Datenbankeinrichtung

Das Schema wird mit `schema.sql` erstellt. Seed-Daten mit realen E-Fahrzeugmodellen werden über `seed.sql` geladen.

## Projektstruktur

```
fleet-electrification/
├── shared/
│   └── types/          # Gemeinsame TypeScript-Typen
├── backend/
│   ├── src/
│   │   ├── database/   # Schema, Seed, DB-Verbindung
│   │   ├── routes/     # Express-Routen
│   │   ├── simulation/ # Simulations-Engine
│   │   ├── middleware/ # Multer, Auth
│   │   └── data/       # Mock-Daten
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ # UI-Komponenten (ui, layout, charts, shared)
│   │   ├── pages/      # Seiten (wizard, results, scenarios, etc.)
│   │   ├── store/      # Zustand-State
│   │   └── lib/        # API-Client, Utils, Validierung
│   └── package.json
└── docker-compose.yml
```

## Funktionsumfang

- **Projekt-Wizard**: Schrittweise Erfassung von Flotte, Touren und Szenarien
- **Tour-Upload**: CSV/XLSX-Upload mit automatischer Spaltenzuordnung
- **Simulations-Engine**: Machbarkeitsanalyse, TCO, CO₂-Berechnung
- **Ergebnisse**: Flottenebene, Tourenebene, Infrastruktur
- **Szenarien-Vergleich**: Mehrere Szenarien gegenüberstellen
- **EV-Modell-Bibliothek**: Reale Fahrzeugdaten mit Filterung
- **Export**: CSV und XLSX-Export der Ergebnisse
