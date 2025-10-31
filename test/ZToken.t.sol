// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZToken} from "../contracts/ZToken.sol";

contract ZTokenTest is Test {
    ZToken zToken;
    address owner;
    address user1;
    address user2;

    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        
        zToken = new ZToken("Test Token", "TEST", 18);
    }

    function test_Deployment_SetsName() public {
        assertEq(zToken.name(), "Test Token");
    }

    function test_Deployment_SetsSymbol() public {
        assertEq(zToken.symbol(), "TEST");
    }

    function test_Deployment_SetsDecimals() public {
        assertEq(zToken.decimals(), 18);
    }

    function test_Deployment_SetsOwner() public {
        assertEq(zToken.owner(), owner);
    }

    function test_Deployment_ZeroInitialSupply() public {
        assertEq(zToken.totalSupply(), 0);
    }

    function test_Mint_AllowsOwner() public {
        uint256 amount = 1000 ether;
        zToken.mint(user1, amount);
        
        assertEq(zToken.balanceOf(user1), amount);
        assertEq(zToken.totalSupply(), amount);
    }

    function test_Mint_UpdatesTotalSupply() public {
        uint256 amount1 = 1000 ether;
        uint256 amount2 = 500 ether;
        
        zToken.mint(user1, amount1);
        zToken.mint(user2, amount2);
        
        assertEq(zToken.totalSupply(), amount1 + amount2);
    }

    function test_Mint_RevertsIfNotOwner() public {
        uint256 amount = 1000 ether;
        vm.prank(user1);
        vm.expectRevert();
        zToken.mint(user2, amount);
    }

    function test_Burn_AllowsOwner() public {
        uint256 mintAmount = 1000 ether;
        uint256 burnAmount = 100 ether;
        
        zToken.mint(user1, mintAmount);
        zToken.burn(user1, burnAmount);
        
        assertEq(zToken.balanceOf(user1), mintAmount - burnAmount);
        assertEq(zToken.totalSupply(), mintAmount - burnAmount);
    }

    function test_Burn_RevertsIfNotOwner() public {
        uint256 mintAmount = 1000 ether;
        uint256 burnAmount = 100 ether;
        
        zToken.mint(user1, mintAmount);
        vm.prank(user1);
        vm.expectRevert();
        zToken.burn(user1, burnAmount);
    }

    function test_Burn_RevertsIfAmountExceedsBalance() public {
        uint256 mintAmount = 1000 ether;
        uint256 burnAmount = 2000 ether;
        
        zToken.mint(user1, mintAmount);
        vm.expectRevert();
        zToken.burn(user1, burnAmount);
    }

    function test_CustomDecimals_6() public {
        ZToken token6 = new ZToken("Token 6", "TK6", 6);
        assertEq(token6.decimals(), 6);
    }

    function test_CustomDecimals_8() public {
        ZToken token8 = new ZToken("Token 8", "TK8", 8);
        assertEq(token8.decimals(), 8);
    }
}

