import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      disable: mode === "development",
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "app-icon.png", "splash.png"],
      // injectManifest: Workbox injects the precache asset list into our custom sw.js
      // instead of generating a new SW that would overwrite (and conflict with) public/sw.js.
      // This preserves our push-notification security, same-origin URL validation,
      // and stale-while-revalidate caching strategy implemented in public/sw.js.
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,webp,woff,woff2}"],
      },
      manifest: {
        name: "BioMusic",
        short_name: "BioMusic",
        description:
          "BioMusic adapts your soundtrack in real-time using heart rate, brainwaves, and stress data to help you reach your optimal flow state.",
        theme_color: "#f97316",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/dashboard",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
