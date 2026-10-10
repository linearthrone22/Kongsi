"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useKongsi, useProjects, fmt, SYM } from "../lib/kongsi";
import { profileOf } from "../lib/profiles";
import { Icon, StatusPill, Cover, Progress } from "../components/ui";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: 0, label: "Funding" },
  { key: 1, label: "Aktif" },
  { key: 2, label: "Selesai" },
  { key: 3, label: "Gagal" },
];

const fundedPct = (p) => Number((p.sold * 100n) / p.totalTokens);

function Meta({ prof }) {
  if (!prof) return null;
  return (
    <div className="meta">
      <span><Icon.pin className="red" /> {prof.location}</span>
      <span><Icon.flag className="amber" /> {prof.category}</span>
    </div>
  );
}

function InvestBox({ id, p }) {
  const { send } = useKongsi();
  const [qty, setQty] = useState(1);
  const left = Number(p.totalTokens - p.sold);
  return (
    <div className="invest">
      <div className="qty">
        <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
        <input type="number" min="1" max={left} value={qty} onChange={(e) => setQty(Math.min(left, Math.max(1, Number(e.target.value) || 1)))} />
        <button onClick={() => setQty((q) => Math.min(left, q + 1))}>+</button>
      </div>
      <button className="btn neon grow" disabled={qty > left}
        onClick={() => send(`Patungan ${qty} token`, (c) => c.invest(id, qty, { value: p.tokenPrice * BigInt(qty) }))}>
        Patungan · {fmt(p.tokenPrice * BigInt(qty), 5)} {SYM}
      </button>
    </div>
  );
}

function Featured({ items }) {
  const [i, setI] = useState(0);
  if (!items.length) return null;
  const { id, p, ms, verified } = items[i % items.length];
  const prof = profileOf(p.metadataURI);
  const status = Number(p.status);
  const go = (d) => setI((x) => (x + d + items.length) % items.length);
  return (
    <section className="featured">
      <div className="hero-img">
        <Cover src={prof?.cover} label={p.title} />
        <div className="hero-bar">
          <button className="round light" onClick={() => go(-1)} aria-label="Sebelumnya"><Icon.left /></button>
          <div className="hero-glass"><StatusPill status={status} /></div>
          <button className="round light" onClick={() => go(1)} aria-label="Berikutnya"><Icon.right /></button>
        </div>
      </div>
      <div className="info-card">
        <h2>{p.title}</h2>
        <Meta prof={prof} />
        <div className="metrics">
          <div><small>Harga / Token</small><b>{fmt(p.tokenPrice, 5)} {SYM}</b></div>
          <div><small>Max Yield</small><b>{fmt(p.maxYield)} {SYM}</b></div>
          <div><small>Estimasi Siklus</small><b>{prof?.cycle || "-"}</b></div>
        </div>
        <div className="inner">
          <div><small>Terkumpul</small><b>{fmt(p.raised, 4)} {SYM}</b></div>
          <div><small>Token Terjual</small><b>{p.sold.toString()}/{p.totalTokens.toString()}</b></div>
          <div><small>Milestone</small><b>{verified}/{ms.length}</b></div>
        </div>
        <Progress pct={fundedPct(p)} />
        {status === 0 ? <InvestBox id={id} p={p} /> : (
          <Link className="btn neon full" href={`/project/${id}`}>Lihat Evidence Feed</Link>
        )}
        <Link className="btn dark full" href={`/project/${id}`}>Lihat detail proyek</Link>
      </div>
    </section>
  );
}

function ProjectCard({ id, p }) {
  const prof = profileOf(p.metadataURI);
  const pct = fundedPct(p);
  return (
    <Link href={`/project/${id}`} className="pcard">
      <div className="pcard-img">
        <Cover src={prof?.cover} label={p.title} />
        <span className="round light corner"><Icon.arrowUR /></span>
      </div>
      <div className="pcard-body">
        <h3 title={p.title}>{p.title}</h3>
        <Meta prof={prof} />
        <div className="metrics sm">
          <div><small>Harga / Token</small><b>{fmt(p.tokenPrice, 5)}</b></div>
          <div><small>Max Yield</small><b>{fmt(p.maxYield, 3)} {SYM}</b></div>
          <div><small>Siklus</small><b>{prof?.cycle || "-"}</b></div>
        </div>
        <div className="row between small fundrow">
          <span className="muted">Pendanaan</span>
          <span><b>{pct}%</b> <span className="muted">· {fmt(p.raised, 3)}/{fmt(p.totalTokens * p.tokenPrice, 3)} {SYM}</span></span>
        </div>
        <Progress pct={pct} tone={Number(p.status) === 3 ? "red" : "neon"} />
        <StatusPill status={p.status} block />
      </div>
    </Link>
  );
}

export default function Market() {
  const projects = useProjects();
  const { query } = useKongsi();
  const [filter, setFilter] = useState("all");

  const shown = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    return projects.filter(({ p }) => {
      if (filter !== "all" && Number(p.status) !== filter) return false;
      if (!q) return true;
      const prof = profileOf(p.metadataURI);
      return [p.title, prof?.name, prof?.category, prof?.location].join(" ").toLowerCase().includes(q);
    });
  }, [projects, filter, query]);

  const featured = useMemo(() => (projects || []).filter(({ p }) => Number(p.status) <= 1), [projects]);

  if (!projects) return <div className="skeleton">Memuat proyek on-chain…</div>;
  return (
    <>
      <Featured items={featured.length ? featured : projects} />
      <div className="section-head">
        <h2>Tokenized Effort</h2>
        <div className="tabs">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? "on" : ""} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="empty">Tidak ada proyek yang cocok.</p>
      ) : (
        <div className="pgrid">{shown.map(({ id, p }) => <ProjectCard key={id} id={id} p={p} />)}</div>
      )}
    </>
  );
}
