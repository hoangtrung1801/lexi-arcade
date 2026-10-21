import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";

const TONES = {
  gold: "bg-gold text-ink",
  blue: "bg-sky text-ink",
  grey: "bg-steel text-snow",
  green: "bg-lime text-ink",
  red: "bg-berry text-snow",
} as const;
type Tone = keyof typeof TONES;

const BASE =
  "px-btn font-vi inline-flex min-h-11 cursor-pointer items-center justify-center gap-3 border-0 no-underline disabled:cursor-not-allowed disabled:opacity-50";

const SIZES = {
  sm: "px-3 py-2.5 text-[18px]",
  md: "px-5 py-3.5 text-[22px]",
  lg: "px-6 py-4 text-[26px]",
} as const;

interface Common {
  tone?: Tone;
  size?: keyof typeof SIZES;
}

export function PixelButton({
  tone = "grey",
  size = "md",
  className = "",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${BASE} ${TONES[tone]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}

export function PixelLink({
  tone = "grey",
  size = "md",
  className = "",
  ...rest
}: Common & LinkProps) {
  return <Link className={`${BASE} ${TONES[tone]} ${SIZES[size]} ${className}`} {...rest} />;
}
