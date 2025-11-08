import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MALAYSIAN_BANKS = [
  "Affin Bank", "Alliance Bank", "AmBank", "CIMB Bank", "Hong Leong Bank",
  "Maybank", "Public Bank", "RHB Bank"
];

interface AgentPurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundleId: string;
  bundleName: string;
  productId: string;
  quantity: number;
  price: number;
  masterAgentId: string;
  onSuccess?: () => void;
}

const AgentPurchaseModal = ({
  open,
  onOpenChange,
  bundleId,
  bundleName,
  productId,
  quantity,
  price,
  masterAgentId,
  onSuccess,
}: AgentPurchaseModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [bankHolderName, setBankHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [receiptDate, setReceiptDate] = useState("");
  const [receiptImage, setReceiptImage] = useState<File | null>(null);

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      if (!receiptImage) throw new Error("Please upload receipt image");
      if (!bankHolderName || !bankName || !receiptDate) {
        throw new Error("Please fill all fields");
      }

      // Upload receipt image
      const fileExt = receiptImage.name.split(".").pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError, data } = await supabase.storage
        .from("public")
        .upload(`receipts/${fileName}`, receiptImage);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("public")
        .getPublicUrl(`receipts/${fileName}`);

      // Create purchase record
      const { error: insertError } = await supabase
        .from("agent_purchases" as any)
        .insert({
          agent_id: user?.id,
          master_agent_id: masterAgentId,
          product_id: productId,
          bundle_id: bundleId,
          quantity,
          unit_price: price,
          total_price: price,
          bank_holder_name: bankHolderName,
          bank_name: bankName,
          receipt_date: receiptDate,
          receipt_image_url: publicUrl,
          status: "pending",
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success("Purchase submitted successfully. Waiting for approval.");
      queryClient.invalidateQueries({ queryKey: ["my-agent-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["agent-purchases"] });
      onOpenChange(false);
      setBankHolderName("");
      setBankName("");
      setReceiptDate("");
      setReceiptImage(null);
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit purchase");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase {bundleName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Quantity: {quantity} units</Label>
          </div>
          <div>
            <Label>Total Price: RM {price.toFixed(2)}</Label>
          </div>
          <div>
            <Label htmlFor="bankHolder">Bank Holder Name</Label>
            <Input
              id="bankHolder"
              value={bankHolderName}
              onChange={(e) => setBankHolderName(e.target.value)}
              placeholder="Enter bank holder name"
            />
          </div>
          <div>
            <Label htmlFor="bank">Bank Name</Label>
            <Popover open={bankOpen} onOpenChange={setBankOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={bankOpen}
                  className="w-full justify-between"
                >
                  {bankName || "Select bank"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search bank..." />
                  <CommandList>
                    <CommandEmpty>No bank found.</CommandEmpty>
                    <CommandGroup>
                      {MALAYSIAN_BANKS.map((bank) => (
                        <CommandItem
                          key={bank}
                          value={bank}
                          onSelect={(currentValue) => {
                            setBankName(currentValue === bankName ? "" : bank);
                            setBankOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              bankName === bank ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {bank}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="receiptDate">Receipt Date</Label>
            <Input
              id="receiptDate"
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="receipt">Upload Receipt</Label>
            <Input
              id="receipt"
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptImage(e.target.files?.[0] || null)}
            />
          </div>
          <Button
            onClick={() => purchaseMutation.mutate()}
            disabled={purchaseMutation.isPending}
            className="w-full"
          >
            {purchaseMutation.isPending ? "Submitting..." : "Submit Purchase"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentPurchaseModal;
