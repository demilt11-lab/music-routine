import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const hostname = window.location.hostname;
const isPwaEligibleHost =
  hostname !== "localhost" &&
  hostname !== "127.0.0.1" &&
  !hostname.includes("lovableproject.com") &&
  !hostname.includes("lovable.app") &&
  !hostname.startsWith("id-preview--");

// Register service worker only on real production hosts
if ("serviceWorker" in navigator && isPwaEligibleHost) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) =>
      console.log("SW registration failed:", err)
    );
  });
}

createRoot(document.getElementById("root")!).render(<App />);
