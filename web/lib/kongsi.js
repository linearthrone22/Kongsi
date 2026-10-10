"use client";
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { BrowserProvider, Contract, JsonRpcProvider, formatEther } from "ethers";

const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "localhost"; // "localhost" | "sepolia" | ...
const RPC = process.env.NEXT_PUBLIC_RPC || "http://127.0.0.1:8545";
const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER || "https://testnet.monadvision.com";
export const SYM = process.env.NEXT_PUBLIC_SYMBOL || (NETWORK === "localhost" ? "ETH" : "MON");
const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || (NETWORK === "localhost" ? "Hardhat lokal" : "Monad Testnet");
export const NETWORK_NAME = CHAIN_NAME;
export const IS_LOCAL = NETWORK === "localhost";
export const explorerAddress = (a) => `${EXPLORER}/address/${a}`;
export const explorerTx = (h) => `${EXPLORER}/tx/${h}`;

export const fmt = (wei, d = 4) => {
  const n = Number(formatEther(wei ?? 0n));
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
};
export const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
export const errMsg = (e) => e?.reason || e?.shortMessage || e?.message || String(e);

export const STATUS = ["Funding", "Aktif", "Selesai", "Gagal"];
export const MSTATUS = ["Belum ada bukti", "Menunggu verifikasi", "Terverifikasi", "Ditolak"];
export const DEV_ROLES = { 1: "Petani x", 2: "Jovan", 3: "T Ronald", 4: "Investor a", 5: "Investor b", 6: "Investor c", 7: "Nelayan c" };

const WALLET_KEY = "kongsi.wallet";
const store = {
  get: () => { try { return localStorage.getItem(WALLET_KEY); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(WALLET_KEY, v) : localStorage.removeItem(WALLET_KEY); } catch {} },
};

const Ctx = createContext(null);
export const useKongsi = () => useContext(Ctx);

export function KongsiProvider({ children }) {
  const [cfg, setCfg] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [devIdx, setDevIdx] = useState(null);
  const [devAccounts, setDevAccounts] = useState([]);
  const [connectOpen, setConnectOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState(null);

  const readProvider = useMemo(() => new JsonRpcProvider(RPC), []);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    (async () => {
      const [abi, deps] = await Promise.all([
        fetch("/Kongsi.abi.json").then((r) => r.json()),
        fetch("/deployments.json").then((r) => r.json()),
      ]);
      const d = deps[NETWORK];
      if (!d) throw new Error(`Belum ada deployment untuk network "${NETWORK}"`);
      setCfg({ abi, address: d.address, chainId: d.chainId, deployTx: d.deployTx });
    })().catch((e) => setToast({ type: "err", msg: errMsg(e) }));
  }, []);

  useEffect(() => {
    if (!IS_LOCAL) return;
    readProvider.listAccounts().then((accs) => setDevAccounts(accs.map((a) => a.address))).catch(() => {});
  }, [readProvider]);

  // Akun demo Hardhat (hanya di localhost): tanpa MetaMask.
  const connectDev = useCallback(async (i) => {
    const s = await readProvider.getSigner(i);
    setSigner(s);
    setAccount(s.address);
    setDevIdx(i);
    store.set(`dev:${i}`);
    setConnectOpen(false);
  }, [readProvider]);

  const connectMetaMask = useCallback(async (silent = false) => {
    if (!window.ethereum) {
      if (!silent) setToast({ type: "err", msg: "MetaMask tidak ditemukan" });
      return;
    }
    const bp = new BrowserProvider(window.ethereum);
    if (silent) {
      const accs = await bp.send("eth_accounts", []);
      if (!accs.length) return;
    } else {
      await bp.send("eth_requestAccounts", []);
    }
    if (cfg?.chainId) {
      const chainId = "0x" + cfg.chainId.toString(16);
      try {
        await bp.send("wallet_switchEthereumChain", [{ chainId }]);
      } catch (e) {
        // 4902 = chain belum ada di MetaMask -> tambahkan (mis. Monad Testnet).
        const code = e?.code ?? e?.error?.code ?? e?.info?.error?.code;
        if (code === 4902 && !IS_LOCAL) {
          await bp.send("wallet_addEthereumChain", [{
            chainId,
            chainName: CHAIN_NAME,
            nativeCurrency: { name: SYM, symbol: SYM, decimals: 18 },
            rpcUrls: [RPC],
            blockExplorerUrls: [EXPLORER],
          }]);
        }
      }
    }
    const s = await new BrowserProvider(window.ethereum).getSigner();
    setSigner(s);
    setAccount(s.address);
    setDevIdx(null);
    store.set("mm");
    setConnectOpen(false);
  }, [cfg]);

  const disconnect = () => {
    setSigner(null);
    setAccount(null);
    setDevIdx(null);
    store.set(null);
  };

  // Pulihkan sesi wallet terakhir.
  useEffect(() => {
    if (!cfg) return;
    // Mode lokal: ?as=4 langsung masuk sebagai akun demo (berguna untuk demo/link cepat).
    const as = IS_LOCAL ? new URLSearchParams(window.location.search).get("as") : null;
    const saved = as ? `dev:${as}` : store.get();
    if (saved?.startsWith("dev:") && IS_LOCAL) connectDev(Number(saved.slice(4))).catch(() => {});
    else if (saved === "mm") connectMetaMask(true).catch(() => {});
  }, [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!window.ethereum?.on) return;
    const onChange = () => store.get() === "mm" && connectMetaMask(true).catch(() => {});
    window.ethereum.on("accountsChanged", onChange);
    return () => window.ethereum.removeListener?.("accountsChanged", onChange);
  }, [connectMetaMask]);

  useEffect(() => {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const reader = useMemo(() => (cfg ? new Contract(cfg.address, cfg.abi, readProvider) : null), [cfg, readProvider]);
  const writer = useMemo(() => (cfg && signer ? new Contract(cfg.address, cfg.abi, signer) : null), [cfg, signer]);

  const send = async (label, fn) => {
    if (!writer) {
      setConnectOpen(true);
      return false;
    }
    try {
      setToast({ type: "info", msg: `${label}…` });
      const tx = await fn(writer);
      const receipt = await tx.wait();
      setToast({ type: "ok", msg: `${label} berhasil`, tx: tx.hash });
      refresh();
      return receipt;
    } catch (e) {
      setToast({ type: "err", msg: errMsg(e) });
      return false;
    }
  };

  const value = {
    cfg, reader, writer, account, devIdx, devAccounts, connectDev, connectMetaMask, disconnect,
    connectOpen, setConnectOpen, query, setQuery, tick, refresh, send, toast, setToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Semua proyek beserta milestone-nya. */
export function useProjects() {
  const { reader, tick } = useKongsi();
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!reader) return;
    (async () => {
      const n = Number(await reader.projectCount());
      const list = await Promise.all(
        [...Array(n).keys()].map(async (id) => {
          const [p, ms] = await Promise.all([reader.getProject(id), reader.getMilestones(id)]);
          return { id, p, ms, verified: ms.filter((m) => Number(m.status) === 2).length };
        })
      );
      setData(list);
    })().catch(console.error);
  }, [reader, tick]);
  return data;
}
