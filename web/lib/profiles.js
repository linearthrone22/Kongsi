// Data profil contoh (referensi dari diagram: Petani x, Jovan, T Ronald).
// Rekam jejak proyek on-chain dihitung langsung dari kontrak; `offchain` = klaim lama yang belum tercatat on-chain.
// `proofs` = tautan bukti verifikasi (dummy untuk demo).
const DUMMY_PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const maps = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export const PROFILES = {
  padi: {
    name: "Petani x",
    category: "Pertanian",
    location: "Karawang, Jawa Barat",
    cover: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=70",
    bio: "Punya lahan dan modal beli bibit, namun tidak punya modal dalam mengurus dan operasional jika dibeli bibit semua.",
    offchain: ["Panen kedelai 200 bibit (2023)"],
    specs: ["Lahan 2 ha, Kab. Karawang", "Irigasi teknis, 2x tanam/tahun"],
    cycle: "±4 bulan",
    proofs: {
      location: { label: "Sawah Karawang", url: maps(-6.2727, 107.3436) },
      document: { label: "Sertifikat lahan", url: DUMMY_PDF },
      kyc: { label: "KTP terverifikasi", url: "/kyc/ktp-petani-x.svg" },
    },
  },
  jovan: {
    name: "Jovan",
    category: "Atlet",
    location: "Jakarta",
    cover: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=900&q=70",
    bio: "Atlet lari yang menargetkan kemenangan Marathon Asia Pacific. Effort: latihan, makanan bergizi, daftar lomba, menang.",
    offchain: ["Finisher Bali Marathon 2024"],
    specs: ["Pelatih bersertifikat", "Jadwal latihan 6 hari/minggu"],
    cycle: "±8 bulan",
    proofs: {
      location: { label: "GBK Senayan", url: maps(-6.2185, 106.8019) },
      document: { label: "Sertifikat atlet", url: DUMMY_PDF },
      kyc: { label: "KTP terverifikasi", url: "/kyc/ktp-jovan.svg" },
    },
  },
  ronald: {
    name: "T Ronald",
    category: "Marketing",
    location: "Surabaya",
    cover: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=70",
    bio: "Menaikkan harga saham lewat marketing dan up diri. Max yield 1m, token 500 jt (contoh).",
    offchain: ["Kampanye brand A (2025) - +18% harga saham"],
    specs: ["Tim marketing 5 orang"],
    cycle: "±6 bulan",
    proofs: {
      location: { label: "Kantor Surabaya", url: maps(-7.2575, 112.7521) },
      document: { label: "Purchase Order", url: DUMMY_PDF },
      kyc: { label: "KTP terverifikasi", url: "/kyc/ktp-t-ronald.svg" },
    },
  },
  nelayan: {
    name: "Nelayan c",
    category: "Perikanan",
    location: "Muara Baru, Jakarta",
    cover: "https://images.unsplash.com/photo-1545816250-e12bedba42ba?w=900&q=70",
    bio: "Nelayan tradisional yang butuh modal perbaikan kapal dan operasional melaut.",
    offchain: ["Tangkapan 1 ton ikan (2025)"],
    specs: ["Kapal 8 GT, pelabuhan Muara Baru"],
    cycle: "±3 bulan",
    proofs: {
      location: { label: "Pelabuhan Muara Baru", url: maps(-6.1036, 106.8031) },
      document: { label: "Surat izin kapal", url: DUMMY_PDF },
      kyc: { label: "KTP terverifikasi", url: "/kyc/ktp-nelayan-c.svg" },
    },
  },
};
const JSON_PREFIX = "data:application/json,";

/** Profil dari form Galang Dana disimpan on-chain sebagai data URI JSON di `metadataURI`. */
export function encodeProfile(meta) {
  return JSON_PREFIX + encodeURIComponent(JSON.stringify(meta));
}

const cache = new Map();
function decodeProfile(uri) {
  if (cache.has(uri)) return cache.get(uri);
  let prof = null;
  try {
    const m = JSON.parse(decodeURIComponent(uri.slice(JSON_PREFIX.length)));
    const proof = (label, url) => (url ? { label, url } : null);
    prof = {
      name: m.name || "Pengusaha",
      category: m.category || "Lainnya",
      location: m.location || "-",
      cover: m.cover || "",
      bio: m.bio || "",
      offchain: [],
      specs: Array.isArray(m.specs) ? m.specs : [],
      cycle: m.cycle || "-",
      proofs: {
        location: proof(m.location || "Lokasi", m.mapsUrl || (m.location ? maps2(m.location) : "")),
        document: proof(m.docLabel || "Dokumen pendukung", m.docUrl),
        kyc: proof("KTP terverifikasi", m.kycUrl),
      },
    };
  } catch {}
  cache.set(uri, prof);
  return prof;
}
const maps2 = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const profileOf = (uri) => {
  if (!uri) return null;
  if (uri.startsWith(JSON_PREFIX)) return decodeProfile(uri);
  return PROFILES[uri.replace("profile:", "")] || null;
};
