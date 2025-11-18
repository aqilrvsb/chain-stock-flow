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
import { Textarea } from "@/components/ui/textarea";

interface AddCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CustomerPurchaseData) => void;
  isLoading?: boolean;
  bundles: Array<{
    id: string;
    name: string;
    units: number;
    agent_price?: number;
    master_agent_price?: number;
  }>;
  userType: "master_agent" | "agent";
}

export interface CustomerPurchaseData {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerState: string;
  paymentMethod: string;
  bundleId: string;
  price: number;
}

const MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Putrajaya",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
];

const PAYMENT_METHODS = ["Online Transfer", "COD", "Cash"];

const AddCustomerModal = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  bundles,
  userType,
}: AddCustomerModalProps) => {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [price, setPrice] = useState("");

  const handleSubmit = () => {
    if (!customerName || !customerPhone || !customerState || !paymentMethod || !bundleId || !price) {
      return;
    }

    onSubmit({
      customerName,
      customerPhone,
      customerAddress,
      customerState,
      paymentMethod,
      bundleId,
      price: parseFloat(price),
    });

    // Reset form
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerState("");
    setPaymentMethod("");
    setBundleId("");
    setPrice("");
  };

  const isFormValid =
    customerName &&
    customerPhone &&
    customerState &&
    paymentMethod &&
    bundleId &&
    price &&
    parseFloat(price) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Customer Purchase</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="customer-name">Name Customer</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
            />
          </div>

          {/* Customer Phone */}
          <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone Customer</Label>
            <Input
              id="customer-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Enter customer phone"
            />
          </div>

          {/* Customer Address */}
          <div className="space-y-2">
            <Label htmlFor="customer-address">Address</Label>
            <Textarea
              id="customer-address"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="Enter customer address"
              rows={3}
            />
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label htmlFor="customer-state">State</Label>
            <Select value={customerState} onValueChange={setCustomerState}>
              <SelectTrigger id="customer-state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {MALAYSIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bundle */}
          <div className="space-y-2">
            <Label htmlFor="bundle">Bundle</Label>
            <Select value={bundleId} onValueChange={setBundleId}>
              <SelectTrigger id="bundle">
                <SelectValue placeholder="Select bundle" />
              </SelectTrigger>
              <SelectContent>
                {bundles?.map((bundle) => (
                  <SelectItem key={bundle.id} value={bundle.id}>
                    {bundle.name} ({bundle.units} units)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Price (RM)</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter price"
            />
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
          <Button onClick={handleSubmit} disabled={!isFormValid || isLoading}>
            {isLoading ? "Processing..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerModal;
