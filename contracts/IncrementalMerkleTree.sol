// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SimplifiedPoseidon.sol";

/**
 * @title IncrementalMerkleTree
 * @dev Incremental Merkle Tree implementation using Poseidon hash
 */
contract IncrementalMerkleTree {
    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    
    SimplifiedPoseidon public immutable poseidonHasher;
    uint32 public immutable depth;
    
    mapping(uint256 => bytes32) public filledSubtrees;
    mapping(uint256 => bytes32) public roots;
    uint32 public constant ROOT_HISTORY_SIZE = 30;
    uint32 public currentRootIndex = 0;
    uint32 public nextLeafIndex = 0;
    
    event LeafInserted(uint32 indexed leafIndex, bytes32 indexed leaf, bytes32 root);
    
    error MerkleTreeFull();
    error InvalidDepth();
    error IndexOutOfBounds();
    
    /**
     * @dev Constructor
     * @param _depth The depth of the tree (max 32)
     * @param _poseidon Address of the Poseidon hasher contract
     */
    constructor(uint32 _depth, SimplifiedPoseidon _poseidon) {
        if (_depth == 0 || _depth > 32) revert InvalidDepth();
        
        depth = _depth;
        poseidonHasher = _poseidon;
        
        // Initialize zero values for each level
        for (uint32 i = 0; i < _depth; i++) {
            filledSubtrees[i] = zeros(i);
        }
        
        roots[0] = zeros(_depth);
    }
    
    /**
     * @dev Insert a leaf into the tree
     * @param _leaf The leaf to insert
     * @return The index of the inserted leaf
     */
    function insertLeaf(bytes32 _leaf) public returns (uint32) {
        uint32 _nextLeafIndex = nextLeafIndex;
        if (_nextLeafIndex >= uint32(2) ** depth) revert MerkleTreeFull();
        
        uint32 currentIndex = _nextLeafIndex;
        bytes32 currentLevelHash = _leaf;
        bytes32 left;
        bytes32 right;
        
        for (uint32 i = 0; i < depth; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = zeros(i);
                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            
            currentLevelHash = poseidonHasher.hashLeftRight(left, right);
            currentIndex /= 2;
        }
        
        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = currentLevelHash;
        nextLeafIndex = _nextLeafIndex + 1;
        
        emit LeafInserted(_nextLeafIndex, _leaf, currentLevelHash);
        
        return _nextLeafIndex;
    }
    
    /**
     * @dev Check if a root is known (valid)
     * @param _root The root to check
     * @return Whether the root is known
     */
    function isKnownRoot(bytes32 _root) public view returns (bool) {
        if (_root == bytes32(0)) return false;
        
        uint32 _currentRootIndex = currentRootIndex;
        uint32 i = _currentRootIndex;
        
        do {
            if (_root == roots[i]) return true;
            if (i == 0) i = ROOT_HISTORY_SIZE;
            i--;
        } while (i != _currentRootIndex);
        
        return false;
    }
    
    /**
     * @dev Get the latest root
     * @return The latest root
     */
    function getLatestRoot() public view returns (bytes32) {
        return roots[currentRootIndex];
    }
    
    /**
     * @dev Get zero value for a specific level
     * @param level The level
     * @return The zero value
     */
    function zeros(uint256 level) public pure returns (bytes32) {
        // Pre-computed zero values for each level
        // These are computed as: zeros[i+1] = poseidon(zeros[i], zeros[i])
        // Starting with zeros[0] = keccak256("cyfrin") % FIELD_SIZE
        
        if (level == 0) return bytes32(0x0d823319708ab99ec915efd4f7e03d11ca1790918e8f04cd14100aceca2aa9ff);
        else if (level == 1) return bytes32(0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c);
        else if (level == 2) return bytes32(0x256a6135777eee2fd26f54b8b7037a25439d5235caee224154186d2b8a52e31d);
        else if (level == 3) return bytes32(0x1151949895e82ab19924de92c40a3d6f7bcb60d92b00504b8199613683f0c200);
        else if (level == 4) return bytes32(0x20121ee811489ff8d61f09fb89e313f14959a0f28bb428a20dba6b0b068b3bdb);
        else if (level == 5) return bytes32(0x0a89ca6ffa14cc462cfedb842c30ed221a50a3d6bf022a6a57dc82ab24c157c9);
        else if (level == 6) return bytes32(0x24ca05c2b5cd42e890d6be94c68d0689f4f21c9cec9c0f13fe41d566dfb54959);
        else if (level == 7) return bytes32(0x1ccb97c932565a92c60156bdba2d08f3bf1377464e025cee765679e604a7315c);
        else if (level == 8) return bytes32(0x19156fbd7d1a8bf5cba8909367de1b624534ebab4f0f79e003bccdd1b182bdb4);
        else if (level == 9) return bytes32(0x261af8c1f0912e465744641409f622d466c3920ac6e5ff37e36604cb11dfff80);
        else if (level == 10) return bytes32(0x0058459724ff6ca5a1652fcbc3e82b93895cf08e975b19beab3f54c217d1c007);
        else revert IndexOutOfBounds();
    }
}
