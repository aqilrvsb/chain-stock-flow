import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Package, CheckCircle, XCircle, TrendingUp, TrendingDown } from "lucide-react";

const ProductManagement = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [baseCost, setBaseCost] = useState("");
  const [quantity, setQuantity] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          inventory(quantity)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get stock movements for each product
      const productsWithStock = await Promise.all(
        data.map(async (product) => {
          // Stock In from stock_in_hq table
          let stockInQuery = supabase
            .from("stock_in_hq")
            .select("quantity")
            .eq("product_id", product.id);

          if (startDate) {
            stockInQuery = stockInQuery.gte("created_at", startDate + 'T00:00:00+08:00');
          }
          if (endDate) {
            stockInQuery = stockInQuery.lte("created_at", endDate + 'T23:59:59.999+08:00');
          }

          const { data: stockInData } = await stockInQuery;
          const stockIn = stockInData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Stock Out from stock_out_hq table - get with recipient_type for breakdown
          let stockOutHQQuery = supabase
            .from("stock_out_hq")
            .select("quantity, recipient_type")
            .eq("product_id", product.id);

          if (startDate) {
            stockOutHQQuery = stockOutHQQuery.gte("created_at", startDate + 'T00:00:00+08:00');
          }
          if (endDate) {
            stockOutHQQuery = stockOutHQQuery.lte("created_at", endDate + 'T23:59:59.999+08:00');
          }

          const { data: stockOutHQData } = await stockOutHQQuery;

          // Calculate Stock Out by category from stock_out_hq
          const stockOutMA = stockOutHQData?.filter(item => item.recipient_type === 'master_agent')
            .reduce((sum, item) => sum + item.quantity, 0) || 0;
          const stockOutBranch = stockOutHQData?.filter(item => item.recipient_type === 'branch')
            .reduce((sum, item) => sum + item.quantity, 0) || 0;
          const stockOutOthers = stockOutHQData?.filter(item => !item.recipient_type)
            .reduce((sum, item) => sum + item.quantity, 0) || 0;

          // MA Purchases via Billplz (completed orders, exclude HQ manual transfers)
          let pendingOrdersQuery = supabase
            .from("pending_orders")
            .select("quantity")
            .eq("product_id", product.id)
            .eq("status", "completed")
            .neq("billplz_bill_id", "HQ");

          if (startDate) {
            pendingOrdersQuery = pendingOrdersQuery.gte("created_at", startDate + 'T00:00:00+08:00');
          }
          if (endDate) {
            pendingOrdersQuery = pendingOrdersQuery.lte("created_at", endDate + 'T23:59:59.999+08:00');
          }

          const { data: pendingOrdersData } = await pendingOrdersQuery;
          const maPurchases = pendingOrdersData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Total Stock Out MA = MA Purchases (Billplz) + Stock Out MA (manual)
          const totalStockOutMA = maPurchases + stockOutMA;

          // Total Stock Out = MA + Branch + Others
          const totalStockOut = totalStockOutMA + stockOutBranch + stockOutOthers;

          // Get current inventory quantity (source of truth - updated by Stock In/Out and Billplz)
          const currentQuantity = product.inventory?.[0]?.quantity || 0;

          return {
            ...product,
            stockIn,
            stockOutMA: totalStockOutMA,
            stockOutBranch,
            stockOutOthers,
            totalStockOut,
            currentQuantity,
          };
        })
      );

      return productsWithStock;
    },
  });

  const createProduct = useMutation({
    mutationFn: async (productData: any) => {
      let imageUrl = null;

      // Upload image if provided
      if (productData.imageFile) {
        const fileExt = productData.imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, productData.imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          name: productData.name,
          sku: productData.sku,
          base_cost: productData.baseCost,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Note: Initial inventory is 0 - stock should be added via Stock In HQ

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Product created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async (productData: any) => {
      let imageUrl = selectedProduct?.image_url;

      // Upload new image if provided
      if (productData.imageFile) {
        const fileExt = productData.imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, productData.imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("products")
        .update({
          name: productData.name,
          sku: productData.sku,
          base_cost: productData.baseCost,
          image_url: imageUrl,
        })
        .eq("id", selectedProduct.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsEditOpen(false);
      setSelectedProduct(null);
      resetForm();
      toast({ title: "Product updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDeleteOpen(false);
      setSelectedProduct(null);
      toast({ title: "Product deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleProductStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product status updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating product status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProduct.mutate({
      name,
      sku,
      baseCost: parseFloat(baseCost),
      imageFile,
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProduct.mutate({
      name,
      sku,
      baseCost: parseFloat(baseCost),
      imageFile,
    });
  };

  const handleDelete = () => {
    if (selectedProduct) {
      deleteProduct.mutate(selectedProduct.id);
    }
  };

  const openEditDialog = (product: any) => {
    setSelectedProduct(product);
    setName(product.name);
    setSku(product.sku);
    setBaseCost(product.base_cost.toString());
    setImagePreview(product.image_url || "");
    setIsEditOpen(true);
  };

  const openDeleteDialog = (product: any) => {
    setSelectedProduct(product);
    setIsDeleteOpen(true);
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
    setName("");
    setSku("");
    setBaseCost("");
    setQuantity("");
    setImageFile(null);
    setImagePreview("");
  };

  // Calculate summary stats
  const totalProducts = products?.length || 0;
  // Total Quantity from inventory table (source of truth - already deducted by Stock Out and Billplz)
  const totalQuantity = products?.reduce((sum, p) => sum + (p.currentQuantity || 0), 0) || 0;
  const totalStockIn = products?.reduce((sum, p) => sum + (p.stockIn || 0), 0) || 0;
  const sumStockOutMA = products?.reduce((sum, p) => sum + (p.stockOutMA || 0), 0) || 0;
  const sumStockOutBranch = products?.reduce((sum, p) => sum + (p.stockOutBranch || 0), 0) || 0;
  const sumStockOutOthers = products?.reduce((sum, p) => sum + (p.stockOutOthers || 0), 0) || 0;
  const sumTotalStockOut = products?.reduce((sum, p) => sum + (p.totalStockOut || 0), 0) || 0;
  const totalActive = products?.filter(p => p.is_active).length || 0;
  const totalInactive = totalProducts - totalActive;

  const summaryStats = [
    { title: "Total Products", value: totalProducts, icon: Package, color: "text-blue-600" },
    { title: "Total Quantity", value: totalQuantity, icon: TrendingUp, color: "text-purple-600" },
    { title: "Total Stock In", value: totalStockIn, icon: TrendingUp, color: "text-emerald-600" },
    { title: "Stock Out MA", value: sumStockOutMA, icon: TrendingDown, color: "text-orange-600" },
    { title: "Stock Out Branch", value: sumStockOutBranch, icon: TrendingDown, color: "text-yellow-600" },
    { title: "Stock Out Others", value: sumStockOutOthers, icon: TrendingDown, color: "text-gray-600" },
    { title: "Total Stock Out", value: sumTotalStockOut, icon: TrendingDown, color: "text-red-600" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Inventory Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your inventory quantities and stock levels
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
        {summaryStats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Date Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Inventory Management</CardTitle>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseCost">Base Cost</Label>
                <Input
                  id="baseCost"
                  type="number"
                  step="0.01"
                  value={baseCost}
                  onChange={(e) => setBaseCost(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={createProduct.isPending}>
                Create Product
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-sm md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Product Name</Label>
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU</Label>
                  <Input
                    id="edit-sku"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-baseCost">Base Cost</Label>
                <Input
                  id="edit-baseCost"
                  type="number"
                  step="0.01"
                  value={baseCost}
                  onChange={(e) => setBaseCost(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateProduct.isPending}>
                Update Product
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the product.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading products...</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Base Cost</TableHead>
              <TableHead>Total Stock In</TableHead>
              <TableHead className="text-orange-600">Stock Out MA</TableHead>
              <TableHead className="text-yellow-600">Stock Out Branch</TableHead>
              <TableHead className="text-gray-600">Stock Out Others</TableHead>
              <TableHead className="text-red-600">Total Stock Out</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => {
                return (
                  <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.sku}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>RM {product.base_cost}</TableCell>
                  <TableCell>{product.stockIn || 0}</TableCell>
                  <TableCell className="text-orange-600">{product.stockOutMA || 0}</TableCell>
                  <TableCell className="text-yellow-600">{product.stockOutBranch || 0}</TableCell>
                  <TableCell className="text-gray-600">{product.stockOutOthers || 0}</TableCell>
                  <TableCell className="text-red-600 font-medium">{product.totalStockOut || 0}</TableCell>
                  <TableCell className="font-medium">{product.currentQuantity || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.is_active}
                        onCheckedChange={(checked) => 
                          toggleProductStatus.mutate({ id: product.id, isActive: checked })
                        }
                      />
                      <Badge variant={product.is_active ? "default" : "secondary"}>
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditDialog(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openDeleteDialog(product)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
};

export default ProductManagement;
