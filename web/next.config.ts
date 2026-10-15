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

  /* `/app/deposit` → the by-address half of Receive.
   *
   * A config redirect rather than `redirect()` inside a page, and that is the
   * measured difference: a page-level `redirect()` in a route Next prerenders is
   * carried in the payload for the CLIENT to perform, so the request answers 200
   * with the app's loading shell and the navigation happens once JavaScript
   * arrives — a scanner following a sticker, a crawler or a link unfurler gets a
   * 200 and no address. This answers 307 from the server, before any render.
   *
   * The path is not free to disappear: it is on stickers, in bookmarks and in the
   * app's own older links, and a 404 for a receive address is a person who cannot
   * be paid. It lands on the ADDRESS half rather than the top of the page, because
   * that is what the path always meant. */
  async redirects() {
    return [
      {
        source: "/app/deposit",
        destination: "/app/receive?view=address",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
