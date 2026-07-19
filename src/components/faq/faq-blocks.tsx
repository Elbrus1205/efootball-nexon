import { Download, ExternalLink } from "lucide-react";
import type { FaqBlock } from "@/lib/faq/content";
import { isAttachmentBlock, isMediaBlock } from "@/lib/faq/content";

/** Renders resolved FAQ blocks (text/heading/note/image/video/file/link). */
export function FaqBlocks({ blocks }: { blocks: FaqBlock[] }) {
  if (!blocks.length) return null;

  return (
    <div className="space-y-4 text-sm leading-6 text-zinc-300">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={index} className="pt-1 text-base font-semibold text-white">
              {block.text}
            </h3>
          );
        }

        if (block.type === "note") {
          return (
            <div
              key={index}
              className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-zinc-200"
            >
              {block.text}
            </div>
          );
        }

        if (block.type === "text") {
          return <p key={index}>{block.text}</p>;
        }

        if (isMediaBlock(block)) {
          return (
            <figure key={index} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              {block.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={block.url}
                  alt={block.caption || "Иллюстрация к ответу"}
                  loading="lazy"
                  decoding="async"
                  className="max-h-[26rem] w-full object-cover"
                />
              ) : (
                <video src={block.url} controls preload="metadata" className="max-h-[26rem] w-full bg-black" />
              )}
              {block.caption ? (
                <figcaption className="border-t border-white/10 px-4 py-2 text-center text-xs text-zinc-400">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (isAttachmentBlock(block)) {
          const Icon = block.type === "file" ? Download : ExternalLink;
          return (
            <a
              key={index}
              href={block.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white transition duration-200 hover:border-primary/40 hover:bg-primary/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{block.title}</span>
              <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
            </a>
          );
        }

        return null;
      })}
    </div>
  );
}
