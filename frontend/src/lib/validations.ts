import { z } from 'zod';
import { FuelType, VehicleSegment, ChargingOption, ScenarioType, AcquisitionType } from '@shared/types';

// ============================================================
// PROJECT VALIDATION
// ============================================================

export const projectSchema = z.object({
  name: z.string().min(2, 'Projektname muss mindestens 2 Zeichen haben').max(100, 'Maximal 100 Zeichen'),
  country: z.string().min(2, 'Land ist erforderlich'),
  currency: z.string().min(3, 'Währung ist erforderlich'),
  fleet_type: z.string().min(1, 'Flottentyp ist erforderlich'),
  industry: z.string().min(1, 'Branche ist erforderlich'),
  depot_location: z.string().min(2, 'Standort ist erforderlich'),
  charging_options: z.array(z.nativeEnum(ChargingOption)).optional().transform(val => val && val.length > 0 ? val : [ChargingOption.DEPOT_AC]),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

// ============================================================
// FLEET VEHICLE VALIDATION
// ============================================================

export const fleetVehicleSchema = z.object({
  segment: z.nativeEnum(VehicleSegment, { required_error: 'Fahrzeugsegment ist erforderlich' }),
  fuel_type: z.nativeEnum(FuelType, { required_error: 'Kraftstofftyp ist erforderlich' }),
  count: z.number().int().min(1, 'Mindestens 1 Fahrzeug').max(10000, 'Maximal 10.000 Fahrzeuge'),
  consumption_l_100km: z.number().min(0.1, 'Verbrauch muss > 0 sein').max(100, 'Realistischer Maximalwert: 100 L/100km'),
  annual_km: z.number().min(1000, 'Mindestens 1.000 km/Jahr').max(500000, 'Maximal 500.000 km/Jahr'),
  payload_kg: z.number().min(0).max(30000, 'Maximal 30.000 kg'),
  maintenance_cost_annual: z.number().min(0, 'Muss >= 0 sein').max(100000, 'Maximal 100.000 €/Jahr'),
  acquisition_type: z.nativeEnum(AcquisitionType),
  capex: z.number().nullable().optional(),
  lease_monthly: z.number().nullable().optional(),
});

export type FleetVehicleFormData = z.infer<typeof fleetVehicleSchema>;

// ============================================================
// SCENARIO VALIDATION
// ============================================================

export const scenarioSchema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben'),
  type: z.nativeEnum(ScenarioType),
  electrification_pct: z.number().min(1, 'Mindestens 1%').max(100, 'Maximal 100%'),
  soc_start: z.number().min(50, 'Mindest-SOC Start: 50%').max(100, 'Maximum: 100%'),
  soc_min: z.number().min(5, 'Mindest-SOC: 5%').max(40, 'Maximum Reserve-SOC: 40%'),
  soc_target: z.number().min(50).max(100),
  charging_power_kw: z.number().min(3.7, 'Mindest-Ladeleistung: 3,7 kW').max(350, 'Maximal 350 kW'),
  charging_efficiency: z.number().min(0.80, 'Wirkungsgrad mindestens 80%').max(1.0, 'Maximum: 100%'),
  electricity_price: z.number().min(0.01, 'Preis muss > 0 sein').max(2.0, 'Preis scheint zu hoch'),
  grid_emission_factor: z.number().min(0, 'Muss >= 0 sein').max(2.0, 'Emissionsfaktor zu hoch'),
  temperature_factor: z.number().min(0.8).max(2.0),
  allow_public_charging: z.boolean(),
  winter_surcharge: z.number().min(0).max(0.5),
  notes: z.string().max(500).optional(),
});

export type ScenarioFormData = z.infer<typeof scenarioSchema>;

// ============================================================
// MANUAL ROUTE VALIDATION
// ============================================================

export const manualRouteSchema = z.object({
  route_id: z.string().min(1, 'Tour-ID erforderlich'),
  distance_km: z.number().min(0.1, 'Distanz muss > 0 sein').max(5000, 'Distanz zu groß'),
  stops: z.number().int().min(0).max(200),
  dwell_time_min: z.number().min(0).max(1440, 'Maximal 24 Stunden Standzeit'),
  avg_speed_kmh: z.number().min(0).max(200).nullable().optional(),
  payload_kg: z.number().min(0).nullable().optional(),
  vehicle_id: z.string().optional(),
});

export type ManualRouteFormData = z.infer<typeof manualRouteSchema>;

// ============================================================
// COLUMN MAPPING VALIDATION
// ============================================================

export const columnMappingSchema = z.object({
  distance_km: z.string().min(1, 'Spalte für Distanz erforderlich'),
  route_id: z.string().optional(),
  date: z.string().optional(),
  stops: z.string().optional(),
  dwell_time_min: z.string().optional(),
  avg_speed_kmh: z.string().optional(),
  payload_kg: z.string().optional(),
  vehicle_id: z.string().optional(),
});

export type ColumnMappingFormData = z.infer<typeof columnMappingSchema>;
