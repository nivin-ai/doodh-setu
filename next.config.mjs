/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Map tile key (saved in Vercel as CART_KEY), passed to the browser at build time for the demand map.
  env: { MAP_TILE_KEY: process.env.CART_KEY || process.env.NEXT_PUBLIC_CARTO_KEY || '' },
  // Database drivers run on the server only; PGlite loads its WebAssembly files from node_modules at runtime.
  experimental: { serverComponentsExternalPackages: ['@electric-sql/pglite', 'postgres'] },
};
export default nextConfig;
