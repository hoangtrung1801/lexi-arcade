import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import type { ToneName } from "../../lib/frames";

type Tone = Exclude<ToneName, "dark">;

/** Light faces get dark, embossed text; dark faces get light text with a hard shadow. */
const TEXT: Record<Tone, string> = {
  gold: "text-[#3a1a18] [text-shadow:2px_0_0_currentColor,0_2px_0_rgb(255_255_255/0.45)]",
  blue: "text-[#0c1440] [text-shadow:2px_0_0_currentColor,0_2px_0_rgb(255_255_255/0.4)]",
  green: "text-[#0f2d2c] [text-shadow:2px_0_0_currentColor,0_2px_0_rgb(255_255_255/0.4)]",
  red: "text-snow t-bold",
  grey: "text-snow t-bold",
};

const BASE =
  "group inline-flex min-h-11 select-none items-center justify-center whitespace-nowrap uppercase no-underline";

const SIZES = {
  sm: "t-sm px-3 pt-0.5 pb-1.5",
  md: "t-md px-4 pt-0.5 pb-1.5",
  lg: "t-lg px-6 pt-1 pb-2",
} as const;

interface Common {
  tone?: Tone;
  size?: keyof typeof SIZES;
  children?: ReactNode;
}

function Face({ children }: { children?: ReactNode }) {
  return (
    <span className="relative inline-flex items-center gap-3 group-active:group-enabled:top-1">
      {children}
    </span>
  );
}

export function PixelButton({
  tone = "grey",
  size = "md",
  className = "",
  children,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${BASE} hb-btn-${tone} ${TEXT[tone]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      <Face>{children}</Face>
    </button>
  );
}

export function PixelLink({
  tone = "grey",
  size = "md",
  className = "",
  children,
  ...rest
}: Common & LinkProps) {
  return (
    <Link className={`${BASE} hb-btn-${tone} ${TEXT[tone]} ${SIZES[size]} ${className}`} {...rest}>
      <span className="relative inline-flex items-center gap-3 group-active:top-1">{children}</span>
    </Link>
  );
}
