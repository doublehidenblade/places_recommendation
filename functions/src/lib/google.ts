import { logger } from "firebase-functions/logger";

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface TextSearchPlace {
  place_id: string;
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  photos?: Array<{ photo_reference: string }>;
  geometry?: { location: LatLngLiteral };
}

export interface TextSearchResponse {
  results: TextSearchPlace[];
  status: string;
  error_message?: string;
}

export interface PlaceDetailsResult {
  name: string;
  geometry: { location: LatLngLiteral };
  photos?: Array<{ photo_reference: string }>;
  editorial_summary?: { overview?: string };
  reviews?: Array<{ rating?: number; text: string; author_name?: string }>;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
}

export interface PlaceDetailsResponse {
  result?: PlaceDetailsResult;
  status: string;
  error_message?: string;
}

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

export async function textSearch(args: {
  query: string;
  location: LatLngLiteral;
  radius: number;
  apiKey: string;
}): Promise<TextSearchResponse> {
  const { query, location, radius, apiKey } = args;
  const params = new URLSearchParams({
    query,
    location: `${location.lat},${location.lng}`,
    radius: String(radius),
    key: apiKey,
  });
  const url = `${PLACES_BASE}/textsearch/json?${params.toString()}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error("Text Search HTTP error", { status: res.status, text });
    throw new Error(`Text Search failed with status ${res.status}`);
  }
  const data = (await res.json()) as TextSearchResponse;
  return data;
}

export async function placeDetails(args: {
  placeId: string;
  apiKey: string;
}): Promise<PlaceDetailsResponse> {
  const { placeId, apiKey } = args;
  const fields = [
    "name",
    "geometry",
    "photos",
    "editorial_summary",
    "reviews",
    "rating",
    "user_ratings_total",
    "types",
  ].join(",");
  const params = new URLSearchParams({ place_id: placeId, fields, key: apiKey });
  const url = `${PLACES_BASE}/details/json?${params.toString()}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error("Place Details HTTP error", { status: res.status, text });
    throw new Error(`Place Details failed with status ${res.status}`);
  }
  const data = (await res.json()) as PlaceDetailsResponse;
  return data;
}