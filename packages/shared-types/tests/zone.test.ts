import { describe, expect, it } from 'vitest';
import {
  COORDINATE_PRECISION_LEVELS,
  ZONE_AVAILABILITY,
  ZONE_RADIUS_MAX_METERS,
  ZONE_RADIUS_MIN_METERS,
  ZONE_TYPES,
  ZoneValidationError,
  assertValidCoordinates,
  assertValidZoneRadius,
  haversineDistanceMeters,
  isInsideZone,
  isValidCoordinates,
  isValidZoneRadius,
  zonesCovering,
} from '../src/delivery/zone.js';
import type { DamazonZone } from '../src/delivery/zone.js';

const DAMASCUS = { latitude: 33.5138, longitude: 36.2765 };

function buildZone(overrides: Partial<DamazonZone> = {}): DamazonZone {
  return {
    id: 'zone-1',
    name: 'Home',
    type: ZONE_TYPES.PERSONAL,
    description: null,
    instructions: null,
    radiusMeters: 100,
    precisionLevel: COORDINATE_PRECISION_LEVELS.EXACT,
    availability: ZONE_AVAILABILITY.ALWAYS,
    isDefault: false,
    ...DAMASCUS,
    ...overrides,
  };
}

describe('coordinates', () => {
  it('accepts real world coordinates and rejects out of range values', () => {
    expect(isValidCoordinates(DAMASCUS)).toBe(true);
    expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidCoordinates({ latitude: Number.NaN, longitude: 0 })).toBe(false);
    expect(() => assertValidCoordinates({ latitude: -91, longitude: 0 })).toThrow(
      ZoneValidationError,
    );
  });
});

describe('zone radius', () => {
  it('keeps coverage radius inside the supported operational range', () => {
    expect(isValidZoneRadius(ZONE_RADIUS_MIN_METERS)).toBe(true);
    expect(isValidZoneRadius(ZONE_RADIUS_MAX_METERS)).toBe(true);
    expect(isValidZoneRadius(ZONE_RADIUS_MIN_METERS - 1)).toBe(false);
    expect(isValidZoneRadius(ZONE_RADIUS_MAX_METERS + 1)).toBe(false);
    expect(() => assertValidZoneRadius(0)).toThrow(ZoneValidationError);
  });
});

describe('distance and coverage', () => {
  it('computes zero distance for identical points', () => {
    expect(haversineDistanceMeters(DAMASCUS, DAMASCUS)).toBe(0);
  });

  it('computes a realistic distance between two Damascus landmarks', () => {
    const umayyadMosque = { latitude: 33.5114, longitude: 36.2917 };
    const distance = haversineDistanceMeters(DAMASCUS, umayyadMosque);
    expect(distance).toBeGreaterThan(1_000);
    expect(distance).toBeLessThan(2_000);
  });

  it('detects whether a point is covered by a zone radius', () => {
    const zone = buildZone({ radiusMeters: 500 });
    const nearby = { latitude: 33.515, longitude: 36.2765 };
    const faraway = { latitude: 34.0, longitude: 36.2765 };
    expect(isInsideZone(nearby, zone)).toBe(true);
    expect(isInsideZone(faraway, zone)).toBe(false);
  });

  it('returns every zone covering a delivery point', () => {
    const zones = [
      buildZone({ id: 'zone-near' }),
      buildZone({ id: 'zone-far', latitude: 34.5 }),
      buildZone({ id: 'zone-mid', radiusMeters: 2_000, latitude: 33.52 }),
    ];
    expect(zonesCovering(DAMASCUS, zones).map((zone) => zone.id)).toStrictEqual([
      'zone-near',
      'zone-mid',
    ]);
  });
});
