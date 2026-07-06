import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    // Left false on purpose: an installed PWA shouldn't swap its running code out from under the
    // user mid-session. The new service worker installs and waits; PwaUpdateBanner posts a
    // SKIP_WAITING message once the user chooses to refresh.
    skipWaiting: false,
  },
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default withPWA(nextConfig);
