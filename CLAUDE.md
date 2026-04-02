# CLAUDE.md — Guía de operación del proyecto ChargingTool

Este archivo es para que Claude Code entienda el contexto completo del proyecto
y pueda operar correctamente en sesiones futuras sin necesidad de que el usuario
explique todo desde cero.

---

## Repositorio

- **GitHub:** `https://github.com/londome/ChargingTool`
- **Token:** guardado en el CLAUDE.md local de C:\Users\LONDONA\ (no se sube a GitHub)
- **Rama principal:** `master`

### Guardar cambios al final de cada sesión

```bash
cd C:\Users\LONDONA\fleet-electrification
git add -A
git commit -m "descripción del cambio"
git push origin master
```

---

## Qué es este proyecto

**ChargingTool** es una plataforma web para analizar la electrificación de flotas de vehículos.
Permite a empresas evaluar si sus vehículos ICE (diésel/gasolina) pueden reemplazarse por EVs,
calculando TCO, CO₂, costos operativos, viabilidad de rutas e infraestructura de carga necesaria.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Estado | Zustand (wizard NO persistido, `lastgangProfile`/`activeRunId` SÍ persistidos) |
| Backend | Express + TypeScript + Node.js |
| Base de datos | PostgreSQL 14+ |
| Componentes UI | shadcn/ui (Radix UI) + Recharts |
| Validación | Zod + React Hook Form |

---

## Estructura del proyecto

```
C:\Users\LONDONA\fleet-electrification\
├── shared/
│   └── types/index.ts          ← Tipos TypeScript compartidos (Scenario, Route, EVModel, etc.)
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   ├── schema.sql      ← Schema de la BD (CREATE TABLE IF NOT EXISTS)
│   │   │   ├── seed.sql        ← Datos iniciales de modelos EV
│   │   │   └── db.ts           ← Pool de conexión PostgreSQL
│   │   ├── index.ts            ← Entry point + migraciones automáticas al arrancar
│   │   ├── routes/             ← Express routers (projects, fleets, routes, scenarios, simulations)
│   │   └── simulation/         ← Motor de simulación
│   │       ├── simulationOrchestrator.ts  ← Orquestador principal
│   │       ├── evCalculator.ts            ← Cálculos EV (energía, costos, CO₂)
│   │       ├── iceCalculator.ts           ← Cálculos ICE (combustible, costos, CO₂)
│   │       ├── feasibilityEngine.ts       ← Viabilidad SOC
│   │       ├── matchingEngine.ts          ← Matching vehículo→EV model
│   │       ├── rankingEngine.ts           ← Ranking EV candidates
│   │       └── infrastructureEstimator.ts ← Estimación cargadores
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── wizard/steps/   ← 6 pasos del wizard
│   │   │   │   ├── Step1ProjectContext.tsx
│   │   │   │   ├── Step3Mobility.tsx   ← Rutas (manual/CSV/fleet_level) + trips_per_year
│   │   │   │   ├── Step3Depot.tsx      ← Depot config
│   │   │   │   ├── Step4Ladeinfrastruktur.tsx  ← SOC params + wallbox price
│   │   │   │   ├── Step5EVSelection.tsx
│   │   │   │   └── Step6Scenarios.tsx  ← Crea escenarios, lanza simulación
│   │   │   ├── results/
│   │   │   │   ├── FleetResults.tsx
│   │   │   │   ├── TourResults.tsx
│   │   │   │   └── InfrastructureResults.tsx  ← Simulación de carga + gráficos SOC
│   │   │   └── scenarios/ScenarioManager.tsx
│   │   ├── store/projectStore.ts   ← Zustand store
│   │   └── lib/api.ts              ← Cliente API (React Query)
│   └── package.json
└── docker-compose.yml
```

---

## Cómo correr el proyecto localmente (Windows)

### Prerequisitos
- Node.js 18+
- PostgreSQL corriendo en `localhost:5432`
- Base de datos `fleetdb` con usuario `fleetuser` / contraseña `fleetpass`

### 1. Inicializar la BD (solo primera vez)
```bash
psql -h localhost -U fleetuser -d fleetdb -f backend/src/database/schema.sql
psql -h localhost -U fleetuser -d fleetdb -f backend/src/database/seed.sql
```

