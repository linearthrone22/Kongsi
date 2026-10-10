"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseEther, formatEther } from "ethers";
import { useKongsi, fmt, short, MSTATUS, explorerAddress, SYM } from "../../../lib/kongsi";
import { profileOf } from "../../../lib/profiles";
import { Icon, StatusPill, Cover, Progress } from "../../../components/ui";

const MAX_URI = 1024; // URI bukti disimpan di storage kontrak: tiap 32 byte ±20k gas

/** Pisahkan URL dan metadata `#sha256=…&type=…` yang ditambahkan saat upload. */
function parseEvidence(uri) {
  const [url, frag = ""] = uri.split("#");
  const q = new URLSearchParams(frag);
  return { url, sha: q.get("sha256"), type: q.get("type") || "" };
}
const isImg = ({ url, type }) =>
  type.startsWith("image/") || /^data:image\//.test(url) || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url) || /images\.unsplash\.com/.test(url);

function HashCheck({ url, sha }) {
  const [state, setState] = useState("idle");
  const check = async (e) => {
    e.preventDefault();
    setState("checking");
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      setState(hex === sha ? "ok" : "bad");
    } catch {
      setState("err");
    }
  };
  const label = { idle: "Cek integritas", checking: "Mengecek…", ok: "✓ Hash cocok", bad: "✗ File berubah!", err: "Gagal cek" }[state];
  return (
    <div className={`hash ${state}`} title={`SHA-256 on-chain: ${sha}`}>
      <span>sha256 {sha.slice(0, 10)}…</span>
      <button className="link-btn" onClick={check} disabled={state === "checking"}>{label}</button>
    </div>
  );
}

function Evidence({ uri }) {
  const [bad, setBad] = useState(false);
  if (!uri) return <div className="ev-empty">Belum ada dokumen</div>;
  const ev = parseEvidence(uri);
  return (
    <>
      {isImg(ev) && !bad ? (
        <a href={ev.url} target="_blank" rel="noreferrer"><img className="ev-img" src={ev.url} alt="bukti" onError={() => setBad(true)} /></a>
      ) : (
        <a className="ev-link" href={ev.url} target="_blank" rel="noreferrer">
          📄 {ev.type === "application/pdf" ? "Dokumen PDF" : ev.url.length > 40 ? ev.url.slice(0, 40) + "…" : ev.url} ↗
        </a>
      )}
      {ev.sha && <HashCheck url={ev.url} sha={ev.sha} />}
    </>
  );
}

