// FIFA world rankings (April 2026) for the 2026 World Cup nations. The football
// data APIs don't expose rankings, so when we import official teams we enrich
// them from this table (matched by 3-letter code, then by name). Includes a few
// name spellings the APIs use (e.g. Türkiye, Czechia, Côte d'Ivoire).
//
// [name, code, ranking]
const TABLE = [
  ['France', 'FRA', 1],
  ['Spain', 'ESP', 2],
  ['Argentina', 'ARG', 3],
  ['England', 'ENG', 4],
  ['Portugal', 'POR', 5],
  ['Brazil', 'BRA', 6],
  ['Netherlands', 'NED', 7],
  ['Morocco', 'MAR', 8],
  ['Belgium', 'BEL', 9],
  ['Germany', 'GER', 10],
  ['Croatia', 'CRO', 11],
  ['Colombia', 'COL', 13],
  ['Senegal', 'SEN', 14],
  ['Mexico', 'MEX', 15],
  ['United States', 'USA', 16],
  ['USA', 'USA', 16],
  ['Uruguay', 'URU', 17],
  ['Japan', 'JPN', 18],
  ['Switzerland', 'SUI', 19],
  ['Iran', 'IRN', 21],
  ['IR Iran', 'IRN', 21],
  ['Turkey', 'TUR', 22],
  ['Türkiye', 'TUR', 22],
  ['Ecuador', 'ECU', 23],
  ['Austria', 'AUT', 24],
  ['South Korea', 'KOR', 25],
  ['Korea Republic', 'KOR', 25],
  ['Australia', 'AUS', 27],
  ['Algeria', 'ALG', 28],
  ['Egypt', 'EGY', 29],
  ['Canada', 'CAN', 30],
  ['Norway', 'NOR', 31],
  ['Panama', 'PAN', 33],
  ['Ivory Coast', 'CIV', 34],
  ["Côte d'Ivoire", 'CIV', 34],
  ['Sweden', 'SWE', 38],
  ['Paraguay', 'PAR', 40],
  ['Czech Republic', 'CZE', 41],
  ['Czechia', 'CZE', 41],
  ['Scotland', 'SCO', 43],
  ['Tunisia', 'TUN', 44],
  ['DR Congo', 'COD', 46],
  ['Congo DR', 'COD', 46],
  ['Uzbekistan', 'UZB', 50],
  ['Qatar', 'QAT', 55],
  ['Iraq', 'IRQ', 57],
  ['South Africa', 'RSA', 60],
  ['Saudi Arabia', 'KSA', 61],
  ['Jordan', 'JOR', 63],
  ['Bosnia and Herzegovina', 'BIH', 65],
  ['Cape Verde', 'CPV', 69],
  ['Cabo Verde', 'CPV', 69],
  ['Ghana', 'GHA', 74],
  ['Curaçao', 'CUW', 82],
  ['Curacao', 'CUW', 82],
  ['Haiti', 'HAI', 83],
  ['New Zealand', 'NZL', 85],
];

export const FIFA_RANKINGS = Object.fromEntries(TABLE.map(([, code, rank]) => [code, rank]));
const BY_NAME = Object.fromEntries(TABLE.map(([name, , rank]) => [name.toLowerCase(), rank]));
const NAME_TO_CODE = Object.fromEntries(TABLE.map(([name, code]) => [name.toLowerCase(), code]));

/** Best-effort ranking lookup by code then name; null if unknown (sorts last). */
export function rankFor(name, code) {
  if (code && FIFA_RANKINGS[code.toUpperCase()] != null) return FIFA_RANKINGS[code.toUpperCase()];
  if (name && BY_NAME[name.toLowerCase()] != null) return BY_NAME[name.toLowerCase()];
  return null;
}

/**
 * Resolve an API team's name/code to our canonical FIFA 3-letter code; null if
 * unknown. Prefers the name table (it carries the alternate spellings the APIs
 * use — "Korea Republic", "Türkiye", "Côte d'Ivoire" …), then falls back to a
 * code the API supplied if it's one we recognise. Used to link a provider's
 * team ids onto our seeded teams.
 */
export function codeFor(name, code) {
  if (name && NAME_TO_CODE[name.toLowerCase()]) return NAME_TO_CODE[name.toLowerCase()];
  if (code && FIFA_RANKINGS[code.toUpperCase()] != null) return code.toUpperCase();
  return null;
}
