import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const BundleManagement = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [bundleName, setBundleName] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [units, setUnits] = useState("1");
  const [dealer1Price, setDealer1Price] = useState("");
  const [dealer2Price, setDealer2Price] = useState("");
  const [platinumPrice, setPlatinumPrice] = useState("");
  const [goldPrice, setGoldPrice] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [editingBundle, setEditingBundle] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch products for dropdown
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch bundles with product details
  const { data: bundles, isLoading } = useQuery({
    queryKey: ["bundles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundles")
        .select(`
          *,
          products (
            name,
            sku,
            image_url
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createBundle = useMutation({
    mutationFn: async () => {
      let imageUrl = null;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("bundles").insert({
        name: bundleName,
        product_id: selectedProductId,
        units: parseInt(units),
        dealer_1_price: parseFloat(dealer1Price),
        dealer_2_price: parseFloat(dealer2Price),
        platinum_price: parseFloat(platinumPrice),
        gold_price: parseFloat(goldPrice),
        image_url: imageUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      toast.success("Bundle created successfully!");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to create bundle: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundleName || !selectedProductId || !units || !dealer1Price || !dealer2Price || !platinumPrice || !goldPrice) {
      toast.error("Please fill in all fields");
      return;
    }
    createBundle.mutate();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setBundleName("");
    setSelectedProductId("");
    setUnits("1");
    setDealer1Price("");
    setDealer2Price("");
    setPlatinumPrice("");
    setGoldPrice("");
    setImageFile(null);
    setImagePreview("");
    setEditingBundle(null);
  };

  const updateBundle = useMutation({
    mutationFn: async () => {
      let imageUrl = editingBundle?.image_url;

      // Upload new image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("bundles").update({
        name: bundleName,
        product_id: selectedProductId,
        units: parseInt(units),
        dealer_1_price: parseFloat(dealer1Price),
        dealer_2_price: parseFloat(dealer2Price),
        platinum_price: parseFloat(platinumPrice),
        gold_price: parseFloat(goldPrice),
        image_url: imageUrl,
      }).eq("id", editingBundle.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      toast.success("Bundle updated successfully!");
      resetForm();
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to update bundle: " + error.message);
    },
  });

  const handleEdit = (bundle: any) => {
    setEditingBundle(bundle);
    setBundleName(bundle.name);
    setSelectedProductId(bundle.product_id);
    setUnits(bundle.units.toString());
    setDealer1Price(bundle.dealer_1_price?.toString() || "0");
    setDealer2Price(bundle.dealer_2_price?.toString() || "0");
    setPlatinumPrice(bundle.platinum_price?.toString() || "0");
    setGoldPrice(bundle.gold_price?.toString() || "0");
    setImagePreview(bundle.image_url || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundleName || !selectedProductId || !units || !dealer1Price || !dealer2Price || !platinumPrice || !goldPrice) {
      toast.error("Please fill in all fields");
      return;
    }
    updateBundle.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bundle Pricing Management</CardTitle>
            <CardDescription>
              Create and manage product bundles with tiered pricing for agents
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Bundle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Bundle</DialogTitle>
                <DialogDescription>
                  Set up a product bundle with pricing for different agent levels
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bundleImage">Bundle Image</Label>
                  <Input
                    id="bundleImage"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <img src={imagePreview} alt="Preview" className="h-32 w-32 object-cover rounded-lg border" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bundleName">Bundle Name</Label>
                  <Input
                    id="bundleName"
                    placeholder="e.g., Premium Pack"
                    value={bundleName}
                    onChange={(e) => setBundleName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product">Select Product</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product" />
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

                <div className="space-y-2">
                  <Label htmlFor="units">Units in Bundle</Label>
                  <Input
                    id="units"
                    type="number"
                    min="1"
                    placeholder="Number of units"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dealer1Price">Dealer 1 Price (Master Agent)</Label>
                  <Input
                    id="dealer1Price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={dealer1Price}
                    onChange={(e) => setDealer1Price(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dealer2Price">Dealer 2 Price (Master Agent)</Label>
                  <Input
                    id="dealer2Price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={dealer2Price}
                    onChange={(e) => setDealer2Price(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platinumPrice">Platinum Price (Agent)</Label>
                  <Input
                    id="platinumPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={platinumPrice}
                    onChange={(e) => setPlatinumPrice(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goldPrice">Gold Price (Agent)</Label>
                  <Input
                    id="goldPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={goldPrice}
                    onChange={(e) => setGoldPrice(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Create Bundle
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Bundle</DialogTitle>
                <DialogDescription>
                  Update bundle information and pricing
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editBundleImage">Bundle Image</Label>
                  <Input
                    id="editBundleImage"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <img src={imagePreview} alt="Preview" className="h-32 w-32 object-cover rounded-lg border" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editBundleName">Bundle Name</Label>
                  <Input
                    id="editBundleName"
                    placeholder="e.g., Premium Pack"
                    value={bundleName}
                    onChange={(e) => setBundleName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editProduct">Select Product</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product" />
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

                <div className="space-y-2">
                  <Label htmlFor="editUnits">Units in Bundle</Label>
                  <Input
                    id="editUnits"
                    type="number"
                    min="1"
                    placeholder="Number of units"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editDealer1Price">Dealer 1 Price (Master Agent)</Label>
                  <Input
                    id="editDealer1Price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={dealer1Price}
                    onChange={(e) => setDealer1Price(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editDealer2Price">Dealer 2 Price (Master Agent)</Label>
                  <Input
                    id="editDealer2Price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={dealer2Price}
                    onChange={(e) => setDealer2Price(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editPlatinumPrice">Platinum Price (Agent)</Label>
                  <Input
                    id="editPlatinumPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={platinumPrice}
                    onChange={(e) => setPlatinumPrice(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editGoldPrice">Gold Price (Agent)</Label>
                  <Input
                    id="editGoldPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={goldPrice}
                    onChange={(e) => setGoldPrice(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Update Bundle
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading bundles...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Bundle Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Dealer 1</TableHead>
                <TableHead>Dealer 2</TableHead>
                <TableHead>Platinum</TableHead>
                <TableHead>Gold</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles?.map((bundle) => (
                <TableRow key={bundle.id}>
                  <TableCell>
                    {bundle.image_url ? (
                      <img
                        src={bundle.image_url}
                        alt={bundle.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        No Image
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{bundle.name}</TableCell>
                  <TableCell>
                    {bundle.products?.name} ({bundle.products?.sku})
                  </TableCell>
                  <TableCell>{bundle.units}</TableCell>
                  <TableCell>RM {parseFloat(bundle.dealer_1_price?.toString() || "0").toFixed(2)}</TableCell>
                  <TableCell>RM {parseFloat(bundle.dealer_2_price?.toString() || "0").toFixed(2)}</TableCell>
                  <TableCell>RM {parseFloat(bundle.platinum_price?.toString() || "0").toFixed(2)}</TableCell>
                  <TableCell>RM {parseFloat(bundle.gold_price?.toString() || "0").toFixed(2)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(bundle)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default BundleManagement;
