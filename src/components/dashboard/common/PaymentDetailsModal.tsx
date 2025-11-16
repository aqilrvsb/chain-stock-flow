import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Calendar, Building2, Receipt } from "lucide-react";

interface PaymentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentType: string;
  paymentDate: string | null;
  bankName: string | null;
  receiptImageUrl: string | null;
}

const PaymentDetailsModal = ({
  open,
  onOpenChange,
  paymentType,
  paymentDate,
  bankName,
  receiptImageUrl,
}: PaymentDetailsModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manual Payment Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Payment Type */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Jenis Bayaran (Payment Type)</Label>
            <div className="font-medium">{paymentType}</div>
          </div>

          {/* Payment Date */}
          {paymentDate && (
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Tarikh Bayaran (Payment Date)
              </Label>
              <div className="font-medium">
                {format(new Date(paymentDate), "PPP")}
              </div>
            </div>
          )}

          {/* Bank Name */}
          {bankName && (
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Pilih Bank (Bank Name)
              </Label>
              <div className="font-medium">{bankName}</div>
            </div>
          )}

          {/* Receipt Image */}
          {receiptImageUrl && (
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Resit Bayaran (Receipt)
              </Label>
              <div className="mt-2">
                <a
                  href={receiptImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <img
                    src={receiptImageUrl}
                    alt="Payment Receipt"
                    className="max-w-full h-auto rounded-lg border border-gray-200 hover:border-primary cursor-pointer transition-colors"
                    style={{ maxHeight: "400px" }}
                  />
                </a>
                <p className="text-xs text-muted-foreground mt-2">
                  Click image to view full size
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDetailsModal;