/** Form bukti pengusaha: file di-upload off-chain, yang dikirim on-chain hanya URL + hash. */
function EvidenceUploader({ id, milestone }) {
  const { reader, account, send, setToast } = useKongsi();
  const [uri, setUri] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [cost, setCost] = useState(null);

  const tooLong = uri.length > MAX_URI;

  useEffect(() => {
    setCost(null);
    if (!uri || tooLong || !reader || !account) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const [gas, fee] = await Promise.all([
          reader.submitEvidence.estimateGas(id, uri, { from: account }),
          reader.runner.provider.getFeeData(),
        ]);
        if (alive) setCost({ gas, fee: gas * (fee.maxFeePerGas ?? fee.gasPrice ?? 0n) });
      } catch {
        if (alive) setCost({ error: true });
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [uri, tooLong, reader, account, id]);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Upload gagal");
      setUri(j.url);
      setFileName(`${f.name} · ${(j.size / 1024).toFixed(0)} KB · ${j.storage === "ipfs" ? "IPFS" : "server"}`);
    } catch (err) {
      setToast({ type: "err", msg: err.message });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (await send("Unggah bukti", (c) => c.submitEvidence(id, uri))) {
      setUri("");
      setFileName("");
    }
  };

  return (
    <>
      <p className="small">Unggah bukti untuk milestone <b>{milestone.title}</b> ({Number(milestone.bps) / 100}% dana akan cair jika &gt;50% investor memverifikasi).</p>
      <div className="row gap wrapflex">
        <input className="field grow" placeholder="Tempel link bukti (IPFS / Drive / foto) atau pilih file"
          value={fileName || uri} onChange={(e) => { setFileName(""); setUri(e.target.value.trim()); }} />
        <label className={`btn dark file ${uploading ? "disabled" : ""}`}>
          {uploading ? "Mengunggah…" : "Pilih file"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={onFile} hidden disabled={uploading} />
        </label>
        <button className="btn neon" disabled={!uri || uploading || tooLong} onClick={submit}>Unggah bukti</button>
      </div>
      <div className="ev-meta small">
        {tooLong ? (
          <span className="red">Link terlalu panjang ({uri.length} karakter, maks. {MAX_URI}). Simpan file di luar chain lalu tempel link-nya.</span>
        ) : cost?.gas ? (
          <span className="muted">Estimasi biaya: <b>~{fmt(cost.fee, 4)} {SYM}</b> ({(Number(cost.gas) / 1000).toFixed(0)}k gas). File disimpan off-chain; on-chain hanya link + hash SHA-256.</span>
        ) : cost?.error ? (
          <span className="amber">Estimasi gas gagal — transaksi kemungkinan akan ditolak.</span>
        ) : (
          <span className="muted">JPG/PNG/WEBP/GIF/PDF maks. 8 MB. Hash SHA-256 file ikut tercatat on-chain.</span>
        )}
      </div>
    </>
  );
}

function ProofBadge({ icon, kind, proof }) {
  if (!proof) return null;
  return (
    <a className="proof" href={proof.url} target="_blank" rel="noreferrer" title={`Buka bukti ${kind}`}>
      <span className="proof-ic">{icon}</span>
      <span><small>{kind}</small><b>{proof.label}</b></span>
      <span className="proof-ok"><Icon.check /></span>
    </a>
  );
}

/** Panel akhir siklus: pengusaha setor hasil, investor tarik pokok + imbal hasil. */
function Payout({ id, p, me, isFarmer, tokens, rev, setRev }) {
  const { send, account, setConnectOpen } = useKongsi();
  const depositedPct = p.maxYield > 0n ? Number((p.revenueDeposited * 100n) / p.maxYield) : 0;
  const room = p.maxYield - p.revenueDeposited;
  const principal = BigInt(tokens) * p.tokenPrice;
  const entitled = (BigInt(tokens) * p.accRevenuePerToken) / 10n ** 18n; // total hak dari setoran saat ini
  const maxEntitled = p.sold > 0n ? (BigInt(tokens) * p.maxYield) / p.sold : 0n;
  const pending = me?.revenue ?? 0n;
  const yieldPart = entitled > principal ? entitled - principal : 0n;

  return (
    <section className="panel payout" id="payout">
      <div className="row between wrapflex">
        <div>
          <h2>Pembayaran Akhir Siklus</h2>
          <p className="muted small">Semua milestone terverifikasi. Hasil penjualan disetor ke kontrak lalu dibagi per token (maks. {fmt(p.maxYield)} {SYM}).</p>
        </div>
        <StatusPill status={p.revenueDeposited > 0n ? 2 : 0} label={p.revenueDeposited > 0n ? "Hasil disetor" : "Menunggu setoran"} />
      </div>

      <div className="row between small top12"><span>Disetor pengusaha <b>{fmt(p.revenueDeposited, 5)} {SYM}</b></span><span className="muted">dari max yield {fmt(p.maxYield)} {SYM}</span></div>
      <Progress pct={depositedPct} tone="green" />

      {isFarmer && (
        <div className="payout-box farmer">
          <div className="grow">
            <b>Setor Hasil Penjualan</b>
            <p className="muted small">Sisa kuota setoran {fmt(room, 5)} {SYM}. Kelebihan otomatis dikembalikan.</p>
          </div>
          {room > 0n ? (
            <div className="row gap wrapflex">
              <div className="eth-input"><input value={rev} onChange={(e) => setRev(e.target.value)} /><span>{SYM}</span></div>
              <button className="btn dark sm" onClick={() => setRev(formatEther(room))}>Max</button>
              <button className="btn neon big" onClick={() => send("Setor hasil penjualan", (c) => c.depositRevenue(id, { value: parseEther(rev || "0") }))}>
                Setor Hasil Penjualan
              </button>
            </div>
          ) : <span className="chip">✓ Max yield sudah terpenuhi</span>}
        </div>
      )}

      {!account && <button className="btn neon top12" onClick={() => setConnectOpen(true)}>Connect wallet untuk menarik hasil</button>}

      {account && tokens > 0 && (
        <div className="payout-box investor">
          <div className="split">
            <div><small>Pokok (modal)</small><b>{fmt(principal, 5)} {SYM}</b></div>
            <div><small>Imbal hasil</small><b className="green">+{fmt(yieldPart, 5)} {SYM}</b></div>
            <div><small>Potensi maks.</small><b>{fmt(maxEntitled, 5)} {SYM}</b></div>
          </div>
          {pending > 0n ? (
            <button className="btn green huge" onClick={() => send("Tarik pokok & imbal hasil", (c) => c.claimRevenue(id))}>
              Tarik Pokok & Imbal Hasil · {fmt(pending, 5)} {SYM}
            </button>
          ) : p.revenueDeposited === 0n ? (
            <div className="waiting"><Icon.clock /> Menunggu pengusaha menyetor hasil penjualan.</div>
          ) : (
            <div className="waiting ok"><Icon.check /> Semua hasil yang tersedia sudah Anda tarik ({fmt(entitled, 5)} {SYM}).</div>
          )}
        </div>
      )}
    </section>
  );
}

const FUND_LABEL =["seeds funded", "operational funded", "cargo funded", "sales funded"];

export default function ProjectPage({ params }) {
  const id = Number(params.id);
  const { reader, account, send, tick, setConnectOpen } = useKongsi();
  const [d, setD] = useState(null);
  const [missing, setMissing] = useState(false);
  const [qty, setQty] = useState(1);
  const [rev, setRev] = useState("0.1");
  const [lq, setLq] = useState(1);
  const [lp, setLp] = useState("");

  useEffect(() => {
    if (!reader) return;
    (async () => {
      const n = Number(await reader.projectCount());
      if (id >= n || Number.isNaN(id)) return setMissing(true);
      const [p, ms, ln, all] = await Promise.all([
        reader.getProject(id),
        reader.getMilestones(id),
        reader.listingCount(),
        Promise.all([...Array(n).keys()].map(async (i) => ({ id: i, p: await reader.getProject(i) }))),
      ]);
      const ls = await Promise.all([...Array(Number(ln)).keys()].map(async (i) => ({ id: i, l: await reader.getListing(i) })));
      const listings = ls.filter(({ l }) => l.active && Number(l.projectId) === id);
      // Rekam jejak on-chain: proyek lain milik pengusaha yang sama.
      const history = all.filter((x) => x.id !== id && x.p.farmer.toLowerCase() === p.farmer.toLowerCase());
      const me = account ? await reader.investorView(id, account) : null;
      setD({ p, ms, listings, me, history });
    })().catch(console.error);
  }, [reader, id, account, tick]);

  if (missing) return <div className="empty-state"><h2>Proyek tidak ditemukan</h2><Link className="btn neon" href="/">Kembali ke Market</Link></div>;
  if (!d) return <div className="skeleton">Memuat dasbor bukti…</div>;

  const { p, ms, listings, me, history } = d;
  const doneHistory = history.filter((x) => Number(x.p.status) === 2);
  const failedHistory = history.filter((x) => Number(x.p.status) === 3);
  const status = Number(p.status);
  const isFarmer = account && account.toLowerCase() === p.farmer.toLowerCase();
  const cur = Number(p.currentMilestone);
  const curStatus = Number(ms[cur]?.status ?? 0);
  const reviewing = status === 1 && curStatus === 1;
  const sold = Number(p.sold) || 1;
  const apr = (Number(p.approveWeight) / sold) * 100;
  const rej = (Number(p.rejectWeight) / sold) * 100;
  const releasedPct = p.raised > 0n ? Number((p.released * 100n) / p.raised) : 0;
  const fundPct = Number((p.sold * 100n) / p.totalTokens);
  const prof = profileOf(p.metadataURI);
  const tokens = me ? Number(me.tokens) : 0;
  const left = Number(p.totalTokens - p.sold);
  const market = status === 2 || (status === 1 && cur > 0);
  const verified = ms.filter((m) => Number(m.status) === 2).length;

  return (
    <>
      <Link href="/" className="back"><Icon.left width="14" height="14" /> Market</Link>

      <section className="featured">
        <div className="hero-img">
          <Cover src={prof?.cover} label={p.title} />
          <div className="hero-bar center">
            <div className="hero-glass"><StatusPill status={status} /></div>
          </div>
        </div>
        <div className="info-card">
          <h2>{p.title}</h2>
          <div className="meta">
            {prof && <span><Icon.pin className="red" /> {prof.location}</span>}
            <span><Icon.flag className="amber" /> Pengusaha <a href={explorerAddress(p.farmer)} target="_blank" rel="noreferrer">{short(p.farmer)}</a></span>
          </div>
          <div className="metrics">
            <div><small>Harga / Token</small><b>{fmt(p.tokenPrice, 5)} {SYM}</b></div>
            <div><small>Max Yield</small><b>{fmt(p.maxYield)} {SYM}</b></div>
            <div><small>Estimasi Siklus</small><b>{prof?.cycle || "-"}</b></div>
          </div>
          <div className="inner">
            <div><small>Terkumpul</small><b>{fmt(p.raised, 4)} {SYM}</b></div>
            <div><small>Token Terjual</small><b>{p.sold.toString()}/{p.totalTokens.toString()}</b></div>
            <div><small>Token Anda</small><b className={tokens ? "neon-t" : ""}>{account ? tokens : "-"}</b></div>
          </div>
          {status === 0 ? (
            <>
              <div className="row between small"><span className="muted">Pendanaan {fundPct}%</span><span className="muted">sisa {left} token</span></div>
              <Progress pct={fundPct} />
              <div className="invest">
                <div className="qty">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <input type="number" min="1" max={left} value={qty} onChange={(e) => setQty(Math.min(left, Math.max(1, Number(e.target.value) || 1)))} />
                  <button onClick={() => setQty((q) => Math.min(left, q + 1))}>+</button>
                </div>
                <button className="btn neon grow" onClick={() => send(`Patungan ${qty} token`, (c) => c.invest(id, qty, { value: p.tokenPrice * BigInt(qty) }))}>
                  Patungan · {fmt(p.tokenPrice * BigInt(qty), 5)} {SYM}
                </button>
              </div>
              <small className="muted">Batas pendanaan {new Date(Number(p.fundingDeadline) * 1000).toLocaleString("id-ID")}</small>
            </>
          ) : (
            <>
              <div className="row between small"><span className="muted">Dana dicairkan {releasedPct}%</span><span className="muted">{verified}/{ms.length} milestone</span></div>
              <Progress pct={releasedPct} tone={status === 3 ? "red" : "green"} />
              {!account && <button className="btn neon full" onClick={() => setConnectOpen(true)}>Connect Wallet untuk verifikasi</button>}
              {status === 2 ? (
                <a className="btn neon full" href="#payout">Lihat pembayaran akhir ↓</a>
              ) : (
                <a className="btn dark full" href="#feed">Lihat Evidence Feed ↓</a>
              )}
            </>
          )}
        </div>
      </section>

      {status === 3 && (
        <div className={`banner ${me?.refundAvailable ? "refund" : ""}`}>
          <span className="banner-ic"><Icon.refund width="26" height="26" /></span>
          <div className="grow">
            <b>{me?.refundAvailable ? "Refund Available" : "Proyek dihentikan"}</b>
            <p>Milestone ditolak / proyek dihentikan. Sisa escrow <b>{fmt(p.refundPool, 5)} {SYM}</b> dikunci smart contract dan dibagi proporsional per token.
              {!me?.refundAvailable && account && " Anda tidak memegang token, atau refund sudah ditarik."}</p>
          </div>
          {me?.refundAvailable && (
            <button className="btn red" onClick={() => send("Tarik refund", (c) => c.claimRefund(id))}>Tarik {fmt(me.refundable, 5)} {SYM}</button>
          )}
        </div>
      )}

      {status === 2 && <Payout id={id} p={p} me={me} isFarmer={isFarmer} tokens={tokens} rev={rev} setRev={setRev} />}

      {reviewing && me?.canVote && (
        <div className="banner vote-call">
          <span className="banner-ic"><Icon.clock width="24" height="24" /></span>
          <div className="grow"><b>Bukti baru menunggu verifikasi Anda</b><p>Milestone “{ms[cur].title}”. Bobot suara Anda: {tokens} token.</p></div>
          <a className="btn neon" href="#feed">Tinjau bukti</a>
        </div>
      )}

      <section className="panel" id="feed">
        <div className="row between wrapflex">
          <h2>Evidence Feed</h2>
          <div className="legend"><i className="l0" />Belum ada bukti<i className="l1" />Menunggu<i className="l2" />Terverifikasi<i className="l3" />Ditolak</div>
        </div>
        <div className="steps">
          {ms.map((m, i) => <span key={i} className={`step s${Number(m.status)} ${i === cur && status === 1 ? "cur" : ""}`} />)}
        </div>
        <div className="feed">
          {ms.map((m, i) => {
            const s = Number(m.status);
            return (
              <div key={i} className={`ev st${s} ${i === cur && status === 1 ? "current" : ""}`}>
                <div className="row between">
                  <span className="ev-num">{i + 1}</span>
                  <span className="ev-bps">{Number(m.bps) / 100}% dana</span>
                </div>
                <b className="ev-title">{m.title}</b>
                <Evidence uri={m.evidenceURI} />
                <div className="ev-status">
                  {s === 2 && <><Icon.check /> {(prof?.category === "Pertanian" && FUND_LABEL[i]) || `tahap ${i + 1} funded`} · signed/verified</>}
                  {s === 1 && <><Icon.clock /> {MSTATUS[s]}</>}
                  {s === 3 && <><Icon.x /> {MSTATUS[s]}</>}
                  {s === 0 && MSTATUS[s]}
                </div>
                {i === cur && reviewing && (
                  <div className="vote">
                    <div className="votebar">
                      <div className="a" style={{ width: apr + "%" }} />
                      <div className="r" style={{ width: rej + "%" }} />
                      <i />
                    </div>
                    <div className="row between tiny">
                      <span className="green">✓ {apr.toFixed(0)}%</span>
                      <span className="muted">mayoritas &gt;50%</span>
                      <span className="red">✗ {rej.toFixed(0)}%</span>
                    </div>
                    {me?.canVote ? (
                      <div className="row gap">
                        <button className="btn green grow sm" onClick={() => send("Verifikasi bukti", (c) => c.vote(id, true))}>Verifikasi</button>
                        <button className="btn red grow sm" onClick={() => send("Tolak bukti", (c) => c.vote(id, false))}>Tolak</button>
                      </div>
                    ) : (
                      <small className="muted">{!account ? "Connect wallet untuk memberi suara." : tokens === 0 ? "Hanya pemegang token yang dapat memberi suara." : "Suara Anda sudah tercatat."}</small>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isFarmer && (
        <section className="panel owner">
          <h2>Panel Pengusaha</h2>
          {status === 0 && <p className="muted small">Menunggu pendanaan penuh sebelum milestone pertama dimulai.</p>}
          {status === 1 && curStatus === 0 && (
            <EvidenceUploader id={id} milestone={ms[cur]} />
          )}
          {reviewing && <p className="muted small">Bukti sedang diverifikasi investor ({apr.toFixed(0)}% setuju).</p>}
          {status === 2 && <p className="muted small">Semua milestone selesai. Setor hasil penjualan lewat panel <a className="neon-t" href="#payout">Pembayaran Akhir</a> di atas.</p>}
          {(status === 0 || status === 1) && (
            <button className="btn ghost-red sm top12" onClick={() => confirm("Hentikan proyek dan buka refund untuk investor?") && send("Hentikan proyek", (c) => c.cancelProject(id))}>Hentikan proyek</button>
          )}
        </section>
      )}

      <div className="two">
        <section className="panel">
          <div className="row between wrapflex">
            <h2>Secondary Market</h2>
            {market && reviewing && <span className="chip amber"><Icon.clock /> dikunci selama voting</span>}
          </div>
          {!market ? (
            <p className="empty">Dibuka setelah minimal satu milestone terverifikasi.</p>
          ) : (
            <>
              {listings.length === 0 ? <p className="empty">Belum ada listing.</p> : (
                <div className="ltable">
                  <div className="thead"><span>Penjual</span><span>Jumlah</span><span>Harga/token</span><span /></div>
                  {listings.map(({ id: lid, l }) => (
                    <div className="trow" key={lid}>
                      <span>{short(l.seller)}</span>
                      <span>{l.amount.toString()}</span>
                      <span>{fmt(l.pricePerToken, 5)} {SYM}</span>
                      <span className="actions">
                        {account && l.seller.toLowerCase() === account.toLowerCase() ? (
                          <button className="btn dark sm" onClick={() => send("Batalkan listing", (c) => c.cancelListing(lid))}>Batalkan</button>
                        ) : (
                          <button className="btn neon sm" disabled={reviewing} onClick={() => send("Beli token", (c) => c.buy(lid, l.amount, { value: l.pricePerToken * l.amount }))}>
                            Beli · {fmt(l.pricePerToken * l.amount, 4)}
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {tokens > 0 && (
                <div className="sell">
                  <small className="muted">Jual token Anda</small>
                  <div className="row gap wrapflex">
                    <input className="field num" type="number" min="1" max={tokens} value={lq} onChange={(e) => setLq(Math.min(tokens, Math.max(1, Number(e.target.value) || 1)))} />
                    <input className="field grow" placeholder={`harga/token (primer ${fmt(p.tokenPrice, 5)})`} value={lp} onChange={(e) => setLp(e.target.value)} />
                    <button className="btn neon" disabled={!lp} onClick={() => send("Pasang listing", (c) => c.list(id, lq, parseEther(lp)))}>Listing</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="panel">
          <h2>Historis / Profil</h2>
          {prof ? (
            <>
              <p className="bio"><b>{prof.name}</b> — {prof.bio}</p>
              <div className="badges">
                <ProofBadge icon="📍" kind="Lokasi" proof={prof.proofs?.location} />
                <ProofBadge icon="📄" kind="Dokumen" proof={prof.proofs?.document} />
                <ProofBadge icon="🪪" kind="KYC / ID" proof={prof.proofs?.kyc} />
              </div>

              <div className="track">
                <a className={`track-stat ${doneHistory.length ? "ok" : ""}`} href={doneHistory[0] ? `/project/${doneHistory[0].id}` : undefined}
                  onClick={(e) => { if (!doneHistory[0]) e.preventDefault(); }}>
                  <b>{doneHistory.length}</b><span>Proyek Selesai</span>
                </a>
                <div className="track-stat"><b>{fmt(doneHistory.reduce((s, x) => s + x.p.revenueDeposited, 0n), 3)}</b><span>{SYM} dibayar ke investor</span></div>
                <div className={`track-stat ${failedHistory.length ? "bad" : ""}`}><b>{failedHistory.length}</b><span>Proyek Gagal</span></div>
              </div>

              <div className="kv">
                <small>Rekam jejak on-chain</small>
                {history.length === 0 ? <p className="muted small">Belum ada proyek lain tercatat on-chain.</p> : (
                  <div className="history">
                    {history.map(({ id: hid, p: hp }) => {
                      const ratio = hp.raised > 0n ? Number((hp.revenueDeposited * 100n) / hp.raised) : 0;
                      return (
                        <Link key={hid} href={`/project/${hid}`} className="hist">
                          <span className="grow">
                            <b>{hp.title}</b>
                            <small className="muted">
                              #{hid} · {Number(hp.status) === 2 ? `dibayar ${fmt(hp.revenueDeposited, 3)} ${SYM} (${ratio}% dari modal)` : `dana ${fmt(hp.raised, 3)} ${SYM}`}
                            </small>
                          </span>
                          <StatusPill status={hp.status} />
                          <Icon.arrowUR />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
              {prof.offchain?.length > 0 && (
                <div className="kv"><small>Klaim off-chain (belum terverifikasi)</small><ul>{prof.offchain.map((x) => <li key={x} className="muted">{x}</li>)}</ul></div>
              )}
              {prof.specs?.length > 0 && <div className="kv"><small>Spesifikasi</small><ul>{prof.specs.map((x) => <li key={x}>{x}</li>)}</ul></div>}
            </>
          ) : <p className="empty">Profil belum tersedia.</p>}
        </section>
      </div>
    </>
  );
}
