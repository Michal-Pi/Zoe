const DEFAULT_BASE_PATH = "/zoe";

function normalizeBasePath(basePath?: string): string {
  if (!basePath || basePath === "/") return "";

  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

export const BASE_PATH = normalizeBasePath(
  process.env.NEXT_PUBLIC_BASE_PATH ?? DEFAULT_BASE_PATH
);

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`withBasePath expects an absolute path. Received: ${path}`);
  }

  if (!BASE_PATH) return path;
  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
}

export function stripBasePath(pathname: string, basePath = BASE_PATH): string {
  const normalizedBasePath = normalizeBasePath(basePath);

  if (!normalizedBasePath) return pathname || "/";
  if (pathname === normalizedBasePath) return "/";

  return pathname.startsWith(`${normalizedBasePath}/`)
    ? pathname.slice(normalizedBasePath.length)
    : pathname;
}

export function getAbsoluteAppUrl(originOrAppUrl: string, path: string): string {
  const normalizedOrigin = originOrAppUrl.endsWith("/")
    ? originOrAppUrl.slice(0, -1)
    : originOrAppUrl;

  if (BASE_PATH && normalizedOrigin.endsWith(BASE_PATH)) {
    return path === "/" ? normalizedOrigin : `${normalizedOrigin}${path}`;
  }

  return `${normalizedOrigin}${withBasePath(path)}`;
}
