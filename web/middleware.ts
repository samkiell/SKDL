import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protected routes: /lighthouse/* (except /lighthouse/login)
  if (pathname.startsWith('/lighthouse') && pathname !== '/lighthouse/login') {
    const authCookie = request.cookies.get('lighthouse_auth')?.value

    if (authCookie !== 'true') {
      const loginUrl = new URL('/lighthouse/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/lighthouse/:path*'],
}
