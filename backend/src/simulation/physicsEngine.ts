/**
 * Physikalisches Reichweitenmodell für elektrische Nutzfahrzeuge
 * ---------------------------------------------------------------
 * Physikalisch motiviertes, kalibrierbares Verbrauchsmodell.
 * Basierend auf: Rollwiderstand, Aerodynamik, Stop-and-Go-Verluste,
 * Temperatureinfluss und HVAC-Last.
 *
 * Alle Variablennamen und Kommentare auf Englisch.
 * Ausgabelabels und Dokumentation auf Deutsch.
 */

// ── Physical constants ─────────────────────────────────────────────────────────
const RHO = 1.225;  // kg/m³ - Luftdichte auf Meereshöhe bei 15°C
const G   = 9.81;   // m/s²  - Erdbeschleunigung

// ── Standard calibration conditions ───────────────────────────────────────────
// Referenzbedingungen für Kalibrierung: 20°C, HVAC aus, typischer Nutzungsmix
const CALIBRATION_TEMP_C  = 20;
const CALIBRATION_HVAC_ON = false;
const CALIBRATION_MIX: UsageMix = { city_share: 0.5, rural_share: 0.3, hwy_share: 0.2 };

// ── SOC window used for range calculation ──────────────────────────────────────
export const DEFAULT_SOC_START = 90; // % - Abfahrt-SOC
export const DEFAULT_SOC_MIN   = 20; // % - Mindest-Reserve
const SOC_WINDOW = (DEFAULT_SOC_START - DEFAULT_SOC_MIN) / 100; // 0.70

// ── Types ──────────────────────────────────────────────────────────────────────

export interface VehiclePhysics {
  usable_battery_kwh: number;       // Nutzbare Batteriekapazität [kWh]
  mass_kg: number;                  // Gesamtmasse Fahrzeug + Zuladung [kg]
  cd: number;                       // Strömungswiderstandsbeiwert [-]
  frontal_area_m2: number;          // Stirnfläche [m²]
  crr: number;                      // Rollwiderstandsbeiwert [-]
  drivetrain_efficiency: number;    // Antriebsstrang-Wirkungsgrad [0–1]
  base_aux_power_kw: number;        // Grundlast Nebenverbraucher [kW]
  calibration_factor: number;       // Kalibrierfaktor auf Nominalverbrauch
}

export interface DriveProfile {
  name: string;
  avg_speed_kmh: number;            // Durchschnittsgeschwindigkeit [km/h]
  stops_per_km: number;             // Anhalte pro km
  relaunch_speed_kmh: number;       // Anfahrgeschwindigkeit nach Halt [km/h]
  regen_efficiency: number;         // Rückgewinnungseffizienz Rekuperation [0–1]
}

export interface UsageMix {
  city_share: number;               // Anteil Stadtverkehr [0–1]
  rural_share: number;              // Anteil Landstraße [0–1]
  hwy_share: number;                // Anteil Autobahn [0–1]
}

export interface ProfileBreakdown {
  e_roll: number;       // Rollwiderstandsenergie [kWh/km]
  e_aero: number;       // Aerodynamischer Widerstand [kWh/km]
  e_stop: number;       // Stop-and-Go-Verluste (netto) [kWh/km]
  e_traction: number;   // Gesamte Traktionsenergie inkl. Temperaturfaktor [kWh/km]
  e_hvac: number;       // HVAC-Energiebedarf [kWh/km]
  e_base_aux: number;   // Nebenverbraucher-Energie [kWh/km]
  e_total: number;      // Gesamtverbrauch [kWh/km]
}

export interface RangeSimResult {
  consumption_kwh_per_100km: number;         // Gemischter Verbrauch [kWh/100km]
  range_km: number;                          // Geschätzte Reichweite [km]
  temperature_factor: number;               // Temperaturfaktor [-]
  hvac_power_kw: number;                    // HVAC-Leistung [kW]
  profile_breakdown: Record<string, ProfileBreakdown>;
}

