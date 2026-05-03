import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow large file uploads through rewrites (no body size limit)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://localhost:4100'}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
