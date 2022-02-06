// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (finance/UBTSplitter.sol)

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UBTSplitter
 * @dev This contract allows to split UBT payments among a group of accounts. The sender does not need to be aware
 * that the UBT will be split in this way, since it is handled transparently by the contract.
 * Contract is based on PaymentSplitter, but difference is that in PaymentSplitter payees are added only once in constructor,
 * but here can be added and update later. Because of this, contract needs to track release amount since the last payee update.
 * Offchain solution should take care of notifying payees to pull their funds before payees are added or updated. 
 *
 * The split can be in equal parts or in any other arbitrary proportion. The way this is specified is by assigning each
 * account to a number of shares. Of all the UBT that this contract receives, each account will then be able to claim
 * an amount proportional to the percentage of total shares they were assigned.
 *
 * `UBTSplitter` follows a _pull payment_ model. This means that payments are not automatically forwarded to the
 * accounts but kept in this contract, and the actual transfer is triggered as a separate step by calling the {release}
 * function.
 */
contract UBTSplitter is Context, Ownable {
    event PayeeAdded(
        address revenueAddress,
        address stakingAddress,
        uint256 shares,
        string baseledgervaloper,
        uint256 lastEventNonce,
        uint256 timestamp
    );

    event PayeeUpdated(
        address revenueAddress,
        address stakingAddress,
        uint256 shares,
        string baseledgervaloper,
        uint256 lastEventNonce,
        uint256 timestamp
    );

    event UbtPaymentReleased(
        IERC20 indexed token,
        address revenueAddress,
        address stakingAddress,
        uint256 amount
    );

    event UbtDeposited(
        address sender,
        address token,
        uint256 tokenAmount,
        uint256 lastEventNonce,
        string destinationAddress
    );

    uint256 public totalShares;
    uint256 public lastEventNonce;

    mapping(address => uint256) public shares;
    mapping(address => address) public validatorStakingAddress; // revenueAddress => validatorStakingAddress
    mapping(address => bool) public payees;

    uint256 public ubtTotalReleased;
    mapping(address => uint256) public ubtReleased;
    mapping(uint256 => mapping (address => uint256)) public ubtReleasedPerRecipientInPeriods;
    
    uint256 public ubtToBeReleasedInPeriod;
    uint256 public ubtNotReleasedInLastPeriods;
    uint256 public ubtCurrentPeriod;

    address public whitelistedToken;

    constructor(address token) {
        whitelistedToken = token;
    }

    /**
     * @dev Modifier for checking for zero address
     */
    modifier zeroAddress(address token) {
        require(token != address(0), "address is zero address");
        _;
    }

    /**
     * @dev Modifier for checking for empty string
     */
    modifier emptyString(string memory baseledgervaloper) {
        bytes memory tempEmptyStringTest = bytes(baseledgervaloper);
        require(
            tempEmptyStringTest.length != 0,
            "string is empty"
        );
        _;
    }

    /**
     * @dev Add token deposit to the contract and emit event.
     * @param amount The amount of the token.
     * @param baseledgerDestinationAddress The baseledger destination address.
     */
    function deposit(
        uint256 amount,
        string memory baseledgerDestinationAddress
    ) public emptyString(baseledgerDestinationAddress) {
        require(
            amount > 0,
            "amount should be greater than zero"
        );
        lastEventNonce = lastEventNonce + 1;

        ubtToBeReleasedInPeriod += amount;

        IERC20(whitelistedToken).transferFrom(msg.sender, address(this), amount);

        emit UbtDeposited(
            msg.sender,
            whitelistedToken,
            amount,
            lastEventNonce,
            baseledgerDestinationAddress
        );
    }

    /**
     * @dev Triggers a transfer to `msg.sender` of the amount of UBT tokens they are owed, according to their
     * percentage of the total shares and their previous withdrawals in current period since last payee update.
     */
    function release() public virtual {
        require(
            payees[msg.sender] == true,
            "msg.sender is not payee"
        );
        require(
            shares[msg.sender] > 0,
            "msg.sender has no shares"
        );
   
        uint256 alreadyReceivedSinceLastPayeeUpdate = ubtReleasedPerRecipientInPeriods[ubtCurrentPeriod][msg.sender];
        uint256 toBeReleased = ubtToBeReleasedInPeriod + ubtNotReleasedInLastPeriods;
        uint256 payment = (shares[msg.sender] * toBeReleased) / totalShares - alreadyReceivedSinceLastPayeeUpdate;

        require(payment != 0, "msg.sender is not due payment");
        SafeERC20.safeTransfer(IERC20(whitelistedToken), msg.sender, payment);

        ubtReleased[msg.sender] += payment;
        ubtTotalReleased += payment;
        ubtReleasedPerRecipientInPeriods[ubtCurrentPeriod][msg.sender] += payment;

        emit UbtPaymentReleased(
            IERC20(whitelistedToken),
            msg.sender,
            validatorStakingAddress[msg.sender],
            payment
        );
    }

    /**
     * @dev Add a new payee to the contract.
     * @param revenueAddress The revenue address.
     * @param stakingAddress The staking address.
     * @param shares_ The number of shares owned by the payee.
     * @param baseledgervaloper Identifier for the node within baseledger.
     */
    function addPayee(
        address revenueAddress,
        address stakingAddress,
        uint256 shares_,
        string memory baseledgervaloper
    )
        public
        onlyOwner
        zeroAddress(revenueAddress)
        zeroAddress(stakingAddress)
        emptyString(baseledgervaloper)
    {
        require(
            payees[revenueAddress] == false,
            "payee already exists"
        );
        require(shares_ > 0, "shares are 0");

        payees[revenueAddress] = true;

        _updatePayeeSharesAndCurrentPeriod(revenueAddress, stakingAddress, shares_);

        emit PayeeAdded(
            revenueAddress,
            stakingAddress,
            shares_,
            baseledgervaloper,
            lastEventNonce,
            block.timestamp
        );
    }

    /**
     * @dev Updates existing payee.
     * @param revenueAddress The revenue address.
     * @param stakingAddress The staking address.
     * @param shares_ The number of shares owned by the payee.
     * @param baseledgervaloper Identifier for the node within baseledger.
     */
    function updatePayee(
        address revenueAddress,
        address stakingAddress,
        uint256 shares_,
        string memory baseledgervaloper
    )
        public
        onlyOwner
        zeroAddress(revenueAddress)
        zeroAddress(stakingAddress)
        emptyString(baseledgervaloper)
    {
        require(
            payees[revenueAddress] == true,
            "payee does not exist"
        );
        totalShares = totalShares - shares[revenueAddress]; // remove the current share of the account from total shares.

        _updatePayeeSharesAndCurrentPeriod(revenueAddress, stakingAddress, shares_);

        emit PayeeUpdated(
            revenueAddress,
            stakingAddress,
            shares_,
            baseledgervaloper,
            lastEventNonce,
            block.timestamp
        );
    }

    function _updatePayeeSharesAndCurrentPeriod(
        address revenueAddress,
        address stakingAddress,
        uint256 shares_
    ) private {
        validatorStakingAddress[revenueAddress] = stakingAddress;
        shares[revenueAddress] = shares_;
        totalShares = totalShares + shares_;
        lastEventNonce = lastEventNonce + 1;

        ubtToBeReleasedInPeriod = 0;
        ubtCurrentPeriod += 1;
        ubtNotReleasedInLastPeriods = IERC20(whitelistedToken).balanceOf(address(this));
    }
}
