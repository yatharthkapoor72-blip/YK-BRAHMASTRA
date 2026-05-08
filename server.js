const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const SYNC_KEY = process.env.YK_SYNC_KEY || "";
const DATA_DIR = process.env.YK_DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = process.env.YK_DATA_FILE || path.join(DATA_DIR, "yk-brahmastra-store.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ app: "YK BRAHMASTRA", updatedAt: "", data: null }, null, 2));
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-YK-Sync-Key",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function isAuthorized(req) {
  if (!SYNC_KEY) return true;
  return req.headers["x-yk-sync-key"] === SYNC_KEY;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleSync(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (!isAuthorized(req)) return sendJson(res, 401, { error: "Invalid sync secret" });
  ensureDataFile();

  if (req.method === "GET") {
    const content = fs.readFileSync(DATA_FILE, "utf8");
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    return res.end(content);
  }

  if (req.method === "PUT") {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      const payload = {
        app: parsed.app || "YK BRAHMASTRA",
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        data: parsed.data || parsed,
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2));
      return sendJson(res, 200, { ok: true, updatedAt: payload.updatedAt });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Invalid JSON" });
    }
  }

  return sendJson(res, 405, { error: "Method not allowed" });
}

function safeStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const filePath = cleanPath === "/" ? "/index.html" : cleanPath;
  const resolved = path.resolve(__dirname, `.${filePath}`);
  if (!resolved.startsWith(__dirname)) return "";
  return resolved;
}

function serveStatic(req, res) {
  const filePath = safeStaticPath(req.url || "/");
  if (!filePath) return sendText(res, 403, "Forbidden");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendText(res, 404, "Not found");
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.url === "/api/sync" || req.url === "/sync") {
      handleSync(req, res).catch((error) => sendJson(res, 500, { error: error.message || "Server error" }));
      return;
    }
    serveStatic(req, res);
  });
}

function startServer() {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`YK BRAHMASTRA running at http://localhost:${PORT}`);
    console.log(`Sync endpoint: http://localhost:${PORT}/api/sync`);
    console.log(`Data file: ${DATA_FILE}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createServer, startServer };
