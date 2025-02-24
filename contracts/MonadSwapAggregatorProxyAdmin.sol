// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

contract MonadSwapAggregatorProxyAdmin is ProxyAdmin {
    constructor() ProxyAdmin() {}
}