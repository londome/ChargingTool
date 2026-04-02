import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FeasibilityStatus, VehicleSegment, FuelType, ScenarioType } from '@shared/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// NUMBER FORMATTING
// ============================================================

export function formatCurrency(value: number | null | undefined, currency = 'EUR', decimals = 0): string {
  if (value === null || value === undefined) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '–';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '–';
  return `${formatNumber(value, decimals)} %`;
}

export function formatCO2(value_t: number | null | undefined, decimals = 1): string {
  if (value_t === null || value_t === undefined) return '–';
  if (value_t >= 1000) return `${formatNumber(value_t / 1000, 1)} kt CO₂e`;
  return `${formatNumber(value_t, decimals)} t CO₂e`;
}

export function formatKWh(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '–';
  if (value >= 1000) return `${formatNumber(value / 1000, 1)} MWh`;
  return `${formatNumber(value, decimals)} kWh`;
}

export function formatDistance(km: number | null | undefined, decimals = 0): string {
  if (km === null || km === undefined) return '–';
  return `${formatNumber(km, decimals)} km`;
}

export function formatPayback(years: number | null | undefined): string {
  if (years === null || years === undefined) return '–';
  if (years >= 100 || !isFinite(years)) return '> 30 Jahre';
  return `${formatNumber(years, 1)} Jahre`;
}

export function formatKW(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '–';
  return `${formatNumber(value, decimals)} kW`;
}

// ============================================================
// LABEL FUNCTIONS (German)
// ============================================================

export function getFuelTypeLabel(fuelType: FuelType): string {
  const labels: Record<FuelType, string> = {
    [FuelType.DIESEL]: 'Diesel',
    [FuelType.PETROL]: 'Benzin',
    [FuelType.CNG]: 'Erdgas (CNG)',
    [FuelType.LPG]: 'Autogas (LPG)',
    [FuelType.HEV]: 'Hybrid (HEV)',
    [FuelType.PHEV]: 'Plug-in-Hybrid',
    [FuelType.BEV]: 'Elektro (BEV)',
  };
  return labels[fuelType] || fuelType;
}

export function getSegmentLabel(segment: VehicleSegment): string {
  const labels: Record<VehicleSegment, string> = {
    [VehicleSegment.SMALL_VAN]: 'Kleintransporter',
    [VehicleSegment.MEDIUM_VAN]: 'Transporter (mittel)',
    [VehicleSegment.LARGE_VAN]: 'Hochdachkombi / Großtransporter',
    [VehicleSegment.LIGHT_TRUCK]: 'Leicht-Lkw (7,5t)',
    [VehicleSegment.MEDIUM_TRUCK]: 'Mittel-Lkw (12-18t)',
    [VehicleSegment.HEAVY_TRUCK]: 'Schwer-Lkw (>18t)',
    [VehicleSegment.CAR]: 'PKW',
    [VehicleSegment.MINIBUS]: 'Minibus / Kleinbus',
  };
  return labels[segment] || segment;
}

export function getFeasibilityLabel(status: FeasibilityStatus): string {
  const labels: Record<FeasibilityStatus, string> = {
    [FeasibilityStatus.FEASIBLE]: 'Machbar',
    [FeasibilityStatus.FEASIBLE_WITH_CHARGING]: 'Machbar mit Zwischenladen',
    [FeasibilityStatus.NOT_FEASIBLE]: 'Nicht machbar',
    [FeasibilityStatus.UNKNOWN]: 'Unbekannt',
  };
  return labels[status] || status;
}

export function getScenarioTypeLabel(type: ScenarioType): string {
  const labels: Record<ScenarioType, string> = {
    [ScenarioType.BASELINE]: 'Basis',
    [ScenarioType.OPTIMISTIC]: 'Optimistisch',
    [ScenarioType.CONSERVATIVE]: 'Konservativ',
    [ScenarioType.CUSTOM]: 'Benutzerdefiniert',
  };
  return labels[type] || type;
}

export function getFeasibilityColor(status: FeasibilityStatus): string {
  const colors: Record<FeasibilityStatus, string> = {
    [FeasibilityStatus.FEASIBLE]: '#22c55e',
    [FeasibilityStatus.FEASIBLE_WITH_CHARGING]: '#f59e0b',
    [FeasibilityStatus.NOT_FEASIBLE]: '#ef4444',
    [FeasibilityStatus.UNKNOWN]: '#94a3b8',
  };
  return colors[status] || '#94a3b8';
}

// ============================================================
// DATE HELPERS
// ============================================================

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// ============================================================
// MISC HELPERS
// ============================================================

export function getTrendColor(value: number, positiveIsGood = true): string {
  if (value === 0) return 'text-slate-500';
  const isPositive = value > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  return isGood ? 'text-green-600' : 'text-red-600';
}

export function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  return denominator !== 0 ? numerator / denominator : fallback;
}

export const GERMANY_INDUSTRIES = [
  'Kurier-, Express- und Paketdienste (KEP)',
  'Lebensmittelhandel / Lebensmittellogistik',
  'Bauwirtschaft',
  'Handwerk',
  'Gesundheitswesen',
  'Entsorgung / Recycling',
  'ÖPNV / Personenbeförderung',
  'Großhandel',
  'Stadtlogistik',
  'Industrie / Produktion',
  'Sonstiges',
];

export const FLEET_TYPES = [
  'Lieferflotte',
  'Serviceflotte',
  'Verkaufsflotte',
  'Betriebsflotte',
  'ÖPNV-Flotte',
  'Gemischte Flotte',
];

export const EUROPEAN_COUNTRIES = [
  { code: 'DE', name: 'Deutschland' },
  { code: 'AT', name: 'Österreich' },
  { code: 'CH', name: 'Schweiz' },
  { code: 'NL', name: 'Niederlande' },
  { code: 'BE', name: 'Belgien' },
  { code: 'FR', name: 'Frankreich' },
  { code: 'IT', name: 'Italien' },
  { code: 'ES', name: 'Spanien' },
  { code: 'PL', name: 'Polen' },
  { code: 'SE', name: 'Schweden' },
  { code: 'DK', name: 'Dänemark' },
  { code: 'NO', name: 'Norwegen' },
];
