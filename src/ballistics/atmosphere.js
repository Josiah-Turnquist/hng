// Air properties for ballistics and sound. Uses the International Standard
// Atmosphere: pressure falls with altitude, temperature sets the speed of sound.

export const STD_DENSITY = 1.225; // kg/m^3 at sea level, 15 C (ICAO) - the reference for published BCs
const R_AIR = 287.05; // J/(kg K)
const GAMMA = 1.4;

export class Atmosphere {
  constructor(altitudeM = 0, temperatureC = 15, humidity = 0.5) {
    this.set(altitudeM, temperatureC, humidity);
    // Wind in m/s (x = east, z = south). Gusts are added on top.
    this.windX = 0;
    this.windZ = 0;
    this.gust = 0;
  }

  set(altitudeM, temperatureC, humidity = 0.5) {
    this.altitude = altitudeM;
    this.temperatureC = temperatureC;
    const T = temperatureC + 273.15;
    // Barometric formula (troposphere): standard pressure at this altitude.
    const p = 101325 * Math.pow(1 - 2.25577e-5 * altitudeM, 5.25588);
    // Water vapor makes air slightly lighter (Tetens saturation pressure).
    const psat = 610.78 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
    const pv = humidity * psat;
    const pd = p - pv;
    this.density = pd / (R_AIR * T) + pv / (461.495 * T);
    this.speedOfSound = Math.sqrt(GAMMA * R_AIR * T);
    this.pressure = p;
  }

  setWind(speed, directionDeg) {
    // directionDeg: where the wind blows FROM, compass degrees (0 = north).
    const a = (directionDeg * Math.PI) / 180;
    this.windX = -Math.sin(a) * speed;
    this.windZ = Math.cos(a) * speed;
  }
}
