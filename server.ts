import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy endpoint for AI Inference
  app.post("/api/inference", express.json({ limit: '20mb' }), async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ error: "Image data is required" });

      const { runEyePipeline } = await import("./src/services/aiService.ts");
      const result = await runEyePipeline(image);
      res.json(result);
    } catch (error: any) {
      console.error("Inference Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy endpoint for AI Chat
  app.post("/api/chat", express.json(), async (req, res) => {
    try {
      const { query, history } = req.body;
      const { getHealthAssistantResponse } = await import("./src/services/aiService.ts");
      const result = await getHealthAssistantResponse(query, history || []);
      res.json({ text: result });
    } catch (error: any) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
