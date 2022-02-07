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
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      chainId: 4,
      accounts: [
        "b7a433ab23c96f64d6a5c29fb9bd6c0fcfdcb0f011fa7e996e4768cff6b7c469",
        "330912a17ad3767738b1b93d968ded600ddbf72bd34ab4414c318f3456de9ec3",
        "b4fe46532de49ff6cfcd54bf2e84b474ac970d613fef6e27a6ed75a54ed8c0d2",
        "8f08f9d354c1a518864c62781cdb1dd7e1d956be72f7c929a24f655b318d5b92",
      ],
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
