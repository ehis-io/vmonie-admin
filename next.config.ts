import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
