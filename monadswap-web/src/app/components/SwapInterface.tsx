"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowsUpDownIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { ethers } from "ethers";
import ConnectWallet from "./ConnectWallet";

const MONADSWAP_ADDRESS = "0x1422a7114DC23BC1473D86378D89a1EE134a0f6c";

const MONADSWAP_ABI = [
  "function swap(address fromToken, address toToken, uint256 amountIn) external returns (uint256 amountOut)",
  "function supportedPairs(address, address) external view returns (bool)",
  "function exchangeRates(address, address) external view returns (uint256)",
  "function calculateFee(uint256 amount) public pure returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

const tokens = [
  {
    symbol: "USDC",
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    decimals: 6,
    icon: "💵",
  },
  {
    symbol: "USDT",
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    decimals: 6,
    icon: "💰",
  },
  {
    symbol: "WETH",
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    decimals: 18,
    icon: "⚡",
  },
];

export default function SwapInterface() {
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTokenList, setShowTokenList] = useState<"from" | "to" | null>(
    null
  );
  const [provider, setProvider] =
    useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState("");
  const [allowance, setAllowance] = useState("0");
  const [balance, setBalance] = useState("0");

  useEffect(() => {
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);
      provider.getSigner().getAddress().then(setAccount).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (provider && account) {
      setSigner(provider.getSigner());
      checkAllowanceAndBalance();
    }
  }, [provider, account, fromToken]);

  const checkAllowanceAndBalance = async () => {
    if (!provider || !account) return;

    const tokenContract = new ethers.Contract(
      fromToken.address,
      ERC20_ABI,
      provider
    );

    try {
      const [allowance, balance] = await Promise.all([
        tokenContract.allowance(account, MONADSWAP_ADDRESS),
        tokenContract.balanceOf(account),
      ]);

      setAllowance(ethers.utils.formatUnits(allowance, fromToken.decimals));
      setBalance(ethers.utils.formatUnits(balance, fromToken.decimals));
    } catch (error) {
      console.error("Error checking allowance/balance:", error);
    }
  };

  const handleApprove = async () => {
    if (!signer) return;

    setLoading(true);
    try {
      const tokenContract = new ethers.Contract(
        fromToken.address,
        ERC20_ABI,
        signer
      );
      const tx = await tokenContract.approve(
        MONADSWAP_ADDRESS,
        ethers.constants.MaxUint256
      );
      await tx.wait();
      await checkAllowanceAndBalance();
    } catch (error) {
      console.error("Approve failed:", error);
    }
    setLoading(false);
  };

  const handleSwap = async () => {
    if (!signer) return;
    setLoading(true);
    setError("");
    try {
      const monadSwap = new ethers.Contract(
        MONADSWAP_ADDRESS,
        MONADSWAP_ABI,
        signer
      );
      const amountIn = ethers.utils.parseUnits(amount, fromToken.decimals);

      // Check if approval is needed
      if (Number(allowance) < Number(amount)) {
        await handleApprove();
      }

      const tx = await monadSwap.swap(
        fromToken.address,
        toToken.address,
        amountIn,
        {
          gasLimit: 500000,
        }
      );

      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Transaction confirmed");

      // Refresh allowance and balance
      await checkAllowanceAndBalance();
    } catch (error: any) {
      setError(error.message || "Swap failed");
    }
    setLoading(false);
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };

  const expectedOutput = amount ? Number(amount) * 0.98 : 0;
  const fee = amount ? Number(amount) * 0.02 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto"
    >
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Swap Tokens
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Trade tokens instantly with 2% fee
          </p>
          <ConnectWallet />
        </div>

        {/* Swap Form */}
        <div className="p-6 space-y-6">
          {/* From Token */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              From
            </label>
            <div className="relative">
              <div className="flex items-center bg-gray-50 dark:bg-gray-900 rounded-xl p-4 hover:ring-2 ring-purple-500/20 transition-all">
                <button
                  onClick={() => setShowTokenList("from")}
                  className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-sm hover:shadow transition-all"
                >
                  <span className="text-xl">{fromToken.icon}</span>
                  <span className="font-medium">{fromToken.symbol}</span>
                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                </button>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-transparent text-right text-2xl font-medium focus:outline-none dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-3">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={switchTokens}
              className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl hover:shadow-lg transition-all"
            >
              <ArrowsUpDownIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </motion.button>
          </div>

          {/* To Token */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              To (estimated)
            </label>
            <div className="relative">
              <div className="flex items-center bg-gray-50 dark:bg-gray-900 rounded-xl p-4 hover:ring-2 ring-purple-500/20 transition-all">
                <button
                  onClick={() => setShowTokenList("to")}
                  className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-sm hover:shadow transition-all"
                >
                  <span className="text-xl">{toToken.icon}</span>
                  <span className="font-medium">{toToken.symbol}</span>
                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                </button>
                <input
                  type="number"
                  value={expectedOutput.toFixed(6)}
                  disabled
                  className="w-full bg-transparent text-right text-2xl font-medium focus:outline-none dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Token Selection Modal */}
          {showTokenList && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-white dark:bg-gray-800 z-10 rounded-3xl"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Select Token</h3>
                  <button
                    onClick={() => setShowTokenList(null)}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {tokens.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => {
                      if (showTokenList === "from") setFromToken(token);
                      if (showTokenList === "to") setToToken(token);
                      setShowTokenList(null);
                    }}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <span className="text-2xl">{token.icon}</span>
                    <div className="text-left">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {token.address.slice(0, 6)}...{token.address.slice(-4)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Swap Details */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Rate</span>
              <span className="font-medium dark:text-white">
                1 {fromToken.symbol} = 1 {toToken.symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Fee (2%)</span>
              <span className="font-medium dark:text-white">
                {fee.toFixed(6)} {fromToken.symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Expected Output
              </span>
              <span className="font-medium dark:text-white">
                {expectedOutput.toFixed(6)} {toToken.symbol}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 text-red-500 text-sm">
              <ExclamationCircleIcon className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Swap Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSwap}
            disabled={!amount || loading}
            className={`w-full py-4 px-6 rounded-xl font-medium text-white
              ${
                loading || !amount
                  ? "bg-purple-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              } transition-all duration-300 flex items-center justify-center space-x-2`}
          >
            {loading && <ArrowPathIcon className="w-5 h-5 animate-spin" />}
            <span>{loading ? "Swapping..." : "Swap"}</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