// ── Standard drive profiles ────────────────────────────────────────────────────

export const DRIVE_PROFILES: Record<string, DriveProfile> = {
  city: {
    name: 'city',
    avg_speed_kmh: 27,
    stops_per_km: 1.2,
    relaunch_speed_kmh: 35,
    regen_efficiency: 0.55,
  },
  rural: {
    name: 'rural',
    avg_speed_kmh: 55,
    stops_per_km: 0.25,
    relaunch_speed_kmh: 55,
    regen_efficiency: 0.35,
  },
  hwy: {
    name: 'hwy',
    avg_speed_kmh: 95,
    stops_per_km: 0.02,
    relaunch_speed_kmh: 90,
    regen_efficiency: 0.10,
  },
};

// ── Segment-based physical defaults ───────────────────────────────────────────
// Typische Fahrzeugparameter je Segment — werden durch Kalibrierfaktor feinjustiert

interface SegmentDefaults {
  base_mass_kg: number;
  cd: number;
  frontal_area_m2: number;
  crr: number;
  drivetrain_efficiency: number;
  base_aux_power_kw: number;
}

export const SEGMENT_DEFAULTS: Record<string, SegmentDefaults> = {
  car:          { base_mass_kg: 1700,  cd: 0.26, frontal_area_m2: 2.4, crr: 0.008, drivetrain_efficiency: 0.92, base_aux_power_kw: 0.12 },
  small_van:    { base_mass_kg: 1900,  cd: 0.28, frontal_area_m2: 2.9, crr: 0.009, drivetrain_efficiency: 0.91, base_aux_power_kw: 0.15 },
  medium_van:   { base_mass_kg: 2600,  cd: 0.31, frontal_area_m2: 3.2, crr: 0.010, drivetrain_efficiency: 0.90, base_aux_power_kw: 0.15 },
  large_van:    { base_mass_kg: 3100,  cd: 0.33, frontal_area_m2: 3.5, crr: 0.011, drivetrain_efficiency: 0.89, base_aux_power_kw: 0.18 },
  minibus:      { base_mass_kg: 3800,  cd: 0.38, frontal_area_m2: 4.0, crr: 0.011, drivetrain_efficiency: 0.89, base_aux_power_kw: 0.20 },
  light_truck:  { base_mass_kg: 4800,  cd: 0.41, frontal_area_m2: 4.6, crr: 0.012, drivetrain_efficiency: 0.88, base_aux_power_kw: 0.20 },
  medium_truck: { base_mass_kg: 9000,  cd: 0.46, frontal_area_m2: 6.2, crr: 0.013, drivetrain_efficiency: 0.87, base_aux_power_kw: 0.25 },
  heavy_truck:  { base_mass_kg: 19000, cd: 0.51, frontal_area_m2: 8.2, crr: 0.014, drivetrain_efficiency: 0.86, base_aux_power_kw: 0.30 },
};

// ── Pure calculation functions ─────────────────────────────────────────────────

/**
 * Temperaturfaktor auf Traktionsenergie.
 * Referenz: 20–25°C → Faktor 1.0. Kälte und starke Hitze erhöhen den Verbrauch.
 */
export function getTemperatureFactor(temp_c: number): number {
  if (temp_c < 20)  return 1 + 0.003 * (20 - temp_c);
  if (temp_c > 25)  return 1 + 0.001 * (temp_c - 25);
  return 1.0;
}

/**
 * Temperaturabhängige HVAC-Leistung.
 * Komfortzone 20–22°C: kein aktiver Bedarf.
 * Heizung: bis 4.0 kW. Klimaanlage: bis 2.5 kW.
 */
export function getHvacPowerKw(temp_c: number, hvac_on: boolean): number {
  if (!hvac_on) return 0;
  if (temp_c < 20)  return Math.min(0.6 + 0.08 * (20 - temp_c), 4.0);
  if (temp_c > 22)  return Math.min(0.4 + 0.05 * (temp_c - 22), 2.5);
  return 0; // 20–22°C Komfortzone
}

