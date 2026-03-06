import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker in production only
if ("serviceWorker" in navigator && window.location.hostname !== "localhost") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) =>
      console.log("SW registration failed:", err)
    );
  });
}

createRoot(document.getElementById("root")!).render(<App />);
