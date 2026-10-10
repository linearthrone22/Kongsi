"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useKongsi, fmt, SYM } from "../../lib/kongsi";
import { profileOf } from "../../lib/profiles";
import { Icon, StatusPill, Cover, Progress } from "../../components/ui";

function StatCard({ tone, icon: I, label, value, sub, href, onClick }) {
  const Arrow = (
    <span className={`round ${tone === "white" ? "dark" : tone === "neon" ? "dark" : "light"}`}><Icon.arrowUR /></span>
  );
  return (
    <div className={`stat ${tone}`}>
      <I />
      <small>{label}</small>
      <div className="row between">
        <b>{value}</b>
        {href ? <Link href={href}>{Arrow}</Link> : <button className="bare" onClick={onClick}>{Arrow}</button>}
      </div>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

export default function Portfolio() {
  const { reader, account, tick, setConnectOpen, send } = useKongsi();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState("live");

  useEffect(() => {
    if (!reader || !account) return;
    (async () => {
      const n = Number(await reader.projectCount());
      const all = await Promise.all(
        [...Array(n).keys()].map(async (id) => {
          const [p, ms, v] = await Promise.all([reader.getProject(id), reader.getMilestones(id), reader.investorView(id, account)]);
          return { id, p, ms, v };
        })
      );
      setRows(all.filter((r) => r.v.tokens > 0n));
    })().catch(console.error);
  }, [reader, account, tick]);

  if (!account) {
    return (
      <div className="empty-state">
        <Icon.wallet width="40" height="40" />
        <h2>Hubungkan wallet untuk melihat portofolio</h2>
        <p className="muted">Lihat token effort yang Anda danai, estimasi return, dan dana yang bisa direfund.</p>
        <button className="btn neon" onClick={() => setConnectOpen(true)}>Connect Wallet</button>
      </div>
    );
  }
  if (!rows) return <div className="skeleton">Memuat portofolio…</div>;

  let invested = 0n, estReturn = 0n, refund = 0n, revenue = 0n;
  for (const { p, v } of rows) {
    invested += v.tokens * p.tokenPrice;
    if (Number(p.status) !== 3) estReturn += (v.tokens * p.maxYield) / p.totalTokens;
    refund += v.refundable;
    revenue += v.revenue;
  }
  const refundRow = rows.find((r) => r.v.refundAvailable);
  const live = rows.filter((r) => Number(r.p.status) <= 1);
  const closed = rows.filter((r) => Number(r.p.status) >= 2);
  const list = tab === "live" ? live : closed;

  return (
    <>
      <div className="stats3">
        <StatCard tone="blue" icon={Icon.lock} label="Total Diinvestasikan" value={`${fmt(invested, 4)} ${SYM}`}
          sub={`${rows.length} proyek · harga primer`} onClick={() => document.getElementById("funded")?.scrollIntoView({ behavior: "smooth" })} />
        <StatCard tone="white" icon={Icon.trend} label="Estimasi Return (maks.)" value={`${fmt(estReturn, 4)} ${SYM}`}
          sub={revenue > 0n ? `${fmt(revenue, 5)} ${SYM} siap diklaim` : "berdasarkan max yield proyek aktif"}
          onClick={() => setTab("closed")} />
        <StatCard tone="neon" icon={Icon.refund} label="Refund Available" value={`${fmt(refund, 4)} ${SYM}`}
          sub={refundRow ? "sisa escrow proyek gagal" : "tidak ada refund"}
          href={refundRow ? `/project/${refundRow.id}` : undefined} onClick={() => {}} />
      </div>

      <section className="panel table-panel" id="funded">
        <div className="row between wrapflex">
          <h2>Proyek Didanai</h2>
          <div className="tabs">
            <button className={tab === "live" ? "on" : ""} onClick={() => setTab("live")}>Berjalan ({live.length})</button>
            <button className={tab === "closed" ? "on" : ""} onClick={() => setTab("closed")}>Selesai & Gagal ({closed.length})</button>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="empty">
            {rows.length === 0 ? <>Belum ada proyek. <Link href="/">Jelajahi Market →</Link></> : "Tidak ada proyek di tab ini."}
          </p>
        ) : (
          <div className="ptable">
            <div className="thead">
              <span>Proyek</span><span>Kepemilikan</span><span>Progres Milestone</span><span>Nilai</span><span />
            </div>
            {list.map(({ id, p, ms, v }) => {
              const prof = profileOf(p.metadataURI);
              const verified = ms.filter((m) => Number(m.status) === 2).length;
              const share = (Number(v.tokens) / Number(p.totalTokens)) * 100;
              const pending = ms.some((m) => Number(m.status) === 1);
              return (
                <div className="trow" key={id}>
                  <span className="proj">
                    <Cover src={prof?.cover} label={p.title} className="thumb" />
                    <span>
                      <b>{p.title}</b>
                      <StatusPill status={p.status} />
                    </span>
                  </span>
                  <span><span><b>{v.tokens.toString()}</b> token</span><small className="muted">{share.toFixed(1)}% dari proyek</small></span>
                  <span className="mprog">
                    <Progress pct={(verified / ms.length) * 100} tone={Number(p.status) === 3 ? "red" : "green"} />
                    <small className={pending && v.canVote ? "amber" : "muted"}>
                      {verified}/{ms.length} terverifikasi{pending && v.canVote ? " · butuh suara Anda" : ""}
                    </small>
                  </span>
                  <span>
                    <b>{fmt(v.tokens * p.tokenPrice, 4)} {SYM}</b>
                    {v.refundAvailable && <small className="red">Refund {fmt(v.refundable, 4)} {SYM}</small>}
                    {v.revenue > 0n && <small className="green">Hasil {fmt(v.revenue, 5)} {SYM}</small>}
                  </span>
                  <span className="actions">
                    {v.refundAvailable && (
                      <button className="btn red sm" onClick={() => send("Tarik refund", (c) => c.claimRefund(id))}>Refund</button>
                    )}
                    {v.revenue > 0n && (
                      <button className="btn neon sm" onClick={() => send("Tarik pokok & imbal hasil", (c) => c.claimRevenue(id))}>Tarik hasil</button>
                    )}
                    <Link className="btn dark sm" href={`/project/${id}`}>View Details</Link>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
