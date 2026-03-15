import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const host = "0.0.0.0";
const port = 5173;
const appRoot = "/app";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const send = async (response, filePath, statusCode = 200) => {
  try {
    const body = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    response.writeHead(statusCode, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    const fallback = await readFile(join(appRoot, "index.html"), "utf8");
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(fallback);
  }
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = join(appRoot, pathname);
  await send(response, filePath);
}).listen(port, host, () => {
  console.log(`frontend placeholder listening on http://${host}:${port}`);
});
