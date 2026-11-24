// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BargePassport} from "../src/BargePassport.sol";

contract BargePassportTest is Test {
    BargePassport p;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    bytes32 agent = keccak256("aa043b6d-9664-4bfa-aacf-9a4b630c8837");

    function setUp() public {
        p = new BargePassport();
    }

    function testIssue() public {
        vm.warp(1000);
        vm.prank(alice);
        uint256 id = p.stamp(agent, bytes32(uint256(1)), 0, "Cedar");
        assertEq(id, 1);
        assertEq(p.total(), 1);
        BargePassport.Passport memory s = p.passport(1);
        assertEq(s.holder, alice);
        assertEq(s.agentId, agent);
        assertEq(s.fingerprint, bytes32(uint256(1)));
        assertEq(s.version, 1);
        assertEq(s.issuedAt, 1000);
        assertEq(s.name, "Cedar");
        assertEq(p.passportOf(alice, agent), 1);
    }

    function testStampAgainBumpsVersion() public {
        vm.warp(1000);
        vm.prank(alice);
        p.stamp(agent, bytes32(uint256(1)), 0, "Cedar");
        vm.warp(2000);
        vm.prank(alice);
        uint256 id = p.stamp(agent, bytes32(uint256(2)), 0, "Cedar v2");
        assertEq(id, 1);
        assertEq(p.total(), 1);
        BargePassport.Passport memory s = p.passport(1);
        assertEq(s.version, 2);
        assertEq(s.fingerprint, bytes32(uint256(2)));
        assertEq(s.issuedAt, 1000);
        assertEq(s.updatedAt, 2000);
        assertEq(s.name, "Cedar v2");
    }

    function testSameAgentOtherHolderGetsOwnPassport() public {
        vm.prank(alice);
        p.stamp(agent, bytes32(uint256(1)), 0, "Cedar");
        vm.prank(bob);
        uint256 id = p.stamp(agent, bytes32(uint256(1)), 0, "Cedar");
        assertEq(id, 2);
        assertEq(p.passport(1).holder, alice);
        assertEq(p.passport(2).holder, bob);
    }

    function testRejectsEmptyFingerprint() public {
        vm.expectRevert(BargePassport.EmptyFingerprint.selector);
        p.stamp(agent, bytes32(0), 0, "Cedar");
    }

    function testRejectsBadName() public {
        vm.expectRevert(BargePassport.BadName.selector);
        p.stamp(agent, bytes32(uint256(1)), 0, "");
        vm.expectRevert(BargePassport.BadName.selector);
        p.stamp(agent, bytes32(uint256(1)), 0, "12345678901234567890123456789012345678901234567890123456789012345");
    }

    function testUnknownPassport() public {
        vm.expectRevert(BargePassport.UnknownPassport.selector);
        p.passport(1);
    }
}
