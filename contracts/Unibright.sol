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
    event PayeeAdded(address revenueAddress, address stakingAddress, uint256 shares, uint256 timestamp);
    event PayeeUpdated(address revenueAddress, address stakingAddress, uint256 shares, uint256 timestamp);
    event WhitelistTokenUpdated(address triggerredBy, address token, bool isWhitelisted);

    event ERC20PaymentReleased(
        IERC20 indexed token,
        address revenueAddress,
        address stakingAddress,
        uint256 amount
    );

    uint256 public totalShares;

    mapping(address => uint256) public shares;
    mapping(address => uint256) public timestamps;
    mapping(address => address) public validatorStakingAddress; // revenueAddress => validatorStakingAddress
    address[] public payees;

    mapping(IERC20 => uint256) public erc20TotalReleased;
    mapping(IERC20 => mapping(address => uint256)) public erc20Released;
    mapping(address => bool) public whitelistedTokens;

    /**
     * @dev Creates an instance of `UBTSplitter` where each account in `payees` is assigned the number of shares at
     * the matching position in the `shares` array.
     *
     * All addresses in `payees` must be non-zero. Both arrays must have the same non-zero length, and there must be no
     * duplicates in `payees`.
     */
    constructor(address token) {
        whitelistedTokens[token] = true;
    }

    /**
     * @dev Modifier for checking for zero address
     */
    modifier zeroAddress(address token) {
       require(
            token != address(0),
            "UBTSplitter: Address is zero address"
        );
        _;
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of `token` tokens they are owed, according to their
     * percentage of the total shares and their previous withdrawals. `token` must be the address of an IERC20
     * contract.
     */
    function release(IERC20 token, address revenueAddress) public virtual {
        require(shares[revenueAddress] > 0, "UBTSplitter: revenueAddress has no shares");

        require(whitelistedTokens[address(token)], "UBTSplitter: not whitelisted");

        uint256 totalReceived = token.balanceOf(address(this)) +
           erc20TotalReleased[token];
        uint256 payment = _pendingPayment(
            revenueAddress,
            totalReceived,
            erc20Released[token][revenueAddress]
        );

        require(payment != 0, "UBTSplitter: revenueAddress is not due payment");

        erc20Released[token][revenueAddress] += payment;
        erc20TotalReleased[token] += payment;

        SafeERC20.safeTransfer(token, revenueAddress, payment);
        emit ERC20PaymentReleased(token, revenueAddress, validatorStakingAddress[revenueAddress], payment);
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
     */
    function addPayee(address revenueAddress, address stakingAddress, uint256 shares_) public onlyOwner zeroAddress(revenueAddress) zeroAddress(stakingAddress) {
        require(shares_ > 0, "UBTSplitter: shares are 0");
        require(
            shares[revenueAddress] == 0,
            "UBTSplitter: revenueAddress already has shares"
        );

        payees.push(revenueAddress);
        validatorStakingAddress[revenueAddress] = stakingAddress;
        shares[revenueAddress] = shares_;
        timestamps[revenueAddress] = block.timestamp;
        totalShares = totalShares + shares_;
        emit PayeeAdded(revenueAddress, stakingAddress, shares_, block.timestamp);
    }

    /**
     * @dev Add a new payee to the contract.
     * @param revenueAddress The revenue address.
     * @param stakingAddress The staking address.
     * @param shares_ The number of shares owned by the payee.
     */
    function updatePayee(address revenueAddress, address stakingAddress, uint256 shares_) public onlyOwner zeroAddress(revenueAddress) zeroAddress(stakingAddress) {

        totalShares = totalShares - shares[revenueAddress]; // remove the current share of the account from total shares.
        
        validatorStakingAddress[revenueAddress] = stakingAddress;
        shares[revenueAddress] = shares_;
        timestamps[revenueAddress] = block.timestamp;
        totalShares = totalShares + shares_; // add the new share of the account to total shares.
        emit PayeeUpdated(revenueAddress, stakingAddress, shares_, block.timestamp);
    }

    function setWhitelistedToken(address token, bool isWhitelisted) public onlyOwner zeroAddress(token) {
       require (token.isContract(), "UBTSplitter: not contract address");
       whitelistedTokens[token] = isWhitelisted;
       emit WhitelistTokenUpdated(msg.sender, token, isWhitelisted);
    }
}
