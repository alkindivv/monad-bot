require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const prompts = require("prompts");

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

// Contract addresses
const ROUTER_ADDRESS = "0x88B96aF200c8a9c35442C8AC6cd3D22695AaE4F0";

// Daftar token yang didukung
const TOKENS = {
  USDC: {
    address: "0xf817257fed379853cde0fa4f97ab987181b1e5ea",
    symbol: "USDC",
    name: "USD Coin",
    minAmount: 0.01,
    maxAmount: 1,
    decimals: 6,
  },
  USDT: {
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    symbol: "USDT",
    name: "Tether USD",
    minAmount: 0.01,
    maxAmount: 1,
    decimals: 6,
  },
  WETH: {
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    symbol: "WETH",
    name: "Wrapped ETH",
    minAmount: 0.0000001,
    maxAmount: 0.000001,
    decimals: 18,
    retryDelay: 5000,
    maxRetries: 3,
  },
};

// Initialize provider dan wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// ABI untuk Ambient DEX
const AMBIENT_ABI = [
  "function swap(address base, address quote, uint256 poolIdx, bool isBuy, bool inBaseQty, uint128 qty, uint16 tip, uint128 limitPrice, uint128 minOut, uint8 reserveFlags) external payable returns (int128 baseFlow, int128 quoteFlow)",
  "function userCmd(uint16 callpath, bytes calldata cmd) external payable returns (bytes memory)",
];

// Fungsi untuk mendapatkan angka random antara min dan max
function getRandomAmount(min, max) {
  // Pastikan jumlah minimal tidak terlalu kecil
  const amount = Math.random() * (max - min) + min;
  // Format ke 6 desimal untuk stablecoin dan 8 desimal untuk token lain
  return parseFloat(amount.toFixed(8));
}

async function approveToken(tokenAddress, amount) {
  try {
    console.log("🔄 Mengecek approval token...".yellow);

    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
        "function symbol() external view returns (string)",
      ],
      wallet
    );

    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    const amountInDecimals = ethers.utils.parseUnits(
      amount.toString(),
      decimals
    );

    const allowance = await tokenContract.allowance(
      wallet.address,
      ROUTER_ADDRESS
    );
    if (allowance.lt(amountInDecimals)) {
      console.log(`🔄 Melakukan approve ${symbol}...`.yellow);
      const tx = await tokenContract.approve(
        ROUTER_ADDRESS,
        ethers.constants.MaxUint256
      );
      await tx.wait();
      console.log(`✅ ${symbol} berhasil diapprove`.green);
    } else {
      console.log(`✅ ${symbol} sudah diapprove sebelumnya`.green);
    }
    return amountInDecimals;
  } catch (error) {
    console.error("❌ Approve gagal:".red, error.message);
    throw error;
  }
}

