import { useState, useRef } from "react";
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
import { Upload, FileText, X } from "lucide-react";

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
  customerPostcode?: string;
  customerCity?: string;
  customerState: string;
  paymentMethod: string;
  closingType: string;
  productId: string;
  quantity: number;
  price: number;
  trackingNumber?: string;
  orderFrom?: string;
  attachmentFile?: File;
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

const PAYMENT_METHODS = ["Online Transfer", "COD"];

const CLOSING_TYPES = [
  "Website",
  "WhatsappBot",
  "Call",
  "Manual",
  "Live",
  "Shop",
  "Walk In",
];

const ORDER_FROM_OPTIONS = [
  "Facebook",
  "Tiktok HQ",
  "Shopee HQ",
  "Database",
  "Google",
  "StoreHub",
];

// These sources require manual tracking number and PDF attachment
const MANUAL_TRACKING_SOURCES = ["Tiktok HQ", "Shopee HQ"];

// These sources use NinjaVan for shipping (all except Tiktok HQ/Shopee HQ which have their own tracking)
const NINJAVAN_SOURCES = ["Facebook", "Database", "Google", "StoreHub"];

const AddCustomerModal = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  products,
  userType,
}: AddCustomerModalProps) => {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPostcode, setCustomerPostcode] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [closingType, setClosingType] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [orderFrom, setOrderFrom] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if order source requires manual tracking (Tiktok/Shopee)
  const requiresManualTracking = MANUAL_TRACKING_SOURCES.includes(orderFrom);
  // Check if order source uses NinjaVan (Facebook, Database, Google, StoreHub)
  const usesNinjaVan = userType === "branch" && orderFrom && NINJAVAN_SOURCES.includes(orderFrom);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setAttachmentFile(file);
    }
  };

  const handleRemoveFile = () => {
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = () => {
    // For Branch with NinjaVan sources, require postcode and city for shipping
    const requiresNinjavanFieldsSubmit = usesNinjaVan;

    // Basic validation
    if (!customerName || !customerPhone || !customerState || !paymentMethod || !closingType || !productId || !quantity || !price) {
      return;
    }

    // Branch requires orderFrom
    if (userType === "branch" && !orderFrom) {
      return;
    }

    // For Tiktok/Shopee: require tracking number and attachment
    if (requiresManualTracking && (!trackingNumber || !attachmentFile)) {
      return;
    }

    // For NinjaVan sources: require postcode and city for shipping
    if (requiresNinjavanFieldsSubmit && (!customerPostcode || !customerCity)) {
      return;
    }

    onSubmit({
      customerName,
      customerPhone,
      customerAddress,
      customerPostcode: customerPostcode || undefined,
      customerCity: customerCity || undefined,
      customerState,
      paymentMethod,
      closingType,
      productId,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      trackingNumber: trackingNumber || undefined,
      orderFrom: orderFrom || undefined,
      attachmentFile: attachmentFile || undefined,
    });

    // Reset form
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerPostcode("");
    setCustomerCity("");
    setCustomerState("");
    setPaymentMethod("");
    setClosingType("");
    setProductId("");
    setQuantity("");
    setPrice("");
    setTrackingNumber("");
    setOrderFrom("");
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // For Branch with NinjaVan sources, require postcode and city for shipping
  const requiresNinjavanFields = usesNinjaVan;

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
    parseFloat(price) > 0 &&
    // Branch requires orderFrom
    (userType !== "branch" || orderFrom) &&
    // Tiktok/Shopee requires tracking + attachment
    (!requiresManualTracking || (trackingNumber && attachmentFile)) &&
    // NinjaVan COD requires postcode + city
    (!requiresNinjavanFields || (customerPostcode && customerCity));

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

          {/* Postcode and City - Required for COD (NinjaVan) */}
          {requiresNinjavanFields && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-postcode">Postcode *</Label>
                <Input
                  id="customer-postcode"
                  value={customerPostcode}
                  onChange={(e) => setCustomerPostcode(e.target.value)}
                  placeholder="e.g. 50000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-city">City *</Label>
                <Input
                  id="customer-city"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder="e.g. Kuala Lumpur"
                />
              </div>
            </div>
          )}

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

          {/* Order From - Branch only */}
          {userType === "branch" && (
            <div className="space-y-2">
              <Label htmlFor="order-from">Order From *</Label>
              <Select value={orderFrom} onValueChange={setOrderFrom}>
                <SelectTrigger id="order-from">
                  <SelectValue placeholder="Select order source" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_FROM_OPTIONS.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {requiresManualTracking && (
                <p className="text-xs text-orange-600">
                  Tiktok/Shopee orders require manual tracking number and PDF attachment.
                </p>
              )}
              {usesNinjaVan && (
                <p className="text-xs text-blue-600">
                  This order will use NinjaVan integration for shipping.
                </p>
              )}
            </div>
          )}

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

          {/* Tracking Number */}
          <div className="space-y-2">
            <Label htmlFor="tracking-number">
              Tracking Number {requiresManualTracking ? "*" : requiresNinjavanFields ? "(Auto-generated by NinjaVan)" : "(Optional)"}
            </Label>
            <Input
              id="tracking-number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder={
                requiresManualTracking
                  ? "Enter tracking number from Tiktok/Shopee"
                  : requiresNinjavanFields
                  ? "Will be auto-generated"
                  : "Enter tracking number"
              }
              disabled={requiresNinjavanFields}
            />
            {requiresNinjavanFields && (
              <p className="text-xs text-muted-foreground">
                Tracking number will be automatically generated by NinjaVan.
              </p>
            )}
          </div>

          {/* PDF Attachment - Required for Tiktok/Shopee */}
          {requiresManualTracking && (
            <div className="space-y-2">
              <Label htmlFor="attachment">PDF Attachment *</Label>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="attachment"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {!attachmentFile ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload PDF
                  </Button>
                ) : (
                  <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-500" />
                      <span className="text-sm truncate max-w-[200px]">
                        {attachmentFile.name}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload the shipping label PDF from Tiktok/Shopee.
              </p>
            </div>
          )}
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
