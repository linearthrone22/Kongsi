"use client";
import { useState } from "react";
import { STATUS } from "../lib/kongsi";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
export const Icon = {
  market: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} {...p}><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M3 9h18" /><path d="M9 20v-6h6v6" /></svg>,
  wallet: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} {...p}><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18" /><circle cx="16.5" cy="15" r="1.2" fill="currentColor" /><path d="M6 6l9-3 1 3" /></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>,
  search: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  arrowUR: (p) => <svg viewBox="0 0 24 24" width="16" height="16" {...P} strokeWidth={2.5} {...p}><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg>,
  left: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} strokeWidth={2.5} {...p}><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></svg>,
  right: (p) => <svg viewBox="0 0 24 24" width="18" height="18" {...P} strokeWidth={2.5} {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>,
  check: (p) => <svg viewBox="0 0 24 24" width="14" height="14" {...P} strokeWidth={3} {...p}><path d="M5 12l5 5 9-10" /></svg>,
  x: (p) => <svg viewBox="0 0 24 24" width="14" height="14" {...P} strokeWidth={3} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  clock: (p) => <svg viewBox="0 0 24 24" width="14" height="14" {...P} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  pin: (p) => <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" {...p}><path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" /></svg>,
  flag: (p) => <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" {...p}><path d="M5 3h2v18H5zM8 4h10l-2 4 2 4H8z" /></svg>,
  lock: (p) => <svg viewBox="0 0 24 24" width="30" height="30" {...P} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /><path d="M12 15v2" /></svg>,
  trend: (p) => <svg viewBox="0 0 24 24" width="30" height="30" {...P} {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>,
  refund: (p) => <svg viewBox="0 0 24 24" width="30" height="30" {...P} {...p}><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8" /><path d="M3 3v5h5" /><path d="M12 8v8M9.5 10.5c0-1 1.1-1.5 2.5-1.5s2.5.6 2.5 1.6c0 2.4-5 1.2-5 3.6 0 1 1.1 1.8 2.5 1.8s2.5-.6 2.5-1.6" /></svg>,
  logo: (p) => (
    <svg viewBox="0 0 32 32" width="30" height="30" {...p}>
      <rect x="3" y="14" width="6" height="15" rx="1.5" fill="#c6f432" />
      <rect x="13" y="7" width="6" height="22" rx="1.5" fill="#c6f432" />
      <rect x="23" y="11" width="6" height="18" rx="1.5" fill="#c6f432" />
      <circle cx="16" cy="3.5" r="2.5" fill="#c6f432" />
    </svg>
  ),
};

const STATUS_ICON = [Icon.clock, Icon.check, Icon.check, Icon.x];
export function StatusPill({ status, block, label }) {
  const s = Number(status);
  const I = STATUS_ICON[s];
  return (
    <span className={`pill st-${s} ${block ? "block" : ""}`}>
      <span className="dot"><I /></span>
      {label || STATUS[s]}
    </span>
  );
}

export function Avatar({ address, size = 36 }) {
  const h = parseInt((address || "0x000000").slice(2, 8), 16);
  const a = h % 360, b = (h >> 8) % 360;
  return (
    <span className="avatar" style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${a} 80% 60%), hsl(${b} 80% 45%))` }} />
  );
}

/** Foto usaha dengan fallback gradien jika gambar gagal dimuat. */
export function Cover({ src, label, className = "" }) {
  const [bad, setBad] = useState(!src);
  return bad ? (
    <div className={`cover fallback ${className}`}><span>{(label || "K").slice(0, 1)}</span></div>
  ) : (
    <img className={`cover ${className}`} src={src} alt={label || ""} onError={() => setBad(true)} />
  );
}

export function Progress({ pct, tone = "neon" }) {
  return (
    <div className="progress"><div className={tone} style={{ width: Math.min(100, pct) + "%" }} /></div>
  );
}
