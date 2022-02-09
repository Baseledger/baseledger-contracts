import hre from "hardhat";
import { ContractFactory } from "ethers";
import { BaseledgerUBTSplitter } from "../typechain";

export async function deployContracts(ubtTokenContractAddress: string) {
  await hre.run("compile");
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log(
    `Account balance: ${(await deployer.getBalance()).toString()} \n`
  );

  const BaseledgerUBTSplitterFactory: ContractFactory =
    await hre.ethers.getContractFactory("BaseledgerUBTSplitter");

  const BaseledgerUBTSplitter = (await BaseledgerUBTSplitterFactory.deploy(
    ubtTokenContractAddress
  )) as BaseledgerUBTSplitter;
  await BaseledgerUBTSplitter.deployed();
  console.log(
    `Unibright contract deployed at: ${BaseledgerUBTSplitter.address}`
  );
}
