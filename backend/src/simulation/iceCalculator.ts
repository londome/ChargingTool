/**
 * ICE (Internal Combustion Engine) Vehicle Calculation Functions
 * All monetary values in EUR, distances in km, fuel in liters, CO2 in kg
 */

// Default diesel emission factor: 2.65 kg CO2e / liter (IPCC/DEFRA)
export const DEFAULT_DIESEL_EMISSION_FACTOR = 2.65;
// Default petrol emission factor: 2.31 kg CO2e / liter
export const DEFAULT_PETROL_EMISSION_FACTOR = 2.31;
// Default diesel price EUR/L (Germany 2024)
export const DEFAULT_DIESEL_PRICE = 1.75;
// Default petrol price EUR/L
export const DEFAULT_PETROL_PRICE = 1.85;
// Default vehicle lifetime years for TCO
export const DEFAULT_LIFETIME_YEARS = 8;
// Default discount rate for NPV / annualized capex
export const DEFAULT_DISCOUNT_RATE = 0.05;

/**
 * Calculate fuel consumption for a given distance
 * @param km - Distance in kilometers
 * @param fc_l100km - Fuel consumption in liters per 100 km
 * @returns Fuel consumed in liters
 */
export function calculateFuelConsumption(km: number, fc_l100km: number): number {
  return (km / 100) * fc_l100km;
}

/**
 * Calculate fuel cost
 * @param fuel_l - Fuel consumed in liters
 * @param price_per_l - Fuel price per liter in EUR
 * @returns Fuel cost in EUR
 */
export function calculateFuelCost(fuel_l: number, price_per_l: number): number {
  return fuel_l * price_per_l;
}

/**
 * Calculate ICE CO2 equivalent emissions
 * @param fuel_l - Fuel consumed in liters
 * @param emission_factor - kg CO2e per liter
 * @returns CO2e in kg
 */
export function calculateIceCO2e(fuel_l: number, emission_factor: number = DEFAULT_DIESEL_EMISSION_FACTOR): number {
  return fuel_l * emission_factor;
}

/**
 * Calculate annual ICE operational expenditure
 * @param fuel_cost - Annual fuel cost in EUR
 * @param maintenance - Annual maintenance cost in EUR
 * @param other - Other annual costs (insurance, tolls, etc.) in EUR
 * @returns Annual OpEx in EUR
 */
export function calculateIceOpex(fuel_cost: number, maintenance: number, other: number = 0): number {
  return fuel_cost + maintenance + other;
}

/**
 * Annualize CAPEX using annuity formula
 * @param capex - Total capital expenditure in EUR
 * @param lifetime_years - Vehicle lifetime in years
 * @param discount_rate - Annual discount rate (e.g. 0.05 = 5%)
 * @returns Annualized CAPEX in EUR/year
 */
export function annualizeCapex(capex: number, lifetime_years: number = DEFAULT_LIFETIME_YEARS, discount_rate: number = DEFAULT_DISCOUNT_RATE): number {
  if (discount_rate === 0) return capex / lifetime_years;
  const annuityFactor = (discount_rate * Math.pow(1 + discount_rate, lifetime_years)) / (Math.pow(1 + discount_rate, lifetime_years) - 1);
  return capex * annuityFactor;
}

/**
 * Calculate Total Cost of Ownership for ICE vehicle (over lifetime)
 * @param capex_annualized - Annualized CAPEX (EUR/year)
 * @param opex_annual - Annual OpEx (EUR/year)
 * @param lifetime_years - Vehicle lifetime in years
 * @returns Total TCO in EUR over lifetime
 */
export function calculateIceTCO(capex_annualized: number, opex_annual: number, lifetime_years: number = DEFAULT_LIFETIME_YEARS): number {
  return (capex_annualized + opex_annual) * lifetime_years;
}

/**
 * Calculate annual fuel cost from annual km and consumption
 * @param annual_km - Annual kilometers
 * @param fc_l100km - Fuel consumption in L/100km
 * @param price_per_l - Fuel price per liter
 */
export function calculateAnnualFuelCost(annual_km: number, fc_l100km: number, price_per_l: number = DEFAULT_DIESEL_PRICE): number {
  const fuelL = calculateFuelConsumption(annual_km, fc_l100km);
  return calculateFuelCost(fuelL, price_per_l);
}

/**
 * Calculate annual ICE CO2e from annual km and consumption
 */
export function calculateAnnualIceCO2e(annual_km: number, fc_l100km: number, emission_factor: number = DEFAULT_DIESEL_EMISSION_FACTOR): number {
  const fuelL = calculateFuelConsumption(annual_km, fc_l100km);
  return calculateIceCO2e(fuelL, emission_factor);
}

/**
 * Calculate residual value of ICE vehicle
 * Simple linear depreciation model
 */
export function calculateResidualValue(purchase_price: number, age_years: number, lifetime_years: number = DEFAULT_LIFETIME_YEARS): number {
  const depreciationPerYear = purchase_price / lifetime_years;
  const residual = purchase_price - depreciationPerYear * age_years;
  return Math.max(0, residual);
}
