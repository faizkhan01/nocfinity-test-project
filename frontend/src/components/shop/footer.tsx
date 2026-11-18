import Image from "next/image";
import Link from "next/link";
import { FacebookIcon, GithubIcon, InstagramIcon, TwitterIcon } from "@/components/icons";
import { Newsletter } from "./newsletter";

const COLUMNS = [
  { title: "Company", links: ["About", "Features", "Works", "Career"] },
  { title: "Help", links: ["Customer Support", "Delivery Details", "Terms & Conditions", "Privacy Policy"] },
  { title: "FAQ", links: [["Account", "/account"], ["Manage Deliveries", "/orders"], ["Orders", "/orders"], ["Payments", "/orders"]] },
  { title: "Resources", links: ["Free eBooks", "Development Tutorial", "How to - Blog", "Youtube Playlist"] },
] as const;

const SOCIALS = [
  { label: "Twitter", Icon: TwitterIcon, dark: false },
  { label: "Facebook", Icon: FacebookIcon, dark: true },
  { label: "Instagram", Icon: InstagramIcon, dark: false },
  { label: "GitHub", Icon: GithubIcon, dark: false },
];

const PAYMENTS = ["visa", "mastercard", "paypal", "applepay", "gpay"];

export function Footer() {
  return (
    <footer className="mt-[50px] sm:mt-20">
      <div className="bg-[linear-gradient(to_bottom,#fff_50%,var(--color-surface)_50%)]">
        <div className="container-shop">
          <Newsletter />
        </div>
      </div>
      <div className="bg-surface pb-[77px] pt-[50px] sm:pb-[88px]">
        <div className="container-shop">
          <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
            <div className="flex flex-col gap-5 lg:gap-[35px]">
              <div className="flex flex-col gap-[14px] lg:gap-[25px]">
                <Link href="/" className="font-heading text-[28.85px] lg:text-[33.45px]">
                  SHOP.CO
                </Link>
                <p className="text-sm leading-[22px] text-ink/60 lg:w-[248px]">
                  We have clothes that suits your style and which you&apos;re proud to wear. From women to men.
                </p>
              </div>
              <ul className="flex gap-3">
                {SOCIALS.map(({ label, Icon, dark }) => (
                  <li key={label}>
                    <span
                      aria-label={label}
                      role="img"
                      className={`grid size-7 place-items-center rounded-full border ${dark ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}
                    >
                      <Icon className="size-3" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:contents">
              {COLUMNS.map((column) => (
                <div key={column.title} className="flex flex-col gap-4 lg:gap-[26px]">
                  <h3 className="text-sm font-medium uppercase leading-[18px] tracking-[3px] lg:text-base">{column.title}</h3>
                  <ul className="flex flex-col gap-4 text-sm leading-[19px] text-ink/60 lg:gap-[19px] lg:text-base">
                    {column.links.map((link) => {
                      const [label, href] = Array.isArray(link) ? link : [link, "#"];
                      return (
                        <li key={label}>
                          <Link href={href} className="hover:text-ink">
                            {label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center gap-4 border-t border-line pt-4 sm:mt-[50px] sm:flex-row sm:justify-between sm:pt-5">
            <p className="text-sm text-ink/60">Shop.co © 2000-2023, All Rights Reserved</p>
            <ul className="flex items-center gap-3">
              {PAYMENTS.map((name) => (
                <li key={name}>
                  <Image src={`/images/payments/${name}.svg`} alt={name} width={65} height={48} className="-mx-[9px] -my-[5px] h-auto w-[56px] sm:w-[65px]" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
