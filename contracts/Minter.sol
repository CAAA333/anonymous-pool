// contracts/Minter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ZToken.sol";

contract Minter {
    mapping(address => address) public tokenToZToken; // underlying token => zToken
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addToken(address token, address zToken) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(zToken != address(0), "Invalid zToken");
        tokenToZToken[token] = zToken;
    }

    function mintZToken(address recipient, address underlyingToken, uint256 amount) external {
        address zTokenAddr = tokenToZToken[underlyingToken];
        require(zTokenAddr != address(0), "Unsupported token");
        require(amount > 0, "Amount must be > 0");

        // Transfer underlying asset from caller
        IERC20(underlyingToken).transferFrom(msg.sender, address(this), amount);

        // Mint zTokens to recipient
        ZToken(zTokenAddr).mint(recipient, amount);
    }

    function burnZToken(address recipient, address underlyingToken, uint256 amount) external {
        address zTokenAddr = tokenToZToken[underlyingToken];
        require(zTokenAddr != address(0), "Unsupported token");
        require(amount > 0, "Amount must be > 0");

        // Burn zTokens from caller
        ZToken(zTokenAddr).burn(msg.sender, amount);

        // Transfer underlying back to recipient
        IERC20(underlyingToken).transfer(recipient, amount);
    }

    // optionally, the owner could withdraw underlying tokens
    function withdrawUnderlying(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}
