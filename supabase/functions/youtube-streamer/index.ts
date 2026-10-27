// Edge function: youtube-streamer
// Resolves a 30-second audio preview URL for a song via the iTunes Search API.
// This runs server-side so the client doesn't depend on iTunes CORS behavior.
// No video player or YouTube branding is exposed to the client — only a raw
// audio preview URL.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StreamRequest {
  songName: string;
  artistName?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as StreamRequest;
    const song = (body.songName || "").trim();
    const artist = (body.artistName || "").trim();

    if (!song) {
      return new Response(
        JSON.stringify({ error: "songName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const query = artist ? `${song} ${artist}` : song;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=US&media=music&entity=song&limit=5&explicit=Yes`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let itunesRes: Response;
    try {
      itunesRes = await fetch(url, { signal: controller.signal });
    } catch {
      clearTimeout(timeout);
      return new Response(
        JSON.stringify({ error: "Preview service unavailable" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!itunesRes.ok) {
      return new Response(
        JSON.stringify({ error: "Preview search failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await itunesRes.json() as { results?: Array<Record<string, unknown>> };
    const results = data.results || [];

    const match = results.find(
      (r) => r.trackName && r.previewUrl,
    ) || results.find((r) => r.previewUrl);

    if (!match || !match.previewUrl) {
      return new Response(
        JSON.stringify({ error: "No audio preview available" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        audioUrl: String(match.previewUrl),
        duration: "30",
        title: String(match.trackName || song),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
