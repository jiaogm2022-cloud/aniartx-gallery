import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import http from "node:http";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "data", "art-gallery.json");
const assetsRoot = path.join(root, "art-gallery-assets");
const tempRoot = path.join(root, ".admin-tmp");
const port = Number(process.env.PORT || 8093);

const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const typeNames = new Set(["原画", "手稿", "赛璐珞", "版画", "海报"]);

function naturalCompare(a, b) {
  return a.localeCompare(b, "zh-Hans-CN", { numeric: true, sensitivity: "base" });
}

function safeSegment(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[/:\\?%*"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function webPath(relativePath) {
  return relativePath.split(path.sep).map(encodeURIComponent).join("/");
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl);
  if (!match) throw new Error("Invalid image data.");
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function textResponse(res, status, content, contentType) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(content);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 120 * 1024 * 1024) throw new Error("Request is too large.");
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readManifest() {
  return JSON.parse(await fs.readFile(manifestPath, "utf8"));
}

async function writeManifest(manifest) {
  manifest.generatedAt = new Date().toISOString();
  manifest.total = manifest.artworks.length;

  const ipMap = new Map();
  const typeMap = new Map();

  for (const artwork of manifest.artworks) {
    const currentIp = ipMap.get(artwork.ip) ?? { name: artwork.ip, count: 0, types: {} };
    currentIp.count += 1;
    currentIp.types[artwork.type] = (currentIp.types[artwork.type] ?? 0) + 1;
    ipMap.set(artwork.ip, currentIp);
    typeMap.set(artwork.type, (typeMap.get(artwork.type) ?? 0) + 1);
  }

  manifest.ips = [...ipMap.values()].sort((a, b) => naturalCompare(a.name, b.name));
  manifest.types = [...typeMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => naturalCompare(a.name, b.name));
  manifest.artworks.sort((a, b) => naturalCompare(a.ip, b.ip) || naturalCompare(a.type, b.type) || naturalCompare(a.path, b.path));

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function uniqueOutputPath(ip, type, item, fileName) {
  const parsed = path.parse(fileName);
  const baseName = safeSegment(parsed.name, "artwork");
  const dirParts = [safeSegment(ip, "Uncategorized"), safeSegment(type, "原画")];

  if (item) dirParts.push(safeSegment(item, "item"));

  let counter = 0;
  let relativePath;

  do {
    const suffix = counter === 0 ? "" : `-${counter + 1}`;
    relativePath = path.join(...dirParts, `${baseName}${suffix}.webp`);
    counter += 1;
  } while (await exists(path.join(assetsRoot, relativePath)));

  return relativePath;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function convertToWebp(inputPath, outputPath, originalName) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".webp") {
    await fs.copyFile(inputPath, outputPath);
    return;
  }

  await execFileAsync("/opt/homebrew/bin/cwebp", [
    "-quiet",
    "-q",
    "82",
    "-resize",
    "1800",
    "0",
    inputPath,
    "-o",
    outputPath,
  ]);
}

async function uploadArtworks(payload) {
  const ip = safeSegment(payload.ip, "");
  const type = payload.type;
  const item = safeSegment(payload.item, "");

  if (!ip) throw new Error("IP / Series is required.");
  if (!typeNames.has(type)) throw new Error("Invalid category.");
  if (!Array.isArray(payload.files) || !payload.files.length) throw new Error("No files uploaded.");

  await fs.mkdir(tempRoot, { recursive: true });
  const manifest = await readManifest();
  const added = [];

  for (const file of payload.files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!imageExts.has(ext)) throw new Error(`Unsupported image type: ${file.name}`);

    const { buffer } = decodeDataUrl(file.dataUrl);
    const tempPath = path.join(tempRoot, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    await fs.writeFile(tempPath, buffer);

    const relativePath = await uniqueOutputPath(ip, type, item, file.name);
    const outputPath = path.join(assetsRoot, relativePath);
    await convertToWebp(tempPath, outputPath, file.name);
    await fs.rm(tempPath, { force: true });

    const artwork = {
      id: relativePath,
      ip,
      type,
      item,
      title: [ip, type, item].filter(Boolean).join(" · "),
      fileName: file.name,
      path: relativePath,
      src: `art-gallery-assets/${webPath(relativePath)}`,
    };

    manifest.artworks.push(artwork);
    added.push(artwork);
  }

  await writeManifest(manifest);
  return added;
}

async function deleteArtwork(id) {
  const manifest = await readManifest();
  const artwork = manifest.artworks.find((item) => item.id === id);
  if (!artwork) throw new Error("Artwork not found.");

  const assetPath = path.resolve(assetsRoot, artwork.id);
  if (!assetPath.startsWith(assetsRoot)) throw new Error("Invalid artwork path.");

  await fs.rm(assetPath, { force: true });
  manifest.artworks = manifest.artworks.filter((item) => item.id !== id);
  await writeManifest(manifest);
}

async function publishChanges() {
  const status = await execFileAsync("git", ["status", "--porcelain"], { cwd: root });

  if (!status.stdout.trim()) {
    return "No gallery changes to publish.";
  }

  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync("git", ["commit", "-m", "Update gallery artwork"], { cwd: root });
  await execFileAsync("git", ["push"], { cwd: root });

  const commit = await execFileAsync("git", ["log", "--oneline", "-1"], { cwd: root });
  return `Published to GitHub: ${commit.stdout.trim()}`;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/admin.html" : url.pathname);
  const filePath = path.resolve(root, pathname.slice(1));

  if (!filePath.startsWith(root)) {
    textResponse(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    }[ext] || "application/octet-stream";
    textResponse(res, 200, content, contentType);
  } catch {
    textResponse(res, 404, "Not found", "text/plain; charset=utf-8");
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/gallery") {
      const manifest = await readManifest();
      jsonResponse(res, 200, {
        artworks: manifest.artworks,
        ips: manifest.ips,
        types: manifest.types,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/upload") {
      const payload = await readJsonBody(req);
      const added = await uploadArtworks(payload);
      jsonResponse(res, 200, { added: added.length, artworks: added });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/delete") {
      const payload = await readJsonBody(req);
      await deleteArtwork(payload.id);
      jsonResponse(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/publish") {
      const message = await publishChanges();
      jsonResponse(res, 200, { message });
      return;
    }

    jsonResponse(res, 404, { error: "API route not found." });
  } catch (error) {
    jsonResponse(res, 500, { error: error.message });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }

  await serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`ANIARTX admin running at http://localhost:${port}/admin.html`);
});
