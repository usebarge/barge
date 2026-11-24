// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BargePassport} from "../src/BargePassport.sol";

contract DeployPassport is Script {
    function run() external {
        vm.startBroadcast();
        BargePassport passport = new BargePassport();
        vm.stopBroadcast();
        console.log("BARGE_PASSPORT:", address(passport));
    }
}
