// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MonadSwap {
    // Events
    event TokenSwapped(
        address indexed user,
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut
    );

    // Debug events
    event Debug(string message, uint256 value);
    event DebugAddress(string message, address value);
    event DebugBalance(string message, address token, uint256 balance);

    // Mapping untuk menyimpan pair yang didukung
    mapping(address => mapping(address => bool)) public supportedPairs;

    // Mapping untuk rate antar token (1e18 based)
    mapping(address => mapping(address => uint256)) public exchangeRates;

    // Owner address
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;

        // Initialize supported pairs dengan checksummed address
        address USDC = 0xf817257fed379853cDe0fa4F97AB987181B1E5Ea;
        address USDT = 0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D;
        address WETH = 0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37;

        // Add pairs
        _addPair(USDC, USDT);
        _addPair(USDC, WETH);
        _addPair(USDT, WETH);

        // Set initial rates (1:1 for stablecoins, 1:2000 for ETH)
        _setRate(USDC, USDT, 1e18); // 1 USDC = 1 USDT
        _setRate(USDT, USDC, 1e18); // 1 USDT = 1 USDC
        _setRate(WETH, USDC, 2000e18); // 1 WETH = 2000 USDC
        _setRate(USDC, WETH, 5e14); // 1 USDC = 0.0005 WETH
        _setRate(WETH, USDT, 2000e18); // 1 WETH = 2000 USDT
        _setRate(USDT, WETH, 5e14); // 1 USDT = 0.0005 WETH
    }

    // Function untuk menambah pair
    function _addPair(address token1, address token2) internal {
        supportedPairs[token1][token2] = true;
        supportedPairs[token2][token1] = true;
    }

    // Function untuk set rate
    function _setRate(address fromToken, address toToken, uint256 rate) internal {
        exchangeRates[fromToken][toToken] = rate;
    }

    // Function untuk swap token
    function swap(
        address fromToken,
        address toToken,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        // Debug info
        emit DebugAddress("From Token", fromToken);
        emit DebugAddress("To Token", toToken);
        emit Debug("Amount In", amountIn);

        // Check pair support
        require(supportedPairs[fromToken][toToken], "Pair not supported");

        // Check input amount
        require(amountIn > 0, "Amount must be > 0");

        // Check contract balances
        uint256 contractFromBalance = IERC20(fromToken).balanceOf(address(this));
        uint256 contractToBalance = IERC20(toToken).balanceOf(address(this));
        emit DebugBalance("Contract From Balance Before", fromToken, contractFromBalance);
        emit DebugBalance("Contract To Balance Before", toToken, contractToBalance);

        // Check user balance
        uint256 userFromBalance = IERC20(fromToken).balanceOf(msg.sender);
        emit DebugBalance("User From Balance", fromToken, userFromBalance);
        require(userFromBalance >= amountIn, "Insufficient balance");

        // Calculate amount out
        amountOut = (amountIn * exchangeRates[fromToken][toToken]) / 1e18;
        require(amountOut > 0, "Invalid amount out");
        emit Debug("Amount Out", amountOut);

        // Check if contract has enough balance
        require(contractToBalance >= amountOut, "Insufficient contract balance");

        // Transfer tokens
        require(IERC20(fromToken).transferFrom(msg.sender, address(this), amountIn), "Transfer from failed");

        // Check balances after transferFrom
        contractFromBalance = IERC20(fromToken).balanceOf(address(this));
        emit DebugBalance("Contract From Balance After TransferFrom", fromToken, contractFromBalance);

        require(IERC20(toToken).transfer(msg.sender, amountOut), "Transfer to failed");

        // Check final balances
        contractFromBalance = IERC20(fromToken).balanceOf(address(this));
        contractToBalance = IERC20(toToken).balanceOf(address(this));
        emit DebugBalance("Contract From Balance After", fromToken, contractFromBalance);
        emit DebugBalance("Contract To Balance After", toToken, contractToBalance);

        emit TokenSwapped(msg.sender, fromToken, toToken, amountIn, amountOut);
        return amountOut;
    }

    // Owner functions
    function addPair(address token1, address token2) external onlyOwner {
        _addPair(token1, token2);
    }

    function setRate(address fromToken, address toToken, uint256 rate) external onlyOwner {
        _setRate(fromToken, toToken, rate);
    }

    // Function untuk deposit token ke contract
    function depositToken(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Deposit failed");
        emit DebugBalance("Token Deposited", token, IERC20(token).balanceOf(address(this)));
    }

    // Emergency withdraw
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(owner, balance), "Withdraw failed");
    }
}