/**
 * Validiert ob Nutzungsmix korrekt auf 100% summiert.
 */
export function validateUsageMix(mix: UsageMix): void {
  const sum = mix.city_share + mix.rural_share + mix.hwy_share;
  if (mix.city_share < 0 || mix.rural_share < 0 || mix.hwy_share < 0) {
    throw new Error('Alle Anteile des Nutzungsmix müssen >= 0 sein');
  }
  if (Math.abs(sum - 1.0) > 0.01) {
    throw new Error(`Nutzungsmix muss 100% ergeben (aktuell: ${Math.round(sum * 100)}%)`);
  }
}

/**
 * Berechnet den physikalischen Energiebedarf [kWh/km] für ein Fahrprofil.
 *
 * Bestandteile:
 *   1. Rollwiderstand:   E = m·g·crr·s / 3_600_000
 *   2. Aerodynamik:      E = 0.5·ρ·A·cd·v²·s / 3_600_000
 *   3. Stop-and-Go:      E_net = stops/km · ½m·v² · (1/η − η_regen) / 3_600_000
 *   4. Temperaturfaktor: f_T = 1 + 0.003·(20−T) für T < 20°C
 *   5. HVAC:             E = P_hvac / v_kmh
 *   6. Nebenverbraucher: E = P_aux / v_kmh
 */
export function calculateProfileEnergy(
  vehicle: VehiclePhysics,
  profile: DriveProfile,
  temp_c: number,
  hvac_on: boolean
): ProfileBreakdown {
  // 1. Rollwiderstand [kWh/km]
  const e_roll = (vehicle.mass_kg * G * vehicle.crr * 1000) / 3_600_000;

  // 2. Aerodynamischer Widerstand [kWh/km]
  const v_ms = profile.avg_speed_kmh / 3.6;
  const e_aero = (0.5 * RHO * vehicle.frontal_area_m2 * vehicle.cd * v_ms ** 2 * 1000) / 3_600_000;

  // 3. Stop-and-Go-Verluste (netto nach Rekuperation) [kWh/km]
  const v_relaunch_ms = profile.relaunch_speed_kmh / 3.6;
  const ke_joule = 0.5 * vehicle.mass_kg * v_relaunch_ms ** 2;
  const e_stop = Math.max(
    0,
    profile.stops_per_km *
    (ke_joule / 3_600_000) *
    (1 / vehicle.drivetrain_efficiency - profile.regen_efficiency)
  );

  // 4. Temperaturfaktor auf Traktionsenergie
  const f_T = getTemperatureFactor(temp_c);
  const e_traction = f_T * (e_roll + e_aero + e_stop);

  // 5. HVAC-Energiebedarf [kWh/km]
  const p_hvac = getHvacPowerKw(temp_c, hvac_on);
  const e_hvac = p_hvac / profile.avg_speed_kmh;

  // 6. Nebenverbraucher [kWh/km]
  const e_base_aux = vehicle.base_aux_power_kw / profile.avg_speed_kmh;

  // Gesamtverbrauch mit Kalibrierfaktor
  const e_total = (e_traction + e_hvac + e_base_aux) * vehicle.calibration_factor;

  return { e_roll, e_aero, e_stop, e_traction, e_hvac, e_base_aux, e_total };
}

/**
 * Berechnet Mischverbrauch und Reichweite basierend auf Nutzungsmix.
 */
export function simulateRange(
  vehicle: VehiclePhysics,
  mix: UsageMix,
  temp_c: number,
  hvac_on: boolean
): RangeSimResult {
  validateUsageMix(mix);

  const city  = calculateProfileEnergy(vehicle, DRIVE_PROFILES.city,  temp_c, hvac_on);
  const rural = calculateProfileEnergy(vehicle, DRIVE_PROFILES.rural, temp_c, hvac_on);
  const hwy   = calculateProfileEnergy(vehicle, DRIVE_PROFILES.hwy,   temp_c, hvac_on);

  const e_mix =
    mix.city_share  * city.e_total  +
    mix.rural_share * rural.e_total +
    mix.hwy_share   * hwy.e_total;

  // Reichweite: nutzbare Energie (SOC-Fenster 90%→20%) geteilt durch Verbrauch
  const effective_kwh = vehicle.usable_battery_kwh * SOC_WINDOW;
  const range_km = effective_kwh / e_mix;

  return {
    consumption_kwh_per_100km: e_mix * 100,
    range_km,
    temperature_factor: getTemperatureFactor(temp_c),
    hvac_power_kw: getHvacPowerKw(temp_c, hvac_on),
    profile_breakdown: { city, rural, hwy },
  };
}

