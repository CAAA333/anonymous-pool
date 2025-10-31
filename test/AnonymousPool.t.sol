// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AnonymousPool} from "../contracts/AnonymousPool.sol";
import {SimplifiedPoseidon} from "../contracts/SimplifiedPoseidon.sol";
import {ZToken} from "../contracts/ZToken.sol";

contract AnonymousPoolTest is Test {
    AnonymousPool pool;
    SimplifiedPoseidon poseidon;
    address owner;
    address user1;
    address user2;
    address relayer;
    
    uint32 constant TREE_DEPTH = 10;
    uint256 constant DEPOSIT_AMOUNT = 0.001 ether;
    uint256 constant FEE = 0.0001 ether;

    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        relayer = address(0x3);
        
        poseidon = new SimplifiedPoseidon();
        pool = new AnonymousPool(TREE_DEPTH, poseidon);
    }

    function test_Deployment_SetsDepositAmount() public {
        assertEq(pool.DEPOSIT_AMOUNT(), DEPOSIT_AMOUNT);
    }

    function test_Deployment_SetsFee() public {
        assertEq(pool.FEE(), FEE);
    }

    function test_Deployment_SetsFeeCollector() public {
        assertEq(pool.feeCollector(), owner);
    }

    function test_Deployment_ZeroInitialDeposits() public {
        assertEq(pool.totalDeposits(), 0);
    }

    function test_Deployment_ZeroInitialWithdrawals() public {
        assertEq(pool.totalWithdrawals(), 0);
    }

    function test_Deposit_AcceptsValidETH() public {
        bytes32 secret = keccak256("secret");
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = pool.generateCommitment(secret, nullifier);
        
        vm.deal(user1, DEPOSIT_AMOUNT);
        vm.prank(user1);
        pool.deposit{value: DEPOSIT_AMOUNT}(commitment);
        
        assertEq(pool.totalDeposits(), 1);
        assertTrue(pool.commitments(commitment));
    }

    function test_Deposit_RevertsIfWrongAmount() public {
        bytes32 secret = keccak256("secret");
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = pool.generateCommitment(secret, nullifier);
        
        vm.deal(user1, DEPOSIT_AMOUNT + 1);
        vm.prank(user1);
        vm.expectRevert(AnonymousPool.InvalidDepositAmount.selector);
        pool.deposit{value: DEPOSIT_AMOUNT + 1}(commitment);
    }

    function test_Deposit_RevertsIfDuplicateCommitment() public {
        bytes32 secret = keccak256("secret");
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = pool.generateCommitment(secret, nullifier);
        
        vm.deal(user1, DEPOSIT_AMOUNT * 2);
        vm.startPrank(user1);
        pool.deposit{value: DEPOSIT_AMOUNT}(commitment);
        vm.expectRevert(AnonymousPool.DuplicateCommitment.selector);
        pool.deposit{value: DEPOSIT_AMOUNT}(commitment);
        vm.stopPrank();
    }

    function test_Withdraw_AllowsValidWithdrawal() public {
        bytes32 secret = keccak256("secret");
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = pool.generateCommitment(secret, nullifier);
        bytes32 nullifierHash = pool.generateNullifierHash(nullifier);
        bytes32 root = pool.getLatestRoot();
        
        // Make deposit
        vm.deal(user1, DEPOSIT_AMOUNT);
        vm.prank(user1);
        pool.deposit{value: DEPOSIT_AMOUNT}(commitment);
        root = pool.getLatestRoot();
        
        // Make withdrawal
        uint256 balanceBefore = user2.balance;
        vm.prank(user2);
        pool.withdraw(nullifierHash, payable(user2), root, payable(address(0)));
        
        assertEq(pool.totalWithdrawals(), 1);
        assertTrue(pool.nullifierHashes(nullifierHash));
        assertEq(user2.balance, balanceBefore + (DEPOSIT_AMOUNT - FEE));
    }

    function test_Withdraw_RevertsIfNullifierAlreadyUsed() public {
        bytes32 secret = keccak256("secret");
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = pool.generateCommitment(secret, nullifier);
        bytes32 nullifierHash = pool.generateNullifierHash(nullifier);
        bytes32 root = pool.getLatestRoot();
        
        vm.deal(user1, DEPOSIT_AMOUNT);
        vm.prank(user1);
        pool.deposit{value: DEPOSIT_AMOUNT}(commitment);
        root = pool.getLatestRoot();
        
        vm.prank(user2);
        pool.withdraw(nullifierHash, payable(user2), root, payable(address(0)));
        
        vm.expectRevert(AnonymousPool.NullifierAlreadyUsed.selector);
        pool.withdraw(nullifierHash, payable(user2), root, payable(address(0)));
    }

    function test_Withdraw_RevertsIfInvalidRecipient() public {
        bytes32 secret = keccak256("secret");
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = pool.generateCommitment(secret, nullifier);
        bytes32 nullifierHash = pool.generateNullifierHash(nullifier);
        bytes32 root = pool.getLatestRoot();
        
        vm.deal(user1, DEPOSIT_AMOUNT);
        vm.prank(user1);
        pool.deposit{value: DEPOSIT_AMOUNT}(commitment);
        root = pool.getLatestRoot();
        
        vm.expectRevert(AnonymousPool.InvalidRecipient.selector);
        pool.withdraw(nullifierHash, payable(address(0)), root, payable(address(0)));
    }

    function test_WithdrawTokens_AllowsValidTokenWithdrawal() public {
        ZToken token = new ZToken("Test Token", "TEST", 18);
        uint256 tokenAmount = 100 ether;
        
        // Mint tokens to pool
        token.mint(address(pool), tokenAmount);
        
        bytes32 secret = keccak256("secret");
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = pool.generateCommitment(secret, nullifier);
        bytes32 nullifierHash = pool.generateNullifierHash(nullifier);
        bytes32 root = pool.getLatestRoot();
        
        // Make ETH deposit first to get valid root
        vm.deal(user1, DEPOSIT_AMOUNT);
        vm.prank(user1);
        pool.deposit{value: DEPOSIT_AMOUNT}(commitment);
        root = pool.getLatestRoot();
        
        // Make token withdrawal
        uint256 withdrawAmount = 50 ether;
        uint256 balanceBefore = token.balanceOf(user2);
        vm.prank(user2);
        pool.withdrawTokens(nullifierHash, user2, root, address(token), withdrawAmount);
        
        assertEq(token.balanceOf(user2), balanceBefore + withdrawAmount);
        assertEq(pool.totalWithdrawals(), 1);
    }

    function test_WithdrawTokens_RevertsIfInsufficientBalance() public {
        ZToken token = new ZToken("Test Token", "TEST", 18);
        uint256 tokenAmount = 100 ether;
        
        token.mint(address(pool), tokenAmount);
        
        bytes32 secret = keccak256("secret");
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = pool.generateCommitment(secret, nullifier);
        bytes32 nullifierHash = pool.generateNullifierHash(nullifier);
        bytes32 root = pool.getLatestRoot();
        
        vm.deal(user1, DEPOSIT_AMOUNT);
        vm.prank(user1);
        pool.deposit{value: DEPOSIT_AMOUNT}(commitment);
        root = pool.getLatestRoot();
        
        vm.expectRevert(AnonymousPool.InsufficientTokenBalance.selector);
        pool.withdrawTokens(nullifierHash, user2, root, address(token), 1000 ether);
    }

    function test_GenerateCommitment_Consistent() public {
        bytes32 secret = keccak256("secret");
        bytes32 nullifier = keccak256("nullifier");
        
        bytes32 commitment1 = pool.generateCommitment(secret, nullifier);
        bytes32 commitment2 = pool.generateCommitment(secret, nullifier);
        
        assertEq(commitment1, commitment2);
    }

    function test_GenerateNullifierHash_Consistent() public {
        bytes32 nullifier = keccak256("nullifier");
        
        bytes32 hash1 = pool.generateNullifierHash(nullifier);
        bytes32 hash2 = pool.generateNullifierHash(nullifier);
        
        assertEq(hash1, hash2);
    }
}

