"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textSearch = textSearch;
exports.placeDetails = placeDetails;
const firebase_functions_1 = require("firebase-functions");
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
async function textSearch(args) {
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
        firebase_functions_1.logger.error("Text Search HTTP error", { status: res.status, text });
        throw new Error(`Text Search failed with status ${res.status}`);
    }
    const data = (await res.json());
    return data;
}
async function placeDetails(args) {
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
        firebase_functions_1.logger.error("Place Details HTTP error", { status: res.status, text });
        throw new Error(`Place Details failed with status ${res.status}`);
    }
    const data = (await res.json());
    return data;
}
