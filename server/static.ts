import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { renderPublicShell } from "./marketing";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Let the route-aware fallback render index.html for "/" and public
  // marketing routes instead of Express short-circuiting to the raw file.
  app.use(express.static(distPath, { index: false }));

  // The creator document is intentionally a standalone HTML page, but its
  // canonical URL is /leaq (the URL published in the sitemap and metadata).
  app.get("/leaq", (_req, res) => {
    res.sendFile(path.resolve(distPath, "leaq.html"));
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res, next) => {
    try {
      const template = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
      res.status(200).set({ "Content-Type": "text/html" }).send(
        renderPublicShell(template, _req.path),
      );
    } catch (error) {
      next(error);
    }
  });
}
