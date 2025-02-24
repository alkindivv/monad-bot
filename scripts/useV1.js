require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const prompts = require("prompts");

// Network configuration
const NETWORK_CONFIG = {
  url: "https://testnet-rpc.monad.xyz/",
  chainId: 10143,
  name: "Monad Testne",
};

const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

// Contract addresses
const PROXY_ADDRESS = "0xabB27315ea51983c5DFea264C4C6087f9aF12f4F";
const BEAN_ROUTER = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";
const AMBIENT_ROUTER = "0x88B96aF200c8a9c35442C8AC6cd3D22695AaE4F0";

// Token configuration
const TOKENS = {
  MON: {
    address: "0x0000000000000000000000000000000000000000",
    symbol: "MON",
    name: "Monad",
    decimals: 18,
    isNative: true,
  },
  USDC: {
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  USDT: {
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  WETH: {
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    symbol: "WETH",
    name: "Wrapped ETH",
    decimals: 18,
  },
};

// ABIs
const AGGREGATOR_ABI = [
  "function beanRouter() external view returns (address)",
  "function wmon() external view returns (address)",
  "function getAmountOut(address fromToken, address toToken, uint256 amountIn) external view returns (uint256)",
  "function swap(address fromToken, address toToken, uint256 amountIn, uint256 amountOutMin) external payable returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

// Initialize provider dan wallet
let provider = new ethers.providers.JsonRpcProvider(NETWORK_CONFIG.url);
let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

async function retryOperation(operation, maxRetries = 3, delay = 5000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (
        error.code === "SERVER_ERROR" ||
        error.message.includes("bad response")
      ) {
        console.log(
          `\n⚠️ RPC Error, mencoba ulang dalam ${
            delay / 1000
          } detik... (Percobaan ${i + 1}/${maxRetries})`.yellow
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  console.log("\n❌ RPC tidak merespon. Silakan coba lagi nanti.".red);
  throw lastError;
}

async function checkBalance(wallet) {
  console.log("\n💰 Balance:".cyan);

  for (const [symbol, token] of Object.entries(TOKENS)) {
    try {
      if (token.isNative) {
        const balance = await wallet.getBalance();
        console.log(`${symbol}: ${ethers.utils.formatEther(balance)}`.cyan);
      } else {
        const tokenContract = new ethers.Contract(
          token.address,
          ERC20_ABI,
          wallet
        );
        const balance = await retryOperation(() =>
          tokenContract.balanceOf(wallet.address)
        );
        console.log(
          `${symbol}: ${ethers.utils.formatUnits(balance, token.decimals)}`.cyan
        );
      }
    } catch (error) {
      console.log(`${symbol}: Error membaca balance - ${error.message}`.red);
    }
  }
}

async function approveToken(wallet, tokenAddress) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const symbol = await tokenContract.symbol();

  console.log(`\n🔄 Checking approvals for ${symbol}...`.yellow);

  // Check allowance untuk kedua DEX
  const [aggregatorAllowance, beanAllowance, ambientAllowance] =
    await Promise.all([
      tokenContract.allowance(wallet.address, PROXY_ADDRESS),
      tokenContract.allowance(wallet.address, BEAN_ROUTER),
      tokenContract.allowance(wallet.address, AMBIENT_ROUTER),
    ]);

  // Approve jika allowance kurang
  if (aggregatorAllowance.lt(ethers.constants.MaxUint256.div(2))) {
    console.log(`🔄 Approving ${symbol} for Aggregator...`.yellow);
    const tx = await tokenContract.approve(
      PROXY_ADDRESS,
      ethers.constants.MaxUint256
    );
    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    await tx.wait();
    console.log(`✅ ${symbol} approved for Aggregator`.green);
  }

  if (beanAllowance.lt(ethers.constants.MaxUint256.div(2))) {
    console.log(`🔄 Approving ${symbol} for Bean DEX...`.yellow);
    const tx = await tokenContract.approve(
      BEAN_ROUTER,
      ethers.constants.MaxUint256
    );
    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    await tx.wait();
    console.log(`✅ ${symbol} approved for Bean DEX`.green);
  }

  if (ambientAllowance.lt(ethers.constants.MaxUint256.div(2))) {
    console.log(`🔄 Approving ${symbol} for Ambient DEX...`.yellow);
    const tx = await tokenContract.approve(
      AMBIENT_ROUTER,
      ethers.constants.MaxUint256
    );
    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    await tx.wait();
    console.log(`✅ ${symbol} approved for Ambient DEX`.green);
  }
}

async function checkRate(aggregator, fromToken, toToken, amount) {
  console.log("\n🔍 Checking rate...".yellow);

  try {
    const amountIn = ethers.utils.parseUnits(
      amount.toString(),
      fromToken.decimals
    );
    const amountOut = await retryOperation(() =>
      aggregator.getAmountOut(fromToken.address, toToken.address, amountIn)
    );

    if (amountOut.isZero()) {
      throw new Error("No liquidity available");
    }

    console.log("\n📊 Swap Details:".cyan);
    console.log(`Input: ${amount} ${fromToken.symbol}`.cyan);
    console.log(
      `Output: ${ethers.utils.formatUnits(amountOut, toToken.decimals)} ${
        toToken.symbol
      }`.cyan
    );

    return amountOut;
  } catch (error) {
    console.log("\n❌ Error checking rate:".red, error.message);
    throw error;
  }
}

async function performSwap(wallet) {
  const aggregator = new ethers.Contract(PROXY_ADDRESS, AGGREGATOR_ABI, wallet);

  try {
    // Tampilkan balance
    await checkBalance(wallet);

    // Pilih token sumber
    const fromTokenResponse = await prompts({
      type: "select",
      name: "token",
      message: "Pilih token sumber:",
      choices: Object.entries(TOKENS).map(([symbol, token]) => ({
        title: symbol,
        value: token,
      })),
    });

    // Pilih token tujuan
    const toTokenResponse = await prompts({
      type: "select",
      name: "token",
      message: "Pilih token tujuan:",
      choices: Object.entries(TOKENS)
        .filter(([symbol]) => symbol !== fromTokenResponse.token.symbol)
        .map(([symbol, token]) => ({
          title: symbol,
          value: token,
        })),
    });

    // Input jumlah
    const amountResponse = await prompts({
      type: "text",
      name: "amount",
      message: `Masukkan jumlah ${fromTokenResponse.token.symbol}:`,
      validate: (value) => !isNaN(value) || "Masukkan angka yang valid",
    });

    const amount = amountResponse.amount;
    const amountIn = ethers.utils.parseUnits(
      amount,
      fromTokenResponse.token.decimals
    );

    // Check dan approve token jika bukan native
    if (!fromTokenResponse.token.isNative) {
      await approveToken(wallet, fromTokenResponse.token.address);
    }

    // Check rate dan validasi
    const amountOut = await checkRate(
      aggregator,
      fromTokenResponse.token,
      toTokenResponse.token,
      amount
    );

    // Konfirmasi swap
    const confirm = await prompts({
      type: "confirm",
      name: "value",
      message: "Lanjutkan swap?",
      initial: true,
    });

    if (!confirm.value) {
      console.log("Swap dibatalkan".yellow);
      return;
    }

    // Execute swap dengan 1% slippage
    console.log("\n🔄 Executing swap...".yellow);
    const minAmountOut = amountOut.mul(99).div(100);

    const tx = await retryOperation(() =>
      aggregator.swap(
        fromTokenResponse.token.address,
        toTokenResponse.token.address,
        amountIn,
        minAmountOut,
        fromTokenResponse.token.isNative
          ? { value: amountIn, gasLimit: 1000000 }
          : { gasLimit: 1000000 }
      )
    );

    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    console.log("Menunggu konfirmasi...".yellow);
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("\n✅ Swap berhasil!".green);
      await checkBalance(wallet);
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error) {
    console.log("\n❌ Error dalam swap:".red);
    console.error(error.message);
    if (error.transaction) {
      console.log("Transaction data:", error.transaction.data);
      console.log("Gas limit:", error.transaction.gasLimit.toString());
    }
  }
}

async function main() {
  console.log("\n🚀 MonadSwap V1 - Best Rate Swapper".green);
  console.log("\nWallet address:", wallet.address);

  const actions = {
    1: checkBalance,
    2: performSwap,
  };

  while (true) {
    const response = await prompts({
      type: "select",
      name: "action",
      message: "Pilih menu:",
      choices: [
        { title: "Check Balance", value: "1" },
        { title: "Swap Tokens", value: "2" },
        { title: "Exit", value: "3" },
      ],
    });

    if (response.action === "3") {
      console.log("\n👋 Terima kasih telah menggunakan MonadSwap V1!".green);
      break;
    }

    if (actions[response.action]) {
      await actions[response.action](wallet);
    }
  }
}

main().catch(console.error);
