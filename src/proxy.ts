import { NextResponse, type NextRequest } from "next/server";
import { COOKIES, verify } from "@/lib/auth/token";

// Optimistic redirect only. Every manager page and action still checks the
// session against the database (src/server/auth.ts).
export async function proxy(request: NextRequest) {
  const session = await verify(request.cookies.get(COOKIES.manager)?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/manage/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/manage", "/manage/((?!login).*)"],
};
