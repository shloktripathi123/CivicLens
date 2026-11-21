import { BILL_STATUS_LABEL } from "@/lib/api";

// Text and icon carry the meaning; colour is never the only signal.
export default function BillStatus({ status, isLaw }: { status: string; isLaw: boolean }) {
  return (
    <span className={isLaw ? "chip law" : "chip"}>
      {isLaw ? "Law" : "Not a law"}: {BILL_STATUS_LABEL[status] ?? status}
    </span>
  );
}
