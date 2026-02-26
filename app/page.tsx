import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-[#0d0d0d] px-4">
      <div className="flex flex-col items-center mb-12">
        <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center mb-4">
          <span className="text-2xl font-bold text-white">K</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">KaoMart</h1>
        <p className="text-sm text-gray-500">AI-Powered Shopping Assistant</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl w-full">
        <Link
          href="/global"
          className="group flex flex-col gap-3 p-6 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-blue-500/40 hover:bg-[#1e1e1e] transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-lg">
            🌐
          </div>
          <div>
            <h2 className="text-base font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
              Global Shopping
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Search millions of products from Shopify merchants worldwide
            </p>
          </div>
        </Link>

        <Link
          href="/kaomart"
          className="group flex flex-col gap-3 p-6 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-emerald-500/40 hover:bg-[#1e1e1e] transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-lg">
            🏪
          </div>
          <div>
            <h2 className="text-base font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">
              KaoMart Store
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Shop curated products with instant checkout
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
