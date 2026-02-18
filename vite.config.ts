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
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "app-icon.png", "splash.png"],
      workbox: {
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,webp,woff,woff2}"],
        additionalManifestEntries: [],
        importScripts: ["/sw.js"],
      },
      strategies: "generateSW",
      manifest: {
        name: "BioMusic - Biometric-Driven Music",
        short_name: "BioMusic",
        description:
          "BioMusic adapts your soundtrack in real-time using heart rate, brainwaves, and stress data to help you reach your optimal flow state.",
        theme_color: "#0a0a0c",
        background_color: "#0a0a0c",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/app-icon.png",
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
