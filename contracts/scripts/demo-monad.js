// Siapkan data demo di Monad Testnet dengan wallet terpisah per pengusaha & investor.
//   npx hardhat run scripts/demo-monad.js --network monadTestnet
// Wallet demo disimpan di contracts/demo/wallets.json (gitignored, KHUSUS testnet).
// Progres disimpan di contracts/demo/state.json sehingga skrip bisa dilanjutkan jika terputus.
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const BASE = process.env.DEMO_BASE_URL || "https://kongsi-three.vercel.app";
const DUMMY_PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const DAY = 86400;
const E = ethers.parseEther;

const DIR = path.join(__dirname, "..", "demo");
const WALLETS = path.join(DIR, "wallets.json");
const STATE = path.join(DIR, "state.json");
const manifest = require("../../web/public/demo-evidence/manifest.json");

const photo = (id) => `https://images.unsplash.com/photo-${id}?w=900&q=70`;
const maps = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const profile = (m) => "data:application/json," + encodeURIComponent(JSON.stringify(m));
const ev = (slug) => {
  const { file, sha256 } = manifest[slug];
  return `${BASE}/demo-evidence/${file}#sha256=${sha256}&type=image%2Fsvg%2Bxml`;
};

// Saldo target per wallet (MON), cukup untuk modal + gas.
const FUND = { darto: "1.0", sari: "0.7", bayu: "0.5", rudi: "0.3", andi: "1.0", bella: "0.7", citra: "0.8" };

const DARTO = {
  name: "Pak Darto", category: "Pertanian", location: "Desa Kosambi, Karawang", mapsUrl: maps(-6.2727, 107.3436),
  bio: "Petani singkong generasi kedua di Karawang. Memulai dari pilot 1 ha, lalu memasok Bu Sari dan pabrik tapioka.",
  docLabel: "Sertifikat lahan", docUrl: DUMMY_PDF, kycUrl: `${BASE}/kyc/ktp-pak-darto.svg`,
  specs: ["Varietas Mekarmanik, umur panen 8–10 bulan", "Pembeli tetap: Bu Sari & PT Tapioka Jaya Abadi"],
};
const SARI = {
  name: "Bu Sari", category: "UMKM", location: "Cicadas, Bandung", mapsUrl: maps(-6.9147, 107.6098),
  bio: "Usaha keripik singkong rumahan. Bahan baku dibeli langsung dari Pak Darto; distribusi minimarket oleh Mas Bayu.",
  docLabel: "Izin usaha (NIB)", docUrl: DUMMY_PDF, kycUrl: `${BASE}/kyc/ktp-bu-sari.svg`,
  specs: ["Dapur produksi 4×6 m, 3 pekerja", "Varian: original & balado, 200 g/bungkus"],
};
const BAYU = {
  name: "Mas Bayu", category: "Logistik", location: "Bandung Raya", mapsUrl: maps(-6.9175, 107.6191),
  bio: "Distributor makanan ringan lokal. Mengantar keripik Bu Sari ke jaringan minimarket koperasi warga.",
  docLabel: "Kontrak koperasi", docUrl: `${BASE}/demo-evidence/bayu1-minimarket.svg`, kycUrl: `${BASE}/kyc/ktp-mas-bayu.svg`,
  specs: ["2 armada pick-up box (sewa)", "Rute 30 gerai, kirim 2× seminggu"],
};
const RUDI = {
  name: "Pak Rudi", category: "Perikanan", location: "Muara Baru, Jakarta Utara", mapsUrl: maps(-6.1036, 106.8031),
  bio: "Nelayan yang mengajukan modal mesin kapal baru untuk melaut lebih jauh.",
  docLabel: "Surat izin kapal", docUrl: DUMMY_PDF, kycUrl: `${BASE}/kyc/ktp-pak-rudi.svg`,
  specs: ["Kapal kayu 6 GT"],
};

