// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BargeLineage} from "../src/BargeLineage.sol";

contract BargeLineageTest is Test {
    BargeLineage p;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    bytes32 agent = keccak256("aa043b6d-9664-4bfa-aacf-9a4b630c8837");

    function setUp() public {
        p = new BargeLineage();
    }

    function testFirstRingOpensLineage() public {
        vm.prank(alice);
        p.ring(agent, bytes32(uint256(1)), 0, 1);
        assertEq(p.lineages(), 1);
        assertEq(p.totalRings(), 1);
        assertEq(p.ringCount(alice, agent), 1);
        BargeLineage.Ring[] memory s = p.ringsOf(alice, agent);
        assertEq(s[0].fingerprint, bytes32(uint256(1)));
        assertEq(s[0].fromPlatform, 0);
        assertEq(s[0].toPlatform, 1);
    }

    function testSecondRingKeepsOneLineage() public {
        vm.startPrank(alice);
        p.ring(agent, bytes32(uint256(1)), 0, 1);
        p.ring(agent, bytes32(uint256(2)), 1, 4);
        vm.stopPrank();
        assertEq(p.lineages(), 1);
        assertEq(p.totalRings(), 2);
        assertEq(p.ringCount(alice, agent), 2);
    }

    function testLineagesAreSeparatedByHolder() public {
        vm.prank(alice);
        p.ring(agent, bytes32(uint256(1)), 0, 1);
        vm.prank(bob);
        p.ring(agent, bytes32(uint256(9)), 2, 3);
        assertEq(p.lineages(), 2);
        assertEq(p.ringCount(alice, agent), 1);
        assertEq(p.ringCount(bob, agent), 1);
        assertEq(p.ringsOf(bob, agent)[0].fingerprint, bytes32(uint256(9)));
    }

    function testRejectsEmptyFingerprint() public {
        vm.prank(alice);
        vm.expectRevert(BargeLineage.EmptyFingerprint.selector);
        p.ring(agent, bytes32(0), 0, 1);
    }
}
