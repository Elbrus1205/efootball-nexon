export type DownloadFile = {
  name: string;
  blob: Blob;
};

const crcTable = Array.from({ length: 256 }, (_, tableIndex) => {
  let value = tableIndex;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function encodeFileName(value: string) {
  return new TextEncoder().encode(value);
}

async function createZipBlob(files: DownloadFile[]) {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encodeFileName(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const checksum = crc32(data);

    const localHeader: number[] = [];
    writeUint32(localHeader, 0x04034b50);
    writeUint16(localHeader, 20);
    writeUint16(localHeader, 0x0800);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint32(localHeader, checksum);
    writeUint32(localHeader, data.length);
    writeUint32(localHeader, data.length);
    writeUint16(localHeader, nameBytes.length);
    writeUint16(localHeader, 0);

    const localPart = new Uint8Array(localHeader.length + nameBytes.length + data.length);
    localPart.set(localHeader, 0);
    localPart.set(nameBytes, localHeader.length);
    localPart.set(data, localHeader.length + nameBytes.length);
    chunks.push(localPart);

    const centralHeader: number[] = [];
    writeUint32(centralHeader, 0x02014b50);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 0x0800);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, checksum);
    writeUint32(centralHeader, data.length);
    writeUint32(centralHeader, data.length);
    writeUint16(centralHeader, nameBytes.length);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, 0);
    writeUint32(centralHeader, offset);

    const centralPart = new Uint8Array(centralHeader.length + nameBytes.length);
    centralPart.set(centralHeader, 0);
    centralPart.set(nameBytes, centralHeader.length);
    centralDirectory.push(centralPart);

    offset += localPart.length;
  }

  const centralDirectorySize = centralDirectory.reduce((sum, item) => sum + item.length, 0);
  const centralDirectoryOffset = offset;
  const endHeader: number[] = [];
  writeUint32(endHeader, 0x06054b50);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, files.length);
  writeUint16(endHeader, files.length);
  writeUint32(endHeader, centralDirectorySize);
  writeUint32(endHeader, centralDirectoryOffset);
  writeUint16(endHeader, 0);

  const blobParts: BlobPart[] = [...chunks, ...centralDirectory, new Uint8Array(endHeader)].map((part) => {
    const copy = new Uint8Array(part.byteLength);
    copy.set(part);
    return copy;
  });
  return new Blob(blobParts, { type: "application/zip" });
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadFiles(files: DownloadFile[], archiveName: string) {
  if (!files.length) return;
  if (files.length === 1) {
    downloadBlob(files[0].blob, files[0].name);
    return;
  }

  const zipBlob = await createZipBlob(files);
  downloadBlob(zipBlob, archiveName);
}
