import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { BaseledgerUBTSplitter, UBTMock } from "../typechain";
import { ContractFactory } from "@ethersproject/contracts";
import {
  tenTokens,
  zeroAddress,
  shares,
  zeroToken,
  zeroPointOneToken,
  fiveTokens,
  threePointThreeInPeriodTokens,
  formatTokens,
  oneToken,
  twoPointFiveTokens,
} from "./utils";
import { Signer } from "ethers";

describe("BaseledgerUBTSplitter contract tests", () => {
  let UBTContract: BaseledgerUBTSplitter;
  let ubtMock: UBTMock;
  let UBTAddress: string;
  let ubtMockAddress: string;
  let accounts;
  let revenue1Address: string;
  let revenue1Account: Signer;
  let revenue2Address: string;
  let revenue2Account: Signer;
  let revenue3Address: string;
  let revenue3Account: Signer;
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
    revenue1Account = await accounts[0];
    revenue2Address = await accounts[1].getAddress();
    revenue2Account = await accounts[1];
    revenue3Address = await accounts[3].getAddress();
    revenue3Account = await accounts[3];
    stakingAddress = await accounts[2].getAddress();
    nonExistentPayee = await accounts[5].getAddress();

    tokenSenderAccount = await accounts[3];
    tokenSenderAddress = await accounts[3].getAddress();
    maliciousAccount = accounts[4];
  });

  beforeEach(async () => {
    const UBTFactory: ContractFactory = await hre.ethers.getContractFactory(
      "BaseledgerUBTSplitter"
    );
    const ubtMockFactory: ContractFactory = await hre.ethers.getContractFactory(
      "UBTMock"
    );
    ubtMock = (await ubtMockFactory.deploy()) as UBTMock;
    await ubtMock.deployed();
    ubtMockAddress = ubtMock.address;
    UBTContract = (await UBTFactory.deploy(
      ubtMockAddress
    )) as BaseledgerUBTSplitter;
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

    it("Should have min deposit set to 1 UBT initialy", async () => {
      const minDeposit = await UBTContract.minDeposit();
      expect(minDeposit).to.equal(oneToken);
    });

    it("Should change min deposit through changeMinDeposit", async () => {
      const tx = await UBTContract.changeMinDeposit(fiveTokens);
      await tx.wait();

      const minDeposit = await UBTContract.minDeposit();
      expect(minDeposit).to.equal(fiveTokens);
    });

    it("Should fail on changeMinDeposit to zero", async () => {
      await expect(UBTContract.changeMinDeposit(zeroToken)).to.be.revertedWith(
        "min deposit must be > 0"
      );
    });

    it("Should fail if malicious account tries to changeMinDeposit ", async () => {
      await expect(
        UBTContract.connect(maliciousAccount).changeMinDeposit(zeroToken)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail on transfering zero token amount", async () => {
      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(
          zeroToken,
          destinationAddress
        )
      ).to.be.revertedWith("amount should be above min deposit");
    });

    it("Should fail on transfer less than min deposit amount", async () => {
      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(
          zeroPointOneToken,
          destinationAddress
        )
      ).to.be.revertedWith("amount should be above min deposit");
    });

    it("Should fail on transfer less than min deposit amount, after min deposit has been changed", async () => {
      const tx = await UBTContract.changeMinDeposit(fiveTokens);
      await tx.wait();

      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(
          twoPointFiveTokens,
          destinationAddress
        )
      ).to.be.revertedWith("amount should be above min deposit");
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
          ubtMockAddress,
          tokenSenderAddress,
          destinationAddress,
          tenTokens,
          firstDepositNonce
        );
      const contractBalance = await ubtMock.balanceOf(UBTAddress);
      expect(contractBalance).to.equal(tenTokens);
    });

    it("Should fail on transfer token with empty token destination address", async () => {
      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(tenTokens, "")
      ).to.be.revertedWith("string is empty");
    });
  });

  context("For adding validators", async () => {
    it("Should add validator with share", async () => {
      const depositNonce = (await UBTContract.lastEventNonce()).add(1);

      expect(
        await UBTContract.addPayee(
          revenue1Address,
          stakingAddress,
          shares.fifty,
          baseledgervaloper
        )
      )
        .to.emit(UBTContract, "PayeeUpdated")
        .withArgs(
          ubtMockAddress,
          revenue1Address,
          baseledgervaloper,
          shares.fifty,
          depositNonce
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
      ).to.be.revertedWith("payee already exists");
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
          ubtMockAddress,
          revenue1Address,
          baseledgervaloper,
          shares.hundred,
          depositNonce
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
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        fiveTokens
      );
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        fiveTokens
      );
    });

    it("Should not release if sender is not payee", async () => {
      await expect(
        UBTContract.connect(maliciousAccount).release()
      ).to.be.revertedWith("msg.sender is not payee");
    });

    it("Should not release if sender has no shares", async () => {
      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.zero,
        baseledgervaloper
      );
      await expect(
        UBTContract.connect(revenue1Account).release()
      ).to.be.revertedWith("msg.sender has no shares");
    });

    it("Should release amount of tokens based on share with equal shares after 3rd payee is added", async () => {
      // 2 payees and 10 ubt deposited
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();
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
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();
      await UBTContract.connect(revenue3Account).release();

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
      await UBTContract.connect(revenue1Account).release();
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        threePointThreeInPeriodTokens
      );
    });

    it("Should release token, update share, send new token amount and then release right amount of tokens", async () => {
      await UBTContract.connect(revenue1Account).release();

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

      await UBTContract.connect(revenue1Account).release();

      // only first one released before updatePayee was called
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        fiveTokens.add(fiveTokens)
      );
      expect(await UBTContract.ubtTotalReleased()).to.equal(
        fiveTokens.add(fiveTokens)
      );
    });

    it("Should BOTH release token, update share, send new token amount and then BOTH release right amount of tokens", async () => {
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

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

      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

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
      expect(await UBTContract.connect(revenue1Account).release())
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
      await expect(
        UBTContract.connect(revenue1Account).release()
      ).to.be.revertedWith("msg.sender has no shares");
    });

    it("Should fail on try to release on validator without due payment", async () => {
      await UBTContract.connect(revenue1Account).release();
      await expect(
        UBTContract.connect(revenue1Account).release()
      ).to.be.revertedWith("msg.sender is not due payment");
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
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("30")
      );
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("20")
      );
    });

    it("Should release amount of tokens based on share with equal shares after 3rd payee is added", async () => {
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

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
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();
      await UBTContract.connect(revenue3Account).release();

      // first got 30 in first release, 10 in second (60 * 20 / 120)
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("40")
      );

      // second got 20 in first release, 6.6666... in second (40 * 20 / 120)
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("26.66666666")
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
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

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

      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("52.5")
      );
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("17.5")
      );
    });

    it("Should release token, update share, send new token amount and then release right amount of tokens", async () => {
      // only first one release and then update happens before 2nd one releases, 50 deposited
      await UBTContract.connect(revenue1Account).release();

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

      expect(await UBTContract.ubtNotReleasedInPreviousPeriods()).to.equal(
        formatTokens("20")
      );

      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

      // because only first released before update, 20 unreleased ubts remained,
      // so now 40 ubts are splitted with 60/25 shares

      // 30 + 60 * 40 / 85
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("58.23529411")
      );

      // 0 + 25 * 40 / 85
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("11.76470588")
      );
    });

    it("Should release token, add new payee, send new token amount and then all release right amount of tokens", async () => {
      // only first one release and then update happens before 2nd one releases, 50 deposited
      await UBTContract.connect(revenue1Account).release();

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("30")
      );

      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("0")
      );

      await UBTContract.addPayee(
        revenue3Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );

      // deposit 20 more ubt and release again
      await UBTContract.connect(tokenSenderAccount).deposit(
        formatTokens("20"),
        destinationAddress
      );

      expect(await UBTContract.ubtNotReleasedInPreviousPeriods()).to.equal(
        formatTokens("20")
      );

      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();
      await UBTContract.connect(revenue3Account).release();

      // because only first released before update, 20 unreleased ubts remained,
      // so now 40 ubts are splitted with 60/40/25 shares

      // 30 + 60 * 40 / 125
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("49.2")
      );

      // 0 + 40 * 40 / 125
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("12.8")
      );

      // 0 + 25 * 40 / 125
      expect(await UBTContract.ubtReleased(revenue3Address)).to.equal(
        formatTokens("8")
      );
    });

    it("Should release token, add and update new payee (2 periods), send new token amount and then all release right amount of tokens", async () => {
      // only first one release and then update happens before 2nd one releases, 50 deposited
      await UBTContract.connect(revenue1Account).release();

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("30")
      );

      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("0")
      );

      await UBTContract.addPayee(
        revenue3Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );

      // deposit 20 more ubt and release again
      await UBTContract.connect(tokenSenderAccount).deposit(
        formatTokens("20"),
        destinationAddress
      );

      expect(await UBTContract.ubtNotReleasedInPreviousPeriods()).to.equal(
        formatTokens("20")
      );

      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

      await UBTContract.updatePayee(
        revenue3Address,
        stakingAddress,
        shares.twenty,
        baseledgervaloper
      );

      // first released before 1st update, first and second released before 2nd update, 3rd release after 2nd update
      // 30 + 60 * 40 / 125
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("49.2")
      );

      // 0 + 40 * 40 / 125
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("12.8")
      );

      // 40 - 19.2 - 12.8
      expect(await UBTContract.ubtNotReleasedInPreviousPeriods()).to.equal(
        formatTokens("8")
      );

      await UBTContract.connect(revenue3Account).release();

      // 3rd only releases after 2 updates
      // 0 + 20 * 8 / 120
      expect(await UBTContract.ubtReleased(revenue3Address)).to.equal(
        formatTokens("1.33333333")
      );
    });

    it("Should BOTH release token, update share, send new token amount and then BOTH release right amount of tokens", async () => {
      // both releases, 50 deposited, 60/40 shares
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

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

      expect(await UBTContract.ubtNotReleasedInPreviousPeriods()).to.equal(
        formatTokens("0")
      );

      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

      // both released, now only 20 deposited are split according to new shares 60/25

      // 30 + 60 * 20 / 85
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("44.11764705")
      );

      // 20 + 25 * 20 / 85
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("25.88235294")
      );
    });

    it("Should BOTH release token, add payee, send new token amount and then all three release right amount of tokens", async () => {
      // both releases, 50 deposited, 60/40 shares
      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();

      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("30")
      );

      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("20")
      );

      await UBTContract.addPayee(
        revenue3Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );

      // deposit 20 more ubt and release again
      await UBTContract.connect(tokenSenderAccount).deposit(
        formatTokens("20"),
        destinationAddress
      );

      expect(await UBTContract.ubtNotReleasedInPreviousPeriods()).to.equal(
        formatTokens("0")
      );

      await UBTContract.connect(revenue1Account).release();
      await UBTContract.connect(revenue2Account).release();
      await UBTContract.connect(revenue3Account).release();

      // both released, now only 20 deposited are split according to new shares 60/40/25

      // 30 + 60 * 20 / 125
      expect(await UBTContract.ubtReleased(revenue1Address)).to.equal(
        formatTokens("39.6")
      );

      // 20 + 40 * 20 / 125
      expect(await UBTContract.ubtReleased(revenue2Address)).to.equal(
        formatTokens("26.4")
      );

      // 0 + 25 * 20 / 125
      expect(await UBTContract.ubtReleased(revenue3Address)).to.equal(
        formatTokens("4")
      );
    });
  });
});