// Skenario: urutan = kronologi. `vote` = siapa memberi suara per milestone (urut), `stop` = berhenti di milestone tsb.
const PROJECTS = [
  {
    key: "darto1", farmer: "darto", title: "Pak Darto - Pilot singkong 1 ha",
    meta: { ...DARTO, cover: photo("1625246333195-78d9c38ad449"), cycle: "±4 bulan" },
    price: "0.001", tokens: 50, maxYield: "0.065", days: 7,
    ms: [["Bibit & pupuk", 40, "darto1-bibit"], ["Perawatan & penyiangan", 30, "darto1-rawat"], ["Panen & penjualan ke Bu Sari", 30, "darto1-panen"]],
    invest: [["andi", 30], ["bella", 20]], voters: ["andi"], deposit: "0.065", claim: ["andi", "bella"],
  },
  {
    key: "sari1", farmer: "sari", title: "Bu Sari - Keripik singkong 500 bungkus",
    meta: { ...SARI, cover: photo("1621447504864-d8686e12698c"), cycle: "±2 bulan" },
    price: "0.002", tokens: 40, maxYield: "0.104", days: 7,
    ms: [["Bahan baku singkong dari Pak Darto", 40, "sari1-bahan"], ["Produksi & pengemasan", 30, "sari1-produksi"], ["Penjualan ke 18 warung", 30, "sari1-jual"]],
    invest: [["bella", 20], ["citra", 20]], voters: ["bella", "citra"], deposit: "0.104", claim: ["bella", "citra"],
  },
  {
    key: "darto2", farmer: "darto", title: "Pak Darto - Singkong 3 ha untuk pabrik tapioka",
    meta: { ...DARTO, cover: photo("1605000797499-95a51c5269ae"), cycle: "±10 bulan" },
    price: "0.003", tokens: 50, maxYield: "0.2", days: 7,
    ms: [["Sewa lahan 3 ha", 30, "darto2-lahan"], ["Bibit, pupuk & irigasi", 25, "darto2-pupuk"], ["Perawatan 60 hari", 15, "darto2-rawat"], ["Panen & kontrak PT Tapioka Jaya", 30, "darto2-panen"]],
    invest: [["andi", 25], ["bella", 15], ["citra", 10]], voters: ["andi", "bella"], deposit: "0.2", claim: ["andi", "bella"], // citra sengaja belum tarik (demo)
  },
  {
    key: "bayu1", farmer: "bayu", title: "Mas Bayu - Distribusi keripik ke 30 minimarket",
    meta: { ...BAYU, cover: photo("1601584115197-04ecc0da31d7"), cycle: "±3 bulan" },
    price: "0.004", tokens: 50, maxYield: "0.25", days: 7,
    ms: [["Sewa 2 armada pick-up", 40, "bayu1-armada"], ["Kontrak pemasokan 30 minimarket", 30, "bayu1-minimarket"], ["Laporan penjualan 3 bulan", 30, "bayu1-laporan"]],
    invest: [["citra", 30], ["andi", 20]], voters: ["citra"], // tanpa setoran: demo "Setor Hasil Penjualan"
  },
  {
    key: "rudi1", farmer: "rudi", title: "Pak Rudi - Kapal tangkap 2 ton ikan",
    meta: { ...RUDI, cover: photo("1500514966906-fe245eea9344"), cycle: "±3 bulan" },
    price: "0.003", tokens: 40, maxYield: "0.16", days: 7,
    ms: [["Mesin kapal baru", 40, "rudi1-mesin-palsu"], ["Operasional melaut 3 trip", 35, null], ["Penjualan di TPI Muara Baru", 25, null]],
    invest: [["andi", 20], ["bella", 20]], reject: ["andi", "bella"], refund: ["andi"], // bella sengaja belum refund (demo)
  },
  {
    key: "sari2", farmer: "sari", title: "Bu Sari - Keripik 5.000 bungkus + izin P-IRT & halal",
    meta: { ...SARI, cover: photo("1566478989037-eec170784d0b"), cycle: "±3 bulan" },
    price: "0.005", tokens: 60, maxYield: "0.39", days: 7,
    ms: [["Bahan baku 3 ton singkong (Pak Darto)", 30, "sari2-bahan"], ["Izin P-IRT & sertifikasi halal", 20, "sari2-izin"], ["Produksi 5.000 bungkus", 25, null], ["Distribusi via Mas Bayu", 25, null]],
    invest: [["andi", 25], ["bella", 20], ["citra", 15]], voters: ["andi", "bella"],
    stopAt: 1, pendingVotes: ["citra"], list: ["citra", 5, "0.006"], // milestone 2 menunggu suara (demo voting)
  },
  {
    key: "darto3", farmer: "darto", title: "Pak Darto - Singkong 10 ha + mesin tepung tapioka",
    meta: { ...DARTO, cover: photo("1500937386664-56d1dfef3854"), cycle: "±10 bulan" },
    price: "0.01", tokens: 60, maxYield: "0.8", days: 5,
    ms: [["Sewa lahan 10 ha", 25, null], ["Bibit & pupuk", 20, null], ["Mesin pemarut & pengering tapioka", 25, null], ["Perawatan & tenaga kerja", 10, null], ["Panen, olah & jual tepung tapioka", 20, null]],
    invest: [["andi", 12], ["citra", 12]], fundingOnly: true, // 40% terdanai: demo patungan
  },
];

