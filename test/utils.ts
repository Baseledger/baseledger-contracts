import hre, { ethers } from "hardhat";

export const zeroAddress = "0x0000000000000000000000000000000000000000";
export const oneEther = ethers.utils.parseEther("1");
export const tenTokens = ethers.utils.parseEther("10");
export const shares = {
  zero: 0,
  fifty: 50,
  hundred: 100,
  hundredFifty: 150,
  twoHundred: 200
};

export const getTimestamp = async () => {
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  return block.timestamp;
};
