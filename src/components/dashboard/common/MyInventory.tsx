import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const MyInventory = () => {
  const { user } = useAuth();

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["inventory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          product:products(name, sku, description)
        `)
        .eq("user_id", user?.id)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading inventory...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product?.name}</TableCell>
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

export default MyInventory;
