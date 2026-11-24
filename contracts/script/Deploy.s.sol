// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BargeLineage} from "../src/BargeLineage.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        BargeLineage lineage = new BargeLineage();
        vm.stopBroadcast();
        console.log("BARGE_LINEAGE:", address(lineage));
    }
}
