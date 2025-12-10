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
  products: Array<{
    id: string;
    name: string;
    sku: string;
  }>;
  userType: "master_agent" | "agent" | "branch";
}

export interface CustomerPurchaseData {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerState: string;
  paymentMethod: string;
  closingType: string;
  productId: string;
  quantity: number;
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

const CLOSING_TYPES = [
  "Website",
  "WhatsappBot",
  "Call",
  "Manual",
  "Live",
  "Shop",
  "Walk In",
];

const AddCustomerModal = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  products,
}: AddCustomerModalProps) => {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [closingType, setClosingType] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");

  const handleSubmit = () => {
    if (!customerName || !customerPhone || !customerState || !paymentMethod || !closingType || !productId || !quantity || !price) {
      return;
    }

    onSubmit({
      customerName,
      customerPhone,
      customerAddress,
      customerState,
      paymentMethod,
      closingType,
      productId,
      quantity: parseInt(quantity),
      price: parseFloat(price),
    });

    // Reset form
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerState("");
    setPaymentMethod("");
    setClosingType("");
    setProductId("");
    setQuantity("");
    setPrice("");
  };

  const isFormValid =
    customerName &&
    customerPhone &&
    customerState &&
    paymentMethod &&
    closingType &&
    productId &&
    quantity &&
    parseInt(quantity) > 0 &&
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

          {/* Jenis Closing */}
          <div className="space-y-2">
            <Label htmlFor="closing-type">Jenis Closing</Label>
            <Select value={closingType} onValueChange={setClosingType}>
              <SelectTrigger id="closing-type">
                <SelectValue placeholder="Select jenis closing" />
              </SelectTrigger>
              <SelectContent>
                {CLOSING_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product */}
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="product">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unit/Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Unit</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter unit quantity"
            />
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
