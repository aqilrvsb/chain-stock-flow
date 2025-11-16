import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Upload } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ManualPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ManualPaymentData) => void;
  isLoading?: boolean;
}

export interface ManualPaymentData {
  paymentType: string;
  paymentDate: Date;
  bankName: string;
  receiptFile: File;
}

const PAYMENT_TYPES = [
  "Online Transfer",
  "Cheque",
  "CDM",
  "Cash",
];

const MALAYSIAN_BANKS = [
  "Maybank",
  "CIMB Bank",
  "Public Bank",
  "RHB Bank",
  "Hong Leong Bank",
  "AmBank",
  "Bank Islam",
  "Bank Rakyat",
];

const ManualPaymentModal = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: ManualPaymentModalProps) => {
  const [paymentType, setPaymentType] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date>();
  const [bankName, setBankName] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setFileError("File size must be less than 2MB");
        setReceiptFile(null);
        e.target.value = "";
        return;
      }

      // Check file type (images only)
      if (!file.type.startsWith("image/")) {
        setFileError("Please upload an image file");
        setReceiptFile(null);
        e.target.value = "";
        return;
      }

      setFileError("");
      setReceiptFile(file);
    }
  };

  const handleSubmit = () => {
    if (!paymentType || !paymentDate || !bankName || !receiptFile) {
      return;
    }

    onSubmit({
      paymentType,
      paymentDate,
      bankName,
      receiptFile,
    });
  };

  const isFormValid = paymentType && paymentDate && bankName && receiptFile && !fileError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual Payment Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Payment Type */}
          <div className="space-y-2">
            <Label htmlFor="payment-type">Jenis Bayaran (Payment Type)</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger id="payment-type">
                <SelectValue placeholder="Select payment type" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label>Tarikh Bayaran (Payment Date)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={setPaymentDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Bank Name */}
          <div className="space-y-2">
            <Label htmlFor="bank-name">Pilih Bank (Select Bank)</Label>
            <Select value={bankName} onValueChange={setBankName}>
              <SelectTrigger id="bank-name">
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>
              <SelectContent>
                {MALAYSIAN_BANKS.map((bank) => (
                  <SelectItem key={bank} value={bank}>
                    {bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label htmlFor="receipt">Resit Bayaran (Receipt)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="receipt"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            {fileError && (
              <p className="text-sm text-destructive">{fileError}</p>
            )}
            {receiptFile && !fileError && (
              <p className="text-sm text-muted-foreground">
                Selected: {receiptFile.name} ({(receiptFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Maximum file size: 2MB
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? "Processing..." : "Proceed"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualPaymentModal;
