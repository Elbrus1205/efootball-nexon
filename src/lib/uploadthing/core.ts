import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  avatarUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } }).onUploadComplete(async ({ file }) => {
    const uploaded = file as unknown as { url?: string; key?: string };
    return { url: uploaded.url ?? uploaded.key ?? "" };
  }),
  coverUploader: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } }).onUploadComplete(async ({ file }) => {
    const uploaded = file as unknown as { url?: string; ufsUrl?: string; key?: string };
    return { url: uploaded.ufsUrl ?? uploaded.url ?? uploaded.key ?? "" };
  }),
  screenshotUploader: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } }).onUploadComplete(async ({ file }) => {
    const uploaded = file as unknown as { url?: string; key?: string };
    return { url: uploaded.url ?? uploaded.key ?? "" };
  }),
  faqAttachmentUploader: f({ blob: { maxFileSize: "16MB", maxFileCount: 1 } }).onUploadComplete(async ({ file }) => {
    const uploaded = file as unknown as { url?: string; ufsUrl?: string; key?: string; name?: string; type?: string };
    return {
      url: uploaded.ufsUrl ?? uploaded.url ?? uploaded.key ?? "",
      name: uploaded.name ?? "",
      type: uploaded.type ?? "",
    };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
