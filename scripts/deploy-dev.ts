import hre from "hardhat";
import { ContractFactory } from "ethers";
import { BaseledgerUBTSplitter, UBTMock } from "../typechain";

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

  const BaseledgerUBTSplitterFactory: ContractFactory =
    await hre.ethers.getContractFactory("BaseledgerUBTSplitter");

  const BaseledgerUBTSplitter = (await BaseledgerUBTSplitterFactory.deploy(
    UBTMock.address
  )) as BaseledgerUBTSplitter;
  await BaseledgerUBTSplitter.deployed();
  console.log(
    `Unibright contract deployed at: ${BaseledgerUBTSplitter.address}`
  );

  console.log(`Approving 100 tokens for dev purpose to ${deployer.address}`);
  await UBTMock.approve(BaseledgerUBTSplitter.address, 100);
}
