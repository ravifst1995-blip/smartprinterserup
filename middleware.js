import { NextResponse } from 'next/server'

// Countries to block (ISO codes)
const BLOCKED = new Set(['IN'])

export function middleware(request) {
  const country =
    request.geo?.country ||
    request.headers.get('x-vercel-ip-country') ||
    'Unknown'

  const { pathname } = new URL(request.url)

  // Allowlist paths (so assets don’t get blocked)
  const allowlist = [
    '/_next', 
    '/favicon',
    '/robots.txt',
    '/p'
  ]
  if (allowlist.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (BLOCKED.has(country)) {
    // Option A: Return 403
    // return new NextResponse('Access blocked in your region.', { status: 403 })

    // Option B: Redirect to /blocked page
    const url = new URL('/p', request.url)
    url.searchParams.set('c', country)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
