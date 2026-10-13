import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Next 16 blocks dev-only resources (including the HMR websocket) unless the
     request's Origin hostname is localhost or the host the server was started
     with. Driving the dev server by IP — 127.0.0.1, or the LAN address from a
     phone — therefore fails the HMR handshake with a bare "Unauthorized", and
     hydration never commits: the page freezes on its skeleton with no console
     error. Allowing the addresses we actually develop against keeps `next dev`
     usable from both. */
  allowedDevOrigins: ["127.0.0.1", "192.168.0.101"],
};

export default nextConfig;
