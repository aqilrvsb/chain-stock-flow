import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PaymentSummary = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const shouldPollRef = useRef(true);

  // Get status from URL params
  const status = searchParams.get("status") || "pending";
  const orderNumber = searchParams.get("order");

  const fetchOrderDetails = useCallback(async () => {
    if (!orderNumber || !user?.id) {
      setLoading(false);
      return;
    }

    try {
      // First fetch order details
      const { data: pendingOrder } = await supabase
        .from("pending_orders")
        .select(`
          *,
          products!product_id (
            name,
            image_url
          ),
          bundles!bundle_id (
            name
          )
        `)
        .eq("order_number", orderNumber)
        .eq("buyer_id", user.id)
        .single();

      if (pendingOrder) {
        setOrderDetails(pendingOrder);

        // If order has a bill ID and is pending, check status directly with Billplz API
        if ((pendingOrder as any).billplz_bill_id && pendingOrder.status === 'pending' && shouldPollRef.current) {
          const { data: statusData, error: statusError } = await supabase.functions.invoke(
            `billplz-payment?order_number=${orderNumber}`,
            {
              method: 'GET'
            }
          );

          if (!statusError && statusData) {
            // Auto-update status based on Billplz response
            let newStatus = pendingOrder.status;

            if (statusData.paid === true) {
              newStatus = 'completed';
            } else if (statusData.paid === false && statusData.state !== 'pending') {
              // If not paid and state is not pending (e.g., "due", "overdue"), mark as failed
              newStatus = 'failed';
            }

            // Update local state if status changed
            if (newStatus !== pendingOrder.status) {
              // Update database status
              await supabase
                .from('pending_orders')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', pendingOrder.id);

              setOrderDetails({ ...pendingOrder, status: newStatus });

              // Start countdown for redirect and stop polling (only for completed)
              if (newStatus === 'completed') {
                shouldPollRef.current = false;
                setCountdown(10);
              }
              // For failed, just stop polling but don't redirect
              else if (newStatus === 'failed') {
                shouldPollRef.current = false;
              }
            } else if (statusData.status && statusData.status !== pendingOrder.status) {
              // Fallback: use status from API if available
              await supabase
                .from('pending_orders')
                .update({ status: statusData.status, updated_at: new Date().toISOString() })
                .eq('id', pendingOrder.id);

              setOrderDetails({ ...pendingOrder, status: statusData.status });
              if (statusData.status === 'completed') {
                shouldPollRef.current = false;
                setCountdown(10);
              } else if (statusData.status === 'failed') {
                shouldPollRef.current = false;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
    } finally {
      setLoading(false);
    }
  }, [orderNumber, user?.id]);

  useEffect(() => {
    fetchOrderDetails();

    // Poll for status updates if order is pending and polling is enabled
    const pollInterval = setInterval(() => {
      if (shouldPollRef.current) {
        fetchOrderDetails();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(pollInterval);
  }, [fetchOrderDetails]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      // Redirect to transactions page
      navigate("/dashboard?view=transactions");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Check payment status directly via Billplz API
      const { data: statusData, error: statusError } = await supabase.functions.invoke(
        `billplz-payment?order_number=${orderNumber}`,
        {
          method: 'GET'
        }
      );

      if (statusError) {
        console.error("Error checking payment status:", statusError);
        toast.error("Failed to check payment status");
      } else {
        // Fetch updated order details
        const { data: pendingOrder } = await supabase
          .from("pending_orders")
          .select(`
            *,
            products!product_id (
              name,
              image_url
            ),
            bundles!bundle_id (
              name
            )
          `)
          .eq("order_number", orderNumber)
          .eq("buyer_id", user?.id)
          .single();

        if (pendingOrder) {
          // Auto-update status based on Billplz response
          let newStatus = pendingOrder.status;

          if (statusData.paid === true) {
            newStatus = 'completed';
            toast.success("Payment successful!");
          } else if (statusData.paid === false && statusData.state !== 'pending') {
            newStatus = 'failed';
            toast.error("Payment failed or cancelled");
          } else if (pendingOrder.status === 'pending') {
            toast.info("Payment is still pending");
          }

          // Update database if status changed
          if (newStatus !== pendingOrder.status) {
            await supabase
              .from('pending_orders')
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .eq('id', pendingOrder.id);
          }

          setOrderDetails({ ...pendingOrder, status: newStatus });

          // Start countdown for redirect and stop polling (only for completed)
          if (newStatus === 'completed') {
            shouldPollRef.current = false;
            setCountdown(10);
          } else if (newStatus === 'failed') {
            shouldPollRef.current = false;
          }
        }
      }
    } catch (error) {
      console.error("Error refreshing:", error);
      toast.error("Failed to refresh status");
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusConfig = () => {
    const orderStatus = orderDetails?.status || status;
    
    if (orderStatus === "completed") {
      return {
        icon: <CheckCircle2 className="h-16 w-16 text-green-500" />,
        title: "Payment Successful!",
        description: "Your payment has been processed successfully.",
        color: "text-green-500",
      };
    } else if (orderStatus === "failed") {
      return {
        icon: <XCircle className="h-16 w-16 text-red-500" />,
        title: "Payment Failed",
        description: "Your payment could not be processed. Please try again.",
        color: "text-red-500",
      };
    } else {
      return {
        icon: <Clock className="h-16 w-16 text-yellow-500" />,
        title: "Payment Pending",
        description: "Waiting for payment confirmation. If you closed the payment window without completing, please complete the payment or wait for it to expire. Click 'Refresh Status' to check the latest payment status.",
        color: "text-yellow-500",
      };
    }
  };

  const statusConfig = getStatusConfig();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col items-center space-y-4">
              {statusConfig.icon}
              <CardTitle className={`text-2xl ${statusConfig.color}`}>
                {statusConfig.title}
              </CardTitle>
              <p className="text-center text-muted-foreground">
                {statusConfig.description}
              </p>
              {countdown !== null && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-center text-blue-800 font-semibold">
                    Redirecting to transactions in {countdown} second{countdown !== 1 ? 's' : ''}...
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {orderDetails && (
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Number:</span>
                <span className="font-semibold">{orderDetails.order_number}</span>
              </div>
              
              {orderDetails.products && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Product:</span>
                  <span className="font-semibold">{orderDetails.products.name}</span>
                </div>
              )}

              {orderDetails.bundles && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bundle:</span>
                  <span className="font-semibold">{orderDetails.bundles.name}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantity:</span>
                <span className="font-semibold">{orderDetails.quantity} units</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit Price:</span>
                <span className="font-semibold">RM {parseFloat(orderDetails.unit_price).toFixed(2)}</span>
              </div>

              <div className="border-t pt-4 flex justify-between text-lg">
                <span className="font-semibold">Total Amount:</span>
                <span className="font-bold text-primary">
                  RM {parseFloat(orderDetails.total_price).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-semibold capitalize ${
                  orderDetails.status === 'completed' ? 'text-green-500' : 
                  orderDetails.status === 'failed' ? 'text-red-500' : 
                  'text-yellow-500'
                }`}>
                  {orderDetails.status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-semibold">
                  {new Date(orderDetails.created_at).toLocaleString()}
                </span>
              </div>

              {orderDetails.status === 'pending' && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Payment window may have been closed. If you didn't complete the payment, please make a new purchase. Click "Refresh Status" to check the latest payment status from Billplz.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col md:flex-row gap-3 justify-center">
          {orderDetails?.status === 'pending' && (
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              disabled={refreshing}
              className="w-full md:w-auto"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
          )}
          <Button onClick={() => navigate("/dashboard")} className="w-full md:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSummary;
