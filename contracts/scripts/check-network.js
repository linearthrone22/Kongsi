// Cek koneksi & saldo deployer sebelum deploy: npx hardhat run scripts/check-network.js --network monadTestnet
const { ethers, network } = require("hardhat");

async function main() {
  const net = await ethers.provider.getNetwork();
  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("DEPLOYER_PRIVATE_KEY belum di-set di .env");
  const bal = await ethers.provider.getBalance(signer.address);
  console.log(`Network ${network.name} · chainId ${net.chainId} · block ${await ethers.provider.getBlockNumber()}`);
  console.log(`Deployer ${signer.address} · saldo ${ethers.formatEther(bal)} MON`);
  if (bal === 0n) console.log("⚠ Saldo 0 — isi dulu dari faucet Monad testnet.");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
