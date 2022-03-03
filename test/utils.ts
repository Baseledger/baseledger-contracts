import { ethers } from "hardhat";

export const zeroAddress = "0x0000000000000000000000000000000000000000";
export const zeroToken = ethers.utils.parseUnits("0", 8);
export const zeroPointOneToken = ethers.utils.parseUnits("0.1", 8);
export const oneToken = ethers.utils.parseUnits("1", 8);
export const twoPointFiveTokens = ethers.utils.parseUnits("2.5", 8);
export const fiveTokens = ethers.utils.parseUnits("5", 8);
export const tenTokens = ethers.utils.parseUnits("10", 8);
export const fiveHundred = ethers.utils.parseUnits("500", 8);
export const thousandTokens = ethers.utils.parseUnits("1000", 8);

export const threePointThreeInPeriodTokens = ethers.utils.parseUnits("3.33333333", 8);
export const onePointSixInPeriodTokens = ethers.utils.parseUnits("1.66666666", 8);
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
  return ethers.utils.parseUnits(amount, 8);
};