### 2. Instalar dependencias (solo primera vez)
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Arrancar backend
```bash
cd C:\Users\LONDONA\fleet-electrification\backend
npm run dev
# Corre en http://localhost:3001
# Al arrancar ejecuta migraciones automáticas (ALTER TABLE IF NOT EXISTS)
```

### 4. Arrancar frontend
```bash
cd C:\Users\LONDONA\fleet-electrification\frontend
npm run dev
# Corre en http://localhost:5173
# El Vite proxy redirige /api/* → http://localhost:3001/api/*
```

---

## Variables de entorno del backend

Archivo: `C:\Users\LONDONA\fleet-electrification\backend\.env`

```
DATABASE_URL=postgresql://fleetuser:fleetpass@localhost:5432/fleetdb
PORT=3001
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## Flujo de datos clave

### Wizard (6 pasos)
1. **Step1** → Crea proyecto en BD
2. **Step3Mobility** → Crea fleet + routes en BD (fuente: manual/CSV/fleet_level)
3. **Step4Ladeinfrastruktur** → Define SOC params + charging power (guardados en wizard store)
4. **Step6Scenarios** → Crea escenarios en BD → lanza `POST /api/simulations/run`

### Simulación (backend)
- `simulationOrchestrator.ts` corre el cálculo completo
- Para cada ruta: calcula ICE (litros × diesel_price) y EV (kWh × electricity_price)
- `annual_trips` determina cuántas veces se multiplica la energía/costo por año
- Guarda en: `route_results`, `result_summaries`, `infrastructure_estimates`

### Costos operativos
- **EV**: `ev_energy_kwh × (1/charging_efficiency) × scenario.electricity_price × annual_trips`
- **ICE**: `(distance_km/100) × consumption_l_100km × scenario.diesel_price × annual_trips`

### Migraciones automáticas
`backend/src/index.ts` ejecuta `ALTER TABLE IF NOT EXISTS` al arrancar para columnas nuevas.
Si se añaden columnas al schema, agregarlas también al array de migraciones en `index.ts`.

---

## Decisiones de arquitectura importantes

1. **`trips_per_year`** es el multiplicador anual de costos/emisiones por ruta. Para rutas manuales
   el usuario lo define (default 250). Para CSV = 1 (cada fila = 1 trip real del año). Para
   fleet_level = `annual_km / trips_per_year`.

2. **SOC en la simulación de carga** (InfrastructureResults):
   - `soc_min` es SOLO umbral de viabilidad backend, NO determina el SOC de llegada
   - SOC al llegar = `soc_target - (distancia × consumo_kWh100km / batería) × 100`
   - Energía a recargar = la misma que consumió en la ruta

3. **`ev_energy_kwh` en route_results** = energía ANUAL (× annual_trips). Para la visualización
   del día típico en InfrastructureResults se usa `distance_km × nominal_consumption_kwh_100km`.

4. **Ventana de carga**: desde `end_time` (llegada) hasta `start_time` del próximo tour del mismo
   vehículo al día siguiente. Soporta overnight charging (ventana cruza medianoche).

5. **Diesel price** viene del escenario (`scenario.diesel_price`), no es hardcodeado.
   Default: 1.75 €/L.

6. **`wallbox_price_eur` e `installation_type`** se definen en Step4 (UI) pero se guardan
   en `step3Depot` del wizard store y se pasan al escenario al crearlo en Step6.

---

## APIs principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/projects` | Crear proyecto |
| POST | `/api/fleets` | Crear flota + vehículos |
| POST | `/api/routes/manual` | Guardar rutas manuales |
| POST | `/api/routes/upload` | Subir CSV de rutas |
| DELETE | `/api/routes/project/:id` | Borrar rutas de un proyecto |
| POST | `/api/scenarios` | Crear escenario |
| POST | `/api/simulations/run` | Lanzar simulación |
| GET | `/api/simulations/:id/results` | Obtener resultados completos |
| GET | `/api/simulations/:id/status` | Estado de simulación |

---

## Problemas conocidos / pendientes

- [ ] Optimización de carga bajo `Max. Anschlussleistung` (distribuir carga dentro de la ventana)
- [ ] Visualización de costos diarios estimados en InfrastructureResults
- [ ] La columna `date` en `route_results` permite filtrar el gráfico por día (ya implementado),
      pero requiere re-ejecutar la simulación para que se llene el campo
