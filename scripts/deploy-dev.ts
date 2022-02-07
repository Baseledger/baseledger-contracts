import hre from "hardhat";
import { ContractFactory } from "ethers";
import { UBTSplitter, UBTMock } from "../typechain";

// deploy both mock erc20 and ubt splitter contracts for development purpose
export async function deployContractsDev() {
  await hre.run("compile");
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    `Account balance: ${(await deployer.getBalance()).toString()} \n`
  );

  const UBTMockFactory: ContractFactory = await hre.ethers.getContractFactory(
    "UBTMock"
  );

  const UBTMock = (await UBTMockFactory.deploy()) as UBTMock;
  await UBTMock.deployed();

  console.log(`UBT Mock erc20 contract deployed at ${UBTMock.address}`);

  const UBTSplitterFactory: ContractFactory =
    await hre.ethers.getContractFactory("UBTSplitter");

  const UBTSplitter = (await UBTSplitterFactory.deploy(
    UBTMock.address
  )) as UBTSplitter;
  await UBTSplitter.deployed();
  console.log(`Unibright contract deployed at: ${UBTSplitter.address}`);
}
