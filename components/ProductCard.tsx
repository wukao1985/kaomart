import { Product } from "@/lib/types";
import Image from "next/image";

function StarRating({ rating }: { rating: number }) {
  const stars = [];
  const rounded = Math.round(rating * 2) / 2;
  for (let i = 1; i <= 5; i++) {
    if (i <= rounded) {
      stars.push(<span key={i} className="text-yellow-400">★</span>);
    } else if (i - 0.5 === rounded) {
      stars.push(<span key={i} className="text-yellow-400 opacity-60">★</span>);
    } else {
      stars.push(<span key={i} className="text-gray-600">★</span>);
    }
  }
  return <span className="flex gap-0.5 text-sm">{stars}</span>;
}

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  const hasImage = product.image && product.image !== "";

  return (
    <div
      className="flex gap-3 rounded-xl bg-gray-800/70 border border-gray-700/50 p-3
        hover:border-emerald-600/50 hover:bg-gray-800 transition-all cursor-pointer max-w-sm
        active:scale-[0.98]"
      onClick={() => onSelect(product)}
    >
      {hasImage && (
        <div className="relative h-[100px] w-[100px] flex-shrink-0 rounded-lg overflow-hidden bg-white">
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-contain p-1"
            sizes="100px"
            unoptimized
          />
        </div>
      )}
      <div className="flex flex-col justify-between min-w-0 flex-1">
        <div>
          <h3 className="font-medium text-sm text-gray-100 line-clamp-2 leading-tight">
            {product.title}
          </h3>
          {product.vendor && (
            <p className="text-xs text-gray-400 mt-0.5">{product.vendor}</p>
          )}
          <div className="mt-1">
            <StarRating rating={product.rating} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-lg font-bold text-emerald-400">
            {product.currency === "USD" ? "$" : product.currency}{" "}
            {product.price}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(product); }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95
              text-white text-xs font-semibold rounded-lg transition-all"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
