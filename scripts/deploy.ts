import hre from "hardhat";
import { ContractFactory } from "ethers";
import { UBTSplitter } from "../typechain";

export async function deployContracts(whitelistedToken: string) {
  await hre.run("compile");
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    `Account balance: ${(await deployer.getBalance()).toString()} \n`
  );

  const UBTSplitterFactory: ContractFactory =
    await hre.ethers.getContractFactory("UBTSplitter");

  const UBTSplitter = (await UBTSplitterFactory.deploy(
    whitelistedToken
  )) as UBTSplitter;
  await UBTSplitter.deployed();
  console.log(`Unibright contract deployed at: ${UBTSplitter.address}`);
}
