const mojibakePattern = /[РС][\u00a0-\u00bf\u0400-\u040f\u0450-\u045f]/;

let reverseWindows1251: Map<string, number> | null = null;

function getReverseWindows1251() {
  if (reverseWindows1251) return reverseWindows1251;

  const decoder = new TextDecoder("windows-1251");
  reverseWindows1251 = new Map();

  for (let byte = 0; byte <= 255; byte += 1) {
    reverseWindows1251.set(decoder.decode(Uint8Array.from([byte])), byte);
  }

  return reverseWindows1251;
}

export function repairMojibake(value: string) {
  if (!mojibakePattern.test(value)) {
    return value;
  }

  const reverseMap = getReverseWindows1251();
  const bytes: number[] = [];

  for (const char of value) {
    if (reverseMap.has(char)) {
      bytes.push(reverseMap.get(char)!);
      continue;
    }

    const code = char.charCodeAt(0);
    if (code <= 0x7f) {
      bytes.push(code);
      continue;
    }

    return value;
  }

  const repaired = new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
  return repaired.includes("�") ? value : repaired;
}
