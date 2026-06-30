const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 1354);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
};

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, headers);
  response.end(body);
}

function getFilePath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${PORT}`).pathname);
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((request, response) => {
  const filePath = getFilePath(request.url);

  if (!filePath) {
    send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    const contentType = contentTypes[path.extname(filePath)] || "application/octet-stream";
    send(response, 200, data, {
      "Cache-Control": "no-store",
      "Content-Type": contentType,
    });
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error(error.message);
  }

  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Wedding invitation server: http://localhost:${PORT}`);
  console.log(`Mobile access: http://<this-computer-ip>:${PORT}`);
});
