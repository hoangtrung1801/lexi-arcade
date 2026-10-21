import { useEffect, useState } from "react";

const MIN_WIDTH = 1024;

function check() {
  const touchOnly = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  return window.innerWidth >= MIN_WIDTH && !touchOnly;
}

/** Desktop-first: below 1024px or on a touch-only device the app shows a "use a computer" screen. */
export function useIsDesktop() {
  const [ok, setOk] = useState(check);
  useEffect(() => {
    const on = () => setOk(check());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return ok;
}
