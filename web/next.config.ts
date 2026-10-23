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

  /* `/app/deposit` → Receive.
   *
   * A config redirect rather than `redirect()` inside a page, and that is the
   * measured difference: a page-level `redirect()` in a route Next prerenders is
   * carried in the payload for the CLIENT to perform, so the request answers 200
   * with the app's loading shell and the navigation happens once JavaScript
   * arrives — a scanner following a sticker, a crawler or a link unfurler gets a
   * 200 and nothing else. This answers 307 from the server, before any render.
   *
   * The path is not free to disappear: it is on stickers, in bookmarks and in the
   * app's own older links, and a 404 where a person was trying to be paid is a
   * customer with nowhere to go. It used to land on `?view=address`, the half that
   * IS gone; landing on the page itself is now the only honest destination. The
   * query is deliberately absent rather than `?view=address`: a dead value would
   * resolve to the default view anyway, and a redirect that names a view the page
   * no longer has is a redirect that lies about where it goes. */
  async redirects() {
    return [
      {
        source: "/app/deposit",
        destination: "/app/receive",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
