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
  onePointSixInPeriodTokens,
} from "./utils";
import { Signer } from "ethers";

describe("UBTSplitter contract tests", () => {
  let UBTContract: UBTSplitter;
  let mockERC20: UBTMock;
  let UBTAddress: string;
  let mockERC20Address: string;
  let accounts;
  let revenue1Address: string;
  let revenue2Address: string;
  let stakingAddress: string;
  let maliciousAccount: Signer;
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

    tokenSenderAccount = await accounts[3];
    tokenSenderAddress = await accounts[3].getAddress();
    maliciousAccount = accounts[4];
  });

  beforeEach(async () => {
    const UBTFactory: ContractFactory = await hre.ethers.getContractFactory(
      "UBTSplitter"
    );
    const mockERC20Factory: ContractFactory =
      await hre.ethers.getContractFactory("UBTMock");
    mockERC20 = (await mockERC20Factory.deploy()) as UBTMock;
    await mockERC20.deployed();
    mockERC20Address = mockERC20.address;
    UBTContract = (await UBTFactory.deploy(mockERC20Address)) as UBTSplitter;
    await UBTContract.deployed();
    UBTAddress = UBTContract.address;
    // Transfer tokens to account which will make a deposit to the contract through deposit
    await mockERC20.transfer(tokenSenderAddress, tenTokens);
  });

  context("For deposit function", async () => {
    it("Should not have any tokens to the contract", async () => {
      const contractBalance = await mockERC20.balanceOf(UBTAddress);
      expect(contractBalance).to.equal(zeroToken);
    });

    it("Should deposit tokens through deposit function, emit deposit event and check balance of contract", async () => {
      const accountBalance = await mockERC20.balanceOf(tokenSenderAddress);
      expect(accountBalance).to.equal(tenTokens);
      const tx = await mockERC20
        .connect(tokenSenderAccount)
        .approve(UBTAddress, tenTokens);
      await tx.wait();
      const allowance = await mockERC20.allowance(
        tokenSenderAddress,
        UBTAddress
      );
      expect(allowance).to.equal(tenTokens);
      expect(
        await UBTContract.connect(tokenSenderAccount).deposit(
          mockERC20Address,
          tenTokens,
          destinationAddress
        )
      )
        .to.emit(UBTContract, "ERC20Deposit")
        .withArgs(
          tokenSenderAddress,
          mockERC20Address,
          tenTokens,
          firstDepositNonce,
          destinationAddress
        );
      const contractBalance = await mockERC20.balanceOf(UBTAddress);
      expect(contractBalance).to.equal(tenTokens);
    });

    it("Should fail on transfer token with zero token address", async () => {
      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(
          zeroAddress,
          tenTokens,
          destinationAddress
        )
      ).to.be.revertedWith("UBTSplitter: Address is zero address");
    });

    it("Should fail on transfer token with empty token destination address", async () => {
      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(
          mockERC20Address,
          tenTokens,
          ""
        )
      ).to.be.revertedWith("UBTSplitter: String is empty");
    });

    it("Should fail on transfer token which is not whitelisted into the contract", async () => {
      await UBTContract.setWhitelistedToken(mockERC20Address, false);
      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(
          mockERC20Address,
          tenTokens,
          destinationAddress
        )
      ).to.be.revertedWith("UBTSplitter: not whitelisted");
      await UBTContract.setWhitelistedToken(mockERC20Address, true);
    });

    it("Should fail on transfer zero token amount", async () => {
      await expect(
        UBTContract.connect(tokenSenderAccount).deposit(
          mockERC20Address,
          zeroToken,
          destinationAddress
        )
      ).to.be.revertedWith("UBTSplitter: amount should be grater than zero");
    });
  });

  context("For adding validators", async () => {
    it("Should add validator with share", async () => {
      const timestamp = (await getTimestamp()) + 1;
      const depositNonce = (await UBTContract.state_lastEventNonce()).add(1);

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
      expect(await UBTContract.payees(0)).to.equal(revenue1Address);
      expect(await UBTContract.shares(revenue1Address)).to.equal(shares.fifty);
      expect(await UBTContract.timestamps(revenue1Address)).to.equal(timestamp);
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
      ).to.be.revertedWith("UBTSplitter: Address is zero address");
    });

    it("Should fail on add validator with zero stakingAddress address", async () => {
      await expect(
        UBTContract.addPayee(
          revenue1Address,
          zeroAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("UBTSplitter: Address is zero address");
    });

    it("Should fail on add validator with zero share", async () => {
      await expect(
        UBTContract.addPayee(
          revenue1Address,
          stakingAddress,
          shares.zero,
          baseledgervaloper
        )
      ).to.be.revertedWith("UBTSplitter: shares are 0");
    });

    it("Should fail on add validator with empty baseledgervaloper string", async () => {
      await expect(
        UBTContract.addPayee(revenue1Address, stakingAddress, shares.fifty, "")
      ).to.be.revertedWith("UBTSplitter: String is empty");
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
      ).to.be.revertedWith("UBTSplitter: revenueAddress already has shares");
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
      const depositNonce = (await UBTContract.state_lastEventNonce()).add(1);

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
      expect(await UBTContract.payees(0)).to.equal(revenue1Address);
      expect(await UBTContract.payees(1)).to.equal(revenue2Address);
      expect(await UBTContract.shares(revenue1Address)).to.equal(
        shares.hundred
      );
      expect(await UBTContract.timestamps(revenue1Address)).to.equal(timestamp);
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
      ).to.be.revertedWith("UBTSplitter: Address is zero address");
    });

    it("Should fail on update validator with zero staking address", async () => {
      await expect(
        UBTContract.updatePayee(
          revenue1Address,
          zeroAddress,
          shares.fifty,
          baseledgervaloper
        )
      ).to.be.revertedWith("UBTSplitter: Address is zero address");
    });

    it("Should fail on update validator with empty baseledgervaloper string", async () => {
      await expect(
        UBTContract.updatePayee(
          revenue1Address,
          stakingAddress,
          shares.fifty,
          ""
        )
      ).to.be.revertedWith("UBTSplitter: String is empty");
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
      const tx = await mockERC20
        .connect(tokenSenderAccount)
        .approve(UBTAddress, tenTokens);
      await tx.wait();
      await UBTContract.connect(tokenSenderAccount).deposit(
        mockERC20Address,
        tenTokens,
        destinationAddress
      );
    });

    it("Should release amount of tokens based on share with equal shares", async () => {
      await UBTContract.release(mockERC20Address, revenue1Address);
      await UBTContract.release(mockERC20Address, revenue2Address);
      expect(
        await UBTContract.erc20Released(mockERC20Address, revenue1Address)
      ).to.equal(fiveTokens);
      expect(
        await UBTContract.erc20Released(mockERC20Address, revenue2Address)
      ).to.equal(fiveTokens);
    });

    it("Should update share and release the right amount of tokens", async () => {
      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );
      await UBTContract.release(mockERC20Address, revenue1Address);
      expect(
        await UBTContract.erc20Released(mockERC20Address, revenue1Address)
      ).to.equal(threePointThreeInPeriodTokens);
    });

    it("Should release token, update share, send new token amount and then release right amount of tokens", async () => {
      await UBTContract.release(mockERC20Address, revenue1Address);
      await mockERC20.transfer(UBTAddress, tenTokens);
      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.twentyFive,
        baseledgervaloper
      );
      await UBTContract.release(mockERC20Address, revenue1Address);
      expect(
        await UBTContract.erc20Released(mockERC20Address, revenue1Address)
      ).to.equal(fiveTokens.add(onePointSixInPeriodTokens));
      expect(await UBTContract.erc20TotalReleased(mockERC20Address)).to.equal(
        fiveTokens.add(onePointSixInPeriodTokens)
      );
    });

    it("Should emit event, when release function is called", async () => {
      expect(await UBTContract.release(mockERC20Address, revenue1Address))
        .to.emit(UBTContract, "ERC20PaymentReleased")
        .withArgs(
          mockERC20Address,
          revenue1Address,
          stakingAddress,
          fiveTokens
        );
    });

    it("Should fail on try to release on validator without share", async () => {
      await UBTContract.updatePayee(
        revenue1Address,
        stakingAddress,
        shares.zero,
        baseledgervaloper
      );
      await expect(
        UBTContract.release(mockERC20Address, revenue1Address)
      ).to.be.revertedWith("UBTSplitter: revenueAddress has no shares");
    });

    it("Should fail on try to release on validator without due payment", async () => {
      await UBTContract.release(mockERC20Address, revenue1Address);
      await expect(
        UBTContract.release(mockERC20Address, revenue1Address)
      ).to.be.revertedWith("UBTSplitter: revenueAddress is not due payment");
    });

    it("Should fail on try to release on validator without which is not whitelisted", async () => {
      await UBTContract.setWhitelistedToken(mockERC20Address, false);
      await expect(
        UBTContract.release(mockERC20Address, revenue1Address)
      ).to.be.revertedWith("UBTSplitter: not whitelisted");
    });
  });

  context("For set whitelisted tokens", async () => {
    it("Should set token address into the whitelist with different statuses", async () => {
      expect(await UBTContract.whitelistedTokens(mockERC20Address)).to.equal(
        true
      );
      await UBTContract.setWhitelistedToken(mockERC20Address, false);
      expect(await UBTContract.whitelistedTokens(mockERC20Address)).to.equal(
        false
      );
      expect(await UBTContract.setWhitelistedToken(mockERC20Address, true))
        .to.emit(UBTContract, "WhitelistTokenUpdated")
        .withArgs(revenue1Address, mockERC20Address, true);
      expect(await UBTContract.whitelistedTokens(mockERC20Address)).to.equal(
        true
      );
    });

    it("Should fail on try to set zero address", async () => {
      await expect(
        UBTContract.setWhitelistedToken(zeroAddress, true)
      ).to.be.revertedWith("UBTSplitter: Address is zero address");
    });

    it("Should fail on try to set address which is not contract", async () => {
      await expect(
        UBTContract.setWhitelistedToken(revenue1Address, true)
      ).to.be.revertedWith("UBTSplitter: not contract address");
    });

    it("Should fail if malicious account tries to set address to whitelist ", async () => {
      await expect(
        UBTContract.connect(maliciousAccount).setWhitelistedToken(
          mockERC20Address,
          true
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
