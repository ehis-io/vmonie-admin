import type { NextConfig } from "next";

/**
 * Security headers on every page. The console moves money and manages
 * access, so no other site may frame it (clickjacking); reset and invite
 * links carry tokens, so no referrer leaves; plus nosniff, no camera/mic/
 * location, HTTPS only. The content policy is deliberately minimal (no
 * plugins, no <base> hijack, forms post only here) so it never blocks the
 * app's own scripts.
 */
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Routes renamed to match zemfi-admin. Old bookmarks and links keep working.
  async redirects() {
    return [
      { source: "/dashboard/customers", destination: "/dashboard/users", permanent: true },
      { source: "/dashboard/customers/:id", destination: "/dashboard/users/:id", permanent: true },
      { source: "/dashboard/admin-users", destination: "/dashboard/admins", permanent: true },
    ];
  },
};

export default nextConfig;
