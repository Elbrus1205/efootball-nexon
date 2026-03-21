import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  avatarUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } }).onUploadComplete(async ({ file }) => {
    const uploaded = file as unknown as { url?: string; key?: string };
    return { url: uploaded.url ?? uploaded.key ?? "" };
  }),
  screenshotUploader: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } }).onUploadComplete(async ({ file }) => {
    const uploaded = file as unknown as { url?: string; key?: string };
    return { url: uploaded.url ?? uploaded.key ?? "" };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
