const { ethers, network, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "..", "..", "web", "public");

async function main() {
  const [deployer] = await ethers.getSigners();
  const k = await ethers.deployContract("Kongsi");
  await k.waitForDeployment();
  const address = await k.getAddress();
  const tx = k.deploymentTransaction();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`Kongsi deployed to ${address} on ${network.name} (chain ${chainId}) by ${deployer.address}`);
  console.log(`Deploy tx: ${tx.hash}`);

  const art = await artifacts.readArtifact("Kongsi");
  fs.mkdirSync(PUBLIC, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, "Kongsi.abi.json"), JSON.stringify(art.abi, null, 2));

  const file = path.join(PUBLIC, "deployments.json");
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  all[network.name] = { address, chainId, deployTx: tx.hash };
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
