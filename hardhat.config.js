import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";
import verifyPlugin from "@nomicfoundation/hardhat-verify";

export default {
  plugins: [verifyPlugin],
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  paths: {
    tests: "./test",
  },
  mocha: {
    timeout: 40000,
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    sepolia: {
      type: "http",
      url: process.env.ALCHEMY_SEPOLIA_URL,
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : []
    }
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_KEY,
      apiUrl: "https://api.etherscan.io/v2/api"
    }
  }
};
