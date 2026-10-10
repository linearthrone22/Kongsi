import { MIME_BY_EXT, readLocal } from "../../../../lib/evidence";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const buf = await readLocal(params.file);
  if (!buf) return new Response("Not found", { status: 404 });
  const ext = params.file.split(".").pop();
  return new Response(buf, {
    headers: {
      "Content-Type": MIME_BY_EXT[ext] || "application/octet-stream",
      // Nama file = hash isinya, jadi aman di-cache permanen.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
