// Where a player is, as near as the game knows: the time zone his computer is
// set to ("America/Chicago"), which his browser sends when he opens the game
// (net/lobby.js). From it, the country and the zone's city, for the admin
// page. No address is kept or looked up; a player whose clock is set to
// another zone shows as being there.
//
//   cleanZone('America/Chicago')  -> 'America/Chicago' (null if it is no zone name)
//   placeOf('America/Chicago')    -> { code: 'US', city: 'Chicago', area: 'America' }
//   placeName('America/Chicago')  -> 'United States (Chicago)'

// The country of each zone a player is at all likely to be in (and the old
// names some browsers still give). A zone not here shows by its city alone.
const BY_COUNTRY = {
  US: 'America/New_York America/Chicago America/Denver America/Los_Angeles America/Phoenix America/Anchorage Pacific/Honolulu America/Detroit America/Boise America/Juneau America/Indiana/Indianapolis America/Indianapolis America/Kentucky/Louisville America/Louisville US/Eastern US/Central US/Mountain US/Pacific',
  CA: 'America/Toronto America/Vancouver America/Edmonton America/Winnipeg America/Halifax America/St_Johns America/Regina America/Montreal',
  MX: 'America/Mexico_City America/Monterrey America/Tijuana America/Cancun America/Chihuahua',
  BR: 'America/Sao_Paulo America/Rio_Branco America/Manaus America/Fortaleza America/Recife America/Bahia America/Belem',
  AR: 'America/Argentina/Buenos_Aires America/Buenos_Aires America/Argentina/Cordoba',
  CL: 'America/Santiago',
  CO: 'America/Bogota',
  PE: 'America/Lima',
  VE: 'America/Caracas',
  GB: 'Europe/London Europe/Belfast',
  IE: 'Europe/Dublin',
  FR: 'Europe/Paris',
  DE: 'Europe/Berlin Europe/Busingen',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  LU: 'Europe/Luxembourg',
  CH: 'Europe/Zurich',
  AT: 'Europe/Vienna',
  IT: 'Europe/Rome',
  ES: 'Europe/Madrid Atlantic/Canary',
  PT: 'Europe/Lisbon Atlantic/Azores',
  DK: 'Europe/Copenhagen',
  NO: 'Europe/Oslo',
  SE: 'Europe/Stockholm',
  FI: 'Europe/Helsinki',
  IS: 'Atlantic/Reykjavik',
  PL: 'Europe/Warsaw',
  CZ: 'Europe/Prague',
  SK: 'Europe/Bratislava',
  HU: 'Europe/Budapest',
  RO: 'Europe/Bucharest',
  BG: 'Europe/Sofia',
  GR: 'Europe/Athens',
  HR: 'Europe/Zagreb',
  SI: 'Europe/Ljubljana',
  RS: 'Europe/Belgrade',
  BA: 'Europe/Sarajevo',
  EE: 'Europe/Tallinn',
  LV: 'Europe/Riga',
  LT: 'Europe/Vilnius',
  UA: 'Europe/Kyiv Europe/Kiev',
  BY: 'Europe/Minsk',
  MD: 'Europe/Chisinau',
  RU: 'Europe/Moscow Europe/Kaliningrad Europe/Samara Europe/Volgograd Asia/Yekaterinburg Asia/Omsk Asia/Novosibirsk Asia/Krasnoyarsk Asia/Irkutsk Asia/Yakutsk Asia/Vladivostok Asia/Kamchatka',
  TR: 'Europe/Istanbul Asia/Istanbul',
  IL: 'Asia/Jerusalem Asia/Tel_Aviv',
  SA: 'Asia/Riyadh',
  AE: 'Asia/Dubai',
  IR: 'Asia/Tehran',
  EG: 'Africa/Cairo',
  ZA: 'Africa/Johannesburg',
  NG: 'Africa/Lagos',
  KE: 'Africa/Nairobi',
  MA: 'Africa/Casablanca',
  DZ: 'Africa/Algiers',
  IN: 'Asia/Kolkata Asia/Calcutta',
  PK: 'Asia/Karachi',
  BD: 'Asia/Dhaka',
  KZ: 'Asia/Almaty',
  GE: 'Asia/Tbilisi',
  CN: 'Asia/Shanghai Asia/Chongqing Asia/Urumqi',
  HK: 'Asia/Hong_Kong',
  TW: 'Asia/Taipei',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  SG: 'Asia/Singapore',
  MY: 'Asia/Kuala_Lumpur',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh Asia/Saigon',
  ID: 'Asia/Jakarta Asia/Makassar',
  PH: 'Asia/Manila',
  AU: 'Australia/Sydney Australia/Melbourne Australia/Brisbane Australia/Perth Australia/Adelaide Australia/Hobart Australia/Darwin',
  NZ: 'Pacific/Auckland',
};
const COUNTRY = new Map();
for (const [code, zones] of Object.entries(BY_COUNTRY)) for (const z of zones.split(' ')) COUNTRY.set(z, code);

// A zone name as a browser gives it, or null: nothing else is kept.
export function cleanZone(tz) {
  if (typeof tz !== 'string' || tz.length > 40) return null;
  return /^[A-Za-z]+(\/[A-Za-z0-9_+-]+){1,2}$/.test(tz) ? tz : null;
}

// { code: the country's two letters (null if not known), city, area }.
export function placeOf(tz) {
  const zone = cleanZone(tz);
  if (!zone) return null;
  const parts = zone.split('/');
  return { code: COUNTRY.get(zone) ?? null, city: parts.at(-1).replace(/_/g, ' '), area: parts[0] };
}

// "United States (Chicago)"; a zone whose country is not known: "Lagos
// (Africa)"; no zone: ''.
export function placeName(tz, locale = 'en') {
  const p = placeOf(tz);
  if (!p) return '';
  if (!p.code) return `${p.city} (${p.area})`;
  let country = p.code;
  try {
    country = new Intl.DisplayNames([locale], { type: 'region' }).of(p.code) || p.code;
  } catch {
    /* (No names here: the two letters.) */
  }
  return `${country} (${p.city})`;
}
