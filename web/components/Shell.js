"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useKongsi, IS_LOCAL, NETWORK_NAME, DEV_ROLES, short, explorerAddress, explorerTx } from "../lib/kongsi";
import { Icon, Avatar } from "./ui";

const NAV = [
  { href: "/", label: "Market", icon: Icon.market },
  { href: "/portfolio", label: "My Portfolio", icon: Icon.wallet },
  { href: "/galang-dana", label: "Galang Dana", icon: Icon.plus },
];

function titleOf(path) {
  if (path.startsWith("/portfolio")) return "My Portfolio";
  if (path.startsWith("/project")) return "Dasbor Bukti";
  if (path.startsWith("/galang-dana")) return "Galang Dana";
  return "Market";
}

function WalletButton() {
  const { account, devIdx, setConnectOpen, disconnect } = useKongsi();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!account) {
    return <button className="btn neon" onClick={() => setConnectOpen(true)}>Connect Wallet</button>;
  }
  return (
    <div className="wallet" ref={ref}>
      <button className="wallet-chip" onClick={() => setOpen((o) => !o)}>
        <span className="wallet-text">
          <b>{devIdx != null ? DEV_ROLES[devIdx] || `Akun ${devIdx}` : "MetaMask"}</b>
          <small>{short(account)}</small>
        </span>
        <Avatar address={account} />
      </button>
      {open && (
        <div className="menu">
          <Link href="/portfolio" onClick={() => setOpen(false)}>My Portfolio</Link>
          <button onClick={() => { setOpen(false); setConnectOpen(true); }}>Ganti akun</button>
          <button className="danger" onClick={() => { setOpen(false); disconnect(); }}>Disconnect</button>
        </div>
      )}
    </div>
  );
}

function ConnectModal() {
  const { connectOpen, setConnectOpen, connectDev, connectMetaMask, devAccounts } = useKongsi();
  const router = useRouter();
  const path = usePathname();
  if (!connectOpen) return null;
  const done = () => path === "/" && router.push("/portfolio");
  return (
    <div className="modal-bg" onClick={() => setConnectOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3 className="modal-title"><img src="/brand/kongsi-mark.png" alt="" /> Connect Wallet</h3>
          <button className="icon-btn" onClick={() => setConnectOpen(false)}><Icon.x /></button>
        </div>
        <button className="wallet-opt" onClick={() => connectMetaMask().then(done)}>
          <span className="mm">🦊</span>
          <span><b>MetaMask</b><small>{IS_LOCAL ? "Tambahkan jaringan Hardhat (31337) di MetaMask" : `Jaringan: ${NETWORK_NAME}`}</small></span>
        </button>
        {IS_LOCAL && devAccounts.length > 0 && (
          <>
            <p className="muted small">Akun demo lokal (tanpa MetaMask)</p>
            <div className="dev-list">
              {[1, 2, 3, 7, 4, 5, 6].filter((i) => devAccounts[i]).map((i) => (
                <button key={i} className="wallet-opt slim" onClick={() => connectDev(i).then(done)}>
                  <Avatar address={devAccounts[i]} size={28} />
                  <span><b>{DEV_ROLES[i]}</b><small>{short(devAccounts[i])}</small></span>
                  <span className="tag">{i <= 3 || i === 7 ? "Pengusaha" : "Investor"}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Shell({ children }) {
  const path = usePathname();
  const { cfg, toast, setToast, query, setQuery } = useKongsi();
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!toast || toast.type === "info") return;
    const id = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(id);
  }, [toast, setToast]);

  return (
    <div className="app">
      <aside className="side">
        <Link href="/" className="logo" aria-label="Kongsi">
          <img className="logo-full" src="/brand/kongsi-logo.png" alt="Kongsi" />
          <img className="logo-mark" src="/brand/kongsi-mark.png" alt="" />
        </Link>
        <nav>
          {NAV.map(({ href, label, icon: I }) => {
            const active = href === "/" ? path === "/" || path.startsWith("/project") : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`nav ${active ? "active" : ""}`}>
                <span className="nav-ic"><I /></span>{label}
              </Link>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className="netcard">
            <span><span className="live" />{NETWORK_NAME}</span>
            {cfg && (
              <a href={explorerAddress(cfg.address)} target="_blank" rel="noreferrer">Kontrak {short(cfg.address)} ↗</a>
            )}
          </div>
          <p className="tagline">Proof of Effort · dana dicairkan per milestone terverifikasi</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{titleOf(path)}</h1>
          <div className="top-actions">
            {path === "/" && (searching ? (
              <input autoFocus className="search" placeholder="Cari proyek / pengusaha…" value={query}
                onChange={(e) => setQuery(e.target.value)} onBlur={() => !query && setSearching(false)} />
            ) : (
              <button className="icon-btn" onClick={() => setSearching(true)} title="Cari"><Icon.search /></button>
            ))}
            <WalletButton />
          </div>
        </header>
        <div className="content">{children}</div>
      </div>

      <ConnectModal />
      {toast && (
        <div className={`toast ${toast.type}`} onClick={() => setToast(null)}>
          {toast.msg}{" "}
          {toast.tx && (
            <a href={explorerTx(toast.tx)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>lihat tx ↗</a>
          )}
        </div>
      )}
    </div>
  );
}
