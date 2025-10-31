// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IncrementalMerkleTree.sol";
import "./SimplifiedPoseidon.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AnonymousPool
 * @dev Simple anonymous deposit and withdrawal pool
 * @notice This is a simplified version for testing. Production version needs ZK proof verification
 */
contract AnonymousPool is IncrementalMerkleTree {
    uint256 public constant DEPOSIT_AMOUNT = 0.001 ether; // Small amount for testing
    uint256 public constant FEE = 0.0001 ether; // 10% fee for simplicity
    
    mapping(bytes32 => bool) public nullifierHashes;
    mapping(bytes32 => bool) public commitments;
    
    address public feeCollector;
    uint256 public totalDeposits;
    uint256 public totalWithdrawals;
    
    event Deposit(bytes32 indexed commitment, uint32 leafIndex, address indexed from, uint256 timestamp);
    event Withdrawal(address indexed to, bytes32 nullifierHash, address indexed relayer, uint256 fee);
    event TokenWithdrawal(address indexed token, address indexed to, bytes32 nullifierHash, uint256 amount);
    
    error InvalidDepositAmount();
    error DuplicateCommitment();
    error InvalidProof();
    error NullifierAlreadyUsed();
    error InvalidRecipient();
    error TransferFailed();
    error NotEnoughBalance();
    error InvalidToken();
    error InsufficientTokenBalance();
    
    /**
     * @dev Constructor
     * @param _depth Merkle tree depth (10 = 1024 deposits max, 20 = ~1M deposits max)
     * @param _poseidon Address of Poseidon hasher
     */
    constructor(
        uint32 _depth,
        SimplifiedPoseidon _poseidon
    ) IncrementalMerkleTree(_depth, _poseidon) {
        feeCollector = msg.sender;
    }
    
    /**
     * @dev Deposit funds with a commitment
     * @param _commitment The Poseidon hash of (secret, nullifier)
     */
    function deposit(bytes32 _commitment) external payable {
        if (msg.value != DEPOSIT_AMOUNT) revert InvalidDepositAmount();
        if (commitments[_commitment]) revert DuplicateCommitment();
        
        uint32 leafIndex = insertLeaf(_commitment);
        commitments[_commitment] = true;
        totalDeposits++;
        
        emit Deposit(_commitment, leafIndex, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Withdraw funds using a nullifier
     * @param _nullifierHash Hash of the nullifier to prevent double spending
     * @param _recipient Address to receive the funds
     * @param _root Merkle root to verify against
     * @param _relayer Optional relayer address (can be address(0))
     * 
     * NOTE: In production, this would also take and verify a ZK proof
     * For testing, we're using a simplified version
     */
    function withdraw(
        bytes32 _nullifierHash,
        address payable _recipient,
        bytes32 _root,
        address payable _relayer
    ) external {
        if (_recipient == address(0)) revert InvalidRecipient();
        if (nullifierHashes[_nullifierHash]) revert NullifierAlreadyUsed();
        if (!isKnownRoot(_root)) revert InvalidProof();
        
        // In production: Verify ZK proof here
        // The proof would verify:
        // 1. User knows secret and nullifier
        // 2. commitment = Poseidon(secret, nullifier) exists in the tree
        // 3. nullifierHash = Poseidon(nullifier)
        
        nullifierHashes[_nullifierHash] = true;
        totalWithdrawals++;
        
        uint256 amountToRecipient = DEPOSIT_AMOUNT - FEE;
        uint256 relayerFee = 0;
        
        // If using a relayer, they get half the fee
        if (_relayer != address(0)) {
            relayerFee = FEE / 2;
            amountToRecipient -= relayerFee;
        }
        
        // Transfer funds
        (bool success, ) = _recipient.call{value: amountToRecipient}("");
        if (!success) revert TransferFailed();
        
        if (relayerFee > 0) {
            (success, ) = _relayer.call{value: relayerFee}("");
            if (!success) revert TransferFailed();
        }
        
        emit Withdrawal(_recipient, _nullifierHash, _relayer, relayerFee);
    }
    
    /**
     * @dev Withdraw tokens using a nullifier
     * @param _nullifierHash Hash of the nullifier to prevent double spending
     * @param _recipient Address to receive the tokens
     * @param _root Merkle root to verify against
     * @param _token Address of the token contract
     * @param _amount Amount of tokens to withdraw
     * 
     * NOTE: In production, this would also take and verify a ZK proof
     */
    function withdrawTokens(
        bytes32 _nullifierHash,
        address _recipient,
        bytes32 _root,
        address _token,
        uint256 _amount
    ) external {
        if (_recipient == address(0)) revert InvalidRecipient();
        if (_token == address(0)) revert InvalidToken();
        if (_amount == 0) revert InvalidDepositAmount();
        if (nullifierHashes[_nullifierHash]) revert NullifierAlreadyUsed();
        if (!isKnownRoot(_root)) revert InvalidProof();
        
        // In production: Verify ZK proof here
        // The proof would verify:
        // 1. User knows secret and nullifier
        // 2. commitment = Poseidon(secret, nullifier) exists in the tree
        // 3. nullifierHash = Poseidon(nullifier)
        
        nullifierHashes[_nullifierHash] = true;
        totalWithdrawals++;
        
        // Check pool has enough tokens
        IERC20 token = IERC20(_token);
        if (token.balanceOf(address(this)) < _amount) revert InsufficientTokenBalance();
        
        // Transfer tokens to recipient
        bool success = token.transfer(_recipient, _amount);
        if (!success) revert TransferFailed();
        
        emit TokenWithdrawal(_token, _recipient, _nullifierHash, _amount);
    }
    
    /**
     * @dev Generate commitment hash (helper function for testing)
     * @param _secret Random secret
     * @param _nullifier Random nullifier
     * @return The commitment hash
     */
    function generateCommitment(
        bytes32 _secret,
        bytes32 _nullifier
    ) external view returns (bytes32) {
        return poseidonHasher.hashLeftRight(_secret, _nullifier);
    }
    
    /**
     * @dev Generate nullifier hash (helper function for testing)
     * @param _nullifier The nullifier
     * @return The nullifier hash
     */
    function generateNullifierHash(bytes32 _nullifier) external view returns (bytes32) {
        return poseidonHasher.hashLeftRight(_nullifier, _nullifier);
    }
    
    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees() external {
        uint256 balance = address(this).balance;
        uint256 lockedAmount = (totalDeposits - totalWithdrawals) * DEPOSIT_AMOUNT;
        
        if (balance <= lockedAmount) revert NotEnoughBalance();
        
        uint256 fees = balance - lockedAmount;
        (bool success, ) = feeCollector.call{value: fees}("");
        if (!success) revert TransferFailed();
    }
    
    /**
     * @dev Update fee collector address
     */
    function updateFeeCollector(address _newCollector) external {
        require(msg.sender == feeCollector, "Only fee collector");
        feeCollector = _newCollector;
    }
    
    /**
     * @dev Get contract statistics
     */
    function getStats() external view returns (
        uint256 poolBalance,
        uint256 deposits,
        uint256 withdrawals,
        uint256 anonymitySet
    ) {
        return (
            address(this).balance,
            totalDeposits,
            totalWithdrawals,
            nextLeafIndex
        );
    }
}
