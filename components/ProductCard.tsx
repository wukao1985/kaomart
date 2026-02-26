import { Product } from "@/lib/types";
import Image from "next/image";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const hasImage = product.image && product.image !== "";

  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a]
        hover:border-emerald-600/50 hover:bg-[#252525] transition-all cursor-pointer
        p-2.5 active:scale-[0.98]"
      onClick={() => onSelect(product)}
    >
      {hasImage && (
        <div className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-white">
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-contain p-1"
            sizes="64px"
            unoptimized
          />
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <h3 className="font-medium text-sm text-gray-100 line-clamp-2 leading-tight">
          {product.title}
        </h3>
        {product.vendor && (
          <p className="text-xs text-emerald-400 font-medium">{product.vendor}</p>
        )}
        <p className="text-sm font-bold text-emerald-400">
          {product.currency === "USD" ? "$" : product.currency}
          {product.price}
        </p>
      </div>
    </div>
  );
}
