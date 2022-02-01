import { ethers } from "hardhat";

export const zeroAddress = "0x0000000000000000000000000000000000000000";
export const zeroToken = ethers.utils.parseEther("0");
export const oneToken = ethers.utils.parseEther("1");
export const twoPointFiveTokens = ethers.utils.parseEther("2.5");
export const fiveTokens = ethers.utils.parseEther("5");
export const tenTokens = ethers.utils.parseEther("10");
export const fiveHundred = ethers.utils.parseEther("500");
export const thousandTokens = ethers.utils.parseEther("1000");

export const threePointThreeInPeriodTokens = ethers.utils.parseEther(
  "3.333333333333333333"
);
export const onePointSixInPeriodTokens = ethers.utils.parseEther(
  "1.666666666666666666"
);
export const shares = {
  zero: 0,
  twenty: 20,
  twentyFive: 25,
  fifty: 50,
  hundred: 100,
  hundredFifty: 150,
  twoHundred: 200,
};

export const getTimestamp = async () => {
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  return block.timestamp;
};

export const formatTokens = (amount: string) => {
  return ethers.utils.parseEther(amount);
};
