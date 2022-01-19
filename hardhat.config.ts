import * as dotenv from "dotenv";
import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

const lazyImport = async (module: any) => {
  return await import(module);
};

task("deploy-contracts", "Deploys contracts").setAction(async () => {
  const { deployContracts } = await lazyImport("./scripts/deploy");
  await deployContracts();
});

task("verify-contracts", "Verifies contracts").setAction(async () => {
  const { verifyContracts } = await lazyImport("./scripts/verify");
  await verifyContracts();
});

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  defaultNetwork: "hardhat",
  networks: {
    coverage: {
      url: "http://localhost:8545",
    },
    localhost: {
      url: "http://localhost:8545",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
