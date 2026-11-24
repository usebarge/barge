// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Barge Passport
/// @notice One passport per agent, on Robinhood Chain. A passport carries the agent's name, the
///         platform it was born on and the fingerprint of its latest .barge package. Each new
///         stamp bumps the version, so anyone can see an agent's current state and when it changed.
///         Passports are keyed by (holder, agentId): nobody can write into someone else's passport.
///         Nothing is transferable. No owner, no fees, no upgrades.
contract BargePassport {
    struct Passport {
        address holder;      // the wallet that issued it
        bytes32 agentId;     // keccak256 of the agent's stable Barge ID (same key as BargeLineage)
        bytes32 fingerprint; // SHA-256 of the latest .barge package
        uint64 issuedAt;     // block timestamp of the first stamp
        uint64 updatedAt;    // block timestamp of the latest stamp
        uint32 version;      // number of stamps
        uint8 source;        // index of the platform the agent came from, in Barge's platform list
        string name;         // agent name, 1 to 64 bytes
    }

    /// @notice Number of passports issued. Passport numbers run from 1 to `total`.
    uint256 public total;

    mapping(uint256 => Passport) private _passports;
    mapping(bytes32 => uint256) private _idOf;

    event PassportIssued(uint256 indexed id, address indexed holder, bytes32 indexed agentId, string name);
    event PassportStamped(uint256 indexed id, bytes32 fingerprint, uint32 version);

    error EmptyFingerprint();
    error BadName();
    error UnknownPassport();

    /// @notice Issues a passport for the caller's agent, or stamps it again if it already exists.
    /// @return id The passport number.
    function stamp(bytes32 agentId, bytes32 fingerprint, uint8 source, string calldata name) external returns (uint256 id) {
        if (fingerprint == bytes32(0)) revert EmptyFingerprint();
        uint256 len = bytes(name).length;
        if (len == 0 || len > 64) revert BadName();
        bytes32 key = keccak256(abi.encode(msg.sender, agentId));
        id = _idOf[key];
        // casting to 'uint64' is safe because block timestamps stay far below 2^64
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 nowTs = uint64(block.timestamp);
        if (id == 0) {
            unchecked { id = ++total; }
            _idOf[key] = id;
            _passports[id] = Passport(msg.sender, agentId, fingerprint, nowTs, nowTs, 1, source, name);
            emit PassportIssued(id, msg.sender, agentId, name);
            emit PassportStamped(id, fingerprint, 1);
        } else {
            Passport storage p = _passports[id];
            p.fingerprint = fingerprint;
            p.updatedAt = nowTs;
            p.name = name;
            unchecked { p.version += 1; }
            emit PassportStamped(id, fingerprint, p.version);
        }
    }

    /// @notice Reads passport number `id`.
    function passport(uint256 id) external view returns (Passport memory) {
        if (id == 0 || id > total) revert UnknownPassport();
        return _passports[id];
    }

    /// @notice The passport number of `holder`'s agent `agentId`, or 0 if it has none.
    function passportOf(address holder, bytes32 agentId) external view returns (uint256) {
        return _idOf[keccak256(abi.encode(holder, agentId))];
    }
}
