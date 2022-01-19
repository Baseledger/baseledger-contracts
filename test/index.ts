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
      expect(await UBTContract.payees(0)).to.equal(validator1Address);
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
      const timestamp = (await getTimestamp()) +1;

      expect(await UBTContract.updatePayee(validator1Address, shares.hundred))
        .to.emit(UBTContract, "PayeeUpdated")
        .withArgs(validator1Address, shares.hundred, timestamp);
      expect(await UBTContract.payees(0)).to.equal(validator1Address);
      expect(await UBTContract.payees(1)).to.equal(validator2Address);
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