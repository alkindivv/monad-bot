export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-purple-600 to-blue-600 text-white py-20">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">Welcome to MonadSwap</h1>
          <p className="text-xl mb-8">
            The simplest way to swap tokens on Monad Testnet
          </p>
          <div className="flex justify-center space-x-4">
            <a
              href="/swap"
              className="bg-white text-purple-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100"
            >
              Launch App
            </a>
            <a
              href="#docs"
              className="border-2 border-white text-white px-8 py-3 rounded-full font-bold hover:bg-white hover:text-purple-600"
            >
              Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4">Low Fees</h3>
              <p>
                Only 2% fee for each swap, lower than most DEXes on Monad
                Testnet.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4">Stable Rates</h3>
              <p>
                Fixed exchange rates for stable pairs (USDC-USDT) and optimized
                rates for other pairs.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4">Simple Interface</h3>
              <p>
                Easy to use interface with no complicated settings or slippage
                adjustments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section id="docs" className="bg-gray-100 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">
            Documentation
          </h2>

          <div className="max-w-3xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-lg mb-8">
              <h3 className="text-2xl font-bold mb-4">Contract Address</h3>
              <p className="font-mono bg-gray-100 p-2 rounded">
                0x1422a7114DC23BC1473D86378D89a1EE134a0f6c
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg mb-8">
              <h3 className="text-2xl font-bold mb-4">Supported Tokens</h3>
              <ul className="space-y-4">
                <li>
                  <span className="font-bold">USDC:</span>
                  <p className="font-mono bg-gray-100 p-2 rounded">
                    0xf817257fed379853cDe0fa4F97AB987181B1E5Ea
                  </p>
                </li>
                <li>
                  <span className="font-bold">USDT:</span>
                  <p className="font-mono bg-gray-100 p-2 rounded">
                    0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D
                  </p>
                </li>
                <li>
                  <span className="font-bold">WETH:</span>
                  <p className="font-mono bg-gray-100 p-2 rounded">
                    0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37
                  </p>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold mb-4">How to Use</h3>
              <ol className="list-decimal list-inside space-y-4">
                <li>
                  <span className="font-bold">Approve Token</span>
                  <p className="mt-2">
                    First, approve the token you want to swap using the token's
                    contract.
                  </p>
                </li>
                <li>
                  <span className="font-bold">Check Rate</span>
                  <p className="mt-2">
                    View the current exchange rate for your desired token pair.
                  </p>
                </li>
                <li>
                  <span className="font-bold">Swap</span>
                  <p className="mt-2">
                    Enter the amount you want to swap and confirm the
                    transaction.
                  </p>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-12">Contact Us</h2>
          <div className="flex justify-center space-x-8">
            <a
              href="#"
              className="flex items-center space-x-2 text-gray-600 hover:text-purple-600"
            >
              <span className="text-xl">Twitter</span>
            </a>
            <a
              href="#"
              className="flex items-center space-x-2 text-gray-600 hover:text-purple-600"
            >
              <span className="text-xl">Telegram</span>
            </a>
            <a
              href="#"
              className="flex items-center space-x-2 text-gray-600 hover:text-purple-600"
            >
              <span className="text-xl">Discord</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
