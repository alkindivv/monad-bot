require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const readline = require("readline");
const displayHeader = require("../src/displayHeader.js");
displayHeader();

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Contract addresses
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const ROUTER_ADDRESS = "0xF6FFe4f3FdC8BBb7F70FFD48e61f17D1e343dDfD";
const POOL_ADDRESS = "0x8552706D9A27013f20eA0f9DF8e20B61E283d2D3"; // Pool address from logs
const USDT_ADDRESS = "0x6a7436775c0d0B70cfF4c5365404ec37c9d9aF4b"; // USDT address from transfer event
const QUOTER_ADDRESS = "0x64c2227A0A9651f6B4c8b1647c4A632cF4E3c8c5E"; // from internal txs
const POOL_IMPL_ADDRESS = "0x706A43B4365c51673B6F9393d926bF7A91A69D1bd"; // from internal txs

// Initialize provider and wallet
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Method signatures (4 bytes)
const DEPOSIT_SIG = "0xd0e30db0";
const WITHDRAW_SIG = "0x2e1a7d4d";
const APPROVE_SIG = "0x095ea7b3";
const SWAP_EXACT_ETH_FOR_TOKENS = "0xac9650d8";
const EXACT_INPUT_PARAMS = "0x75ceafe6";
const POOL_FEE = 2000; // 0.2% fee from successful transaction

async function wrap(amount) {
  console.log(`🔄 Wrapping ${ethers.utils.formatEther(amount)} MON...`.yellow);

  const tx = await wallet.sendTransaction({
    to: WMON_CONTRACT,
    data: DEPOSIT_SIG,
    value: amount,
    gasLimit: 300000,
  });

  await tx.wait();
  console.log(`✅ Wrapped successfully`.green);
}

async function unwrap(amount) {
  console.log(
    `🔄 Unwrapping ${ethers.utils.formatEther(amount)} WMON...`.yellow
  );

  const data =
    WITHDRAW_SIG +
    ethers.utils.defaultAbiCoder.encode(["uint256"], [amount]).slice(2);

  const tx = await wallet.sendTransaction({
    to: WMON_CONTRACT,
    data: data,
    gasLimit: 300000,
  });

  await tx.wait();
  console.log(`✅ Unwrapped successfully`.green);
}

async function approve(token, spender, amount) {
  console.log(`🔄 Approving ${spender}...`.yellow);

  const data =
    APPROVE_SIG +
    ethers.utils.defaultAbiCoder
      .encode(["address", "uint256"], [spender, amount])
      .slice(2);

  const tx = await wallet.sendTransaction({
    to: token,
    data: data,
    gasLimit: 300000,
  });

  await tx.wait();
  console.log(`✅ Approved`.green);
}

async function swap(amount) {
  try {
    console.log(
      `🔄 Swapping ${ethers.utils.formatEther(amount)} MON to USDT...`.yellow
    );

    // Format data sesuai dengan transaksi yang berhasil
    const exactInputParams = ethers.utils.defaultAbiCoder.encode(
      [
        "uint256",
        "uint256",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "bytes",
      ],
      [
        2, // type
        0, // flag
        wallet.address,
        amount,
        0, // amountOutMin
        ethers.constants.MaxUint256,
        ethers.utils.solidityPack(
          ["address", "uint24", "address"],
          [WMON_CONTRACT, 2000, USDT_ADDRESS] // 0.2% fee
        ),
      ]
    );

    const multicallData = ethers.utils.defaultAbiCoder.encode(
      ["bytes[]"],
      [["0x75ceafe6" + exactInputParams.slice(2), "0x412210e8"]]
    );

    const finalData = "0xac9650d8" + multicallData.slice(2);

    const tx = await wallet.sendTransaction({
      to: ROUTER_ADDRESS,
      data: finalData,
      value: amount,
      gasLimit: 179576, // gas limit dari transaksi internal pertama
      maxPriorityFeePerGas: ethers.utils.parseUnits("2.5", "gwei"),
      maxFeePerGas: ethers.utils.parseUnits("102.5", "gwei"),
    });

    console.log(`Transaction hash: ${tx.hash}`);
    console.log(`View on explorer: ${EXPLORER_URL}${tx.hash}`);

    const receipt = await tx.wait();
    if (receipt.status === 1) {
      console.log(`✅ Swap successful`.green);
      // Check logs untuk konfirmasi transfer
      const transferEvents = receipt.logs.filter(
        (log) =>
          log.topics[0] ===
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      if (transferEvents.length > 0) {
        console.log(`✅ Tokens transferred successfully`.green);
      }
    }
    return true;
  } catch (error) {
    console.error(`❌ Swap failed:`.red, error.message);
    if (error.transaction) {
      console.error("Transaction hash:", error.transaction.hash);
      console.error("From:", error.transaction.from);
      console.error("To:", error.transaction.to);
      console.error(
        "Value:",
        ethers.utils.formatEther(error.transaction.value),
        "MON"
      );
    }
    return false;
  }
}

async function runBasicSwaps(numberOfSwaps) {
  console.log(`🚀 Starting basic swap session`.green);

  for (let i = 0; i < numberOfSwaps; i++) {
    console.log(`\n📍 Swap set ${i + 1}/${numberOfSwaps}:`.yellow);

    const amount = ethers.utils.parseEther("0.01");
    const success = await swap(amount);

    if (success && i < numberOfSwaps - 1) {
      console.log(`⏳ Waiting 15 seconds before next set...`.yellow);
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
  }

  console.log(`\n✨ All swap sets completed!`.green);
}

// CLI Interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("How many swap sets do you want to execute? ", async (answer) => {
  const numberOfSwaps = parseInt(answer);
  if (isNaN(numberOfSwaps) || numberOfSwaps <= 0) {
    console.log("❌ Please enter a valid number greater than 0".red);
    rl.close();
    return;
  }

  await runBasicSwaps(numberOfSwaps);
  rl.close();
});
