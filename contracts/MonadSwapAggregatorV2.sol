// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IBeanRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

contract MonadSwapAggregatorV2 is Initializable, OwnableUpgradeable {
    // Events
    event TokenSwapped(
        address indexed user,
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );

    event FeeUpdated(uint256 newFee);
    event FeeCollectorUpdated(address newCollector);

    // State variables
    IBeanRouter public beanRouter;
    address public wmon;
    address private constant NATIVE = address(0);

    // New V2 variables
    uint256 public swapFee; // dalam basis points (1 = 0.01%)
    address public feeCollector;
    mapping(address => bool) public preferredPairs; // Pairs yang bisa di-swap langsung

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _beanRouter, address _wmon) public initializer {
        __Ownable_init();
        beanRouter = IBeanRouter(_beanRouter);
        wmon = _wmon;
        swapFee = 30; // 0.3% fee default
        feeCollector = msg.sender;
    }

    // New V2 functions
    function setSwapFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 100, "Fee too high"); // Max 1%
        swapFee = _newFee;
        emit FeeUpdated(_newFee);
    }

    function setFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid address");
        feeCollector = _newCollector;
        emit FeeCollectorUpdated(_newCollector);
    }

    function setPreferredPair(address token0, address token1, bool status) external onlyOwner {
        bytes32 pairKey = _getPairKey(token0, token1);
        preferredPairs[address(uint160(uint256(pairKey)))] = status;
    }

    function _getPairKey(address token0, address token1) internal pure returns (bytes32) {
        return token0 < token1
            ? keccak256(abi.encodePacked(token0, token1))
            : keccak256(abi.encodePacked(token1, token0));
    }

    // Updated V2 functions
    function getAmountOut(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        address[] memory path = _getOptimalPath(fromToken, toToken);
        uint256[] memory amounts = beanRouter.getAmountsOut(amountIn, path);
        amountOut = amounts[amounts.length - 1];

        // Apply fee
        amountOut = amountOut * (10000 - swapFee) / 10000;
    }

    function _getOptimalPath(address fromToken, address toToken) internal view returns (address[] memory) {
        if (fromToken == NATIVE) fromToken = wmon;
        if (toToken == NATIVE) toToken = wmon;

        // Check if direct swap is possible
        bytes32 pairKey = _getPairKey(fromToken, toToken);
        if (preferredPairs[address(uint160(uint256(pairKey)))]) {
            address[] memory directPath = new address[](2);
            directPath[0] = fromToken;
            directPath[1] = toToken;
            return directPath;
        }

        // Default to WMON routing
        if (fromToken == wmon || toToken == wmon) {
            address[] memory path = new address[](2);
            path[0] = fromToken;
            path[1] = toToken;
            return path;
        } else {
            address[] memory path = new address[](3);
            path[0] = fromToken;
            path[1] = wmon;
            path[2] = toToken;
            return path;
        }
    }

    // Main swap function (updated with fee)
    function swap(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 amountOutMin
    ) external payable returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be > 0");
        require(fromToken != toToken, "Same tokens");

        if (fromToken == NATIVE) {
            require(msg.value == amountIn, "Invalid MON amount");
            amountOut = _swapMonForTokens(toToken, amountIn, amountOutMin);
        } else if (toToken == NATIVE) {
            amountOut = _swapTokensForMon(fromToken, amountIn, amountOutMin);
        } else {
            amountOut = _swapTokens(fromToken, toToken, amountIn, amountOutMin);
        }

        // Collect fee
        uint256 fee = amountOut * swapFee / 10000;
        if (fee > 0 && toToken != NATIVE) {
            IERC20(toToken).transfer(feeCollector, fee);
        }

        emit TokenSwapped(msg.sender, fromToken, toToken, amountIn, amountOut, fee);
    }

    // Internal function untuk swap MON ke token
    function _swapMonForTokens(
        address toToken,
        uint256 amountIn,
        uint256 amountOutMin
    ) internal returns (uint256) {
        // Setup path
        address[] memory path = new address[](2);
        path[0] = wmon;
        path[1] = toToken;

        // Swap MON ke token
        uint256[] memory amounts = beanRouter.swapExactETHForTokens{value: amountIn}(
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 1200
        );

        uint256 amountOut = amounts[amounts.length - 1];
        return amountOut;
    }

    // Internal function untuk swap token ke MON
    function _swapTokensForMon(
        address fromToken,
        uint256 amountIn,
        uint256 amountOutMin
    ) internal returns (uint256) {
        // Transfer tokens from user
        require(
            IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn),
            "Transfer from failed"
        );

        // Approve router
        IERC20(fromToken).approve(address(beanRouter), amountIn);

        // Setup path
        address[] memory path = new address[](2);
        path[0] = fromToken;
        path[1] = wmon;

        // Swap token ke MON
        uint256[] memory amounts = beanRouter.swapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 1200
        );

        uint256 amountOut = amounts[amounts.length - 1];
        return amountOut;
    }

    // Internal function untuk swap antar token
    function _swapTokens(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 amountOutMin
    ) internal returns (uint256) {
        // Transfer tokens from user
        require(
            IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn),
            "Transfer from failed"
        );

        // Approve router
        IERC20(fromToken).approve(address(beanRouter), amountIn);

        // Setup path
        address[] memory path = _getOptimalPath(fromToken, toToken);

        // Execute swap
        uint256[] memory amounts = beanRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 1200
        );

        uint256 amountOut = amounts[amounts.length - 1];
        return amountOut;
    }

    receive() external payable {}

    // Admin functions
    function updateBeanRouter(address _newRouter) external onlyOwner {
        require(_newRouter != address(0), "Invalid router address");
        beanRouter = IBeanRouter(_newRouter);
    }

    function updateWMON(address _newWMON) external onlyOwner {
        require(_newWMON != address(0), "Invalid WMON address");
        wmon = _newWMON;
    }
}