import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/shop/section-heading";

type Style = { name: string; slug: string; src: string; w: number; h: number; img: string; flip?: boolean };

// Each image's width and offset (as % of its card) reproduce the crop in the Figma frame.
const ROWS: { columns: string; styles: Style[] }[] = [
  {
    columns: "lg:grid-cols-[407fr_684fr]",
    styles: [
      { name: "Casual", slug: "casual", src: "/images/style/casual.png", w: 826, h: 620, img: "lg:left-[-85.3%] lg:top-[-56%] lg:w-[239%]", flip: true },
      { name: "Formal", slug: "formal", src: "/images/style/formal.png", w: 900, h: 600, img: "lg:left-0 lg:top-[-50.5%] lg:w-[191%]" },
    ],
  },
  {
    columns: "lg:grid-cols-[684fr_407fr]",
    styles: [
      { name: "Party", slug: "party", src: "/images/style/party.png", w: 826, h: 660, img: "lg:left-[6.1%] lg:top-[-56.4%] lg:w-[112.6%]" },
      { name: "Gym", slug: "gym", src: "/images/style/gym.png", w: 740, h: 1110, img: "lg:left-[13%] lg:top-[-51.2%] lg:w-[111%]" },
    ],
  },
];

export function DressStyles() {
  return (
    <section className="container-shop pt-[50px] lg:pt-20">
      <div className="rounded-[20px] bg-surface px-6 pb-[27px] pt-10 lg:rounded-panel lg:px-16 lg:pb-[76px] lg:pt-[70px]">
        <SectionHeading className="text-center">Browse by dress style</SectionHeading>
        <div className="mt-7 flex flex-col gap-4 lg:mt-16 lg:gap-5">
          {ROWS.map((row) => (
            <ul key={row.columns} className={`grid gap-4 lg:gap-5 ${row.columns}`}>
              {row.styles.map((style) => (
                <li key={style.slug}>
                  <Link href={`/shop?styles=${style.slug}`} className="group relative block h-[190px] overflow-hidden rounded-[20px] bg-white lg:h-[289px]">
                    <Image
                      src={style.src}
                      alt=""
                      width={style.w}
                      height={style.h}
                      sizes="(min-width: 1024px) 1000px, 100vw"
                      className={`absolute right-0 top-0 h-full w-auto max-w-none transition-transform duration-500 group-hover:scale-105 lg:right-auto lg:h-auto ${style.img} ${style.flip ? "-scale-x-100 group-hover:-scale-x-105" : ""}`}
                    />
                    <span className="absolute left-6 top-4 text-2xl font-bold lg:left-9 lg:top-[25px] lg:text-4xl">{style.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
