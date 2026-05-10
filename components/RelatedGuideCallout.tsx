import Link from "next/link";
import { PRODUCTS } from "@/lib/products";

interface Props {
  guideSlug: string;
}

export default function RelatedGuideCallout({ guideSlug }: Props) {
  const product = PRODUCTS.find((p) => p.id === guideSlug);
  if (!product) return null;

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(product.price);

  return (
    <div className="my-10 rounded-lg border-l-4 border-primary bg-ash p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
        Related Guide
      </p>
      <h3 className="font-display font-bold text-xl text-secondary mb-2">
        {product.name}
      </h3>
      <p className="text-stone text-sm leading-relaxed mb-5">
        {product.description}
      </p>
      <Link
        href={`/digital-products#${product.id}`}
        className="inline-block bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded hover:bg-secondary transition-colors"
      >
        Get the guide for {price}
      </Link>
    </div>
  );
}
