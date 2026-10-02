const http = require("http");
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const port = Number(process.env.PORT) || 3000;
const htmlPath = path.join(__dirname, "index.html");

function accepted(svg) {
  if (typeof svg !== "string" || svg.length < 40 || svg.length > 100000) return false;
  if (!svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" ')) return false;
  const rest = svg.replace('xmlns="http://www.w3.org/2000/svg"', "");
  if (/<(script|image|foreignObject|iframe|use)\b/i.test(svg)) return false;
  if (/https?:|javascript:|data:/i.test(rest)) return false;
  return true;
}

function png(svg, width) {
  const rendered = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
  }).render();
  return rendered.asPng();
}

const server = http.createServer((req, res) => {
  const origin = { "access-control-allow-origin": "*" };
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }
  if (req.method === "POST" && req.url === "/render.png") {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 100000) {
        res.writeHead(413, origin);
        res.end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (res.writableEnded) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const width = Math.round(Number(body.width));
        if (!accepted(body.svg) || !Number.isInteger(width) || width < 1 || width > 4096) {
          throw new Error("bad");
        }
        const file = png(body.svg, width);
        res.writeHead(200, {
          ...origin,
          "content-type": "image/png",
          "cache-control": "no-store",
        });
        res.end(file);
      } catch (err) {
        if (!res.headersSent) res.writeHead(400, { ...origin, "content-type": "text/plain" });
        res.end("render failed");
      }
    });
    return;
  }
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(htmlPath));
    return;
  }
  res.writeHead(404, origin);
  res.end();
});

server.listen(port);
