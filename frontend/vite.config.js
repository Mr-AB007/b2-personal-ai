import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During development (`npm run dev`) the React app runs on port 5173 with
// hot reload, and any /api/... call is forwarded to the Python server on 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
});
