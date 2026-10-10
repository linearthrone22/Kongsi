"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseEther } from "ethers";
import { useKongsi, SYM, fmt } from "../../lib/kongsi";
import { encodeProfile } from "../../lib/profiles";
import { Icon, Cover, Progress, StatusPill } from "../../components/ui";

const CATEGORIES = ["Pertanian", "Perikanan", "Peternakan", "Atlet", "UMKM", "Marketing", "Lainnya"];
const MAX_MILESTONES = 10;

// Template milestone per kategori (porsi %, total 100).
const TEMPLATES = {
  Pertanian: [["Bon pembelian bibit", 25], ["Dokumentasi penyiraman & perawatan", 25], ["Dokumentasi petani menghubungkan dengan penjual", 25], ["Penjualan hasil panen", 25]],
  Perikanan: [["Perbaikan kapal & alat tangkap", 30], ["Operasional melaut", 40], ["Penjualan hasil tangkapan", 30]],
  Peternakan: [["Pembelian bibit ternak", 35], ["Pakan & vaksinasi", 35], ["Penjualan ternak", 30]],
  Atlet: [["Latihan", 20], ["Makanan bergizi", 20], ["Daftar lomba", 15], ["Menang", 45]],
  UMKM: [["Pembelian bahan baku", 40], ["Produksi", 30], ["Distribusi & penjualan", 30]],
  Marketing: [["Kampanye marketing", 50], ["Up diri / hasil terukur", 50]],
  Lainnya: [["Tahap persiapan", 50], ["Tahap penyelesaian", 50]],
};

let uid = 0;
const mkMilestones = (cat) => TEMPLATES[cat].map(([title, pct]) => ({ id: ++uid, title, pct: String(pct) }));
const toBps = (pct) => Math.round((Number(pct) || 0) * 100);
const safeEther = (v) => { try { return v && Number(v) > 0 ? parseEther(String(v)) : 0n; } catch { return 0n; } };
const SEG_COLORS = ["#c6f432", "#35c46a", "#1d63ff", "#f5c542", "#ff8a3d", "#b07cff", "#2ad1c9", "#ff4d5e", "#9aa0a6", "#ffffff"];

function Field({ label, hint, children, error }) {
  return (
    <label className={`f ${error ? "has-err" : ""}`}>
      <span className="f-label">{label}</span>
      {children}
      {error ? <small className="f-err">{error}</small> : hint ? <small className="f-hint">{hint}</small> : null}
    </label>
  );
}

