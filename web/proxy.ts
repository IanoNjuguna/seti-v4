import { NextResponse } from 'next/server';
import { securityHeaders } from '@/lib/security-headers';

/**
 * Attach the security headers to every document the app serves.
 *
 * A proxy rather than a `headers()` block in `next.config.ts`, because the deployed
 * web app is built by vinext and served as a Cloudflare Worker (`wrangler.jsonc`), so
 * the response is assembled at request time. The proxy file convention is the one
 * both runtimes honour, and the headers therefore cannot diverge between the dev
 * server and what ships.
 *
 * It touches nothing else: no rewrite, no redirect, no request header. A proxy that
 * also routed would be a second place routing is decided, and this file's whole job
 * is to add five lines to a response someone else built.
 *
 * `config.matcher` is everything. The pages that matter most are the ones with a
 * wallet on them, and a path list would be a list to keep up to date rather than a
 * rule.
 */
export function proxy() {
  const response = NextResponse.next();

  for (const [name, value] of Object.entries(securityHeaders())) {
    response.headers.set(name, value);
  }

  return response;
}

export const config = {
  matcher: '/:path*',
};
