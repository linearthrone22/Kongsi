// Penyimpanan file bukti (server-side). On-chain hanya disimpan URL + hash SHA-256 file,
// karena menyimpan file di storage kontrak butuh puluhan juta gas.
import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export const UPLOAD_DIR = path.join(process.cwd(), ".uploads");
export const MAX_BYTES = 8 * 1024 * 1024;
export const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
export const MIME_BY_EXT = Object.fromEntries(Object.entries(TYPES).map(([m, e]) => [e, m]));
export const FILE_RE = /^[a-f0-9]{64}\.(jpg|png|webp|gif|pdf)$/;

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export async function saveLocal(buf, ext) {
  const name = `${sha256(buf)}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buf);
  return name;
}

export async function readLocal(name) {
  if (!FILE_RE.test(name)) return null;
  try {
    return await readFile(path.join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
}

/** Upload ke IPFS via Pinata (opsional, aktif jika PINATA_JWT di-set). */
export async function pinToIpfs(buf, filename, mime) {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: mime }), filename);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`Pinata ${res.status}: ${await res.text()}`);
  const { IpfsHash } = await res.json();
  const gateway = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";
  return `${gateway}/ipfs/${IpfsHash}`;
}
