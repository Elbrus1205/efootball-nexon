import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { optimizedImageUrl } from "@/lib/image-optimization";
import { proxyTelegramAssetUrl } from "@/lib/telegram-assets";
import { cn, getInitials } from "@/lib/utils";

export function Avatar({ className, ...props }: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>) {
  return <AvatarPrimitive.Root className={cn("relative aspect-square flex h-11 w-11 shrink-0 overflow-hidden rounded-full", className)} {...props} />;
}

export function AvatarImage({ src, ...props }: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>) {
  const proxiedSrc = proxyTelegramAssetUrl(src);
  return <AvatarPrimitive.Image className="aspect-square h-full w-full object-cover" src={optimizedImageUrl(proxiedSrc, { width: 192, height: 192, quality: 84, resize: "cover", format: "webp" })} {...props} />;
}

export function AvatarFallback({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn("flex h-full w-full items-center justify-center bg-white/10 text-sm font-semibold text-white", className)}
      {...props}
    >
      {typeof children === "string" ? getInitials(children) : children}
    </AvatarPrimitive.Fallback>
  );
}
