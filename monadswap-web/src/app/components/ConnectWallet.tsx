"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { motion } from "framer-motion";
import {
  WalletIcon,
  ChevronDownIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export default function ConnectWallet() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] =
    useState<ethers.providers.Web3Provider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [networkName, setNetworkName] = useState("Monad Testnet");

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);

      // Check if already connected
      provider.listAccounts().then((accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      });

      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount("");
        }
      });

      // Listen for chain changes
      window.ethereum.on("chainChanged", (_chainId: string) => {
        window.location.reload();
      });
    }
  }, []);

  const connectWallet = async () => {
    if (!provider || !window.ethereum) return;
    setIsLoading(true);

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAccount(accounts[0]);

      // Switch to Monad Testnet
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2799" }], // 10137 in hex
        });
      } catch (switchError: any) {
        // If chain doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x2799",
                chainName: "Monad Testnet",
                nativeCurrency: {
                  name: "MON",
                  symbol: "MON",
                  decimals: 18,
                },
                rpcUrls: ["https://testnet-rpc.monad.xyz/"],
                blockExplorerUrls: ["https://testnet.monadexplorer.com/"],
              },
            ],
          });
        }
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      {!account ? (
        <motion.button
          onClick={connectWallet}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl
                     hover:from-purple-700 hover:to-indigo-700 transition-all duration-300
                     flex items-center space-x-2 shadow-lg hover:shadow-xl"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isLoading}
        >
          {isLoading ? (
            <ArrowPathIcon className="w-5 h-5 animate-spin" />
          ) : (
            <WalletIcon className="w-5 h-5" />
          )}
          <span className="font-semibold">
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </span>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg
                     flex items-center space-x-3 hover:border-purple-300 transition-all duration-300"
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-gray-600 font-medium">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          </div>
          <div className="h-4 w-px bg-gray-300" />
          <div className="flex items-center space-x-1 text-gray-500">
            <span className="text-sm">{networkName}</span>
            <ChevronDownIcon className="w-4 h-4" />
          </div>
        </motion.div>
      )}
    </div>
  );
}
