import Image from "next/image";

const BRANDS = [
  { name: "Versace", src: "/images/brands/versace.png", width: 167, height: 34 },
  { name: "Zara", src: "/images/brands/zara.svg", width: 91, height: 38 },
  { name: "Gucci", src: "/images/brands/gucci.svg", width: 156, height: 36 },
  { name: "Prada", src: "/images/brands/prada.png", width: 195, height: 32 },
  { name: "Calvin Klein", src: "/images/brands/calvin-klein.svg", width: 207, height: 33 },
];

export function Brands() {
  return (
    <section id="brands" aria-label="Brands we carry" className="bg-ink">
      <ul className="container-shop flex flex-wrap items-center justify-center gap-x-8 gap-y-5 py-10 lg:flex-nowrap lg:justify-between lg:py-11">
        {BRANDS.map((brand) => (
          <li key={brand.name}>
            <Image
              src={brand.src}
              alt={brand.name}
              width={brand.width}
              height={brand.height}
              className="h-auto"
              style={{ width: `clamp(${Math.round(brand.width * 0.7)}px, ${((brand.width / 1440) * 100).toFixed(2)}vw, ${brand.width}px)` }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