/**
 * Erstellt ein kalibriertes VehiclePhysics-Objekt aus den EV-Modell-Daten.
 *
 * Kalibrierung: Der Kalibrierfaktor wird so berechnet, dass das Modell bei
 * Standardbedingungen (20°C, HVAC aus, 50/30/20 Mix, Leergewicht) exakt den
 * Nominalverbrauch des Herstellers reproduziert.
 *
 * Dadurch ist das Modell sowohl physikalisch motiviert als auch an reale Daten
 * verankert — alle Einflussfaktoren (Temperatur, Zuladung, Geschwindigkeit)
 * wirken als physikalisch korrekte Abweichungen vom Nominalverbrauch.
 */
export function buildVehiclePhysics(
  usable_battery_kwh: number,
  nominal_consumption_kwh_100km: number,
  segment: string,
  payload_kg: number = 0
): VehiclePhysics {
  const defaults = SEGMENT_DEFAULTS[segment] ?? SEGMENT_DEFAULTS['medium_van'];
  const mass_kg = defaults.base_mass_kg + payload_kg;

  // Schritt 1: Fahrzeug ohne Kalibrierung (Faktor = 1.0)
  const uncalibrated: VehiclePhysics = {
    usable_battery_kwh,
    mass_kg,
    cd: defaults.cd,
    frontal_area_m2: defaults.frontal_area_m2,
    crr: defaults.crr,
    drivetrain_efficiency: defaults.drivetrain_efficiency,
    base_aux_power_kw: defaults.base_aux_power_kw,
    calibration_factor: 1.0,
  };

  // Schritt 2: Verbrauch bei Standardbedingungen berechnen
  const stdResult = simulateRange(uncalibrated, CALIBRATION_MIX, CALIBRATION_TEMP_C, CALIBRATION_HVAC_ON);
  const computed_consumption = stdResult.consumption_kwh_per_100km;

  // Schritt 3: Kalibrierfaktor = Nominalwert / berechneter Wert
  const calibration_factor = nominal_consumption_kwh_100km / computed_consumption;

  return { ...uncalibrated, calibration_factor };
}

/**
 * Erstellt ein routenspezifisches Fahrprofil durch Interpolation zwischen
 * den Standardprofilen (Stadt/Landstraße/Autobahn) anhand der Durchschnittsgeschwindigkeit.
 */
export function buildRouteProfile(avg_speed_kmh: number | null): DriveProfile {
  const speed = avg_speed_kmh ?? 50;

  if (speed <= 27) return DRIVE_PROFILES.city;
  if (speed >= 95) return DRIVE_PROFILES.hwy;

  if (speed <= 55) {
    // Interpolation Stadt → Landstraße
    const t = (speed - 27) / (55 - 27);
    return {
      name: 'interpolated',
      avg_speed_kmh: speed,
      stops_per_km:        lerp(1.2,  0.25, t),
      relaunch_speed_kmh:  lerp(35,   55,   t),
      regen_efficiency:    lerp(0.55, 0.35, t),
    };
  }

  // Interpolation Landstraße → Autobahn
  const t = (speed - 55) / (95 - 55);
  return {
    name: 'interpolated',
    avg_speed_kmh: speed,
    stops_per_km:        lerp(0.25, 0.02, t),
    relaunch_speed_kmh:  lerp(55,   90,   t),
    regen_efficiency:    lerp(0.35, 0.10, t),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
