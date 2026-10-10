require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const pk = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const accounts = pk ? [pk.startsWith("0x") ? pk : `0x${pk}`] : [];

module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true } },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    monadTestnet: {
      url: process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts,
    },
  },
  // Verifikasi kontrak di explorer Monad (MonadVision) via Sourcify:
  //   npx hardhat verify --network monadTestnet <ALAMAT_KONTRAK>
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://testnet.monadvision.com",
  },
  etherscan: { enabled: false },
};
