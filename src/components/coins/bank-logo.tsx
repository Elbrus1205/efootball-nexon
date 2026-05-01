import type { CoinPaymentBank } from "@prisma/client";
import { coinPaymentBankLabel, coinPaymentBankTone } from "@/lib/coin-services";
import { cn } from "@/lib/utils";

const bankMarks = {
  OZON: "O",
  TBANK: "T",
  SBER: "✓",
  VTB: "VTB",
} satisfies Record<CoinPaymentBank, string>;

export function BankLogo({ bank, className }: { bank?: CoinPaymentBank | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-black", coinPaymentBankTone(bank), className)}>
      <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-white/20 px-1 text-[10px] font-black leading-none">
        {bank ? bankMarks[bank] : "?"}
      </span>
      <span>{coinPaymentBankLabel(bank)}</span>
    </span>
  );
}
