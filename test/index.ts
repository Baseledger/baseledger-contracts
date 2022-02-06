import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { UBTSplitter, UBTMock } from "../typechain";
import { ContractFactory } from "@ethersproject/contracts";
import {
  tenTokens,
  zeroAddress,
  shares,
  getTimestamp,
  zeroToken,
  fiveTokens,
  threePointThreeInPeriodTokens,
  formatTokens,
} from "./utils";
import { Signer } from "ethers";

describe("UBTSplitter contract tests", () => {
  let UBTContract: UBTSplitter;
  let ubtMock: UBTMock;
  let UBTAddress: string;
  let ubtMockAddress: string;
  let accounts;
  let revenue1Address: string;
  let revenue2Address: string;
  let stakingAddress: string;
  let maliciousAccount: Signer;
  let nonExistentPayee: string;
  let tokenSenderAccount: Signer;
  let tokenSenderAddress: string;
  const baseledgervaloper = "Testing String";
  const firstDepositNonce = 1;

  const destinationAddress = "0x00f10566dD219F4cFb787858B9909A468131DC0B";

  before(async () => {
    accounts = await ethers.getSigners();
    revenue1Address = await accounts[0].getAddress();
    revenue2Address = await accounts[1].getAddress();
    stakingAddress = await accounts[2].getAddress();
    nonExistentPayee = await accounts[5].getAddress();

    tokenSenderAccount = await accounts[3];
    tokenSenderAddress = await accounts[3].getAddress();
    maliciousAccount = accounts[4];
  });

  beforeEach(async () => {
    const UBTFactory: ContractFactory = await hre.ethers.getContractFactory(
      "UBTSplitter"
    );
    const ubtMockFactory: ContractFactory = await hre.ethers.getContractFactory(
      "UBTMock"
    );
    ubtMock = (await ubtMockFactory.deploy()) as UBTMock;
    await ubtMock.deployed();
    ubtMockAddress = ubtMock.address;
    UBTContract = (await UBTFactory.deploy(ubtMockAddress)) as UBTSplitter;
    await UBTContract.deployed();
    UBTAddress = UBTContract.address;
    // Transfer tokens to account which will make a deposit to the contract through deposit
    await ubtMock.transfer(tokenSenderAddress, tenTokens);
  });

  context("For deposit function", async () => {
    it("Should not have any tokens to the contract", async () => {
      const contractBalance = await ubtMock.balanceOf(UBTAddress);
      expect(contractBalance).to.equal(zeroToken);
    });

    it("Should deposit tokens through deposit function, emit deposit event and check balance of contract", async () => {
      const accountBalance = await ubtMock.balanceOf(tokenSenderAddress);
      expect(accountBalance).to.equal(tenTokens);
      const tx = await ubtMock
        .connect(tokenSenderAccount)
        .approve(UBTAddress, tenTokens);
      await tx.wait();
      const allowance = await ubtMock.allowance(tokenSenderAddress, UBTAddress);
      expect(allowance).to.equal(tenTokens);
      expect(
        await UBTContract.connect(tokenSenderAccount).deposit(
          tenTokens,
          destinationAddress
        )
      )
        .to.emit(UBTContract, "UbtDeposited")
        .withArgs(
          tokenSenderAddress,
          ubtMockAddress,
          tenTokens,
          firstDepositNonce,
          destinationAddress
        );
      const contractBalance = await ubtMock.balanceOf(UBTAddress);
      expect(contractBalance).to.equal(tenTokens);
    });

    it("Should fail on transfer token with empty token destination address", async () => {
      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(tenTokens, "")
      ).to.be.revertedWith("string is empty");
    });

    it("Should fail on transfer zero token amount", async () => {
      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(
          zeroToken,
          destinationAddress
        )
      ).to.be.revertedWith("amount should be grater than zero");
    });
  });

  context("For adding validators", async () => {
    it("Should add validator with share", async () => {
      const timestamp = (await getTimestamp()) + 1;
      const depositNonce = (await UBTContract.lastEventNonce()).add(1);

      expect(
        await UBTContract.addPayee(
          revenue1Address,
          stakingAddress,
          shares.fifty,
          baseledgervaloper
        )
      )
        .to.emit(UBTContract, "PayeeAdded")
        .withArgs(
          revenue1Address,
          stakingAddress,
          shares.fifty,
          baseledgervaloper,
          depositNonce,
          timestamp
        );
      expect(await UBTContract.payees(revenue1Address)).to.equal(true);
      expect(await UBTContract.shares(revenue1Address)).to.equal(shares.fifty);
      expect(await UBTContract.totalShares()).to.equal(shares.fifty);
    });

    it("Should update totalShares when second validator added", async () => {
      await UBTContract.addPayee(
        revenue1Address,
        stakingAddress,
        shares.fifty,
        baseledgervaloper
      );
      await UBTContract.addPayee(
        revenue2Address,
        stakingAddress,
        shares.fifty,
        baseledgervaloper
      );
      expect(await UBTContract.totalShares()).to.equal(shares.hundred);
    });

    it("Should fail on add validator with zero revenue address", async () => {
      await expect(
        UBTContract.addPayee(
          zeroAddress,
          stakingAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("address is zero address");
    });

    it("Should fail on add validator with zero stakingAddress address", async () => {
      await expect(
        UBTContract.addPayee(
          revenue1Address,
          zeroAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("address is zero address");
    });

    it("Should fail on add validator with zero share", async () => {
      await expect(
        UBTContract.addPayee(
          revenue1Address,
          stakingAddress,
          shares.zero,
          baseledgervaloper
        )
      ).to.be.revertedWith("shares are 0");
    });

    it("Should fail on add validator with empty baseledgervaloper string", async () => {
      await expect(
        UBTContract.addPayee(revenue1Address, stakingAddress, shares.fifty, "")
      ).to.be.revertedWith("string is empty");
    });

    it("Should fail on add validator with already allocated share", async () => {
      await UBTContract.addPayee(
        revenue1Address,
        stakingAddress,
        shares.fifty,
        baseledgervaloper
      );
      await expect(
        UBTContract.addPayee(
          revenue1Address,
          stakingAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("revenueAddress already has shares");
    });

    it("Should fail if malicious account tries to add validator ", async () => {
      await expect(
        UBTContract.connect(maliciousAccount).addPayee(
          revenue1Address,
          stakingAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  context("For updating validators", async () => {
    beforeEach(async () => {
      await UBTContract.addPayee(
        revenue1Address,
        stakingAddress,
        shares.fifty,
        baseledgervaloper
      );
      await UBTContract.addPayee(
        revenue2Address,
        stakingAddress,
        shares.fifty,
        baseledgervaloper
      );
    });
    it("Should update validator with share", async () => {
      const timestamp = (await getTimestamp()) + 1;
      const depositNonce = (await UBTContract.lastEventNonce()).add(1);

      expect(
        await UBTContract.updatePayee(
          revenue1Address,
          stakingAddress,
          shares.hundred,
          baseledgervaloper
        )
      )
        .to.emit(UBTContract, "PayeeUpdated")
        .withArgs(
          revenue1Address,
          stakingAddress,
          shares.hundred,
          baseledgervaloper,
          depositNonce,
          timestamp
        );
      expect(await UBTContract.payees(revenue1Address)).to.equal(true);
      expect(await UBTContract.payees(revenue2Address)).to.equal(true);
      expect(await UBTContract.shares(revenue1Address)).to.equal(
        shares.hundred
      );
      expect(await UBTContract.totalShares()).to.equal(shares.hundredFifty);
    });

    it("Should update totalShares when second validator added", async () => {
      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.hundred,
        baseledgervaloper
      );
      await UBTContract.updatePayee(
        revenue2Address,
        stakingAddress,
        shares.hundred,
        baseledgervaloper
      );
      expect(await UBTContract.totalShares()).to.equal(shares.twoHundred);
    });

    it("Should update validator with zero share", async () => {
      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.zero,
        baseledgervaloper
      );
      expect(await UBTContract.shares(revenue1Address)).to.equal(shares.zero);
    });

    it("Should fail on update validator with zero revenue address", async () => {
      await expect(
        UBTContract.updatePayee(
          zeroAddress,
          stakingAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("address is zero address");
    });

    it("Should fail on update validator with zero staking address", async () => {
      await expect(
        UBTContract.updatePayee(
          revenue1Address,
          zeroAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("address is zero address");
    });

    it("Should fail on update validator with empty baseledgervaloper string", async () => {
      await expect(
        UBTContract.updatePayee(
          revenue1Address,
          stakingAddress,
          shares.fifty,
          ""
        )
      ).to.be.revertedWith("string is empty");
    });

    it("Should fail if malicious account tries to update validator ", async () => {
      await expect(
        UBTContract.connect(maliciousAccount).updatePayee(
          revenue1Address,
          stakingAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if payee does not exist", async () => {
      await expect(
        UBTContract.updatePayee(
          nonExistentPayee,
          stakingAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("payee does not exist");
    });
  });

  context("For release funds for validators", async () => {
    beforeEach(async () => {
      await UBTContract.addPayee(
        revenue1Address,
        stakingAddress,
        shares.fifty,
        baseledgervaloper
      );
      await UBTContract.addPayee(
        revenue2Address,
        stakingAddress,
        shares.fifty,
        baseledgervaloper
      );
      const tx = await ubtMock
        .connect(tokenSenderAccount)
        .approve(UBTAddress, tenTokens);
      await tx.wait();
      await UBTContract.connect(tokenSenderAccount).deposit(
        tenTokens,
        destinationAddress
      );
    });

    it("Should release amount of tokens based on share with equal shares", async () => {
      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        fiveTokens
      );
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        fiveTokens
      );
    });

    it("Should release amount of tokens based on share with equal shares after 3rd payee is added", async () => {
      // 2 payees and 10 ubt deposited
      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);
      // after release they each have 5 ubt
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        fiveTokens
      );
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        fiveTokens
      );
      accounts = await ethers.getSigners();
      const revenue3Address = await accounts[3].getAddress();

      // 3rd payee added
      await UBTContract.addPayee(
        revenue3Address,
        stakingAddress,
        shares.fifty,
        "baseledgervaloper123"
      );

      // send 10 more tokens to tokenSenderAddress so he can deposit 10 more
      await ubtMock.transfer(tokenSenderAddress, tenTokens);
      const tx = await ubtMock
        .connect(tokenSenderAccount)
        .approve(UBTAddress, tenTokens);
      await tx.wait();
      await UBTContract.connect(tokenSenderAccount).deposit(
        tenTokens,
        destinationAddress
      );

      // all 3 release again
      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);
      await UBTContract.release(revenue3Address);

      // check total released for all 3, first 2 should have 5 more than 3rd one
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        fiveTokens.add(threePointThreeInPeriodTokens)
      );

      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        fiveTokens.add(threePointThreeInPeriodTokens)
      );

      expect(await UBTContract.ubtReleased(revenue3Address)).to.equal(
        threePointThreeInPeriodTokens
      );
    });

    it("Should update share and release the right amount of tokens", async () => {
      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );
      await UBTContract.release(revenue1Address);
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        threePointThreeInPeriodTokens
      );
    });

    it("Should release token, update share, send new token amount and then release right amount of tokens", async () => {
      await UBTContract.release(revenue1Address);

      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );

      // send 10 more tokens to tokenSenderAddress so he can deposit 10 more
      await ubtMock.transfer(tokenSenderAddress, tenTokens);
      const tx = await ubtMock
        .connect(tokenSenderAccount)
        .approve(UBTAddress, tenTokens);
      await tx.wait();
      await UBTContract.connect(tokenSenderAccount).deposit(
        tenTokens,
        destinationAddress
      );

      await UBTContract.release(revenue1Address);

      // only first one released before updatePayee was called
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        fiveTokens.add(fiveTokens)
      );
      expect(await UBTContract.ubtTotalReleased()).to.equal(
        fiveTokens.add(fiveTokens)
      );
    });

    it("Should BOTH release token, update share, send new token amount and then BOTH release right amount of tokens", async () => {
      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        fiveTokens
      );

      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        fiveTokens
      );

      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );

      // send 10 more tokens to tokenSenderAddress so he can deposit 10 more
      await ubtMock.transfer(tokenSenderAddress, tenTokens);
      const tx = await ubtMock
        .connect(tokenSenderAccount)
        .approve(UBTAddress, tenTokens);
      await tx.wait();
      await UBTContract.connect(tokenSenderAccount).deposit(
        tenTokens,
        destinationAddress
      );

      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);

      // since they both released in correct order, update payee is reflected on follow up release
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        fiveTokens.add(threePointThreeInPeriodTokens)
      );
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        fiveTokens
          .add(threePointThreeInPeriodTokens)
          .add(threePointThreeInPeriodTokens)
      );
    });

    it("Should emit event, when release function is called", async () => {
      expect(await UBTContract.release(revenue1Address))
        .to.emit(UBTContract, "UbtPaymentReleased")
        .withArgs(ubtMockAddress, revenue1Address, stakingAddress, fiveTokens);
    });

    it("Should fail on try to release on validator without share", async () => {
      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.zero,
        baseledgervaloper
      );
      await expect(UBTContract.release(revenue1Address)).to.be.revertedWith(
        "revenueAddress has no shares"
      );
    });

    it("Should fail on try to release on validator without due payment", async () => {
      await UBTContract.release(revenue1Address);
      await expect(UBTContract.release(revenue1Address)).to.be.revertedWith(
        "revenueAddress is not due payment"
      );
    });
  });

  context("For release funds for validators with no equal shares", async () => {
    beforeEach(async () => {
      // set up 60/40 shares
      await UBTContract.addPayee(
        revenue1Address,
        stakingAddress,
        shares.twenty * 3,
        baseledgervaloper
      );
      await UBTContract.addPayee(
        revenue2Address,
        stakingAddress,
        shares.twenty * 2,
        baseledgervaloper
      );
      // start with 50 ubt deposited from account with 100 ubt
      await ubtMock.transfer(tokenSenderAddress, formatTokens("100"));
      const tx = await ubtMock
        .connect(tokenSenderAccount)
        .approve(UBTAddress, formatTokens("100"));
      await tx.wait();
      await UBTContract.connect(tokenSenderAccount).deposit(
        formatTokens("50"),
        destinationAddress
      );
    });

    it("Should release amount of tokens based on not equal shares", async () => {
      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("30")
      );
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("20")
      );
    });

    it("Should release amount of tokens based on share with equal shares after 3rd payee is added", async () => {
      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);

      accounts = await ethers.getSigners();
      const revenue3Address = await accounts[3].getAddress();

      // 3rd payee added
      await UBTContract.addPayee(
        revenue3Address,
        stakingAddress,
        shares.twenty,
        "baseledgervaloper123"
      );

      // deposit 20 more ubt
      await UBTContract.connect(tokenSenderAccount).deposit(
        formatTokens("20"),
        destinationAddress
      );

      // all 3 release again
      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);
      await UBTContract.release(revenue3Address);

      // first got 30 in first release, 10 in second (60 * 20 / 120)
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("40")
      );

      // second got 20 in first release, 6.6666... in second (40 * 20 / 120)
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("26.666666666666666666")
      );

      // third got only 3.333... in second release (20 * 20 / 120)
      expect(await UBTContract.ubtReleased(revenue3Address)).to.equal(
        threePointThreeInPeriodTokens
      );
    });

    it("Should update share and release the right amount of tokens after 2 deposits", async () => {
      // set shares to 60/20, 50 ubt deposited
      await UBTContract.updatePayee(
        revenue2Address,
        stakingAddress,
        shares.twenty,
        baseledgervaloper
      );
      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("37.5")
      );

      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("12.5")
      );

      // deposit 20 more ubt and release again to make sure those 20 are correctly split as well
      await UBTContract.connect(tokenSenderAccount).deposit(
        formatTokens("20"),
        destinationAddress
      );

      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("52.5")
      );
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("17.5")
      );
    });

    it("Should release token, update share, send new token amount and then release right amount of tokens", async () => {
      // only first one release and then update happens before 2nd one releases, 50 deposited
      await UBTContract.release(revenue1Address);

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("30")
      );

      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("0")
      );

      await UBTContract.updatePayee(
        revenue2Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );

      // deposit 20 more ubt and release again
      await UBTContract.connect(tokenSenderAccount).deposit(
        formatTokens("20"),
        destinationAddress
      );

      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);

      // because only first released before update, 20 unreleased ubts remained,
      // so now 40 ubts are splitted with 60/25 shares

      // 30 + 60 * 40 / 85
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("58.235294117647058823")
      );

      // 0 + 25 * 40 / 85
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("11.764705882352941176")
      );
    });

    it("Should BOTH release token, update share, send new token amount and then BOTH release right amount of tokens", async () => {
      // both releases, 50 deposited, 60/40 shares
      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("30")
      );

      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("20")
      );

      await UBTContract.updatePayee(
        revenue2Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );

      // deposit 20 more ubt and release again
      await UBTContract.connect(tokenSenderAccount).deposit(
        formatTokens("20"),
        destinationAddress
      );

      await UBTContract.release(revenue1Address);
      await UBTContract.release(revenue2Address);

      // both released, now only 20 deposited are split according to new shares 60/25

      // 30 + 60 * 20 / 85
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("44.117647058823529411")
      );

      // 20 + 25 * 20 / 85
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("25.882352941176470588")
      );
    });
  });
});