async function retryOperation(operation, maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (
        error.message.includes("SERVER_ERROR") ||
        error.message.includes("bad response")
      ) {
        if (i < maxRetries - 1) {
          console.log(
            `❌ RPC Node error, mencoba ulang dalam ${delay / 1000} detik... (Percobaan ${i + 1}/${maxRetries})`
              .yellow
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error("Maksimum retry tercapai");
}

async function swapTokens(fromToken, toToken, amount) {
  try {
    const ambientContract = new ethers.Contract(
      ROUTER_ADDRESS,
      AMBIENT_ABI,
      wallet
    );

    // Parse amount to proper decimals
    const amountIn = ethers.utils.parseUnits(
      amount.toString(),
      fromToken.decimals
    );

    // Approve token if needed
    if (fromToken.symbol !== "MON") {
      await retryOperation(async () => {
        await approveToken(fromToken.address, amount);
      });
    }

    console.log(
      `🔄 Swapping ${amount} ${fromToken.symbol} to ${toToken.symbol}...`.yellow
    );

    let tx;
    if (fromToken.symbol === "MON") {
      // Method swapExactEthForTokens
      const data = ethers.utils.hexConcat([
        "0x7ff36ab5", // swapExactEthForTokens
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "address", "uint256", "address[]"],
          [
            0, // amountOutMin
            160, // offset untuk path array (0xa0 in hex)
            wallet.address, // recipient
            Math.floor(Date.now() / 1000) + 1200, // deadline 20 menit
            [ethers.constants.AddressZero, toToken.address], // path swap
          ]
        ),
      ]);

      tx = await wallet.sendTransaction({
        to: ROUTER_ADDRESS,
        data: data,
        value: amountIn,
        gasLimit: 250000,
      });
    } else if (toToken.symbol === "MON") {
      // Method swapExactTokensForETH
      const data = ethers.utils.hexConcat([
        "0x18cbafe5", // swapExactTokensForETH
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint256", "address[]", "address", "uint256"],
          [
            amountIn, // amountIn
            0, // amountOutMin
            [fromToken.address, ethers.constants.AddressZero], // path
            wallet.address, // recipient
            Math.floor(Date.now() / 1000) + 1200, // deadline 20 menit
          ]
        ),
      ]);

      tx = await wallet.sendTransaction({
        to: ROUTER_ADDRESS,
        data: data,
        gasLimit: 350000,
      });
    } else {
      // Method untuk swap token ke token
      const data = ethers.utils.hexConcat([
        "0xa15112f9", // userCmd method
        ethers.utils.defaultAbiCoder.encode(
          ["uint16", "bytes"],
          [
            1, // callpath untuk swap
            ethers.utils.defaultAbiCoder.encode(
              [
                "uint256",
                "address",
                "uint24",
                "bool",
                "bool",
                "uint128",
                "uint16",
                "uint128",
                "uint128",
                "uint8",
              ],
              [
                0, // offset
                fromToken.address, // base token
                36000, // poolIdx
                true, // isBuy
                true, // inBaseQty
                amountIn, // qty
                0, // tip
                ethers.utils.parseUnits("100000", 18), // limitPrice yang lebih masuk akal
                0, // minOut
                0, // reserveFlags
              ]
            ),
          ]
        ),
      ]);

      tx = await wallet.sendTransaction({
        to: ROUTER_ADDRESS,
        data: data,
        gasLimit: 500000,
      });
    }

    console.log(`Transaction hash: ${EXPLORER_URL}${tx.hash}`.cyan);
    console.log("Menunggu konfirmasi transaksi...".yellow);

    const receipt = await tx.wait();
    if (receipt.status === 1) {
      console.log(`✅ Swap berhasil!`.green);
      const transferEvents = receipt.logs.filter(
        (log) =>
          log.topics[0] ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      if (transferEvents.length > 0) {
        console.log(`✅ Token berhasil ditransfer`.green);
      }
    } else {
      throw new Error("Transaction failed");
    }
    return receipt;
  } catch (error) {
    console.error(`❌ Swap gagal:`.red, error.message);
    if (error.transaction) {
      console.log("Data transaksi:", error.transaction.data);
      console.log("Gas limit:", error.transaction.gasLimit.toString());
      if (error.transaction.value) {
        console.log(
          "Value:",
          ethers.utils.formatEther(error.transaction.value),
          "MON"
        );
      }
    }
    throw error;
  }
}

async function checkBalance() {
  console.log("\n💰 Balance:".cyan);

  try {
    // Check MON balance
    const monBalance = await provider.getBalance(wallet.address);
    console.log(`MON: ${ethers.utils.formatEther(monBalance)}`.cyan);

    // Check token balances
    for (const [symbol, token] of Object.entries(TOKENS)) {
      try {
        const tokenContract = new ethers.Contract(
          token.address,
          [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
          ],
          wallet
        );

        const balance = await tokenContract.balanceOf(wallet.address);
        const decimals = await tokenContract.decimals();
        console.log(
          `${symbol}: ${ethers.utils.formatUnits(balance, decimals)}`.cyan
        );
      } catch (error) {
        console.log(`${symbol}: Error membaca balance`.red);
      }
    }
  } catch (error) {
    console.error("❌ Error mengecek balance:".red, error.message);
  }
}

async function performRandomSwap() {
  try {
    // Get list of available tokens
    const tokenSymbols = Object.keys(TOKENS);

    // Select random tokens for swap
    const fromTokenSymbol =
      tokenSymbols[Math.floor(Math.random() * tokenSymbols.length)];
    let toTokenSymbol;
    do {
      toTokenSymbol =
        tokenSymbols[Math.floor(Math.random() * tokenSymbols.length)];
    } while (toTokenSymbol === fromTokenSymbol);

    const fromToken = TOKENS[fromTokenSymbol];
    const toToken = TOKENS[toTokenSymbol];

    // Generate random amount within limits
    let amount = getRandomAmount(fromToken.minAmount, fromToken.maxAmount);

    // Pastikan jumlah minimal sesuai dengan token
    if (fromToken.symbol === "WETH") {
      amount = Math.max(amount, 0.0000001);
    } else if (fromToken.symbol === "USDC" || fromToken.symbol === "USDT") {
      amount = Math.max(amount, 0.01);
    }

    // Format jumlah sesuai dengan desimal token
    const formattedAmount =
      fromToken.symbol === "WETH" ? amount.toFixed(8) : amount.toFixed(6);

    console.log(
      `\n🎲 Random swap ${fromTokenSymbol} ke ${toTokenSymbol}: ${formattedAmount} ${fromTokenSymbol}`
        .yellow
    );

    // Execute swap
    await swapTokens(fromToken, toToken, formattedAmount);
    return true;
  } catch (error) {
    console.error("❌ Error dalam random swap:".red, error.message);
    return false;
  }
}

async function main() {
  console.log(`\n🚀 Ambient Random Swap Bot`.green);

  // Show initial balance
  await checkBalance();

  // Menu options
  const choices = [
    { title: "Mulai Random Swap", value: "random_swap" },
    { title: "Swap Manual", value: "manual_swap" },
    { title: "Exit", value: "exit" },
  ];

  while (true) {
    const response = await prompts({
      type: "select",
      name: "action",
      message: "Pilih aksi yang ingin dilakukan:",
      choices: choices,
    });

    if (!response.action || response.action === "exit") {
      console.log("👋 Terima kasih telah menggunakan Ambient Swap Bot!".green);
      break;
    }

    if (response.action === "random_swap") {
      const countResponse = await prompts({
        type: "number",
        name: "count",
        message: "Berapa kali ingin melakukan random swap?",
        initial: 5,
      });

      const delayResponse = await prompts({
        type: "number",
        name: "delay",
        message: "Berapa detik jeda antar swap? (minimal 5)",
        initial: 5,
        validate: (value) => (value >= 5 ? true : "Minimal jeda 5 detik"),
      });

      console.log(
        `\n🚀 Memulai ${countResponse.count}x random swap dengan jeda ${delayResponse.delay} detik`
          .green
      );

      for (let i = 0; i < countResponse.count; i++) {
        console.log(`\n📍 Random Swap ${i + 1}/${countResponse.count}:`.yellow);
        const success = await performRandomSwap();

        if (success) {
          console.log("\n📊 Balance setelah swap:".yellow);
          await checkBalance();
        }

        if (i < countResponse.count - 1) {
          console.log(
            `\n⏳ Menunggu ${delayResponse.delay} detik sebelum swap berikutnya...`
              .yellow
          );
          await new Promise((resolve) =>
            setTimeout(resolve, delayResponse.delay * 1000)
          );
        }
      }
    } else if (response.action === "manual_swap") {
      // Get token choices
      const tokenChoices = Object.entries(TOKENS).map(([symbol, token]) => ({
        title: `${token.name} (${symbol})`,
        value: symbol,
      }));

      // Select from token
      const fromTokenResponse = await prompts({
        type: "select",
        name: "token",
        message: "Pilih token sumber:",
        choices: tokenChoices,
      });

      // Select to token
      const toTokenChoices = tokenChoices.filter(
        (t) => t.value !== fromTokenResponse.token
      );
      const toTokenResponse = await prompts({
        type: "select",
        name: "token",
        message: "Pilih token tujuan:",
        choices: toTokenChoices,
      });

      // Input amount
      const fromToken = TOKENS[fromTokenResponse.token];
      const toToken = TOKENS[toTokenResponse.token];

      const amountResponse = await prompts({
        type: "number",
        name: "amount",
        message: `Masukkan jumlah ${fromTokenResponse.token} (${fromToken.minAmount} - ${fromToken.maxAmount}):`,
        initial: (fromToken.minAmount + fromToken.maxAmount) / 2,
        validate: (value) =>
          value >= fromToken.minAmount && value <= fromToken.maxAmount
            ? true
            : `Jumlah harus antara ${fromToken.minAmount} - ${fromToken.maxAmount}`,
      });

      await swapTokens(fromToken, toToken, amountResponse.amount);

      console.log("\n📊 Balance setelah swap:".yellow);
      await checkBalance();
    }
  }
}

main().catch(console.error);
