import type { PlaceDetailsResult } from "./google";

export function mapsDirLink(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number
): string {
  const sLat = Number(startLat.toFixed(6));
  const sLng = Number(startLng.toFixed(6));
  const dLat = Number(destLat.toFixed(6));
  const dLng = Number(destLng.toFixed(6));
  return `https://www.google.com/maps/dir/${sLat},${sLng}/${dLat},${dLng}`;
}

export function photoProxyUrl(photoRef: string, maxwidth = 1200): string {
  const params = new URLSearchParams({ ref: photoRef, maxwidth: String(maxwidth) });
  return `/photo?${params.toString()}`;
}

export function buildReason(details: PlaceDetailsResult, vibe?: string): string {
  const segments: string[] = [];

  const overview = details.editorial_summary?.overview?.trim();
  if (overview) {
    // Make sure it ends with a period
    segments.push(overview.endsWith(".") ? overview : `${overview}.`);
  }

  if (typeof details.rating === "number" && typeof details.user_ratings_total === "number") {
    const rounded = Math.round(details.rating * 10) / 10;
    const count = details.user_ratings_total;
    const formattedCount = count.toLocaleString("en-US");
    segments.push(`Rated ${rounded} (${formattedCount}).`);
  }

  const topReview = selectTopReview(details);
  if (topReview) {
    const reviewSnippet = truncateForSentence(topReview.text.trim(), 240);
    const author = topReview.author_name ? ` — ${topReview.author_name}` : "";
    segments.push(`Top review: "${reviewSnippet}"${author}.`);
  }

  if (vibe && vibe.trim().length > 0) {
    segments.push(`Fits your vibe: ${vibe.trim()}.`);
  }

  return segments.join(" ").replace(/\s+/g, " ").trim();
}

function truncateForSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastSpace = truncated.lastIndexOf(" ");
  const cutoff = Math.max(lastPeriod, lastSpace);
  return (cutoff > 40 ? truncated.slice(0, cutoff) : truncated).trim() + "…";
}

function selectTopReview(details: PlaceDetailsResult): { text: string; author_name?: string } | null {
  const reviews = details.reviews || [];
  const withText = reviews.filter((r) => typeof r.text === "string" && r.text.trim().length > 0);
  if (withText.length === 0) return null;
  // Heuristic: prioritize highest rating, then longest text
  withText.sort((a, b) => {
    const ra = typeof a.rating === "number" ? a.rating : 0;
    const rb = typeof b.rating === "number" ? b.rating : 0;
    if (rb !== ra) return rb - ra;
    return (b.text?.length || 0) - (a.text?.length || 0);
  });
  const top = withText[0];
  return { text: top.text, author_name: top.author_name };
}