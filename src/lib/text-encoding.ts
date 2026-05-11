let reverseWindows1251: Map<string, number> | null = null;
let mojibakeTokenPattern: RegExp | null = null;

function escapeRegex(value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");
}

function getReverseWindows1251() {
  if (reverseWindows1251) return reverseWindows1251;

  const decoder = new TextDecoder("windows-1251");
  reverseWindows1251 = new Map();

  for (let byte = 0; byte <= 255; byte += 1) {
    reverseWindows1251.set(decoder.decode(Uint8Array.from([byte])), byte);
  }

  return reverseWindows1251;
}

function getMojibakeTokenPattern() {
  if (mojibakeTokenPattern) return mojibakeTokenPattern;

  const decoder = new TextDecoder("windows-1251");
  let middleBytes = "";

  for (let byte = 0x80; byte <= 0xbf; byte += 1) {
    middleBytes += decoder.decode(Uint8Array.from([byte]));
  }

  const middleClass = `[${escapeRegex(middleBytes)}]`;
  mojibakeTokenPattern = new RegExp(`(?:[\\u0420\\u0421]${middleClass}|\\u0412${middleClass}|\\u0432\\u0402${middleClass})`, "g");
  return mojibakeTokenPattern;
}

export function repairMojibake(value: string) {
  const pattern = getMojibakeTokenPattern();
  pattern.lastIndex = 0;
  if (!pattern.test(value)) {
    return value;
  }
  pattern.lastIndex = 0;

  const reverseMap = getReverseWindows1251();
  return value.replace(pattern, (token) => {
    const bytes: number[] = [];

    for (const char of token) {
      const byte = reverseMap.get(char);
      if (byte === undefined) return token;
      bytes.push(byte);
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    } catch {
      return token;
    }
  });
}
