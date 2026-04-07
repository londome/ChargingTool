import { XMLParser } from 'fast-xml-parser';

const ENTSO_E_API_KEY = 'c2f4624a-d705-414b-adb6-bff15f78202d';
const ENTSO_E_BASE_URL = 'https://web-api.tp.entsoe.eu/api';

export const AVAILABLE_BIDDING_ZONES: Record<string, string> = {
  DE_LU: 'Deutschland/Luxemburg (DE-LU)',
  GB: 'Großbritannien (GB)',
  NL: 'Niederlande (NL)',
  DE_AT_LU: 'DE-AT-LU (historisch)',
  FR: 'Frankreich (FR)',
  ES: 'Spanien (ES)',
};

const EIC_CODES: Record<string, string> = {
  GB: '10YGB----------A',
  NL: '10YNL----------L',
  DE_LU: '10Y1001A1001A82H',
  DE_AT_LU: '10Y1001A1001A63L',
  FR: '10YFR-RTE------C',
  ES: '10YES-REE------0',
};

function formatDateParam(date: Date): string {
  // YYYYMMDDHHOO format expected by ENTSO-E
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}0000`;
}

function generateMockPrices(): number[] {
  // Realistic mock day-ahead prices in €/MWh for a 24h period
  const baseHourlyPrices = [
    45, 40, 38, 36, 35, 38, 55, 75, 90, 95, 92, 88,
    85, 82, 80, 85, 92, 105, 115, 110, 95, 75, 60, 50,
  ];
  // Expand to 96 x 15-min intervals
  const prices96: number[] = [];
  for (const p of baseHourlyPrices) {
    // Add small random variation within each hour
    for (let q = 0; q < 4; q++) {
      prices96.push(p + (Math.random() - 0.5) * 5);
    }
  }
  return prices96;
}

export interface DayAheadPricesResult {
  prices_15min: number[]; // 96 values in €/kWh
  prices_hourly: number[]; // 24 values in €/kWh
  unit: string;
  source: 'entso-e' | 'mock';
}

export async function fetchDayAheadPrices(
  date: Date,
  biddingZone: string
): Promise<DayAheadPricesResult> {
  const eicCode = EIC_CODES[biddingZone];
  if (!eicCode) {
    throw new Error(`Unknown bidding zone: ${biddingZone}`);
  }

  // periodStart = start of day, periodEnd = start of next day
  const periodStart = formatDateParam(date);
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const periodEnd = formatDateParam(nextDay);

  const url = new URL(ENTSO_E_BASE_URL);
  url.searchParams.set('securityToken', ENTSO_E_API_KEY);
  url.searchParams.set('documentType', 'A44');
  url.searchParams.set('in_Domain', eicCode);
  url.searchParams.set('out_Domain', eicCode);
  url.searchParams.set('periodStart', periodStart);
  url.searchParams.set('periodEnd', periodEnd);

  try {
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/xml' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`ENTSO-E API returned ${response.status}, falling back to mock prices`);
      return buildMockResult();
    }

    const xml = await response.text();
    return parseEntsoeXml(xml);
  } catch (err) {
    console.warn('ENTSO-E API unavailable, using mock prices:', (err as Error).message);
    return buildMockResult();
  }
}

function buildMockResult(): DayAheadPricesResult {
  const prices96mwh = generateMockPrices();
  const prices96kwh = prices96mwh.map(p => p / 1000);
  const pricesHourly = Array.from({ length: 24 }, (_, h) => {
    const slice = prices96kwh.slice(h * 4, h * 4 + 4);
    return slice.reduce((a, b) => a + b, 0) / 4;
  });
  return { prices_15min: prices96kwh, prices_hourly: pricesHourly, unit: '€/kWh', source: 'mock' };
}

function parseEntsoeXml(xml: string): DayAheadPricesResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    parseAttributeValue: true,
  });
  const doc = parser.parse(xml);

  // Navigate ENTSO-E XML structure
  const publication = doc['Publication_MarketDocument'] || doc;
  const timeSeriesRaw = publication['TimeSeries'];

  if (!timeSeriesRaw) {
    console.warn('No TimeSeries found in ENTSO-E response, using mock');
    return buildMockResult();
  }

  // TimeSeries can be a single object or array
  const tsList = Array.isArray(timeSeriesRaw) ? timeSeriesRaw : [timeSeriesRaw];

  // Collect all price points (€/MWh)
  const allPoints: { position: number; price: number }[] = [];

  for (const ts of tsList) {
    const period = ts['Period'];
    if (!period) continue;

    const resolution: string = period['resolution'] || 'PT60M';
    const pointsRaw = period['Point'];
    if (!pointsRaw) continue;

    const points = Array.isArray(pointsRaw) ? pointsRaw : [pointsRaw];

    for (const pt of points) {
      const position = Number(pt['position']);
      const priceAmount = Number(pt['price.amount']);
      if (!isNaN(position) && !isNaN(priceAmount)) {
        allPoints.push({ position, price: priceAmount });
      }
    }

    // If hourly resolution (PT60M), expand to 15-min (4 slots per hour)
    if (resolution === 'PT60M' && allPoints.length > 0) {
      const expanded: { position: number; price: number }[] = [];
      for (const pt of allPoints) {
        for (let q = 0; q < 4; q++) {
          expanded.push({ position: (pt.position - 1) * 4 + q + 1, price: pt.price });
        }
      }
      allPoints.length = 0;
      allPoints.push(...expanded);
    }
  }

  if (allPoints.length === 0) {
    console.warn('No price points parsed from ENTSO-E XML, using mock');
    return buildMockResult();
  }

  // Sort by position and build 96-value array
  allPoints.sort((a, b) => a.position - b.position);

  const prices96kwh = Array(96).fill(0);
  for (const pt of allPoints) {
    const idx = pt.position - 1;
    if (idx >= 0 && idx < 96) {
      prices96kwh[idx] = pt.price / 1000; // €/MWh → €/kWh
    }
  }

  const pricesHourly = Array.from({ length: 24 }, (_, h) => {
    const slice = prices96kwh.slice(h * 4, h * 4 + 4);
    return slice.reduce((a, b) => a + b, 0) / 4;
  });

  return { prices_15min: prices96kwh, prices_hourly: pricesHourly, unit: '€/kWh', source: 'entso-e' };
}
