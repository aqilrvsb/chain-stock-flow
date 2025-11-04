import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const TransactionAgent = () => {
  const queryClient = useQueryClient();

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["agent-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_purchases" as any)
        .select(`
          *,
          agent:profiles!agent_id(full_name, email),
          product:products(name, sku),
          bundle:bundles(name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as any;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ purchaseId, status }: { purchaseId: string; status: string }) => {
      const purchase = purchases?.find(p => p.id === purchaseId);
      if (!purchase) throw new Error("Purchase not found");

      // Update purchase status
      const { error: updateError } = await supabase
        .from("agent_purchases" as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", purchaseId);

      if (updateError) throw updateError;

      // If approved, update inventory
      if (status === "completed") {
        const { data: masterAgentProfile } = await supabase.auth.getUser();
        const masterAgentId = masterAgentProfile.user?.id;

        // Deduct from master agent inventory
        const { data: inventory, error: invError } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("user_id", masterAgentId)
          .eq("product_id", purchase.product_id)
          .maybeSingle();

        if (invError) throw invError;

        const currentQty = inventory?.quantity || 0;
        const newQty = currentQty - purchase.quantity;

        if (newQty < 0) {
          throw new Error("Insufficient inventory");
        }

        if (inventory) {
          await supabase
            .from("inventory")
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq("user_id", masterAgentId)
            .eq("product_id", purchase.product_id);
        }

        // Add to agent inventory
        const { data: agentInv } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("user_id", purchase.agent_id)
          .eq("product_id", purchase.product_id)
          .maybeSingle();

        if (agentInv) {
          await supabase
            .from("inventory")
            .update({ 
              quantity: agentInv.quantity + purchase.quantity,
              updated_at: new Date().toISOString()
            })
            .eq("user_id", purchase.agent_id)
            .eq("product_id", purchase.product_id);
        } else {
          await supabase
            .from("inventory")
            .insert({
              user_id: purchase.agent_id,
              product_id: purchase.product_id,
              quantity: purchase.quantity,
            });
        }
      }
    },
    onSuccess: () => {
      toast.success("Status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["agent-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
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
        <CardTitle>Agent Purchase Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading transactions...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Total Price</TableHead>
                <TableHead>Bank Holder</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Receipt Date</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases?.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>{purchase.agent?.full_name || purchase.agent?.email}</TableCell>
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
                  <TableCell>
                    {purchase.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              purchaseId: purchase.id,
                              status: "completed",
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              purchaseId: purchase.id,
                              status: "failed",
                            })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    )}
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

export default TransactionAgent;
