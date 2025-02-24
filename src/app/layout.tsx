import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MonadSwap - Simple DEX on Monad Testnet",
  description:
    "A simple decentralized exchange for swapping tokens on Monad Testnet with 2% fee.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="bg-white shadow-lg">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <a href="/" className="text-2xl font-bold text-purple-600">
                MonadSwap
              </a>
              <div className="flex space-x-4">
                <a href="/swap" className="text-gray-600 hover:text-purple-600">
                  Swap
                </a>
                <a
                  href="#features"
                  className="text-gray-600 hover:text-purple-600"
                >
                  Features
                </a>
                <a href="#docs" className="text-gray-600 hover:text-purple-600">
                  Docs
                </a>
                <a
                  href="#contact"
                  className="text-gray-600 hover:text-purple-600"
                >
                  Contact
                </a>
              </div>
            </div>
          </div>
        </nav>
        {children}
        <footer className="bg-gray-800 text-white py-8">
          <div className="container mx-auto px-4 text-center">
            <p>© 2024 MonadSwap. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
