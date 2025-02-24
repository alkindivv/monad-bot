"use client";

import { useState } from "react";

const tokens = [
  {
    symbol: "USDC",
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    decimals: 6,
  },
  {
    symbol: "USDT",
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    decimals: 6,
  },
  {
    symbol: "WETH",
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    decimals: 18,
  },
];

export default function SwapInterface() {
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSwap = async () => {
    setLoading(true);
    try {
      // TODO: Implement swap logic
      console.log("Swapping", amount, fromToken.symbol, "to", toToken.symbol);
    } catch (error) {
      console.error("Swap failed:", error);
    }
    setLoading(false);
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Swap Tokens</h2>

      {/* From Token */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          From
        </label>
        <div className="flex items-center space-x-2">
          <select
            value={fromToken.symbol}
            onChange={(e) =>
              setFromToken(
                tokens.find((t) => t.symbol === e.target.value) || tokens[0]
              )
            }
            className="flex-1 rounded-lg border border-gray-300 p-2"
          >
            {tokens.map((token) => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 rounded-lg border border-gray-300 p-2"
          />
        </div>
      </div>

      {/* Switch Button */}
      <button
        onClick={switchTokens}
        className="mx-auto block p-2 rounded-full bg-gray-100 hover:bg-gray-200 mb-4"
      >
        ↓↑
      </button>

      {/* To Token */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          To
        </label>
        <div className="flex items-center space-x-2">
          <select
            value={toToken.symbol}
            onChange={(e) =>
              setToToken(
                tokens.find((t) => t.symbol === e.target.value) || tokens[1]
              )
            }
            className="flex-1 rounded-lg border border-gray-300 p-2"
          >
            {tokens.map((token) => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={amount ? Number(amount) * 0.98 : ""} // Showing amount after 2% fee
            disabled
            className="flex-1 rounded-lg border border-gray-300 p-2 bg-gray-50"
          />
        </div>
      </div>

      {/* Fee Info */}
      <div className="text-sm text-gray-500 mb-6">
        <p>
          Fee: 2% ({amount ? (Number(amount) * 0.02).toFixed(6) : "0"}{" "}
          {fromToken.symbol})
        </p>
        <p>
          Rate: 1 {fromToken.symbol} = 1 {toToken.symbol}
        </p>
      </div>

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!amount || loading}
        className={`w-full py-3 px-4 rounded-lg font-medium text-white ${
          loading || !amount
            ? "bg-purple-400 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700"
        }`}
      >
        {loading ? "Swapping..." : "Swap"}
      </button>
    </div>
  );
}
