import { Download, ExternalLink, ImageIcon, Info, Play } from "lucide-react";
import type { FaqBlock } from "@/lib/faq/content";
import { isAttachmentBlock, isMediaBlock } from "@/lib/faq/content";
import { getFaqVideoEmbedUrl, isSafeFaqUrl } from "@/lib/faq/media";
import styles from "./faq.module.css";

/** Shared by the public answer and the admin preview. Text is never interpreted as HTML. */
export function FaqBlocks({ blocks }: { blocks: FaqBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className={styles.blocks}>
      {blocks.map((block, index) => {
        if (block.type === "heading") return <h3 key={index}>{block.text}</h3>;
        if (block.type === "text") return <p key={index}>{block.text}</p>;
        if (block.type === "note") {
          return <div key={index} className={styles.note}><Info size={16} aria-hidden="true" /><p>{block.text}</p></div>;
        }
        if (isMediaBlock(block)) {
          if (!isSafeFaqUrl(block.url)) return null;
          const embed = block.type === "video" ? getFaqVideoEmbedUrl(block.url) : null;
          const CaptionIcon = block.type === "image" ? ImageIcon : Play;
          return (
            <figure key={index} className={styles.media}>
              {block.type === "image" ? (
                <a href={block.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть изображение в полном размере">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={block.url} alt={block.caption || "Иллюстрация к ответу"} loading="lazy" decoding="async" />
                </a>
              ) : embed ? (
                <iframe src={embed} title={block.caption || "Видеоинструкция"} loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              ) : (
                <video src={block.url} controls playsInline preload="none" aria-label={block.caption || "Видеоинструкция"}>
                  Ваш браузер не поддерживает видео. <a href={block.url}>Открыть видео</a>
                </video>
              )}
              {block.caption ? <figcaption><CaptionIcon size={14} aria-hidden="true" />{block.caption}</figcaption> : null}
            </figure>
          );
        }
        if (isAttachmentBlock(block)) {
          if (!isSafeFaqUrl(block.url)) return null;
          const Icon = block.type === "file" ? Download : ExternalLink;
          return (
            <a key={index} href={block.url} target="_blank" rel="noopener noreferrer" className={styles.attachment}>
              <Icon size={18} aria-hidden="true" /><span>{block.title}</span><ExternalLink size={14} aria-hidden="true" />
            </a>
          );
        }
        return null;
      })}
    </div>
  );
}
