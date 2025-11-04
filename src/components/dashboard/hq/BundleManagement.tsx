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
  const [masterAgentPrice, setMasterAgentPrice] = useState("");
  const [agentPrice, setAgentPrice] = useState("");

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
      const { error } = await supabase.from("bundles").insert({
        name: bundleName,
        product_id: selectedProductId,
        units: parseInt(units),
        master_agent_price: parseFloat(masterAgentPrice),
        agent_price: parseFloat(agentPrice),
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
    if (!bundleName || !selectedProductId || !units || !masterAgentPrice || !agentPrice) {
      toast.error("Please fill in all fields");
      return;
    }
    createBundle.mutate();
  };

  const resetForm = () => {
    setBundleName("");
    setSelectedProductId("");
    setUnits("1");
    setMasterAgentPrice("");
    setAgentPrice("");
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
                  <Label htmlFor="masterAgentPrice">Master Agent Price</Label>
                  <Input
                    id="masterAgentPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={masterAgentPrice}
                    onChange={(e) => setMasterAgentPrice(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agentPrice">Agent Price</Label>
                  <Input
                    id="agentPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={agentPrice}
                    onChange={(e) => setAgentPrice(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Create Bundle
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
                <TableHead>Master Agent Price</TableHead>
                <TableHead>Agent Price</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles?.map((bundle) => (
                <TableRow key={bundle.id}>
                  <TableCell>
                    {bundle.products?.image_url ? (
                      <img
                        src={bundle.products.image_url}
                        alt={bundle.products?.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        No Image
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{bundle.name}</TableCell>
                  <TableCell>
                    {bundle.products?.name} ({bundle.products?.sku})
                  </TableCell>
                  <TableCell>{bundle.units}</TableCell>
                  <TableCell>RM {parseFloat(bundle.master_agent_price.toString()).toFixed(2)}</TableCell>
                  <TableCell>RM {parseFloat(bundle.agent_price.toString()).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
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
