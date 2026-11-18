export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="container-shop">
      <hr className="border-line" />
      <div className="mx-auto my-10 max-w-md rounded-[20px] border border-line p-6 sm:my-16 sm:p-10">
        <h1 className="font-heading text-[28px] leading-8 sm:text-[32px] sm:leading-9">{title}</h1>
        {subtitle && <p className="mt-3 text-ink/60">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
