export const ZONE_TYPES = {
  PERSONAL: 'personal',
  PUBLIC: 'public',
  OFFICIAL: 'official',
} as const;

export type ZoneType = (typeof ZONE_TYPES)[keyof typeof ZONE_TYPES];

export const ALL_ZONE_TYPES = Object.values(ZONE_TYPES) as readonly ZoneType[];

export const ZONE_AVAILABILITY = {
  ALWAYS: 'always',
  SCHEDULED: 'scheduled',
  TEMPORARILY_CLOSED: 'temporarily_closed',
} as const;

export type ZoneAvailability = (typeof ZONE_AVAILABILITY)[keyof typeof ZONE_AVAILABILITY];

export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;

export const ZONE_RADIUS_MIN_METERS = 20;
export const ZONE_RADIUS_MAX_METERS = 5_000;
export const ZONE_RADIUS_DEFAULT_METERS = 100;

export const COORDINATE_PRECISION_LEVELS = {
  EXACT: 'exact',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type CoordinatePrecisionLevel =
  (typeof COORDINATE_PRECISION_LEVELS)[keyof typeof COORDINATE_PRECISION_LEVELS];

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface DamazonZone extends Coordinates {
  readonly id: string;
  readonly name: string;
  readonly type: ZoneType;
  readonly description: string | null;
  readonly instructions: string | null;
  readonly radiusMeters: number;
  readonly precisionLevel: CoordinatePrecisionLevel;
  readonly availability: ZoneAvailability;
  readonly isDefault: boolean;
}

export class ZoneValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ZoneValidationError';
  }
}

export function isValidLatitude(latitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= LATITUDE_MIN && latitude <= LATITUDE_MAX;
}

export function isValidLongitude(longitude: number): boolean {
  return Number.isFinite(longitude) && longitude >= LONGITUDE_MIN && longitude <= LONGITUDE_MAX;
}

export function isValidCoordinates(coordinates: Coordinates): boolean {
  return isValidLatitude(coordinates.latitude) && isValidLongitude(coordinates.longitude);
}

export function assertValidCoordinates(coordinates: Coordinates): void {
  if (!isValidLatitude(coordinates.latitude)) {
    throw new ZoneValidationError(`Latitude out of range: ${coordinates.latitude}`);
  }
  if (!isValidLongitude(coordinates.longitude)) {
    throw new ZoneValidationError(`Longitude out of range: ${coordinates.longitude}`);
  }
}

export function isValidZoneRadius(radiusMeters: number): boolean {
  return (
    Number.isFinite(radiusMeters) &&
    radiusMeters >= ZONE_RADIUS_MIN_METERS &&
    radiusMeters <= ZONE_RADIUS_MAX_METERS
  );
}

export function assertValidZoneRadius(radiusMeters: number): void {
  if (!isValidZoneRadius(radiusMeters)) {
    throw new ZoneValidationError(
      `Zone radius must be between ${ZONE_RADIUS_MIN_METERS} and ${ZONE_RADIUS_MAX_METERS} meters, received ${radiusMeters}`,
    );
  }
}

const EARTH_RADIUS_METERS = 6_371_008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(from: Coordinates, to: Coordinates): number {
  assertValidCoordinates(from);
  assertValidCoordinates(to);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function isInsideZone(point: Coordinates, zone: DamazonZone): boolean {
  return haversineDistanceMeters(point, zone) <= zone.radiusMeters;
}

export function zonesCovering(
  point: Coordinates,
  zones: readonly DamazonZone[],
): readonly DamazonZone[] {
  return zones.filter((zone) => isInsideZone(point, zone));
}
