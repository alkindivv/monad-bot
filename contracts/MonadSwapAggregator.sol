// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

contract MonadSwapAggregator {
    // Events
    event TokenSwapped(
        address indexed user,
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut
    );

    // Constants
    IBeanRouter public constant BEAN_ROUTER = IBeanRouter(0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89);
    address public constant WMON = 0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701;

    // Function untuk mendapatkan estimasi output
    function getAmountOut(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) public view returns (uint256 amountOut) {
        address[] memory path;
        if (fromToken == WMON || toToken == WMON) {
            path = new address[](2);
            path[0] = fromToken;
            path[1] = toToken;
        } else {
            // Jika bukan WMON, gunakan WMON sebagai perantara
            path = new address[](3);
            path[0] = fromToken;
            path[1] = WMON;
            path[2] = toToken;
        }

        uint256[] memory amounts = BEAN_ROUTER.getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
    }

    // Main swap function
    function swap(
        address fromToken,
        address toToken,
        uint256 amountIn,
        uint256 amountOutMin
    ) external returns (uint256 amountOut) {
        // Check input
        require(amountIn > 0, "Amount must be > 0");
        require(fromToken != toToken, "Same tokens");

        // Transfer tokens from user
        require(
            IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn),
            "Transfer from failed"
        );

        // Approve router
        IERC20(fromToken).approve(address(BEAN_ROUTER), amountIn);

        // Setup path
        address[] memory path;
        if (fromToken == WMON || toToken == WMON) {
            path = new address[](2);
            path[0] = fromToken;
            path[1] = toToken;
        } else {
            // Jika bukan WMON, gunakan WMON sebagai perantara
            path = new address[](3);
            path[0] = fromToken;
            path[1] = WMON;
            path[2] = toToken;
        }

        // Execute swap menggunakan msg.sender sebagai penerima
        uint256[] memory amounts = BEAN_ROUTER.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender, // Send directly to user
            block.timestamp + 1200 // 20 menit deadline
        );

        amountOut = amounts[amounts.length - 1];
        emit TokenSwapped(
            msg.sender,
            fromToken,
            toToken,
            amountIn,
            amountOut
        );

        return amountOut;
    }

    // Function untuk menerima MON yang dikirim ke kontrak (fallback)
    receive() external payable {}
}