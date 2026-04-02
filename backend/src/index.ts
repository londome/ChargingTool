import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { query } from './database/db';
import projectsRouter from './routes/projects';
import fleetsRouter from './routes/fleets';
import routesRouter from './routes/routes';
import evModelsRouter from './routes/evModels';
import scenariosRouter from './routes/scenarios';
import simulationsRouter from './routes/simulations';
import exportsRouter from './routes/exports';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/fleets', fleetsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/ev-models', evModelsRouter);
app.use('/api/scenarios', scenariosRouter);
app.use('/api/simulations', simulationsRouter);
app.use('/api/exports', exportsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Run lightweight schema migrations on startup
async function runMigrations() {
  const migrations = [
    `ALTER TABLE route_results ADD COLUMN IF NOT EXISTS start_time VARCHAR(8) DEFAULT NULL`,
    `ALTER TABLE route_results ADD COLUMN IF NOT EXISTS end_time VARCHAR(8) DEFAULT NULL`,
    `ALTER TABLE route_results ADD COLUMN IF NOT EXISTS date DATE DEFAULT NULL`,
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS consumption_l_100km DECIMAL(6,3)`,
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS trips_per_year INTEGER`,
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS vehicle_count INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS diesel_price DECIMAL(8,4) NOT NULL DEFAULT 1.75`,
    `ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS wallbox_price_eur DECIMAL(10,2) NOT NULL DEFAULT 1200`,
    `ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS installation_type VARCHAR(20) NOT NULL DEFAULT 'standard'`,
  ];
  for (const sql of migrations) {
    try { await query(sql); } catch (e) { console.warn('Migration skipped:', (e as Error).message); }
  }
  console.log('DB migrations done.');
}
runMigrations().catch(console.error);

app.listen(PORT, () => {
  console.log(`Fleet electrification backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
