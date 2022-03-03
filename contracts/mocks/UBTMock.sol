//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract UBTMock is ERC20, Ownable {
    uint256 private constant SUPPLY = 1_000_000_000 * 10**8;

    constructor() ERC20("UBT Mock Token", "MUBT") {
        _mint(msg.sender, SUPPLY);
    }

    function mint(address to, uint256 amount) public virtual onlyOwner {
        _mint(to, amount);
    }
}
