import Image from "next/image";

/**
 * A game item as a small picture (128px files in `public/items`, from
 * kingshotdata.com) or, for items without one, its emoji. `className` sizes it
 * in rem so it follows the text size.
 */
export function ItemIcon({ image, emoji, className }: { image?: string; emoji: string; className: string }) {
  if (!image) {
    return (
      <span className="leading-none" aria-hidden>
        {emoji}
      </span>
    );
  }
  // Already 128px: skip the optimiser (saves free-tier image transformations), like the hero portraits.
  return <Image src={image} alt="" width={64} height={64} unoptimized className={`object-contain ${className}`} />;
}
