import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { Sparkle } from "../sparkle";

const STATS = [
  { value: "200+", label: "International Brands" },
  { value: "2,000+", label: "High-Quality Products" },
  { value: "30,000+", label: "Happy Customers" },
];

export function Hero() {
  return (
    <section className="overflow-hidden bg-hero">
      <div className="container-shop relative lg:h-[663px]">
        <div className="relative z-10 pt-10 lg:max-w-[596px] lg:pt-[103px]">
          <h1 className="font-heading text-[36px] leading-[34px] lg:text-[64px] lg:leading-[64px]">Find clothes that matches your style</h1>
          <p className="mt-5 text-sm leading-5 text-ink/60 lg:mt-2 lg:max-w-[545px] lg:text-base lg:leading-[22px]">
            Browse through our diverse range of meticulously crafted garments, designed to bring out your individuality and cater to your
            sense of style.
          </p>
          <ButtonLink href="/shop" size="lg" className="mt-6 w-full lg:mt-8 lg:w-[210px]">
            Shop Now
          </ButtonLink>
          <dl className="mt-5 flex flex-wrap justify-center gap-y-3 lg:mt-12 lg:flex-nowrap lg:justify-start">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={[
                  "flex flex-col whitespace-nowrap px-[22px] lg:px-8 lg:first:pl-0",
                  i === 0 ? "border-r border-line" : "",
                  i === 1 ? "lg:border-r lg:border-line" : "",
                ].join(" ")}
              >
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-bold lg:text-[40px] lg:leading-[54px]">{stat.value}</dd>
                <dd className="text-xs leading-[22px] text-ink/60 lg:text-base">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative -mx-4 mt-6 h-[448px] overflow-hidden lg:absolute lg:inset-0 lg:m-0 lg:h-full lg:overflow-visible">
          <Image
            src="/images/hero.jpg"
            alt="Couple wearing denim jackets and hoodies"
            width={1400}
            height={2100}
            priority
            sizes="(min-width: 1024px) 672px, 100vw"
            className="absolute left-1/2 top-0 h-[150%] w-auto max-w-none -translate-x-[45%] lg:left-[49.6%] lg:top-[-46px] lg:h-[1008px] lg:translate-x-0"
          />
          <Sparkle className="absolute right-4 top-[11px] size-[76px] lg:right-[-19px] lg:top-[86px] lg:size-[104px]" />
          <Sparkle className="absolute left-[27px] top-[124px] size-11 lg:left-[650px] lg:top-[297px] lg:size-14" />
        </div>
      </div>
    </section>
  );
}
