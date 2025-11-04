import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

const MyPurchases = () => {
  const { user } = useAuth();

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["my-agent-purchases", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_purchases" as any)
        .select(`
          *,
          product:products(name, sku),
          bundle:bundles(name),
          master_agent:profiles!master_agent_id(full_name, email)
        `)
        .eq("agent_id", user?.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as any;
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Success</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Purchase Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading transactions...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Master Agent</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Total Price</TableHead>
                <TableHead>Bank Holder</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Receipt Date</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases?.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>{purchase.master_agent?.full_name || purchase.master_agent?.email}</TableCell>
                  <TableCell>
                    {purchase.bundle?.name || purchase.product?.name}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {purchase.product?.sku}
                    </span>
                  </TableCell>
                  <TableCell>{purchase.quantity}</TableCell>
                  <TableCell>RM {purchase.total_price}</TableCell>
                  <TableCell>{purchase.bank_holder_name}</TableCell>
                  <TableCell>{purchase.bank_name}</TableCell>
                  <TableCell>{format(new Date(purchase.receipt_date), "dd-MM-yyyy")}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">View</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>Payment Receipt</DialogTitle>
                        </DialogHeader>
                        <img 
                          src={purchase.receipt_image_url} 
                          alt="Payment receipt" 
                          className="w-full h-auto"
                        />
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                  <TableCell>{format(new Date(purchase.created_at), "dd-MM-yyyy HH:mm")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default MyPurchases;
