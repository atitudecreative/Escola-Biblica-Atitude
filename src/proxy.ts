import { NextResponse, type NextRequest } from "next/server";

/**
 * Verificação otimista na borda: sem cookie de sessão, rotas privadas vão
 * direto para o login. A autorização real (sessão válida, perfil, permissão)
 * acontece no servidor, em layouts, páginas e serviços.
 */
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/my-courses",
  "/learn",
  "/favorites",
  "/certificates",
  "/messages",
  "/notifications",
  "/announcements",
  "/community",
  "/profile",
  "/search",
  "/assignments",
  "/teacher",
  "/manager",
  "/admin",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPrivate && !request.cookies.has("eba_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|demo/|api/files).*)"],
};
