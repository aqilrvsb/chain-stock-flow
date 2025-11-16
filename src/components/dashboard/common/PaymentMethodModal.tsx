import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFPX: () => void;
  onSelectManual: () => void;
}

const PaymentMethodModal = ({
  open,
  onOpenChange,
  onSelectFPX,
  onSelectManual,
}: PaymentMethodModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<"fpx" | "manual">("fpx");

  const handleProceed = () => {
    if (selectedMethod === "fpx") {
      onSelectFPX();
    } else {
      onSelectManual();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Payment Method</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <RadioGroup
            value={selectedMethod}
            onValueChange={(value) => setSelectedMethod(value as "fpx" | "manual")}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="fpx" id="fpx" />
              <Label htmlFor="fpx" className="flex-1 cursor-pointer">
                <div className="font-medium">FPX</div>
                <div className="text-sm text-muted-foreground">
                  Pay online via Billplz
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="manual" id="manual" />
              <Label htmlFor="manual" className="flex-1 cursor-pointer">
                <div className="font-medium">Transfer</div>
                <div className="text-sm text-muted-foreground">
                  Manual payment (Online Transfer, Cheque, CDM, Cash)
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleProceed} className="w-full sm:w-auto">
            Proceed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodModal;
