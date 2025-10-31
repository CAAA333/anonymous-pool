// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IncrementalMerkleTree} from "../contracts/IncrementalMerkleTree.sol";
import {SimplifiedPoseidon} from "../contracts/SimplifiedPoseidon.sol";

contract IncrementalMerkleTreeTest is Test {
    IncrementalMerkleTree tree;
    SimplifiedPoseidon poseidon;
    uint32 constant TREE_DEPTH = 10;

    function setUp() public {
        poseidon = new SimplifiedPoseidon();
        tree = new IncrementalMerkleTree(TREE_DEPTH, poseidon);
    }

    function test_Deployment_SetsDepth() public {
        assertEq(tree.depth(), TREE_DEPTH);
    }

    function test_Deployment_InitializesRoot() public {
        bytes32 root = tree.getLatestRoot();
        assertNotEq(root, bytes32(0));
    }

    function test_Deployment_ZeroLeaves() public {
        assertEq(tree.nextLeafIndex(), 0);
    }

    function test_Deployment_RevertsIfDepthZero() public {
        vm.expectRevert(IncrementalMerkleTree.InvalidDepth.selector);
        new IncrementalMerkleTree(0, poseidon);
    }

    function test_Deployment_RevertsIfDepthTooLarge() public {
        vm.expectRevert(IncrementalMerkleTree.InvalidDepth.selector);
        new IncrementalMerkleTree(33, poseidon);
    }

    function test_InsertLeaf_FirstLeaf() public {
        bytes32 leaf = keccak256("leaf1");
        uint32 index = tree.insertLeaf(leaf);
        
        assertEq(index, 0);
        assertEq(tree.nextLeafIndex(), 1);
    }

    function test_InsertLeaf_MultipleLeaves() public {
        bytes32 leaf1 = keccak256("leaf1");
        bytes32 leaf2 = keccak256("leaf2");
        bytes32 leaf3 = keccak256("leaf3");
        
        tree.insertLeaf(leaf1);
        tree.insertLeaf(leaf2);
        uint32 index3 = tree.insertLeaf(leaf3);
        
        assertEq(index3, 2);
        assertEq(tree.nextLeafIndex(), 3);
    }

    function test_InsertLeaf_UpdatesRoot() public {
        bytes32 root1 = tree.getLatestRoot();
        bytes32 leaf1 = keccak256("leaf1");
        tree.insertLeaf(leaf1);
        bytes32 root2 = tree.getLatestRoot();
        
        assertNotEq(root1, root2);
        
        bytes32 leaf2 = keccak256("leaf2");
        tree.insertLeaf(leaf2);
        bytes32 root3 = tree.getLatestRoot();
        
        assertNotEq(root2, root3);
        assertNotEq(root1, root3);
    }

    function test_InsertLeaf_RevertsIfTreeFull() public {
        uint256 maxLeaves = 2 ** TREE_DEPTH;
        
        // Insert leaves up to capacity
        for (uint256 i = 0; i < maxLeaves; i++) {
            bytes32 leaf = keccak256(abi.encodePacked(i));
            tree.insertLeaf(leaf);
        }
        
        bytes32 overflowLeaf = keccak256("overflow");
        vm.expectRevert(IncrementalMerkleTree.MerkleTreeFull.selector);
        tree.insertLeaf(overflowLeaf);
    }

    function test_IsKnownRoot_ReturnsTrue() public {
        bytes32 leaf = keccak256("leaf");
        tree.insertLeaf(leaf);
        
        bytes32 root = tree.getLatestRoot();
        assertTrue(tree.isKnownRoot(root));
    }

    function test_IsKnownRoot_ReturnsFalseForUnknown() public {
        bytes32 fakeRoot = keccak256("fake");
        assertFalse(tree.isKnownRoot(fakeRoot));
    }

    function test_Zeros_DifferentForDifferentLevels() public {
        bytes32 zero0 = tree.zeros(0);
        bytes32 zero1 = tree.zeros(1);
        bytes32 zero2 = tree.zeros(2);
        
        assertNotEq(zero0, zero1);
        assertNotEq(zero1, zero2);
    }

    function test_Zeros_RevertsIfOutOfBounds() public {
        vm.expectRevert(IncrementalMerkleTree.IndexOutOfBounds.selector);
        tree.zeros(TREE_DEPTH + 1);
    }
}

