import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { UBTSplitter, UBTMock } from "../typechain";
import { ContractFactory } from "@ethersproject/contracts";
import {
  oneEther,
  tenTokens,
  zeroAddress,
  shares,
  getTimestamp,
} from "./utils";
import { Signer } from "ethers";

describe.only("UBTSplitter contract tests", () => {
  let UBTContract: UBTSplitter;
  let mockERC20: UBTMock;
  let UBTAddress: string;
  let mockERC20Address: string;
  let accounts;
  let validator1Address: string;
  let validator2Address: string;
  let maliciousAccount: Signer;

  before(async () => {
    accounts = await ethers.getSigners();
    validator1Address = await accounts[0].getAddress();
    validator2Address = await accounts[1].getAddress();
    maliciousAccount = accounts[9];
  });

  beforeEach(async () => {
    const UBTFactory: ContractFactory = await hre.ethers.getContractFactory(
      "UBTSplitter"
    );
    const mockERC20Factory: ContractFactory =
      await hre.ethers.getContractFactory("UBTMock");
    UBTContract = (await UBTFactory.deploy()) as UBTSplitter;
    mockERC20 = (await mockERC20Factory.deploy()) as UBTMock;
    await UBTContract.deployed();
    await mockERC20.deployed();
    UBTAddress = UBTContract.address;
    mockERC20Address = mockERC20.address;
    await mockERC20.transfer(UBTAddress, tenTokens);
  });

  context("For transferring proper value of tokens", async () => {
    it("Should have 10 Tokens", async () => {
      const contractBalance = await mockERC20.balanceOf(UBTAddress);
      expect(contractBalance).to.equal(tenTokens);
    });
  });

  context("For adding validators", async () => {
    it("Should add validator with share", async () => {
      const timestamp = (await getTimestamp()) + 1;

      expect(await UBTContract.addPayee(validator1Address, shares.fifty))
        .to.emit(UBTContract, "PayeeAdded")
        .withArgs(validator1Address, shares.fifty, timestamp);
      expect(await UBTContract.payee(0)).to.equal(validator1Address);
      expect(await UBTContract.shares(validator1Address)).to.equal(
        shares.fifty
      );
      expect(await UBTContract.timestamps(validator1Address)).to.equal(
        timestamp
      );
      expect(await UBTContract.totalShares()).to.equal(shares.fifty);
    });

    it("Should update totalShares when second validator added", async () => {
      await UBTContract.addPayee(validator1Address, shares.fifty);
      await UBTContract.addPayee(validator2Address, shares.fifty);
      expect(await UBTContract.totalShares()).to.equal(shares.hundred);
    });

    it("Should fail on add validator with zero address", async () => {
      await expect(
        UBTContract.addPayee(zeroAddress, shares.fifty)
      ).to.be.revertedWith("UBTSplitter: account is the zero address");
    });

    it("Should fail on add validator with zero share", async () => {
      await expect(
        UBTContract.addPayee(validator1Address, shares.zero)
      ).to.be.revertedWith("UBTSplitter: shares are 0");
    });

    it("Should fail on add validator with already allocated share", async () => {
      await UBTContract.addPayee(validator1Address, shares.fifty);
      await expect(
        UBTContract.addPayee(validator1Address, shares.fifty)
      ).to.be.revertedWith("UBTSplitter: account already has shares");
    });

    it("Should fail if malicious account tries to add validator ", async () => {
      await expect(
        UBTContract.connect(maliciousAccount).addPayee(
          validator1Address,
          shares.fifty
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  context("For updating validators", async () => {
    beforeEach(async () => {
      await UBTContract.addPayee(validator1Address, shares.fifty);
      await UBTContract.addPayee(validator2Address, shares.fifty);
    })
    it("Should update validator with share", async () => {
      const timestamp = (await getTimestamp()) + 1;

      expect(await UBTContract.updatePayee(validator1Address, shares.hundred))
        .to.emit(UBTContract, "PayeeUpdated")
        .withArgs(validator1Address, shares.hundred, timestamp);
      expect(await UBTContract.payee(0)).to.equal(validator1Address);
      expect(await UBTContract.payee(1)).to.equal(validator2Address);
      expect(await UBTContract.shares(validator1Address)).to.equal(
        shares.hundred
      );
      expect(await UBTContract.timestamps(validator1Address)).to.equal(
        timestamp
      );
      expect(await UBTContract.totalShares()).to.equal(shares.hundredFifty);
    });

    it("Should update totalShares when second validator added", async () => {
      await UBTContract.updatePayee(validator1Address, shares.hundred);
      await UBTContract.updatePayee(validator2Address, shares.hundred);
      expect(await UBTContract.totalShares()).to.equal(shares.twoHundred);
    });

    it("Should update validator with zero share", async () => {
      await UBTContract.updatePayee(validator1Address, shares.zero)
      expect(await UBTContract.shares(validator1Address)).to.equal(shares.zero);
    });

    it("Should fail on update validator with zero address", async () => {
      await expect(
        UBTContract.updatePayee(zeroAddress, shares.fifty)
      ).to.be.revertedWith("UBTSplitter: account is the zero address");
    });

    it("Should fail if malicious account tries to update validator ", async () => {
      await expect(
        UBTContract.connect(maliciousAccount).updatePayee(
          validator1Address,
          shares.fifty
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});

// async function setupSigners() {
//   const accounts = await ethers.getSigners();
//   const account = accounts[0]

//   return { accounts, account }
// }

// describe("March Madness tests", function () {
//   let UBTContract: UBTSplitter;
//   let UBTAddress: string;

//   beforeEach(async function () {
//     const UBTFactory: ContractFactory =
//       await hre.ethers.getContractFactory("UBTSplitter");
//     UBTContract = (await UBTFactory.deploy()) as UBTSplitter;
//     await UBTContract.deployed();
//     UBTAddress = UBTContract.address;
//   });

//   it.only("should deploy MarchMadness contract", async function () {
//     const { accounts, account } = await setupSigners();
//     const account1 = accounts[1];
//     const account2 = accounts[2];
//     const account1Address = await account1.getAddress();
//     const account2Address = await account2.getAddress();

//     expect(UBTAddress).to.not.equal(zeroAddress);
//     // Send 1 ether to an ens name.
//     await account.sendTransaction({
//       to: UBTAddress,
//       value: oneEther,
//     });

//     let value = await account.provider?.getBalance(UBTAddress);

//     console.log("balance: ", value?.toString());

//     await UBTContract.addPayee(account1Address, 50);
//     await UBTContract.addPayee(account2Address, 50);

//     const share = await UBTContract.shares(account1Address);
//     console.log("Share of address: ", share.toString());
//     let totalReleased = await UBTContract["totalReleased()"]();
//     console.log("TOTAL released: ", totalReleased.toString());
//     let totalShares = await UBTContract.totalShares();
//     console.log("TOTAL SHARES: ", totalShares.toString());

//     await UBTContract["release(address)"](account1Address);
//     totalReleased = await UBTContract["totalReleased()"]();
//     console.log(
//       "TOTAL released 1: ",
//       ethers.utils.formatEther(totalReleased.toString())
//     );

//     await account.sendTransaction({
//       to: UBTAddress,
//       value: oneEther,
//     });

//     value = await account.provider?.getBalance(UBTAddress);
//     console.log("balance 2: ", value?.toString());

//     await UBTContract.updatePayee(account1Address, 25);
//     totalShares = await UBTContract.totalShares();
//     console.log("TOTAL SHARES 2: ", totalShares.toString());

//     await UBTContract["release(address)"](account1Address);
//     totalReleased = await UBTContract["totalReleased()"]();
//     console.log(
//       "TOTAL released 2: ",
//       ethers.utils.formatEther(totalReleased.toString())
//     );
//   });

//   it("should deploy MarchMadness contract", async function () {
//     const { accounts, account } = await setupSigners();
//     const account1 = accounts[1];
//     const account1Address = await account1.getAddress();

//     expect(UBTAddress).to.not.equal(zeroAddress);
//     // Send 1 ether to an ens name.
//     await account.sendTransaction({
//       to: UBTAddress,
//       value: oneEther,
//     });

//     const value = await account.provider?.getBalance(UBTAddress);

//     console.log("balance: ", value?.toString());

//     await UBTContract.addPayee(account1Address, 50);

//     const share = await UBTContract.shares(account1Address);
//     console.log("Share of address: ", share.toString());
//     let totalReleased = await UBTContract["totalReleased()"]();
//     console.log("TOTAL released: ", totalReleased.toString());
//     const totalShares = await UBTContract.totalShares();
//     console.log("TOTAL SHARES: ", totalShares.toString());

//     await UBTContract["release(address)"](account1Address);
//     totalReleased = await UBTContract["totalReleased()"]();
//     console.log(
//       "TOTAL released 1: ",
//       ethers.utils.formatEther(totalReleased.toString())
//     );
//   });

//   it("ADD 200 shares to contract", async function () {
//     const { accounts, account } = await setupSigners();
//     const account1 = accounts[1];
//     const account1Address = await account1.getAddress();

//     const account2 = accounts[2];
//     const account2Address = await account2.getAddress();

//     const account3 = accounts[3];
//     const account3Address = await account3.getAddress();

//     const account4 = accounts[4];
//     const account4Address = await account4.getAddress();

//     expect(UBTAddress).to.not.equal(zeroAddress);
//     // Send 1 ether to an ens name.
//     await account.sendTransaction({
//       to: UBTAddress,
//       value: oneEther,
//     });

//     const value = await account.provider?.getBalance(UBTAddress);

//     console.log("balance: ", value?.toString());

//     await UBTContract.addPayee(account1Address, 50);
//     await UBTContract.addPayee(account2Address, 50);
//     await UBTContract.addPayee(account3Address, 50);
//     await UBTContract.addPayee(account4Address, 50);

//     const share = await UBTContract.shares(account1Address);
//     console.log("Share of address: ", share.toString());
//     let totalReleased = await UBTContract["totalReleased()"]();
//     console.log("TOTAL released: ", totalReleased.toString());
//     const totalShares = await UBTContract.totalShares();
//     console.log("TOTAL SHARES: ", totalShares.toString());

//     await UBTContract["release(address)"](account1Address);
//     totalReleased = await UBTContract["totalReleased()"]();
//     console.log(
//       "TOTAL released 1: ",
//       ethers.utils.formatEther(totalReleased.toString())
//     );
//   });
// });
