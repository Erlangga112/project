import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const role = token.role as string

    // Role-based access control routes
    const roleRoutes = {
      WARGA: "/warga",
      STAF_DESA: "/staf",
      SUPERVISOR: "/supervisor",
      KEPALA_DESA: "/kades",
    }

    // Checking if the path starts with a restricted route prefix
    for (const [routeRole, routePrefix] of Object.entries(roleRoutes)) {
      if (path.startsWith(routePrefix)) {
        if (role !== routeRole) {
          // If the role doesn't match the required role for this route, redirect to unauthorized
          return NextResponse.redirect(new URL("/unauthorized", req.url))
        }
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ["/warga/:path*", "/staf/:path*", "/supervisor/:path*", "/kades/:path*"],
}
