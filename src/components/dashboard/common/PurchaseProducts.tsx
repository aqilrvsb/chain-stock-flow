import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveStatusCheck } from "@/hooks/useActiveStatusCheck";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Swal from "sweetalert2";
import AgentPurchaseModal from "../agent/AgentPurchaseModal";
import PaymentMethodModal from "./PaymentMethodModal";
import ManualPaymentModal, { ManualPaymentData } from "./ManualPaymentModal";

interface PurchaseProductsProps {
  userType: "master_agent" | "agent";
  onNavigateToSettings?: () => void;
  onNavigateToTransactions?: () => void;
}

const ITEMS_PER_PAGE = 12;

const PurchaseProducts = ({ userType, onNavigateToSettings, onNavigateToTransactions }: PurchaseProductsProps) => {
  // Check if user is still active when purchase page loads
  useActiveStatusCheck();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [agentPurchaseModal, setAgentPurchaseModal] = useState<{
    open: boolean;
    bundleId: string;
    bundleName: string;
    productId: string;
    quantity: number;
    price: number;
    masterAgentId: string;
  }>({
    open: false,
    bundleId: "",
    bundleName: "",
    productId: "",
    quantity: 0,
    price: 0,
    masterAgentId: "",
  });
  const [paymentMethodModal, setPaymentMethodModal] = useState(false);
  const [manualPaymentModal, setManualPaymentModal] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<{
    bundleId: string;
    bundleName: string;
    price: number;
    units: number;
  } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: masterAgentId, isLoading: isLoadingMasterAgent, error: masterAgentError } = useQuery({
    queryKey: ["master-agent-id", user?.id],
    queryFn: async () => {
      if (userType !== "agent") return null;

      console.log("Fetching master agent relationship for user:", user?.id);

      const { data, error } = await supabase
        .from("master_agent_relationships")
        .select("master_agent_id")
        .eq("agent_id", user?.id)
        .maybeSingle();

      console.log("Master agent relationship query result:", { data, error });

      if (error) {
        console.error("Error fetching master agent relationship:", error);
        throw error;
      }

      const masterAgentId = data?.master_agent_id;
      console.log("Master Agent ID:", masterAgentId);

      return masterAgentId;
    },
    enabled: !!user?.id && userType === "agent",
  });

  const { data: bundles, isLoading } = useQuery({
    queryKey: ["bundles-for-purchase", userType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundles")
        .select(`
          *,
          products!inner (
            name,
            sku,
            is_active
          )
        `)
        .eq("is_active", true)
        .eq("products.is_active", true);

      if (error) throw error;
      return data;
    },
  });

  // Filter and paginate bundles
  const filteredBundles = bundles?.filter((bundle) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      bundle.name.toLowerCase().includes(searchLower) ||
      bundle.products?.name?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const totalPages = Math.ceil(filteredBundles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedBundles = filteredBundles.slice(startIndex, endIndex);

  const checkProfileComplete = () => {
    if (!profile?.phone_number || !profile?.whatsapp_number || !profile?.delivery_address) {
      Swal.fire({
        icon: "warning",
        title: "Profile Incomplete",
        html: `
          <p>Please complete your profile before making a purchase:</p>
          <ul style="text-align: left; margin-top: 10px;">
            ${!profile?.phone_number ? '<li>Phone Number</li>' : ''}
            ${!profile?.whatsapp_number ? '<li>WhatsApp Number</li>' : ''}
            ${!profile?.delivery_address ? '<li>Delivery Address</li>' : ''}
          </ul>
          <p style="margin-top: 10px;">Go to Settings to update your profile.</p>
        `,
        confirmButtonText: "Go to Settings",
        showCancelButton: true,
      }).then((result) => {
        if (result.isConfirmed && onNavigateToSettings) {
          onNavigateToSettings();
        }
      });
      return false;
    }
    return true;
  };

  const handleBuy = async (bundleId: string, bundleName: string, price: number, units: number, productId: string) => {
    if (!checkProfileComplete()) {
      return;
    }

    // Agent purchases from Master Agent (different flow)
    if (userType === "agent") {
      console.log("Agent attempting purchase. Master Agent ID:", masterAgentId);
      console.log("Is loading master agent:", isLoadingMasterAgent);
      console.log("Master agent error:", masterAgentError);

      if (!masterAgentId) {
        console.error("No master agent ID found for agent");
        toast({
          title: "Error",
          description: "You are not assigned to any Master Agent",
          variant: "destructive",
        });
        return;
      }

      // Check Master Agent inventory
      console.log("Checking master agent inventory:", { masterAgentId, productId, units });

      const { data: masterInventory, error } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("user_id", masterAgentId)
        .eq("product_id", productId)
        .maybeSingle();

      console.log("Master agent inventory query result:", { masterInventory, error });

      if (error || !masterInventory || masterInventory.quantity < units) {
        console.error("Insufficient inventory:", {
          error,
          masterInventory,
          required: units,
          available: masterInventory?.quantity
        });
        toast({
          title: "Insufficient Stock",
          description: "Master Agent doesn't have enough inventory for this product",
          variant: "destructive",
        });
        return;
      }

      // Open Agent purchase modal
      setAgentPurchaseModal({
        open: true,
        bundleId,
        bundleName,
        productId,
        quantity: units,
        price,
        masterAgentId,
      });
      return;
    }

    // Master Agent purchases from HQ
    // Check if Master Agent has fpx_manual payment method enabled
    if (userType === "master_agent" && profile?.payment_method === "fpx_manual") {
      // Show payment method selection modal
      setPendingPurchase({ bundleId, bundleName, price, units });
      setPaymentMethodModal(true);
      return;
    }

    // Default FPX only payment flow
    const result = await Swal.fire({
      icon: "info",
      title: "Confirm Purchase",
      html: `
        <div style="text-align: left;">
          <p><strong>Order Summary:</strong></p>
          <p>Bundle: ${bundleName}</p>
          <p>Total Units: ${units}</p>
          <p><strong>Total: RM ${price.toFixed(2)}</strong></p>
          <br>
          <p>You will be redirected to Billplz FPX payment gateway.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Proceed to Payment",
      cancelButtonText: "Cancel"
    });

    if (result.isConfirmed) {
      purchaseProduct.mutate({
        bundleId,
        quantity: units,
        unitPrice: price,
        totalPrice: price,
        units
      });
    }
  };

  const handleSelectFPX = async () => {
    if (!pendingPurchase) return;

    setPaymentMethodModal(false);

    const result = await Swal.fire({
      icon: "info",
      title: "Confirm Purchase",
      html: `
        <div style="text-align: left;">
          <p><strong>Order Summary:</strong></p>
          <p>Bundle: ${pendingPurchase.bundleName}</p>
          <p>Total Units: ${pendingPurchase.units}</p>
          <p><strong>Total: RM ${pendingPurchase.price.toFixed(2)}</strong></p>
          <br>
          <p>You will be redirected to Billplz FPX payment gateway.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Proceed to Payment",
      cancelButtonText: "Cancel"
    });

    if (result.isConfirmed) {
      purchaseProduct.mutate({
        bundleId: pendingPurchase.bundleId,
        quantity: pendingPurchase.units,
        unitPrice: pendingPurchase.price,
        totalPrice: pendingPurchase.price,
        units: pendingPurchase.units
      });
    }

    setPendingPurchase(null);
  };

  const handleSelectManual = () => {
    setPaymentMethodModal(false);
    // Add a small delay to ensure the first modal is fully closed before opening the second
    setTimeout(() => {
      setManualPaymentModal(true);
    }, 100);
  };

  const handleManualPaymentSubmit = async (data: ManualPaymentData) => {
    if (!pendingPurchase) return;

    manualPaymentMutation.mutate({
      ...pendingPurchase,
      ...data,
    });
  };

  const manualPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      // Get bundle details to fetch product_id
      const { data: bundleData, error: bundleError } = await supabase
        .from('bundles')
        .select('product_id')
        .eq('id', data.bundleId)
        .single();

      if (bundleError || !bundleData) throw bundleError || new Error('Bundle not found');

      // Upload receipt image to Supabase storage
      const fileExt = data.receiptFile.name.split('.').pop();
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(filePath, data.receiptFile);

      if (uploadError) throw uploadError;

      // Get public URL for the uploaded receipt
      const { data: { publicUrl } } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(filePath);

      // Generate unique order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      // Create pending order with manual payment details
      const { error: orderError } = await supabase
        .from('pending_orders')
        .insert({
          order_number: orderNumber,
          buyer_id: user?.id,
          bundle_id: data.bundleId,
          product_id: bundleData.product_id,
          quantity: data.units,
          unit_price: data.price,
          total_price: data.price,
          status: 'pending',
          payment_method: 'manual',
          payment_type: data.paymentType,
          payment_date: data.paymentDate.toISOString().split('T')[0],
          bank_name: data.bankName,
          receipt_image_url: publicUrl,
        });

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      setManualPaymentModal(false);
      setPendingPurchase(null);

      Swal.fire({
        icon: "success",
        title: "Payment Submitted",
        html: `
          <p>Your manual payment has been submitted for verification.</p>
          <p>You will receive an update once it's approved.</p>
        `,
        confirmButtonText: "OK"
      }).then(() => {
        // Redirect to transactions page after user clicks OK
        if (onNavigateToTransactions) {
          onNavigateToTransactions();
        }
      });

      queryClient.invalidateQueries({ queryKey: ["bundles-for-purchase"] });
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const purchaseProduct = useMutation({
    mutationFn: async (purchase: any) => {
      // Refresh session to get a fresh token (prevents "Unauthorized" after token expires)
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();

      if (sessionError || !session) {
        console.error('Session refresh error:', sessionError);
        throw new Error('Session expired. Please login again.');
      }

      console.log('Using fresh access token for payment');

      // Call Billplz payment edge function with fresh token
      const { data, error } = await supabase.functions.invoke('billplz-payment', {
        body: {
          bundleId: purchase.bundleId,
          quantity: purchase.quantity,
          unitPrice: purchase.unitPrice,
          totalPrice: purchase.totalPrice,
          units: purchase.units,
          profile: profile,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Redirect to Billplz payment page
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error('Failed to get payment URL');
      }
    },
    onSuccess: () => {
      // Payment redirect will happen, no need for toast here
    },
    onError: (error: any) => {
      toast({
        title: "Purchase failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Purchase Products</h1>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search bundles or products..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Loading products...
          </div>
        ) : paginatedBundles.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No products found
          </div>
        ) : (
          paginatedBundles.map((bundle) => {
            const price = userType === "master_agent" ? bundle.master_agent_price : bundle.agent_price;
            return (
              <Card key={bundle.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square relative overflow-hidden bg-muted">
                  {bundle.image_url ? (
                    <img
                      src={bundle.image_url}
                      alt={bundle.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg line-clamp-1">{bundle.name}</h3>
                    <p className="text-sm text-muted-foreground">Units: {bundle.units}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-primary">
                      RM {parseFloat(price.toString()).toFixed(2)}
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleBuy(bundle.id, bundle.name, parseFloat(price.toString()), bundle.units, bundle.product_id)}
                    disabled={purchaseProduct.isPending}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Buy
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Purchase Modal */}
      {userType === "agent" && (
        <AgentPurchaseModal
          open={agentPurchaseModal.open}
          onOpenChange={(open) => setAgentPurchaseModal({ ...agentPurchaseModal, open })}
          bundleId={agentPurchaseModal.bundleId}
          bundleName={agentPurchaseModal.bundleName}
          productId={agentPurchaseModal.productId}
          quantity={agentPurchaseModal.quantity}
          price={agentPurchaseModal.price}
          masterAgentId={agentPurchaseModal.masterAgentId}
          onSuccess={() => {
            if (onNavigateToTransactions) {
              onNavigateToTransactions();
            }
          }}
        />
      )}

      {/* Payment Method Selection Modal (Master Agent only) */}
      {userType === "master_agent" && (
        <PaymentMethodModal
          open={paymentMethodModal}
          onOpenChange={setPaymentMethodModal}
          onSelectFPX={handleSelectFPX}
          onSelectManual={handleSelectManual}
        />
      )}

      {/* Manual Payment Modal (Master Agent only) */}
      {userType === "master_agent" && (
        <ManualPaymentModal
          open={manualPaymentModal}
          onOpenChange={setManualPaymentModal}
          onSubmit={handleManualPaymentSubmit}
          isLoading={manualPaymentMutation.isPending}
        />
      )}
    </div>
  );
};

export default PurchaseProducts;
