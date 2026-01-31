import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require authentication
const protectedRoutes = [
    '/dashboard',
    '/users',
    '/control',
    '/notifications',
    '/job-fetcher',
    '/activity',
];

// Public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip middleware for static files and Next.js internals
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Allow API routes to handle their own auth
    if (pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Check if this is a public route
    if (publicRoutes.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // For root path, redirect to login
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check if this is a protected route
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    if (!isProtectedRoute) {
        return NextResponse.next();
    }

    // Check for Supabase auth cookies (sb-*-auth-token)
    const cookies = request.cookies.getAll();
    const hasAuthCookie = cookies.some(cookie =>
        cookie.name.includes('auth-token') ||
        cookie.name.startsWith('sb-')
    );

    // If no auth cookie found, redirect to login
    // Note: This is a basic check - the actual session validation happens client-side
    // This middleware provides an extra layer of protection
    if (!hasAuthCookie) {
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