async function main() {
  if (network.name !== "monadTestnet") throw new Error("Skrip ini untuk --network monadTestnet");
  fs.mkdirSync(DIR, { recursive: true });
  const [deployer] = await ethers.getSigners();
  const k0 = await ethers.getContractAt("Kongsi", require("../../web/public/deployments.json").monadTestnet.address);

  // ── Wallet ──
  const saved = fs.existsSync(WALLETS) ? JSON.parse(fs.readFileSync(WALLETS, "utf8")) : {};
  for (const name of Object.keys(FUND)) {
    if (!saved[name]) {
      const w = ethers.Wallet.createRandom();
      saved[name] = { address: w.address, privateKey: w.privateKey };
    }
  }
  fs.writeFileSync(WALLETS, JSON.stringify(saved, null, 2));
  const W = Object.fromEntries(Object.entries(saved).map(([n, v]) => [n, new ethers.Wallet(v.privateKey, ethers.provider)]));

  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { done: {}, ids: {} };
  const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  const step = async (key, fn) => {
    if (state.done[key]) return;
    await fn();
    state.done[key] = true;
    save();
  };
  const tx = async (label, p) => {
    const r = await (await p).wait();
    console.log(`  ✓ ${label}  gas ${r.gasUsed}  ${r.hash}`);
    return r;
  };

  // ── Isi saldo ──
  console.log(`Deployer ${deployer.address}: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MON`);
  for (const [name, amt] of Object.entries(FUND)) {
    const bal = await ethers.provider.getBalance(W[name].address);
    if (bal < E(amt)) await tx(`isi saldo ${name} → ${amt} MON`, deployer.sendTransaction({ to: W[name].address, value: E(amt) - bal }));
  }

  for (const P of PROJECTS) {
    console.log(`\n▶ ${P.title}`);
    const farmer = k0.connect(W[P.farmer]);
    const price = E(P.price);

    await step(`${P.key}.create`, async () => {
      const r = await tx("galang dana", farmer.createProject(
        P.title, profile(P.meta), price, P.tokens, P.days * DAY, E(P.maxYield),
        P.ms.map((m) => m[0]), P.ms.map((m) => m[1] * 100)));
      const evt = r.logs.map((l) => { try { return k0.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === "ProjectCreated");
      state.ids[P.key] = Number(evt.args.id);
    });
    const id = state.ids[P.key];

    for (const [who, n] of P.invest) {
      await step(`${P.key}.invest.${who}`, () => tx(`${who} patungan ${n} token`, k0.connect(W[who]).invest(id, n, { value: price * BigInt(n) })));
    }
    if (P.fundingOnly) continue;

    if (P.reject) {
      await step(`${P.key}.m0.evidence`, () => tx("unggah nota mesin (palsu)", farmer.submitEvidence(id, ev(P.ms[0][2]))));
      for (const who of P.reject) await step(`${P.key}.m0.reject.${who}`, () => tx(`${who} TOLAK bukti`, k0.connect(W[who]).vote(id, false)));
      for (const who of P.refund) await step(`${P.key}.refund.${who}`, () => tx(`${who} tarik refund`, k0.connect(W[who]).claimRefund(id)));
      continue;
    }

    const last = P.stopAt ?? P.ms.length;
    for (let i = 0; i < last; i++) {
      await step(`${P.key}.m${i}.evidence`, () => tx(`bukti: ${P.ms[i][0]}`, farmer.submitEvidence(id, ev(P.ms[i][2]))));
      for (const who of P.voters) await step(`${P.key}.m${i}.vote.${who}`, () => tx(`${who} verifikasi`, k0.connect(W[who]).vote(id, true)));
    }
    if (P.list) {
      const [who, n, p] = P.list;
      await step(`${P.key}.list.${who}`, () => tx(`${who} listing ${n} token @ ${p}`, k0.connect(W[who]).list(id, n, E(p))));
    }
    if (P.stopAt !== undefined) {
      await step(`${P.key}.m${last}.evidence`, () => tx(`bukti: ${P.ms[last][0]}`, farmer.submitEvidence(id, ev(P.ms[last][2]))));
      for (const who of P.pendingVotes) await step(`${P.key}.m${last}.vote.${who}`, () => tx(`${who} verifikasi (menunggu mayoritas)`, k0.connect(W[who]).vote(id, true)));
      continue;
    }
    if (P.deposit) await step(`${P.key}.deposit`, () => tx(`setor hasil ${P.deposit} MON`, farmer.depositRevenue(id, { value: E(P.deposit) })));
    for (const who of P.claim || []) await step(`${P.key}.claim.${who}`, () => tx(`${who} tarik pokok & imbal hasil`, k0.connect(W[who]).claimRevenue(id)));
  }

  console.log("\nRingkasan proyek:");
  for (const P of PROJECTS) {
    const p = await k0.getProject(state.ids[P.key]);
    console.log(`  #${state.ids[P.key]} ${P.title} · status ${["Funding", "Aktif", "Selesai", "Gagal"][Number(p.status)]} · terkumpul ${ethers.formatEther(p.raised)} · disetor ${ethers.formatEther(p.revenueDeposited)}`);
  }
  console.log(`\nSisa saldo deployer: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MON`);
}

main().catch((e) => { console.error(e); process.exit(1); });
