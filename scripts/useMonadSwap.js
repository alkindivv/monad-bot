require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const prompts = require("prompts");

// Konfigurasi
const RPC_URL = "https://testnet-rpc.monad.xyz/";
const AGGREGATOR_ADDRESS = "0x4b032F001d8EAdE82dC6dCA3d7554B30fbE9e132";
const BEAN_ROUTER = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";

// Token yang didukung
const TOKENS = {
  MON: {
    address: "0x0000000000000000000000000000000000000000", // Address 0 untuk native token
    decimals: 18,
    symbol: "MON",
    isNative: true,
  },
  USDC: {
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    decimals: 6,
    symbol: "USDC",
  },
  USDT: {
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    decimals: 6,
    symbol: "USDT",
  },
  WETH: {
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    decimals: 18,
    symbol: "WETH",
  },
};

// ABI untuk MonadSwapAggregator
const AGGREGATOR_ABI = [
  "function swap(address fromToken, address toToken, uint256 amountIn, uint256 amountOutMin) external returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

async function checkAllowanceAndBalance(tokenContract, wallet, spender) {
  const [allowance, balance] = await Promise.all([
    tokenContract.allowance(wallet.address, spender),
    tokenContract.balanceOf(wallet.address),
  ]);
  return { allowance, balance };
}

async function approveIfNeeded(tokenContract, spender, amount, spenderName) {
  const allowance = await tokenContract.allowance(
    tokenContract.signer.address,
    spender
  );

  if (allowance.lt(amount)) {
    console.log(`\n🔄 Approve ${spenderName}...`.yellow);
    const tx = await tokenContract.approve(
      spender,
      ethers.constants.MaxUint256
    );
    console.log(`Approval tx: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Approved untuk ${spenderName}`.green);
    return true;
  }

  console.log(`\n✅ Sudah diapprove untuk ${spenderName}`.green);
  return false;
}

// Fungsi untuk mengecek balance MON
async function checkMonBalance(wallet) {
  const balance = await wallet.getBalance();
  console.log(`MON Balance: ${ethers.utils.formatEther(balance)}`);
  return balance;
}

async function checkContractMonBalance(provider) {
  const balance = await provider.getBalance(AGGREGATOR_ADDRESS);
  console.log(`MON Balance Kontrak: ${ethers.utils.formatEther(balance)}`);
  return balance;
}

async function main() {
  // Setup provider dan wallet
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const aggregator = new ethers.Contract(
    AGGREGATOR_ADDRESS,
    AGGREGATOR_ABI,
    wallet
  );

  console.log("\n🚀 MonadSwap Simple Interface".green);
  console.log("Wallet:", wallet.address);
  console.log("Aggregator:", AGGREGATOR_ADDRESS);

  // Check MON balance di wallet
  console.log("\n💰 Checking MON balance...".cyan);
  const walletBalance = await checkMonBalance(wallet);

  if (walletBalance.eq(0)) {
    console.log(
      "\n❌ Tidak ada MON untuk gas fee. Silakan dapatkan MON dari faucet terlebih dahulu."
        .red
    );
    return;
  }

  // Check balance token lainnya
  console.log("\n💰 Checking token balances...".cyan);
  for (const [symbol, token] of Object.entries(TOKENS)) {
    if (token.isNative) continue; // Skip MON karena sudah di-check
    const tokenContract = new ethers.Contract(
      token.address,
      ERC20_ABI,
      provider
    );
    const balance = await tokenContract.balanceOf(wallet.address);
    console.log(
      `${symbol}: ${ethers.utils.formatUnits(balance, token.decimals)}`
    );
  }

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

  // Check balance
  if (fromTokenResponse.token.isNative) {
    const balance = await wallet.getBalance();
    if (balance.lt(amountIn.add(ethers.utils.parseEther("0.01")))) {
      // Tambah 0.01 MON untuk gas
      console.log("\n❌ Balance MON tidak cukup (termasuk gas)".red);
      return;
    }
  } else {
    const tokenContract = new ethers.Contract(
      fromTokenResponse.token.address,
      ERC20_ABI,
      wallet
    );
    const { balance } = await checkAllowanceAndBalance(
      tokenContract,
      wallet,
      AGGREGATOR_ADDRESS
    );

    console.log("\n📊 Status Token:".cyan);
    console.log(
      `Balance: ${ethers.utils.formatUnits(
        balance,
        fromTokenResponse.token.decimals
      )} ${fromTokenResponse.token.symbol}`
    );

    if (balance.lt(amountIn)) {
      console.log("\n❌ Balance tidak cukup".red);
      return;
    }

    // Approve untuk aggregator dan router
    await approveIfNeeded(
      tokenContract,
      AGGREGATOR_ADDRESS,
      amountIn,
      "Aggregator"
    );
    await approveIfNeeded(tokenContract, BEAN_ROUTER, amountIn, "Bean Router");
  }

  // Konfirmasi swap
  const confirm = await prompts({
    type: "confirm",
    name: "value",
    message: "Lanjutkan swap?",
    initial: true,
  });

  if (confirm.value) {
    // Execute swap
    console.log("\n🔄 Executing swap...".yellow);
    try {
      let tx;
      if (fromTokenResponse.token.isNative) {
        // Swap dari MON
        tx = await aggregator.swap(
          fromTokenResponse.token.address,
          toTokenResponse.token.address,
          amountIn,
          0, // tidak perlu cek minimum output
          { value: amountIn, gasLimit: 500000 }
        );
      } else if (toTokenResponse.token.isNative) {
        // Swap ke MON
        tx = await aggregator.swap(
          fromTokenResponse.token.address,
          toTokenResponse.token.address,
          amountIn,
          0, // tidak perlu cek minimum output
          { gasLimit: 500000 }
        );
      } else {
        // Swap antar token
        tx = await aggregator.swap(
          fromTokenResponse.token.address,
          toTokenResponse.token.address,
          amountIn,
          0, // tidak perlu cek minimum output
          { gasLimit: 500000 }
        );
      }

      console.log(`Swap tx: ${tx.hash}`);
      await tx.wait();
      console.log("✅ Swap berhasil!".green);

      // Check balance akhir
      console.log("\n💰 Balance setelah swap:".cyan);
      const monBalance = await wallet.getBalance();
      console.log(`MON: ${ethers.utils.formatEther(monBalance)}`);

      for (const [symbol, token] of Object.entries(TOKENS)) {
        if (token.isNative) continue;
        const tokenContract = new ethers.Contract(
          token.address,
          ERC20_ABI,
          provider
        );
        const balance = await tokenContract.balanceOf(wallet.address);
        console.log(
          `${symbol}: ${ethers.utils.formatUnits(balance, token.decimals)}`
        );
      }
    } catch (error) {
      console.log("\n❌ Swap gagal:".red, error.message);
      if (error.transaction) {
        console.log("Transaction data:", error.transaction.data);
      }
    }
  }
}

main().catch(console.error);
