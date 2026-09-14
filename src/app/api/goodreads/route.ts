// Goodreads rating lookup for the /books app. Goodreads has no public API and no CORS,
// so the browser can't query it directly; this route does it server-side.
// GET /api/goodreads?isbn=9780735211292 → { rating, ratingsCount, url } or null (not on Goodreads)

export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set(["https://shimansky.nl", "https://shimapa.github.io"]);

export async function GET(request: Request) {
  const isbn = new URL(request.url).searchParams.get("isbn") ?? "";
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;

  if (!/^(\d{9}[\dX]|\d{13})$/.test(isbn)) {
    return Response.json({ error: "invalid isbn" }, { status: 400, headers });
  }

  let list: unknown;
  try {
    const res = await fetch(`https://www.goodreads.com/book/auto_complete?format=json&q=${isbn}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; shimansky.nl books)", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`goodreads ${res.status}`);
    list = await res.json();
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502, headers });
  }

  const book = Array.isArray(list) ? list[0] : null;
  const body = book?.bookUrl
    ? {
        rating: parseFloat(book.avgRating) || 0,
        ratingsCount: Number(book.ratingsCount) || 0,
        url: `https://www.goodreads.com${book.bookUrl}`,
      }
    : null;
  return Response.json(body, { headers: { ...headers, "Cache-Control": "public, max-age=86400" } });
}
