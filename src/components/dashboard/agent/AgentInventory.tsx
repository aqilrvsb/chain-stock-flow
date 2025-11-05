import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, TrendingUp } from "lucide-react";

const AgentInventory = () => {
  const { user } = useAuth();

  const { data: products, isLoading } = useQuery({
    queryKey: ["agent-inventory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          inventory!inner(quantity)
        `)
        .eq("inventory.user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate summary stats
  const totalProducts = products?.length || 0;
  const totalQuantity = products?.reduce((sum, p) =>
    sum + (p.inventory?.reduce((invSum: number, inv: any) => invSum + inv.quantity, 0) || 0), 0
  ) || 0;

  const summaryStats = [
    { title: "Total Products", value: totalProducts, icon: Package, color: "text-blue-600" },
    { title: "Total Quantity", value: totalQuantity, icon: TrendingUp, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Inventory Management
        </h1>
        <p className="text-muted-foreground mt-2">
          View your inventory quantities and stock levels
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {summaryStats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading inventory...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Base Cost</TableHead>
                  <TableHead>Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => {
                  const totalQuantity = product.inventory?.reduce((sum: number, inv: any) => sum + inv.quantity, 0) || 0;

                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>RM {product.base_cost}</TableCell>
                      <TableCell className="font-medium">{totalQuantity}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentInventory;
