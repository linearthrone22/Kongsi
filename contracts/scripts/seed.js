// Seed data demo. Jalankan setelah deploy: npx hardhat run scripts/seed.js --network localhost
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const E = ethers.parseEther;
const DAY = 86400;
const IMG = {
  bibit: "https://images.unsplash.com/photo-1536657464919-892534f60d6e?w=600",
  sawah: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600",
  panen: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600",
  lari: "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=600",
  lari2: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600",
  nota: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
};

async function main() {
  const all = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "web", "public", "deployments.json"), "utf8"));
  const k = await ethers.getContractAt("Kongsi", all[network.name].address);
  const s = await ethers.getSigners();
  const local = network.name === "localhost" || network.name === "hardhat";
  const [deployer] = s;
  const signer = (i) => (local ? s[i] : deployer);
  const w = (p) => p.then((t) => t.wait());

  let next = Number(await k.projectCount());
  const mk = async (i, ...args) => { await w(k.connect(signer(i)).createProject(...args)); return next++; };

  if (!local) {
    // Testnet: satu proyek contoh dari wallet deployer. Proyek lain dibuat lewat UI "Galang Dana"
    // dari wallet berbeda, supaya rekam jejak per pengusaha tidak tercampur.
    const id = await mk(1, "Petani x - Panen 1000 bibit padi", "profile:padi", E("0.001"), 20, 3 * DAY, E("0.026"),
      ["Bon pembelian 1000 bibit", "Dokumentasi penyiraman", "Dokumentasi petani menghubungkan dengan penjual", "Penjualan hasil panen"], [2500, 2500, 2500, 2500]);
    console.log(`Seed testnet: proyek #${id} (Funding, target 0.02 MON).`);
    return;
  }

  const [a, b] = [s[4], s[5]];
  const buy = (who, id, n, price) => w(k.connect(who).invest(id, n, { value: E(price) * BigInt(n) }));
  // Jalankan semua milestone sampai selesai; `voter` memegang mayoritas token.
  const complete = async (id, farmerIdx, voter, uris) => {
    for (const uri of uris) {
      await w(k.connect(s[farmerIdx]).submitEvidence(id, uri));
      await w(k.connect(voter).vote(id, true));
    }
  };

  // ── Rekam jejak (proyek lama yang sudah Selesai) ──
  const h1 = await mk(1, "Petani x - Panen 500 bibit padi (2025)", "profile:padi", E("0.01"), 50, 7 * DAY, E("0.65"),
    ["Bon pembelian 500 bibit", "Dokumentasi penyiraman", "Penjualan hasil panen"], [3000, 4000, 3000]);
  await buy(a, h1, 30, "0.01"); await buy(b, h1, 20, "0.01");
  await complete(h1, 1, a, [IMG.bibit, IMG.sawah, IMG.panen]);
  await w(k.connect(s[1]).depositRevenue(h1, { value: E("0.65") }));
  await w(k.connect(a).claimRevenue(h1));

  const h2 = await mk(1, "Petani x - Panen 300 bibit jagung (2024)", "profile:padi", E("0.01"), 30, 7 * DAY, E("0.4"),
    ["Bon pembelian bibit", "Penjualan hasil panen"], [5000, 5000]);
  await buy(a, h2, 20, "0.01"); await buy(b, h2, 10, "0.01");
  await complete(h2, 1, a, [IMG.bibit, IMG.panen]);
  await w(k.connect(s[1]).depositRevenue(h2, { value: E("0.36") }));

  const h3 = await mk(2, "Jovan - Half Marathon Jakarta 2025", "profile:jovan", E("0.02"), 20, 7 * DAY, E("0.5"),
    ["Latihan", "Daftar lomba", "Finish podium"], [3000, 2000, 5000]);
  await buy(a, h3, 12, "0.02"); await buy(b, h3, 8, "0.02");
  await complete(h3, 2, a, [IMG.lari, IMG.nota, IMG.lari2]);
  await w(k.connect(s[2]).depositRevenue(h3, { value: E("0.5") }));

  // ── Proyek berjalan ──
  // Petani x: milestone 1 terverifikasi, milestone 2 menunggu voting
  const p0 = await mk(1, "Petani x - Panen 1000 bibit padi", "profile:padi", E("0.01"), 100, 7 * DAY, E("2"),
    ["Bon pembelian 1000 bibit", "Dokumentasi penyiraman", "Dokumentasi petani menghubungkan dengan penjual", "Penjualan hasil panen"], [2500, 2500, 2500, 2500]);
  await buy(a, p0, 60, "0.01"); await buy(b, p0, 40, "0.01");
  await complete(p0, 1, a, [IMG.bibit]);
  await w(k.connect(s[1]).submitEvidence(p0, IMG.sawah));

  // Jovan: pendanaan 40%
  const p1 = await mk(2, "Jovan - Menang lomba lari Marathon Asia Pacific", "profile:jovan", E("0.02"), 50, 7 * DAY, E("2.5"),
    ["Latihan", "Makanan bergizi", "Daftar lomba", "Menang"], [2000, 2000, 1500, 4500]);
  await buy(a, p1, 20, "0.02");

  // T Ronald: semua milestone selesai, menunggu setoran hasil (demo End of Cycle)
  const p2 = await mk(3, "T Ronald - Menaikkan harga saham", "profile:ronald", E("0.01"), 50, 7 * DAY, E("1"),
    ["Marketing", "Up diri"], [5000, 5000]);
  await buy(a, p2, 30, "0.01"); await buy(b, p2, 20, "0.01");
  await complete(p2, 3, a, [IMG.nota, IMG.nota]);

  // Nelayan c: bukti ditolak -> Refund Available
  const p3 = await mk(7, "Nelayan c - Tangkap 2 ton ikan", "profile:nelayan", E("0.01"), 40, 7 * DAY, E("0.8"),
    ["Perbaikan kapal", "Operasional melaut", "Penjualan"], [3000, 4000, 3000]);
  await buy(a, p3, 25, "0.01"); await buy(b, p3, 15, "0.01");
  await w(k.connect(s[7]).submitEvidence(p3, "https://example.com/nota-mencurigakan.jpg"));
  await w(k.connect(a).vote(p3, false));

  console.log(`Seed selesai: rekam jejak #${h1},#${h2},#${h3}; berjalan #${p0} (voting), #${p1} (funding), #${p2} (menunggu setoran), #${p3} (refund).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
