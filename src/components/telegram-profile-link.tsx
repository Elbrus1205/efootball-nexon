import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { TelegramProfileLinks } from "@/lib/social-links";

type TelegramProfileLinkProps = TelegramProfileLinks & {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  "aria-label"?: string;
  target?: AnchorHTMLAttributes<HTMLAnchorElement>["target"];
  rel?: AnchorHTMLAttributes<HTMLAnchorElement>["rel"];
};

export function TelegramProfileLink({
  href,
  children,
  className,
  ariaLabel,
  "aria-label": ariaLabelProp,
  target = "_blank",
  rel = "noreferrer",
}: TelegramProfileLinkProps) {
  return (
    <a href={href} target={target} rel={rel} aria-label={ariaLabel ?? ariaLabelProp} className={className}>
      {children}
    </a>
  );
}
