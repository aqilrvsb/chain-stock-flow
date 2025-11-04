import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const InventoryView = () => {
  const { data: inventory, isLoading } = useQuery({
    queryKey: ["hq-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          user:profiles(full_name, email),
          product:products(name, sku)
        `)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading inventory...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.user?.full_name || item.user?.email}</TableCell>
                  <TableCell>{item.product?.name}</TableCell>
                  <TableCell>{item.product?.sku}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    {format(new Date(item.updated_at), "dd-MM-yyyy")}
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

export default InventoryView;
