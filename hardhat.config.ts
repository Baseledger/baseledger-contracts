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

task("deploy-contracts", "Deploys contracts")
  .addParam("token", "The token's address")
  .setAction(async (taskArgs) => {
    const { deployContracts } = await lazyImport("./scripts/deploy");
    await deployContracts(taskArgs.token);
  });

task("deploy-contracts-dev", "Deploys contracts for development").setAction(
  async () => {
    const { deployContractsDev } = await lazyImport("./scripts/deploy-dev");
    await deployContractsDev();
  }
);

task("verify-contracts", "Verifies contracts")
  .addParam("contract", "The contract's address")
  .addParam("token", "The token's address")
  .setAction(async (taskArgs) => {
    const { verifyContracts } = await lazyImport("./scripts/verify");
    await verifyContracts(taskArgs.contract, taskArgs.token);
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
