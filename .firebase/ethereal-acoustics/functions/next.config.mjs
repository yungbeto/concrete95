// next.config.mjs
var nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**"
      }
    ]
  }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
