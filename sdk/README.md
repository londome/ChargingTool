# Fleet Electrification SDK

Cliente TypeScript/JavaScript para la API del backend.

## Instalación

Copia `fleet-sdk.ts` a tu proyecto. No requiere dependencias externas (usa `fetch` nativo).

## Uso básico

```ts
import { FleetClient } from './fleet-sdk';

const client = new FleetClient('http://localhost:3001');

// Verificar que el servidor esté online
const online = await client.ping();

// Listar proyectos
const projects = await client.projects.list();

// Crear un proyecto
const project = await client.projects.create({
  name: 'Flota Logística 2025',
  country: 'DE',
  currency: 'EUR',
  wizard_module: 'flotte_elektrifizierung',
});
```

## Correr una simulación completa (esperar resultado)

```ts
const results = await client.simulations.runAndWait(
  projectId,   // string
  scenarioId,  // string
  2000,        // polling cada 2 segundos (opcional)
  120_000,     // timeout máximo 2 minutos (opcional)
);

console.log(results.summary);
console.log(results.route_results);
```

## Optimización de carga (Módulo Ladeoptimierung)

```ts
const { run_id } = await client.optimization.run(projectId);

// Esperar y obtener resultados
const results = await client.optimization.results(run_id);
console.log(`Costo optimizado: ${results.total_cost_eur} €`);
console.log(`Costo sin optimizar: ${results.naive_total_cost_eur} €`);
```

## V2G / Bidireccional (Módulo Arbitrage)

```ts
const { run_id } = await client.arbitrage.run(projectId);
const results = await client.arbitrage.results(run_id);
console.log(`Ingresos V2G: ${results.total_revenue_eur} €`);
```

## Descargar resultados como CSV

```ts
// En el browser: crear un link de descarga
const blob = await client.exports.downloadCsv(runId);
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'resultados.csv';
a.click();

// O simplemente obtener la URL directa
const csvUrl = client.exports.csvUrl(runId);
```

## Módulos disponibles

| `client.X`       | Descripción                            |
|------------------|----------------------------------------|
| `projects`       | CRUD de proyectos                      |
| `fleets`         | Flotas y vehículos                     |
| `routes`         | Rutas de conducción                    |
| `scenarios`      | Escenarios de simulación               |
| `simulations`    | Simulación Módulo 1 (Fleet)            |
| `evModels`       | Biblioteca de modelos EV               |
| `optimization`   | Optimización de carga (Módulo 2)       |
| `arbitrage`      | V2G bidireccional (Módulo 3)           |
| `exports`        | Descarga CSV / XLSX                    |

## Manejo de errores

```ts
import { FleetClient, FleetAPIError } from './fleet-sdk';

try {
  await client.simulations.runAndWait(projectId, scenarioId);
} catch (err) {
  if (err instanceof FleetAPIError) {
    console.error(`Error ${err.status} en ${err.endpoint}: ${err.message}`);
  }
}
```

## CORS — conectarse desde otra web

En el `.env` del backend agregar tu dominio:

```
CORS_ORIGIN=http://localhost:5173,https://mi-app.com
```
