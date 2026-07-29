import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key';

  const supabase = createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh user session if expired
  let user = null;
  try {
    if (supabaseUrl !== 'https://placeholder.supabase.co') {
      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    }
  } catch (err) {
    console.warn('Supabase session fetch skipped or failed:', err);
  }

  const url = request.nextUrl.clone();
  const isProtectedRoute =
    url.pathname.startsWith('/chat') ||
    url.pathname.startsWith('/profile') ||
    url.pathname.startsWith('/admin');
  const isLoginRoute =
    url.pathname.startsWith('/login') || url.pathname.startsWith('/signup');

  // 1. If trying to access a protected route without being logged in
  if (isProtectedRoute && !user) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. If logged in and trying to access login/signup pages
  if (isLoginRoute && user) {
    let role = 'student';
    try {
      if (supabaseUrl !== 'https://placeholder.supabase.co') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        role = profile?.role || 'student';
      }
    } catch (e) {
      console.warn('Failed to fetch user role on login redirect:', e);
    }

    if (role === 'admin') {
      url.pathname = '/admin';
    } else {
      url.pathname = '/chat';
    }
    return NextResponse.redirect(url);
  }

  // 3. Admin authorization check
  if (url.pathname.startsWith('/admin') && user) {
    let role = 'student';
    try {
      if (supabaseUrl !== 'https://placeholder.supabase.co') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        role = profile?.role || 'student';
      }
    } catch (e) {
      console.warn('Failed to fetch user role:', e);
    }

    if (role !== 'admin') {
      // Redirect students trying to access admin dashboard back to chat
      url.pathname = '/chat';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
