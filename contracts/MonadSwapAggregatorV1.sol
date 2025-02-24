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

contract MonadSwapAggregatorV1 is Initializable, OwnableUpgradeable {
    // Events
    event TokenSwapped(
        address indexed user,
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut
    );

    // State variables
    IBeanRouter public beanRouter;
    address public wmon;
    address private constant NATIVE = address(0);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _beanRouter, address _wmon) public initializer {
        __Ownable_init();
        beanRouter = IBeanRouter(_beanRouter);
        wmon = _wmon;
    }

    // Function untuk mendapatkan estimasi output
    function getAmountOut(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        address[] memory path;

        // Handle native MON
        if (fromToken == NATIVE) fromToken = wmon;
        if (toToken == NATIVE) toToken = wmon;

        if (fromToken == wmon || toToken == wmon) {
            path = new address[](2);
            path[0] = fromToken;
            path[1] = toToken;
        } else {
            // Jika bukan WMON, gunakan WMON sebagai perantara
            path = new address[](3);
            path[0] = fromToken;
            path[1] = wmon;
            path[2] = toToken;
        }

        uint256[] memory amounts = beanRouter.getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
    }

    // Main swap function
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
            return _swapMonForTokens(toToken, amountIn, amountOutMin);
        } else if (toToken == NATIVE) {
            return _swapTokensForMon(fromToken, amountIn, amountOutMin);
        } else {
            return _swapTokens(fromToken, toToken, amountIn, amountOutMin);
        }
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
        emit TokenSwapped(msg.sender, NATIVE, toToken, amountIn, amountOut);
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
        emit TokenSwapped(msg.sender, fromToken, NATIVE, amountIn, amountOut);
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
        address[] memory path;
        if (fromToken == wmon || toToken == wmon) {
            path = new address[](2);
            path[0] = fromToken;
            path[1] = toToken;
        } else {
            path = new address[](3);
            path[0] = fromToken;
            path[1] = wmon;
            path[2] = toToken;
        }

        // Execute swap
        uint256[] memory amounts = beanRouter.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 1200
        );

        uint256 amountOut = amounts[amounts.length - 1];
        emit TokenSwapped(msg.sender, fromToken, toToken, amountIn, amountOut);
        return amountOut;
    }

    // Function untuk menerima MON
    receive() external payable {}

    // Fungsi upgrade (hanya owner)
    function updateBeanRouter(address _newRouter) external onlyOwner {
        require(_newRouter != address(0), "Invalid router address");
        beanRouter = IBeanRouter(_newRouter);
    }

    function updateWMON(address _newWMON) external onlyOwner {
        require(_newWMON != address(0), "Invalid WMON address");
        wmon = _newWMON;
    }
}