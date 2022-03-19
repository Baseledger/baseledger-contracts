// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (finance/BaseledgerUBTSplitter .sol)

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BaseledgerUBTSplitter
 * @dev This contract allows to split UBT payments among a group of accounts. The sender does not need to be aware
 * that the UBT will be split in this way, since it is handled transparently by the contract.
 * Contract is based on PaymentSplitter, but difference is that in PaymentSplitter payees are added only once in constructor,
 * but here can be added and updated later. Because of this, contract needs to track release amount since the last payee update.
 * Offchain solution should take care of notifying payees to pull their funds before payees are added or updated.
 *
 * The split can be in equal parts or in any other arbitrary proportion. The way this is specified is by assigning each
 * account to a number of shares. Of all the UBT that this contract receives, each account will then be able to claim
 * an amount proportional to the percentage of total shares they were assigned.
 *
 * `BaseledgerUBTSplitter ` follows a _pull payment_ model. This means that payments are not automatically forwarded to the
 * accounts but kept in this contract, and the actual transfer is triggered as a separate step by calling the {release}
 * function.
 */
contract BaseledgerUBTSplitter is Context, Ownable {
    event PayeeUpdated(
        address indexed token,
        address indexed revenueAddress,
        string baseledgerValidatorAddress,
        uint256 shares,
        uint256 lastEventNonce
    );

    event UbtPaymentReleased(
        IERC20 indexed token,
        address revenueAddress,
        address stakingAddress,
        uint256 amount
    );

    event UbtDeposited(
        address indexed token,
        address indexed sender,
        string baseledgerDestinationAddress,
        uint256 tokenAmount,
        uint256 lastEventNonce
    );

    uint256 public totalShares;
    uint256 public lastEventNonce = 2;

    mapping(address => uint256) public shares;
    mapping(address => address) public stakingAddresses;
    mapping(address => uint256) public ubtReleased;

    mapping(address => bool) public payees;

    uint256 public ubtTotalReleased;
    mapping(uint256 => mapping(address => uint256))
        public ubtReleasedPerRecipientInPeriods;

    uint256 public ubtToBeReleasedInPeriod;
    uint256 public ubtNotReleasedInPreviousPeriods;
    uint256 public ubtCurrentPeriod;

    address public ubtTokenContractAddress;

    uint256 public minDeposit = 100000000;

    constructor(address token) {
        ubtTokenContractAddress = token;
    }

    /**
     * @dev Modifier for checking for zero address
     */
    modifier zeroAddress(address address_) {
        require(address_ != address(0), "address is zero address");
        _;
    }

    /**
     * @dev Modifier for checking for empty string
     */
    modifier emptyString(string memory str) {
        bytes memory tempEmptyStringTest = bytes(str);
        require(tempEmptyStringTest.length != 0, "string is empty");
        _;
    }

    /**
     * @dev Add token deposit to the contract and emit event.
     * @param amount The amount of the token.
     * @param baseledgerDestinationAddress The baseledger destination address.
     */
    function deposit(uint256 amount, string memory baseledgerDestinationAddress)
        public
        emptyString(baseledgerDestinationAddress)
    {
        require(amount >= minDeposit, "amount should be above min deposit");
        lastEventNonce += 1;
        ubtToBeReleasedInPeriod += amount;

        bool transferFromReturn = IERC20(ubtTokenContractAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        require(
            transferFromReturn == true,
            "transferFrom fail, check allowance"
        );
        emit UbtDeposited(
            ubtTokenContractAddress,
            msg.sender,
            baseledgerDestinationAddress,
            amount,
            lastEventNonce
        );
    }

    /**
     * @dev Triggers a transfer to `msg.sender` of the amount of UBT tokens they are owed, according to their
     * percentage of the total shares and their previous withdrawals in current period since last payee update.
     */
    function release() public virtual {
        require(payees[msg.sender] == true, "msg.sender is not payee");
        require(shares[msg.sender] > 0, "msg.sender has no shares");

        uint256 alreadyReceivedSinceLastPayeeUpdate = ubtReleasedPerRecipientInPeriods[
                ubtCurrentPeriod
            ][msg.sender];
        uint256 toBeReleased = ubtToBeReleasedInPeriod +
            ubtNotReleasedInPreviousPeriods;
        uint256 payment = (shares[msg.sender] * toBeReleased) /
            totalShares -
            alreadyReceivedSinceLastPayeeUpdate;

        ubtReleased[msg.sender] += payment;
        ubtTotalReleased += payment;
        ubtReleasedPerRecipientInPeriods[ubtCurrentPeriod][
            msg.sender
        ] += payment;

        require(payment != 0, "msg.sender is not due payment");
        IERC20(ubtTokenContractAddress).transfer(msg.sender, payment);

        emit UbtPaymentReleased(
            IERC20(ubtTokenContractAddress),
            msg.sender,
            stakingAddresses[msg.sender],
            payment
        );
    }

    /**
     * @dev Add a new payee to the contract.
     * @param revenueAddress The revenue address.
     * @param stakingAddress The staking address.
     * @param shares_ The number of shares owned by the payee.
     * @param baseledgerValidatorAddress Identifier for the node within baseledger.
     */
    function addPayee(
        address revenueAddress,
        address stakingAddress,
        uint256 shares_,
        string memory baseledgerValidatorAddress
    )
        public
        onlyOwner
        zeroAddress(revenueAddress)
        zeroAddress(stakingAddress)
        emptyString(baseledgerValidatorAddress)
    {
        require(payees[revenueAddress] == false, "payee already exists");
        require(shares_ > 0, "shares are 0");

        payees[revenueAddress] = true;

        _updatePayeeSharesAndCurrentPeriod(
            revenueAddress,
            stakingAddress,
            shares_
        );

        emit PayeeUpdated(
            ubtTokenContractAddress,
            revenueAddress,
            baseledgerValidatorAddress,
            shares_,
            lastEventNonce
        );
    }

    /**
     * @dev Updates existing payee.
     * @param revenueAddress The revenue address.
     * @param stakingAddress The staking address.
     * @param shares_ The number of shares owned by the payee.
     * @param baseledgerValidatorAddress Identifier for the node within baseledger.
     */
    function updatePayee(
        address revenueAddress,
        address stakingAddress,
        uint256 shares_,
        string memory baseledgerValidatorAddress
    )
        public
        onlyOwner
        zeroAddress(revenueAddress)
        zeroAddress(stakingAddress)
        emptyString(baseledgerValidatorAddress)
    {
        require(payees[revenueAddress] == true, "payee does not exist");
        totalShares = totalShares - shares[revenueAddress]; // remove the current share of the account from total shares.

        _updatePayeeSharesAndCurrentPeriod(
            revenueAddress,
            stakingAddress,
            shares_
        );

        emit PayeeUpdated(
            ubtTokenContractAddress,
            revenueAddress,
            baseledgerValidatorAddress,
            shares_,
            lastEventNonce
        );
    }

    /**
     * @dev Change the minimum required UBT deposit.
     * @param minDeposit_ The new amount of minimum deposit
     */
    function changeMinDeposit(uint256 minDeposit_) public onlyOwner {
        require(minDeposit_ > 0, "min deposit must be > 0");

        minDeposit = minDeposit_;
    }

    function _updatePayeeSharesAndCurrentPeriod(
        address revenueAddress,
        address stakingAddress,
        uint256 shares_
    ) private {
        stakingAddresses[revenueAddress] = stakingAddress;
        shares[revenueAddress] = shares_;
        totalShares = totalShares + shares_;
        lastEventNonce = lastEventNonce + 1;

        ubtToBeReleasedInPeriod = 0;
        ubtCurrentPeriod += 1;
        ubtNotReleasedInPreviousPeriods = IERC20(ubtTokenContractAddress)
            .balanceOf(address(this));
    }
}
