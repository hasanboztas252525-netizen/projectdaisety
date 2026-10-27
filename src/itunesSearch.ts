export interface ITunesResult {
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
  trackId: number;
}

const ITUNES_BASE = "https://itunes.apple.com/search";

function detectRegion(): string {
  try {
    const locale = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage || "en-US";
    const parts = locale.split("-");
    if (parts.length >= 2) {
      return parts[1].toUpperCase();
    }
    return "US";
  } catch {
    return "US";
  }
}

export function getRegion(): string {
  return detectRegion();
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedSearch(
  query: string,
  callback: (results: ITunesResult[]) => void,
  delay = 500,
): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const results = await searchITunes(query);
    callback(results);
  }, delay);
}

export async function searchITunes(query: string): Promise<ITunesResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const region = detectRegion();
  const url = `${ITUNES_BASE}?term=${encodeURIComponent(trimmed)}&country=${region}&media=music&entity=song&limit=5&explicit=Yes&v=${Date.now()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter((r: Record<string, unknown>) => r.trackName && r.artistName)
      .slice(0, 5)
      .map((r: Record<string, unknown>) => ({
        trackName: String(r.trackName),
        artistName: String(r.artistName),
        artworkUrl100: String(r.artworkUrl100 || ""),
        previewUrl: String(r.previewUrl || ""),
        trackId: Number(r.trackId || 0),
      }));
  } catch {
    return [];
  }
}
