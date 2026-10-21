import type { HTMLAttributes } from "react";

const BG = { steel: "bg-steel", navy: "bg-navy", ink: "bg-ink", deep: "bg-[#0f1424]" } as const;

export function PixelPanel({
  tone = "steel",
  className = "",
  ...rest
}: { tone?: keyof typeof BG } & HTMLAttributes<HTMLElement>) {
  return <section className={`px-box ${BG[tone]} p-5 ${className}`} {...rest} />;
}
