import type { NextConfig } from 'next'

// Standalone output so the Dockerfile can copy a self-contained server
// (bundled node_modules incl. the better-sqlite3 native addon).
const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
