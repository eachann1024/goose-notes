import type { Plugin } from "vite";
export function createIconMiddleware(): Plugin {
  return {
    name: "api-icon-middleware",
    configureServer(server) {
      server.middlewares.use("/api/icon", async (req, res) => {
        try {
          const urlObj = new URL(req.url || "", `http://${req.headers.host}`);
          const targetUrl = urlObj.searchParams.get("url");

          if (!targetUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing url parameter" }));
            return;
          }

          const response = await fetch(targetUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
          });
          const html = await response.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const title = titleMatch
            ? titleMatch[1].trim()
            : new URL(targetUrl).hostname;

          const domain = new URL(targetUrl).hostname;
          const icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ title, icon }));
        } catch (error) {
          console.error("API Error:", error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Failed to fetch metadata" }));
        }
      });
    },
  };
}
