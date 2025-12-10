import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, ShoppingCart } from "lucide-react";

const MALAYSIAN_STATES = [
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Melaka",
  "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Putrajaya",
  "Sabah", "Sarawak", "Selangor", "Terengganu",
];

const PLATFORMS = ["Facebook", "Database", "Shopee", "Tiktok", "Google"];
const CUSTOMER_TYPES = ["NP", "EP", "EC"];
const PAYMENT_METHODS = ["CASH", "COD"];
const CLOSING_TYPES = ["Website", "WhatsappBot", "Call", "Manual", "Live", "Shop", "Walk In"];

const MarketerOrders = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPostcode, setCustomerPostcode] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [platform, setPlatform] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [closingType, setClosingType] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      // Create customer first
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: orderData.customerName,
          phone: orderData.customerPhone,
          address: orderData.customerAddress,
          postcode: orderData.customerPostcode,
          city: orderData.customerCity,
          state: orderData.customerState,
          created_by: user?.id,
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // Create order
      const { error: orderError } = await supabase
        .from("customer_purchases")
        .insert({
          customer_id: customer.id,
          seller_id: user?.id,
          marketer_id: user?.id,
          marketer_id_staff: userProfile?.idstaff,
          marketer_name: orderData.customerName,
          product_id: orderData.productId,
          quantity: orderData.quantity,
          total_price: orderData.price * orderData.quantity,
          payment_method: orderData.paymentMethod,
          closing_type: orderData.closingType,
          jenis_platform: orderData.platform,
          jenis_customer: orderData.customerType,
          delivery_status: "Pending",
          date_order: new Date().toISOString().split("T")[0],
        });

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      toast.success("Order created successfully");
      queryClient.invalidateQueries({ queryKey: ["marketer-orders"] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create order");
    },
  });

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCustomerPostcode("");
    setCustomerCity("");
    setCustomerState("");
    setProductId("");
    setQuantity("1");
    setPrice("");
    setPlatform("");
    setCustomerType("");
    setPaymentMethod("");
    setClosingType("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName || !customerPhone || !customerState || !productId || !price || !platform || !customerType || !paymentMethod || !closingType) {
      toast.error("Please fill all required fields");
      return;
    }

    createOrderMutation.mutate({
      customerName,
      customerPhone,
      customerAddress,
      customerPostcode,
      customerCity,
      customerState,
      productId,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      platform,
      customerType,
      paymentMethod,
      closingType,
      notes,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Order</h1>
        <p className="text-muted-foreground mt-2">
          Add a new customer order
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Order Form
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 60123456789"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Enter full address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={customerPostcode}
                  onChange={(e) => setCustomerPostcode(e.target.value)}
                  placeholder="e.g. 50000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder="e.g. Kuala Lumpur"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Select value={customerState} onValueChange={setCustomerState}>
                  <SelectTrigger>
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
            </div>

            {/* Product & Order Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product">Product *</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product: any) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (RM) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Platform, Customer Type, Payment */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform *</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerType">Customer Type *</Label>
                <Select value={customerType} onValueChange={setCustomerType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment">Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="closing">Jenis Closing *</Label>
                <Select value={closingType} onValueChange={setClosingType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select closing" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLOSING_TYPES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Reset
              </Button>
              <Button type="submit" disabled={createOrderMutation.isPending}>
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Order
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketerOrders;
