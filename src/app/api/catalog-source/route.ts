import { NextRequest, NextResponse } from "next/server";
import {
  CATALOG_SOURCE_COOKIE,
  getDefaultCatalogSource,
  isCatalogSource,
  isCatalogSourceLabEnabled,
  type CatalogSource,
} from "@/lib/catalog-source";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const CATALOG_SOURCES = ["json", "supabase"] satisfies CatalogSource[];

function cookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

function resolveRequestCatalogSource(request: NextRequest): CatalogSource {
  const labEnabled = isCatalogSourceLabEnabled();
  const defaultSource = getDefaultCatalogSource();
  if (!labEnabled) return defaultSource;

  const override = request.cookies.get(CATALOG_SOURCE_COOKIE)?.value;
  return isCatalogSource(override) ? override : defaultSource;
}

export async function GET(request: NextRequest) {
  const labEnabled = isCatalogSourceLabEnabled();
  const defaultSource = getDefaultCatalogSource();
  const currentSource = resolveRequestCatalogSource(request);

  return NextResponse.json({
    labEnabled,
    defaultSource,
    currentSource,
    sources: CATALOG_SOURCES,
  });
}

export async function POST(request: NextRequest) {
  if (!isCatalogSourceLabEnabled()) {
    return NextResponse.json(
      {
        error: "Catalog source lab is disabled in this environment.",
        labEnabled: false,
        defaultSource: getDefaultCatalogSource(),
        currentSource: getDefaultCatalogSource(),
        sources: CATALOG_SOURCES,
      },
      { status: 403 },
    );
  }

  let body: { source?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isCatalogSource(body.source)) {
    return NextResponse.json({ error: "source must be 'json' or 'supabase'." }, { status: 400 });
  }

  const source = body.source;
  const response = NextResponse.json({
    labEnabled: true,
    defaultSource: getDefaultCatalogSource(),
    currentSource: source,
    sources: CATALOG_SOURCES,
  });

  response.cookies.set(CATALOG_SOURCE_COOKIE, source, cookieOptions(request));
  return response;
}
