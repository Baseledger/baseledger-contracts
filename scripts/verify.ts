import hre from "hardhat";

export async function verifyContracts(
  contractAddress: string,
  token: string
): Promise<void> {
  // verify BaseledgerUBTSplitter contract
  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [token],
    });
  } catch (error: any) {
    logError("BaseledgerUBTSplitter", error.message);
  }
}

function logError(contractName: string, msg: string) {
  console.log(
    `\x1b[31mError while trying to verify contract: ${contractName}!`
  );
  console.log(`Error message: ${msg}`);
  resetConsoleColor();
}

function resetConsoleColor() {
  console.log("\x1b[0m");
}
