import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── Public routes — skip auth entirely, return immediately ──
  if (
    pathname.startsWith('/player/') ||
    pathname.startsWith('/api/player/') ||
    pathname === '/live' ||
    pathname === '/login'
  ) {
    return NextResponse.next()
  }

  // ── All other routes need auth check ────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Root redirect
  if (pathname === '/') {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    // authenticated — let the page handle the dashboard redirect
    return supabaseResponse
  }

  // Protected routes — require authentication
  if (!user && (pathname.startsWith('/admin') || pathname.startsWith('/team'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based access
  if (user && (pathname.startsWith('/admin') || pathname.startsWith('/team'))) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (pathname.startsWith('/admin') && userData.role !== 'admin') {
      return NextResponse.redirect(new URL('/team/scan', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