export default function GalangDana() {
  const { account, send, setConnectOpen, writer } = useKongsi();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Pertanian");
  const [location, setLocation] = useState("");
  const [cycleMonths, setCycleMonths] = useState("4");
  const [bio, setBio] = useState("");
  const [cover, setCover] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [kycUrl, setKycUrl] = useState("");

  const [price, setPrice] = useState("0.01");
  const [tokens, setTokens] = useState("100");
  const [maxYield, setMaxYield] = useState("1.3");
  const [days, setDays] = useState("7");

  const [ms, setMs] = useState(() => mkMilestones("Pertanian"));
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  // ── Turunan ──
  const priceWei = safeEther(price);
  const tokenCount = Number.isInteger(Number(tokens)) ? Math.max(0, Number(tokens)) : 0;
  const target = priceWei * BigInt(tokenCount);
  const yieldWei = safeEther(maxYield);
  const roi = target > 0n ? (Number(yieldWei - target) / Number(target)) * 100 : 0;
  const totalBps = ms.reduce((s, m) => s + toBps(m.pct), 0);
  const diff = 10000 - totalBps;

  const errors = useMemo(() => {
    const e = {};
    if (!title.trim()) e.title = "Judul effort wajib diisi";
    if (!name.trim()) e.name = "Nama pengusaha wajib diisi";
    if (priceWei <= 0n) e.price = "Harga token harus > 0";
    if (!Number.isInteger(Number(tokens)) || Number(tokens) < 1) e.tokens = "Jumlah token minimal 1 (bilangan bulat)";
    if (yieldWei < target) e.maxYield = `Max yield minimal sama dengan target dana (${fmt(target, 6)} ${SYM})`;
    if (!(Number(days) > 0)) e.days = "Durasi minimal 1 hari";
    if (ms.length === 0) e.ms = "Tambahkan minimal 1 milestone";
    else if (ms.some((m) => !m.title.trim())) e.ms = "Setiap milestone wajib punya judul";
    else if (ms.some((m) => toBps(m.pct) <= 0)) e.ms = "Porsi tiap milestone harus > 0%";
    else if (totalBps !== 10000) e.ms = `Total porsi harus tepat 100% (sekarang ${(totalBps / 100).toFixed(2)}%)`;
    return e;
  }, [title, name, priceWei, tokens, yieldWei, target, days, ms, totalBps]);
  const valid = Object.keys(errors).length === 0;
  const err = (k) => (touched ? errors[k] : undefined);

  // ── Aksi milestone ──
  const update = (id, patch) => setMs((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const remove = (id) => setMs((list) => list.filter((m) => m.id !== id));
  const move = (i, d) => setMs((list) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const add = () => setMs((list) => (list.length >= MAX_MILESTONES ? list : [...list, { id: ++uid, title: "", pct: "" }]));
  const splitEven = () => setMs((list) => {
    const n = list.length;
    if (!n) return list;
    const base = Math.floor(10000 / n);
    return list.map((m, i) => ({ ...m, pct: String((i === n - 1 ? 10000 - base * (n - 1) : base) / 100) }));
  });
  const fixLast = () => setMs((list) => {
    if (!list.length) return list;
    const others = list.slice(0, -1).reduce((s, m) => s + toBps(m.pct), 0);
    const last = 10000 - others;
    if (last <= 0) return list;
    return list.map((m, i) => (i === list.length - 1 ? { ...m, pct: String(last / 100) } : m));
  });
  const applyTemplate = (cat) => {
    setCategory(cat);
    setMs(mkMilestones(cat));
  };

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    if (!writer) return setConnectOpen(true);
    const meta = {
      name: name.trim(),
      category,
      location: location.trim(),
      cycle: cycleMonths ? `±${cycleMonths} bulan` : "-",
      bio: bio.trim(),
      cover: cover.trim(),
      docUrl: docUrl.trim(),
      kycUrl: kycUrl.trim(),
    };
    setBusy(true);
    const receipt = await send("Galang dana", (c) =>
      c.createProject(
        title.trim(),
        encodeProfile(meta),
        priceWei,
        tokenCount,
        Math.round(Number(days) * 86400),
        yieldWei,
        ms.map((m) => m.title.trim()),
        ms.map((m) => toBps(m.pct))
      )
    );
    setBusy(false);
    if (!receipt) return;
    const ev = receipt.logs.map((l) => { try { return writer.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === "ProjectCreated");
    router.push(ev ? `/project/${ev.args.id}` : "/");
  };

  const previewProfile = { name: name || "Nama pengusaha", category, location: location || "Lokasi", cover, cycle: cycleMonths ? `±${cycleMonths} bulan` : "-" };

  return (
    <div className="gd">
      <div className="gd-form">
        <div className="gd-intro">
          <h2>Tokenisasi effort Anda</h2>
          <p className="muted">Dana investor dikunci di smart contract dan cair bertahap per milestone setelah &gt;50% pemegang token memverifikasi bukti Anda.</p>
        </div>

        {/* 1. Profil */}
        <section className="panel">
          <h3 className="step-h"><span>1</span> Profil effort</h3>
          <div className="fgrid">
            <Field label="Judul effort" error={err("title")} hint="Contoh: Petani y - Panen 1000 bibit padi">
              <input className="in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama usaha - target effort" />
            </Field>
            <Field label="Nama pengusaha" error={err("name")}>
              <input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Petani y" />
            </Field>
            <Field label="Kategori" hint="Mengganti kategori tidak menimpa milestone; pakai tombol template di bawah.">
              <select className="in" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Lokasi" hint="Dipakai untuk badge lokasi (Google Maps)">
              <input className="in" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Karawang, Jawa Barat" />
            </Field>
            <Field label="Estimasi siklus (bulan)">
              <input className="in" type="number" min="1" value={cycleMonths} onChange={(e) => setCycleMonths(e.target.value)} />
            </Field>
            <Field label="Foto usaha (URL)" hint="Opsional, tampil di kartu Market">
              <input className="in" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…jpg" />
            </Field>
          </div>
          <Field label="Cerita / kebutuhan modal">
            <textarea className="in" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Punya lahan dan bibit, butuh modal operasional untuk…" />
          </Field>
        </section>

        {/* 2. Pendanaan */}
        <section className="panel">
          <h3 className="step-h"><span>2</span> Pendanaan</h3>
          <div className="fgrid four">
            <Field label={`Harga / token (${SYM})`} error={err("price")}>
              <input className="in" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Jumlah token" error={err("tokens")}>
              <input className="in" type="number" min="1" step="1" value={tokens} onChange={(e) => setTokens(e.target.value)} />
            </Field>
            <Field label={`Max yield (${SYM})`} error={err("maxYield")} hint="Total maksimum yang dikembalikan ke investor">
              <input className="in" value={maxYield} onChange={(e) => setMaxYield(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Durasi pendanaan (hari)" error={err("days")}>
              <input className="in" type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
          </div>
          <div className="sum-strip">
            <div><small>Target dana</small><b>{fmt(target, 6)} {SYM}</b></div>
            <div><small>Max yield</small><b>{fmt(yieldWei, 6)} {SYM}</b></div>
            <div><small>Imbal hasil maks. investor</small><b className={roi >= 0 ? "green" : "red"}>{target > 0n ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "-"}</b></div>
          </div>
          <p className="muted small">Jika dalam {Number(days) || 0} hari token belum terjual 100%, pendanaan gagal dan seluruh dana otomatis bisa direfund.</p>
        </section>

        {/* 3. Milestone dinamis */}
        <section className="panel">
          <div className="row between wrapflex">
            <h3 className="step-h"><span>3</span> Milestone & pencairan</h3>
            <div className="row gap wrapflex">
              <select className="in sm" value="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
                <option value="">Pakai template…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="btn dark sm" onClick={splitEven} disabled={!ms.length}>Bagi rata</button>
            </div>
          </div>

          <div className="alloc">
            {ms.map((m, i) => {
              const w = Math.max(0, toBps(m.pct)) / 100;
              return w > 0 ? <span key={m.id} style={{ width: `${Math.min(w, 100)}%`, background: SEG_COLORS[i % SEG_COLORS.length] }} title={`${i + 1}. ${m.title || "Milestone"} · ${w}%`} /> : null;
            })}
          </div>
          <div className={`alloc-status ${diff === 0 ? "ok" : "bad"}`}>
            {diff === 0 ? (
              <><Icon.check /> Total 100% — siap</>
            ) : (
              <>
                Total {(totalBps / 100).toFixed(2)}% · {diff > 0 ? `kurang ${(diff / 100).toFixed(2)}%` : `lebih ${(-diff / 100).toFixed(2)}%`}
                {ms.length > 0 && 10000 - ms.slice(0, -1).reduce((s, m) => s + toBps(m.pct), 0) > 0 && (
                  <button className="link-btn" onClick={fixLast}>Sesuaikan milestone terakhir</button>
                )}
              </>
            )}
          </div>

          <div className="ms-list">
            {ms.map((m, i) => {
              const amount = (target * BigInt(Math.max(0, toBps(m.pct)))) / 10000n;
              return (
                <div className="ms-row" key={m.id}>
                  <span className="ms-num" style={{ background: SEG_COLORS[i % SEG_COLORS.length] }}>{i + 1}</span>
                  <input className="in grow" value={m.title} placeholder={`Judul milestone ${i + 1} (mis. bon pembelian bibit)`} onChange={(e) => update(m.id, { title: e.target.value })} />
                  <div className="pct">
                    <input className="in" value={m.pct} inputMode="decimal" placeholder="0" onChange={(e) => update(m.id, { pct: e.target.value.replace(",", ".") })} />
                    <span>%</span>
                  </div>
                  <span className="ms-amt">{fmt(amount, 5)} {SYM}</span>
                  <div className="ms-act">
                    <button className="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} title="Naik">↑</button>
                    <button className="icon-sm" onClick={() => move(i, 1)} disabled={i === ms.length - 1} title="Turun">↓</button>
                    <button className="icon-sm danger" onClick={() => remove(m.id)} title="Hapus"><Icon.x /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn dashed full" onClick={add} disabled={ms.length >= MAX_MILESTONES}>
            + Tambah milestone {ms.length >= MAX_MILESTONES ? `(maks. ${MAX_MILESTONES})` : ""}
          </button>
          {err("ms") && <p className="f-err">{err("ms")}</p>}
          <p className="muted small">Setiap milestone mencairkan porsi dana sesuai persentasenya setelah bukti diverifikasi mayoritas investor. Urutan menentukan tahap.</p>
        </section>

        {/* 4. Bukti verifikasi */}
        <section className="panel">
          <h3 className="step-h"><span>4</span> Bukti verifikasi (opsional)</h3>
          <div className="fgrid">
            <Field label="Link dokumen (sertifikat lahan / PO)" hint="PDF / Drive / IPFS">
              <input className="in" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://…pdf" />
            </Field>
            <Field label="Link KTP tersensor" hint="Jangan unggah KTP asli tanpa sensor">
              <input className="in" value={kycUrl} onChange={(e) => setKycUrl(e.target.value)} placeholder="https://…" />
            </Field>
          </div>
        </section>

        <div className="gd-submit">
          {touched && !valid && <p className="f-err">Periksa kembali: {Object.values(errors)[0]}</p>}
          {account ? (
            <button className="btn neon big full" disabled={busy} onClick={submit}>
              {busy ? "Mengirim transaksi…" : `Galang Dana · target ${fmt(target, 6)} ${SYM}`}
            </button>
          ) : (
            <button className="btn neon big full" onClick={() => setConnectOpen(true)}>Connect Wallet untuk galang dana</button>
          )}
          <p className="muted small center">Profil & milestone disimpan on-chain. Alamat wallet Anda menjadi identitas pengusaha dan rekam jejak.</p>
        </div>
      </div>

      {/* Preview */}
      <aside className="gd-preview">
        <small className="muted">Pratinjau kartu Market</small>
        <div className="pcard static">
          <div className="pcard-img"><Cover src={cover} label={title || name || "K"} /></div>
          <div className="pcard-body">
            <h3>{title || "Judul effort Anda"}</h3>
            <div className="meta">
              <span><Icon.pin className="red" /> {previewProfile.location}</span>
              <span><Icon.flag className="amber" /> {category}</span>
            </div>
            <div className="metrics sm">
              <div><small>Harga / Token</small><b>{fmt(priceWei, 5)}</b></div>
              <div><small>Max Yield</small><b>{fmt(yieldWei, 3)} {SYM}</b></div>
              <div><small>Siklus</small><b>{previewProfile.cycle}</b></div>
            </div>
            <div className="row between small fundrow"><span className="muted">Pendanaan</span><span><b>0%</b> <span className="muted">· 0/{fmt(target, 3)} {SYM}</span></span></div>
            <Progress pct={0} />
            <StatusPill status={0} block />
          </div>
        </div>
        <div className="panel timeline">
          <small className="muted">Jadwal pencairan</small>
          {ms.length === 0 && <p className="muted small">Belum ada milestone.</p>}
          {ms.map((m, i) => (
            <div className="tl" key={m.id}>
              <span className="tl-dot" style={{ background: SEG_COLORS[i % SEG_COLORS.length] }} />
              <span className="grow">{m.title || <i className="muted">Milestone {i + 1}</i>}</span>
              <b>{(toBps(m.pct) / 100).toFixed(toBps(m.pct) % 100 ? 2 : 0)}%</b>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
