// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (finance/UBTSplitter.sol)

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UBTSplitter
 * @dev This contract allows to split Ether payments among a group of accounts. The sender does not need to be aware
 * that the Ether will be split in this way, since it is handled transparently by the contract.
 *
 * The split can be in equal parts or in any other arbitrary proportion. The way this is specified is by assigning each
 * account to a number of shares. Of all the Ether that this contract receives, each account will then be able to claim
 * an amount proportional to the percentage of total shares they were assigned.
 *
 * `UBTSplitter` follows a _pull payment_ model. This means that payments are not automatically forwarded to the
 * accounts but kept in this contract, and the actual transfer is triggered as a separate step by calling the {release}
 * function.
 *
 * NOTE: This contract assumes that ERC20 tokens will behave similarly to native tokens (Ether). Rebasing tokens, and
 * tokens that apply fees during transfers, are likely to not be supported as expected. If in doubt, we encourage you
 * to run tests before sending real value to this contract.
 */
contract UBTSplitter is Context, Ownable {
    using Address for address;

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
    address[] public payees;

    mapping(IERC20 => uint256) public ubtTotalReleased;
    mapping(IERC20 => mapping(address => uint256)) public ubtReleased;
    
    uint256 public ubtToBeReleasedInPeriod;
    uint256 public ubtNotReleasedInLastPeriod;
    uint256 public ubtCurrentPeriod;

    address public whitelistedToken;

    mapping(uint256 => mapping (address => uint256)) public ubtReleasedPerRecipientInPeriods;

    /**
     * @dev Creates an instance of `UBTSplitter` where each account in `payees` is assigned the number of shares at
     * the matching position in the `shares` array.
     *
     * All addresses in `payees` must be non-zero. Both arrays must have the same non-zero length, and there must be no
     * duplicates in `payees`.
     */
    constructor(address token) {
        whitelistedToken = token;
    }

    /**
     * @dev Modifier for checking for zero address
     */
    modifier zeroAddress(address token) {
        require(token != address(0), "UBTSplitter: Address is zero address");
        _;
    }

    /**
     * @dev Modifier for checking for empty string
     */
    modifier emptyString(string memory baseledgervaloper) {
        bytes memory tempEmptyStringTest = bytes(baseledgervaloper);
        require(
            tempEmptyStringTest.length != 0,
            "UBTSplitter: String is empty"
        );
        _;
    }

    /**
     * @dev Add token deposit to the contract.
     * @param token The address of the token.
     * @param tokenAmount The amount of the token.
     * @param destinationAddress The destination address.
     */
    function deposit(
        address token,
        uint256 tokenAmount,
        string memory destinationAddress
    ) public zeroAddress(token) emptyString(destinationAddress) {
        require(
            whitelistedToken == address(token),
            "UBTSplitter: not whitelisted"
        );
        require(
            tokenAmount > 0,
            "UBTSplitter: amount should be grater than zero"
        );
        lastEventNonce = lastEventNonce + 1;

        ubtToBeReleasedInPeriod += tokenAmount;

        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);

        emit UbtDeposited(
            msg.sender,
            token,
            tokenAmount,
            lastEventNonce,
            destinationAddress
        );
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of `token` tokens they are owed, according to their
     * percentage of the total shares and their previous withdrawals. `token` must be the address of an IERC20
     * contract.
     */
    function release(IERC20 token, address revenueAddress) public virtual {
        require(
            shares[revenueAddress] > 0,
            "UBTSplitter: revenueAddress has no shares"
        );

        require(
            whitelistedToken == address(token),
            "UBTSplitter: not whitelisted"
        );
   
        uint256 alreadyReceivedSinceLastPayeeUpdate = ubtReleasedPerRecipientInPeriods[ubtCurrentPeriod][revenueAddress];
        uint256 toBeReleased = ubtToBeReleasedInPeriod;        
        toBeReleased += ubtNotReleasedInLastPeriod;
        uint256 payment = (shares[revenueAddress] * toBeReleased) / totalShares - alreadyReceivedSinceLastPayeeUpdate;

        require(payment != 0, "UBTSplitter: revenueAddress is not due payment");

        ubtReleased[token][revenueAddress] += payment;
        ubtTotalReleased[token] += payment;
        
        ubtReleasedPerRecipientInPeriods[ubtCurrentPeriod][revenueAddress] += payment;

        SafeERC20.safeTransfer(token, revenueAddress, payment);
        emit UbtPaymentReleased(
            token,
            revenueAddress,
            validatorStakingAddress[revenueAddress],
            payment
        );
    }

    /**
     * @dev internal logic for computing the pending payment of an `account` given the token historical balances and
     * already released amounts.
     */
    function _pendingPayment(
        address account,
        uint256 totalReceived,
        uint256 alreadyReleased
    ) private view returns (uint256) {
        uint256 formula = (totalReceived * shares[account]) /
            totalShares -
            alreadyReleased;
        return formula;
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
        require(shares_ > 0, "UBTSplitter: shares are 0");
        require(
            shares[revenueAddress] == 0,
            "UBTSplitter: revenueAddress already has shares"
        );

        payees.push(revenueAddress);
        validatorStakingAddress[revenueAddress] = stakingAddress;
        shares[revenueAddress] = shares_;
        totalShares = totalShares + shares_;
        lastEventNonce = lastEventNonce + 1;

        ubtToBeReleasedInPeriod = 0;
        ubtCurrentPeriod += 1;
        ubtNotReleasedInLastPeriod = IERC20(whitelistedToken).balanceOf(address(this));
        

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
     * @dev Add a new payee to the contract.
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
        totalShares = totalShares - shares[revenueAddress]; // remove the current share of the account from total shares.

        validatorStakingAddress[revenueAddress] = stakingAddress;
        shares[revenueAddress] = shares_;
        totalShares = totalShares + shares_; // add the new share of the account to total shares.
        lastEventNonce = lastEventNonce + 1;

        ubtToBeReleasedInPeriod = 0;
        ubtCurrentPeriod += 1;
        ubtNotReleasedInLastPeriod = IERC20(whitelistedToken).balanceOf(address(this));

        emit PayeeUpdated(
            revenueAddress,
            stakingAddress,
            shares_,
            baseledgervaloper,
            lastEventNonce,
            block.timestamp
        );
    }

    
}
