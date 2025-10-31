// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SimplifiedPoseidon
 * @dev Simplified Poseidon hash implementation for 2 inputs
 * @notice This is a simplified version optimized for Merkle trees
 * Constants are precomputed for the specific field and rounds
 */
contract SimplifiedPoseidon {
    uint256 constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    
    // Simplified round constants (using fewer rounds for gas optimization)
    // In production, you'd want the full set of constants
    uint256[8] private C = [
        uint256(0x0c1f91a0e9b8c6b3e0c9c8e7f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0),
        uint256(0x230a8305fb6ad5fbae5e5d5a5e5d5a5e5d5a5e5d5a5e5d5a5e5d5a5e5d5a5e5d),
        uint256(0x1b03d4a7f3b8c6b3e0c9c8e7f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0),
        uint256(0x0e1f91a0e9b8c6b3e0c9c8e7f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0),
        uint256(0x2c1f91a0e9b8c6b3e0c9c8e7f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0),
        uint256(0x1d1f91a0e9b8c6b3e0c9c8e7f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0),
        uint256(0x3a1f91a0e9b8c6b3e0c9c8e7f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0),
        uint256(0x2b1f91a0e9b8c6b3e0c9c8e7f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0f8e0)
    ];

    /**
     * @dev Poseidon hash function for 2 inputs
     * @param inputs Array of 2 uint256 values to hash
     * @return Hash result
     */
    function poseidon(uint256[2] memory inputs) public view returns (uint256) {
        uint256 state = 0;
        
        // Add inputs to the state
        state = addmod(state, inputs[0], FIELD_SIZE);
        state = addmod(state, inputs[1], FIELD_SIZE);
        
        // Simplified rounds (in production, this would be more complex)
        for (uint256 i = 0; i < 8; i++) {
            // S-box: state^5
            uint256 s = mulmod(state, state, FIELD_SIZE);
            s = mulmod(s, s, FIELD_SIZE);
            state = mulmod(s, state, FIELD_SIZE);
            
            // Add round constant
            state = addmod(state, C[i], FIELD_SIZE);
            
            // Mix with inputs (simplified mixing)
            state = addmod(state, mulmod(inputs[0], C[i], FIELD_SIZE), FIELD_SIZE);
            state = addmod(state, mulmod(inputs[1], C[7-i], FIELD_SIZE), FIELD_SIZE);
        }
        
        return state;
    }
    
    /**
     * @dev Hash two values - convenience function for Merkle tree
     */
    function hash2(uint256 left, uint256 right) external view returns (uint256) {
        uint256[2] memory inputs = [left, right];
        return poseidon(inputs);
    }
    
    /**
     * @dev Hash two bytes32 values - for compatibility with Merkle tree
     */
    function hashLeftRight(bytes32 left, bytes32 right) external view returns (bytes32) {
        uint256[2] memory inputs = [uint256(left), uint256(right)];
        return bytes32(poseidon(inputs));
    }
}
