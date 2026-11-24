// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Barge Lineage
/// @notice An on-chain record of every barge an AI agent goes through. Each time an agent
///         lands on a new platform with Barge, its holder can add a ring to its lineage with the fingerprint of the
///         .barge package and the route it took. Lineages are keyed by (holder, agentId), so
///         nobody can write into someone else's lineage. No owner, no fees, no upgrades.
contract BargeLineage {
    struct Ring {
        bytes32 fingerprint; // SHA-256 of the .barge package
        uint64 time;         // block timestamp
        uint8 fromPlatform;  // index in Barge's platform list
        uint8 toPlatform;    // index in Barge's platform list
    }

    /// @notice Number of lineages opened.
    uint256 public lineages;
    /// @notice Number of rings written across all lineages.
    uint256 public totalRings;

    mapping(bytes32 => Ring[]) private _rings;

    event LineageOpened(address indexed holder, bytes32 indexed agentId);
    event Ringed(
        address indexed holder,
        bytes32 indexed agentId,
        bytes32 fingerprint,
        uint8 fromPlatform,
        uint8 toPlatform,
        uint256 index
    );

    error EmptyFingerprint();

    /// @notice Adds a ring to the caller's lineage for `agentId`. Opens it on first use.
    function ring(bytes32 agentId, bytes32 fingerprint, uint8 fromPlatform, uint8 toPlatform) external {
        if (fingerprint == bytes32(0)) revert EmptyFingerprint();
        Ring[] storage list = _rings[_key(msg.sender, agentId)];
        if (list.length == 0) {
            unchecked { lineages++; }
            emit LineageOpened(msg.sender, agentId);
        }
        // casting to 'uint64' is safe because block timestamps stay far below 2^64
        // forge-lint: disable-next-line(unsafe-typecast)
        list.push(Ring(fingerprint, uint64(block.timestamp), fromPlatform, toPlatform));
        unchecked { totalRings++; }
        emit Ringed(msg.sender, agentId, fingerprint, fromPlatform, toPlatform, list.length - 1);
    }

    /// @notice How many rings `holder` wrote for `agentId`.
    function ringCount(address holder, bytes32 agentId) external view returns (uint256) {
        return _rings[_key(holder, agentId)].length;
    }

    /// @notice Every ring `holder` wrote for `agentId`, oldest first.
    function ringsOf(address holder, bytes32 agentId) external view returns (Ring[] memory) {
        return _rings[_key(holder, agentId)];
    }

    function _key(address holder, bytes32 agentId) private pure returns (bytes32) {
        return keccak256(abi.encode(holder, agentId));
    }
}
