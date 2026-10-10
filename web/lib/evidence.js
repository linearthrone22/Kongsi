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

/**
 * Upload ke IPFS via Pinata (aktif jika PINATA_JWT di-set).
 * Pakai API v3 (key dengan scope "Files: Write") di jaringan publik; jika key lama
 * (scope legacy pinFileToIPFS) ditolak v3, coba endpoint legacy.
 */
export async function pinToIpfs(buf, filename, mime) {
  const auth = { Authorization: `Bearer ${process.env.PINATA_JWT.trim()}` };
  const form = (extra = {}) => {
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: mime }), filename);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    return fd;
  };

  let cid;
  const v3 = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: auth,
    body: form({ network: "public", name: filename }),
  });
  if (v3.ok) {
    cid = (await v3.json())?.data?.cid;
  } else if (v3.status === 401 || v3.status === 403) {
    const legacy = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: auth, body: form() });
    if (!legacy.ok) throw new Error(`Pinata ${legacy.status}: ${(await legacy.text()).slice(0, 200)}`);
    cid = (await legacy.json()).IpfsHash;
  } else {
    throw new Error(`Pinata ${v3.status}: ${(await v3.text()).slice(0, 200)}`);
  }
  if (!cid) throw new Error("Pinata tidak mengembalikan CID");

  // PINATA_GATEWAY = gateway khusus akun (mis. https://xxx.mypinata.cloud) agar lebih cepat.
  const gateway = (process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud").replace(/\/$/, "");
  return `${gateway}/ipfs/${cid}`;
}
