import { NextResponse } from "next/server";
import { MAX_BYTES, TYPES, sha256, saveLocal, pinToIpfs } from "../../../lib/evidence";

export const runtime = "nodejs";

/**
 * POST multipart { file } -> { url, sha256, type, size, storage }
 * URL yang dikembalikan membawa fragmen `#sha256=…&type=…` supaya hash ikut tercatat on-chain.
 */
export async function POST(req) {
  let file;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Body harus multipart/form-data" }, { status: 400 });
  }
  if (!file || typeof file === "string") return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });

  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Format harus JPG, PNG, WEBP, GIF, atau PDF" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Ukuran maksimal 8 MB" }, { status: 413 });

  // Vercel/serverless: disk read-only & tidak permanen -> wajib pakai IPFS (Pinata).
  if (process.env.VERCEL && !process.env.PINATA_JWT) {
    return NextResponse.json({ error: "Upload file belum aktif di server ini (PINATA_JWT belum di-set). Tempel link bukti sebagai gantinya." }, { status: 503 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = sha256(buf);
  const frag = `#sha256=${hash}&type=${encodeURIComponent(file.type)}`;

  try {
    if (process.env.PINATA_JWT) {
      const url = await pinToIpfs(buf, file.name || `${hash}.${ext}`, file.type);
      return NextResponse.json({ url: url + frag, sha256: hash, type: file.type, size: buf.length, storage: "ipfs" });
    }
    const name = await saveLocal(buf, ext);
    const origin = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
    return NextResponse.json({ url: `${origin}/api/evidence/${name}${frag}`, sha256: hash, type: file.type, size: buf.length, storage: "local" });
  } catch (e) {
    return NextResponse.json({ error: `Gagal menyimpan file: ${e.message}` }, { status: 500 });
  }
}
