import type { HTMLAttributes } from "react";

const VARIANT = {
  panel: "hb-panel hb-lift p-4",
  ornate: "hb-ornate hb-lift p-5",
  inset: "hb-inset p-3",
} as const;

export function PixelPanel({
  variant = "panel",
  className = "",
  ...rest
}: { variant?: keyof typeof VARIANT } & HTMLAttributes<HTMLElement>) {
  return <section className={`${VARIANT[variant]} ${className}`} {...rest} />;
}
