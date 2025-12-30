import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, startOfMonth } from "date-fns";
import { getMalaysiaDate } from "@/lib/utils";
import {
  Package,
  Truck,
  Clock,
  Loader2,
  Printer,
  Send,
  Search,
  ShoppingBag,
  Music2,
  DollarSign,
  CreditCard,
  Trash2,
  Navigation,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import PaymentDetailsModal from "./PaymentDetailsModal";

const PAYMENT_OPTIONS = ["All", "Online Transfer", "COD"];
const PLATFORM_OPTIONS = ["All", "Ninjavan", "Tiktok", "Shopee"];
const PAGE_SIZE_OPTIONS = [10, 50, 100, "All"] as const;

const LogisticsOrder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = getMalaysiaDate();
  const firstDayOfMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

  // Filter states
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [pageSize, setPageSize] = useState<number | "All">(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Loading states
  const [isShipping, setIsShipping] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [generatingTrackingFor, setGeneratingTrackingFor] = useState<string | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Payment details modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalOrder, setPaymentModalOrder] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    customerName: "",
    phone: "",
    address: "",
    postcode: "",
    city: "",
    state: "",
    quantity: 1,
    totalPrice: 0,
    paymentMethod: "Online Transfer",
    notaStaff: "",
    productId: "",
  });

  // User filter state
  const [userFilter, setUserFilter] = useState("All");

  // Fetch marketers under this branch
  const { data: marketers } = useQuery({
    queryKey: ["branch-marketers-logistics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, idstaff, full_name")
        .eq("branch_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch all products for dropdown
  const { data: allProducts = [] } = useQuery({
    queryKey: ["all-products-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Update product for an order
  const handleUpdateProduct = async (orderId: string, productId: string) => {
    try {
      const { error } = await supabase
        .from("customer_purchases")
        .update({ product_id: productId })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Product updated successfully");
      queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update product");
    }
  };

  // Fetch pending orders (both HQ orders and Marketer orders)
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["logistics-order", user?.id, startDate, endDate, marketers],
    queryFn: async () => {
      const marketerIds = marketers?.map(m => m.id) || [];

      // Query 1: HQ orders (seller_id = branch)
      let hqQuery = supabase
        .from("customer_purchases")
        .select(`
          *,
          customer:customers(name, phone, address, state, postcode, city),
          product:products(name, sku),
          marketer:profiles!customer_purchases_marketer_id_fkey(full_name, idstaff)
        `)
        .eq("seller_id", user?.id)
        .eq("delivery_status", "Pending")
        .neq("platform", "StoreHub")
        .order("created_at", { ascending: false });

      if (startDate) {
        hqQuery = hqQuery.gte("date_order", startDate);
      }
      if (endDate) {
        hqQuery = hqQuery.lte("date_order", endDate);
      }

      const { data: hqOrders, error: hqError } = await hqQuery;
      if (hqError) throw hqError;

      // Query 2: Marketer orders (marketer_id in branch's marketers)
      let marketerOrders: any[] = [];
      if (marketerIds.length > 0) {
        let marketerQuery = supabase
          .from("customer_purchases")
          .select(`
            *,
            customer:customers(name, phone, address, state, postcode, city),
            product:products(name, sku),
            marketer:profiles!customer_purchases_marketer_id_fkey(full_name, idstaff)
          `)
          .in("marketer_id", marketerIds)
          .eq("delivery_status", "Pending")
          .order("created_at", { ascending: false });

        if (startDate) {
          marketerQuery = marketerQuery.gte("date_order", startDate);
        }
        if (endDate) {
          marketerQuery = marketerQuery.lte("date_order", endDate);
        }

        const { data: mOrders, error: mError } = await marketerQuery;
        if (mError) throw mError;
        marketerOrders = mOrders || [];
      }

      // Combine and deduplicate by ID (same order might match both queries if seller_id = branch AND marketer_id in branch's marketers)
      const allOrders = [...(hqOrders || []), ...marketerOrders];
      const uniqueOrders = allOrders.filter((order, index, self) =>
        index === self.findIndex((o) => o.id === order.id)
      );
      uniqueOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return uniqueOrders;
    },
    enabled: !!user?.id,
  });

  // Helper function to get platform display value (fallback to platform/order_from if jenis_platform is empty)
  const getOrderPlatform = (order: any) => {
    if (order.jenis_platform) return order.jenis_platform;
    // Fallback for old Branch HQ orders that only have platform/order_from
    if (order.order_from) {
      // Map order_from values to display values
      if (order.order_from === "Tiktok HQ") return "Tiktok";
      if (order.order_from === "Shopee HQ") return "Shopee";
      return order.order_from; // Facebook, Database, Google, StoreHub
    }
    if (order.platform && order.platform !== "Manual") return order.platform;
    return null;
  };

  // Helper function to determine order platform category
  const getOrderPlatformCategory = (order: any) => {
    const platform = getOrderPlatform(order)?.toLowerCase() || "";
    if (platform === "tiktok" || platform === "tiktok hq") return "Tiktok";
    if (platform === "shopee" || platform === "shopee hq") return "Shopee";
    // Everything else (Website, Facebook, etc.) goes through Ninjavan
    return "Ninjavan";
  };

  // Check if order is NinjaVan platform (Facebook, Google, Database)
  const isNinjavanPlatform = (order: any) => {
    const platform = getOrderPlatform(order)?.toLowerCase() || "";
    return platform !== "tiktok" && platform !== "shopee" && platform !== "storehub";
  };

  // Filter orders
  const filteredOrders = orders.filter((order: any) => {
    // Search filter
    if (search.trim()) {
      const searchTerms = search.toLowerCase().split("+").map((s) => s.trim()).filter(Boolean);
      const matchesSearch = searchTerms.every((term) =>
        order.customer?.name?.toLowerCase().includes(term) ||
        order.customer?.phone?.toLowerCase().includes(term) ||
        order.tracking_number?.toLowerCase().includes(term) ||
        order.product?.name?.toLowerCase().includes(term) ||
        order.customer?.address?.toLowerCase().includes(term)
      );
      if (!matchesSearch) return false;
    }

    // Payment filter
    if (paymentFilter !== "All" && order.payment_method !== paymentFilter) {
      return false;
    }

    // Platform filter
    if (platformFilter !== "All") {
      const orderCategory = getOrderPlatformCategory(order);
      if (orderCategory !== platformFilter) {
        return false;
      }
    }

    // User filter
    if (userFilter !== "All") {
      if (userFilter === "Branch") {
        // Branch orders have no marketer_id
        if (order.marketer_id) return false;
      } else if (userFilter === "Marketer") {
        // Marketer orders have marketer_id
        if (!order.marketer_id) return false;
      } else {
        // Specific marketer ID
        if (order.marketer_id !== userFilter) return false;
      }
    }

    return true;
  });

  // Pagination
  const effectivePageSize = pageSize === "All" ? filteredOrders.length : pageSize;
  const totalPages = pageSize === "All" ? 1 : Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = pageSize === "All"
    ? filteredOrders
    : filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Counts - use all orders (before platform filter) for stats
  // Ninjavan = orders that are NOT Tiktok, NOT Shopee, NOT StoreHub
  const ninjavanOrders = orders.filter((o: any) => {
    const platform = getOrderPlatform(o)?.toLowerCase() || "";
    return platform !== "tiktok" && platform !== "shopee";
  });

  const counts = {
    // Total Order (Branch Order except storehub + Marketer order) - already excluded in query
    total: orders.length,
    // Order Tiktok (Tiktok Branch + Tiktok Marketer)
    tiktok: orders.filter((o: any) => getOrderPlatform(o)?.toLowerCase() === "tiktok").length,
    // Order Shopee (Shopee Branch + Shopee Marketer)
    shopee: orders.filter((o: any) => getOrderPlatform(o)?.toLowerCase() === "shopee").length,
    // Order Ninjavan (order branch and marketer order but except tiktok, shopee, storehub)
    ninjavan: ninjavanOrders.length,
    // Order Ninjavan COD
    ninjavanCod: ninjavanOrders.filter((o: any) => o.payment_method === "COD").length,
    // Order Ninjavan CASH (not COD)
    ninjavanCash: ninjavanOrders.filter((o: any) => o.payment_method !== "COD").length,
  };

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(paginatedOrders.map((o: any) => o.id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelection = new Set(selectedOrders);
    if (checked) {
      newSelection.add(orderId);
    } else {
      newSelection.delete(orderId);
    }
    setSelectedOrders(newSelection);
  };

  const isAllSelected = paginatedOrders.length > 0 && paginatedOrders.every((o: any) => selectedOrders.has(o.id));

  // Helper function to parse bundle SKU and deduct inventory for each item
  const deductBundleInventory = async (sku: string, orderQuantity: number) => {
    // Bundle SKU format: "SKU-qty + SKU-qty" (e.g., "ABC001-2 + XYZ002-1")
    const skuParts = sku.split(' + ');

    for (const skuPart of skuParts) {
      const trimmedPart = skuPart.trim();
      // Parse SKU-quantity format
      const lastHyphenIndex = trimmedPart.lastIndexOf('-');
      let baseSku = trimmedPart;
      let skuQty = 1;

      if (lastHyphenIndex !== -1) {
        const potentialQty = parseInt(trimmedPart.substring(lastHyphenIndex + 1), 10);
        if (!isNaN(potentialQty) && potentialQty > 0) {
          baseSku = trimmedPart.substring(0, lastHyphenIndex);
          skuQty = potentialQty;
        }
      }

      // Find product by SKU
      const product = allProducts.find((p: any) => p.sku === baseSku);
      if (product) {
        const totalDeduct = skuQty * orderQuantity;
        // Get current inventory
        const { data: inventoryData } = await supabase
          .from("inventory")
          .select("id, quantity")
          .eq("user_id", user?.id)
          .eq("product_id", product.id)
          .single();

        if (inventoryData) {
          const newQuantity = Math.max(0, inventoryData.quantity - totalDeduct);
          await supabase
            .from("inventory")
            .update({ quantity: newQuantity })
            .eq("id", inventoryData.id);
          console.log(`Bundle deduct ${baseSku}: ${inventoryData.quantity} -> ${newQuantity} (deducted ${totalDeduct})`);
        }
      } else {
        console.warn(`Bundle item SKU not found: ${baseSku}`);
      }
    }
  };

  // Bulk Ship action - also deducts inventory
  const handleBulkShipped = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Please select orders to mark as shipped");
      return;
    }

    setIsShipping(true);
    const today = getMalaysiaDate();

    try {
      // Get selected orders with their product_id and quantity
      const selectedOrdersList = paginatedOrders.filter((o: any) => selectedOrders.has(o.id));

      // Update delivery status for all selected orders
      const updatePromises = Array.from(selectedOrders).map((orderId) =>
        supabase
          .from("customer_purchases")
          .update({
            delivery_status: "Shipped",
            date_processed: today,
            seo: "Shipped",
          })
          .eq("id", orderId)
      );

      await Promise.all(updatePromises);

      // Deduct inventory for each order
      for (const order of selectedOrdersList) {
        const orderSku = order.sku || "";
        const quantity = order.quantity || 1;

        // Check if this is a bundle SKU (contains " + ")
        if (orderSku.includes(' + ')) {
          // Bundle: foreach deduct each product
          console.log(`Processing bundle SKU: ${orderSku}`);
          await deductBundleInventory(orderSku, quantity);
        } else if (order.product_id && quantity > 0) {
          // Single product: deduct normally
          const { data: inventoryData } = await supabase
            .from("inventory")
            .select("id, quantity")
            .eq("user_id", user?.id)
            .eq("product_id", order.product_id)
            .single();

          if (inventoryData) {
            const newQuantity = Math.max(0, inventoryData.quantity - quantity);
            await supabase
              .from("inventory")
              .update({ quantity: newQuantity })
              .eq("id", inventoryData.id);
          }
        }
      }

      toast.success(`${selectedOrders.size} order(s) marked as Shipped. Inventory updated.`);
      queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
      queryClient.invalidateQueries({ queryKey: ["logistics-processed"] });
      queryClient.invalidateQueries({ queryKey: ["branch-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setSelectedOrders(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to update orders");
    } finally {
      setIsShipping(false);
    }
  };

  // Bulk Print action
  const handleBulkPrint = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Please select orders to print waybills");
      return;
    }

    const selectedOrdersList = paginatedOrders.filter((o: any) => selectedOrders.has(o.id));

    // Separate NinjaVan orders and Shopee/Tiktok orders
    const ninjavanOrdersForPrint = selectedOrdersList.filter(
      (o: any) => getOrderPlatform(o) !== "Shopee" && getOrderPlatform(o) !== "Tiktok" && o.tracking_number
    );
    const marketplaceOrders = selectedOrdersList.filter(
      (o: any) => (getOrderPlatform(o) === "Shopee" || getOrderPlatform(o) === "Tiktok") && o.waybill_url
    );

    if (ninjavanOrdersForPrint.length === 0 && marketplaceOrders.length === 0) {
      toast.error("Selected orders do not have waybills to print");
      return;
    }

    setIsPrinting(true);

    try {
      const { data: session } = await supabase.auth.getSession();

      // Handle NinjaVan orders
      if (ninjavanOrdersForPrint.length > 0) {
        const trackingNumbers = ninjavanOrdersForPrint.map((o: any) => o.tracking_number);

        const response = await supabase.functions.invoke("ninjavan-waybill", {
          body: { trackingNumbers, profileId: user?.id },
          headers: { Authorization: `Bearer ${session?.session?.access_token}` },
        });

        if (response.error) {
          console.error("NinjaVan waybill error:", response.error);
          toast.error("Failed to fetch NinjaVan waybills");
        } else if (response.data) {
          const blob = new Blob([response.data], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          toast.success(`NinjaVan waybill for ${trackingNumbers.length} order(s) opened`);
        }
      }

      // Handle Shopee/Tiktok orders (merge waybills)
      if (marketplaceOrders.length > 0) {
        const waybillUrls = marketplaceOrders.map((o: any) => o.waybill_url);

        const response = await supabase.functions.invoke("merge-waybills", {
          body: { waybillUrls },
          headers: { Authorization: `Bearer ${session?.session?.access_token}` },
        });

        if (response.error) {
          console.error("Marketplace waybill error:", response.error);
          toast.error("Failed to fetch Shopee/Tiktok waybills");
        } else if (response.data) {
          const blob = new Blob([response.data], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          toast.success(`Shopee/Tiktok waybill for ${waybillUrls.length} order(s) opened`);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to generate waybills");
    } finally {
      setIsPrinting(false);
    }
  };

  // Process single order - also deducts inventory
  const handleProcessOrder = async (orderId: string) => {
    const today = getMalaysiaDate();
    try {
      // Get order details for inventory deduction
      const order = orders.find((o: any) => o.id === orderId);

      await supabase
        .from("customer_purchases")
        .update({
          delivery_status: "Shipped",
          date_processed: today,
          seo: "Shipped",
        })
        .eq("id", orderId);

      // Deduct inventory
      const orderSku = order?.sku || "";
      const quantity = order?.quantity || 1;

      // Check if this is a bundle SKU (contains " + ")
      if (orderSku.includes(' + ')) {
        // Bundle: foreach deduct each product
        console.log(`Processing bundle SKU: ${orderSku}`);
        await deductBundleInventory(orderSku, quantity);
      } else if (order?.product_id && quantity > 0) {
        // Single product: deduct normally
        const { data: inventoryData } = await supabase
          .from("inventory")
          .select("id, quantity")
          .eq("user_id", user?.id)
          .eq("product_id", order.product_id)
          .single();

        if (inventoryData) {
          const newQuantity = Math.max(0, inventoryData.quantity - quantity);
          await supabase
            .from("inventory")
            .update({ quantity: newQuantity })
            .eq("id", inventoryData.id);
        }
      }

      toast.success("Order marked as Shipped. Inventory updated.");
      queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
      queryClient.invalidateQueries({ queryKey: ["logistics-processed"] });
      queryClient.invalidateQueries({ queryKey: ["branch-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to process order");
    }
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
    setSelectedOrders(new Set());
  };

  // Bulk Delete action
  const handleBulkDelete = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Please select orders to delete");
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Delete Orders?",
      text: `Are you sure you want to delete ${selectedOrders.size} order(s)? This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const selectedOrdersList = paginatedOrders.filter((o: any) => selectedOrders.has(o.id));

      // Cancel NinjaVan tracking for orders that have tracking numbers (NinjaVan platform only)
      for (const order of selectedOrdersList) {
        if (order.tracking_number && isNinjavanPlatform(order)) {
          try {
            await supabase.functions.invoke("ninjavan-cancel", {
              body: { trackingNumber: order.tracking_number, profileId: user?.id },
              headers: { Authorization: `Bearer ${session?.session?.access_token}` },
            });
          } catch (cancelError) {
            console.error("Failed to cancel tracking:", order.tracking_number, cancelError);
            // Continue with delete even if cancel fails
          }
        }
      }

      // Delete orders
      const deletePromises = Array.from(selectedOrders).map((orderId) =>
        supabase.from("customer_purchases").delete().eq("id", orderId)
      );

      await Promise.all(deletePromises);

      toast.success(`${selectedOrders.size} order(s) deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setSelectedOrders(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to delete orders");
    } finally {
      setIsDeleting(false);
    }
  };

  // Generate NinjaVan tracking for an order
  const handleGenerateTracking = async (order: any) => {
    // Ask for postcode confirmation/update
    const { value: postcode, isConfirmed } = await Swal.fire({
      title: "Generate Tracking",
      text: "Enter or confirm postcode for shipping:",
      input: "text",
      inputValue: order.customer?.postcode || order.poskod || "",
      inputPlaceholder: "Enter postcode (e.g., 15100)",
      showCancelButton: true,
      confirmButtonText: "Generate Tracking",
      cancelButtonText: "Cancel",
      inputValidator: (value) => {
        if (!value || value.trim().length < 5) {
          return "Please enter a valid postcode";
        }
        return null;
      },
    });

    if (!isConfirmed || !postcode) return;

    setGeneratingTrackingFor(order.id);

    try {
      const { data: session } = await supabase.auth.getSession();

      // Prepare order data for NinjaVan
      const orderData = {
        profileId: user?.id,
        customerName: order.customer?.name || order.marketer_name || "Customer",
        phone: order.customer?.phone || order.no_phone || "",
        address: order.alamat || order.customer?.address || "",
        postcode: postcode.trim(),
        city: order.customer?.city || order.bandar || "",
        state: order.customer?.state || order.negeri || "",
        price: Number(order.total_price || 0),
        paymentMethod: order.payment_method || "Online Transfer",
        productName: order.product?.name || order.produk || "Product",
        productSku: order.product?.sku || "",
        quantity: order.quantity || 1,
        nota: order.nota_staff || "",
        marketerIdStaff: order.marketer?.idstaff || order.marketer_id_staff || "",
      };

      console.log("Generating tracking for order:", orderData);

      const response = await supabase.functions.invoke("ninjavan-order", {
        body: orderData,
        headers: { Authorization: `Bearer ${session?.session?.access_token}` },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to generate tracking");
      }

      const result = response.data;

      if (!result.success || !result.trackingNumber) {
        throw new Error(result.error || "Failed to get tracking number");
      }

      // Update the order with tracking number and postcode
      const { error: updateError } = await supabase
        .from("customer_purchases")
        .update({
          tracking_number: result.trackingNumber,
          // Also update postcode if customer exists
        })
        .eq("id", order.id);

      if (updateError) throw updateError;

      // If there's a customer_id, update customer postcode too
      if (order.customer_id && postcode !== order.customer?.postcode) {
        await supabase
          .from("customers")
          .update({ postcode: postcode.trim() })
          .eq("id", order.customer_id);
      }

      toast.success(`Tracking generated: ${result.trackingNumber}`);
      queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
    } catch (error: any) {
      console.error("Generate tracking error:", error);
      toast.error(error.message || "Failed to generate tracking number");
    } finally {
      setGeneratingTrackingFor(null);
    }
  };

  // Check if order needs tracking generation (NinjaVan platforms without tracking)
  const needsTrackingGeneration = (order: any) => {
    return isNinjavanPlatform(order) && !order.tracking_number;
  };

  // Check if payment details should be clickable (Online Transfer from Facebook, Google, Database)
  const isPaymentClickable = (order: any) => {
    const platform = getOrderPlatform(order)?.toLowerCase() || "";
    const isNinjavanSource = platform === "facebook" || platform === "google" || platform === "database";
    const isOnlinePayment = order.payment_method === "Online Transfer";
    return isNinjavanSource && isOnlinePayment;
  };

  // Open payment details modal
  const handleOpenPaymentDetails = (order: any) => {
    setPaymentModalOrder(order);
    setPaymentModalOpen(true);
  };

  // Open edit dialog
  const handleOpenEdit = (order: any) => {
    setEditingOrder(order);
    setEditForm({
      customerName: order.customer?.name || order.marketer_name || "",
      phone: order.customer?.phone || order.no_phone || "",
      address: order.alamat || order.customer?.address || "",
      postcode: order.customer?.postcode || order.poskod || "",
      city: order.customer?.city || order.bandar || "",
      state: order.customer?.state || order.negeri || "",
      quantity: order.quantity || 1,
      totalPrice: Number(order.total_price || 0),
      paymentMethod: order.payment_method || "Online Transfer",
      notaStaff: order.nota_staff || "",
      productId: order.product_id || "",
    });
    setEditDialogOpen(true);
  };

  // Save edited order
  const handleSaveEdit = async () => {
    if (!editingOrder) return;

    setIsSavingEdit(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const hasExistingTracking = !!editingOrder.tracking_number;
      const isNinjavan = isNinjavanPlatform(editingOrder);

      // Step 1: If has existing tracking, cancel it first
      if (hasExistingTracking && isNinjavan) {
        toast.info("Cancelling existing tracking...");
        const cancelResponse = await supabase.functions.invoke("ninjavan-cancel", {
          body: { trackingNumber: editingOrder.tracking_number, profileId: user?.id },
          headers: { Authorization: `Bearer ${session?.session?.access_token}` },
        });

        if (cancelResponse.error) {
          console.error("Cancel tracking error:", cancelResponse.error);
          // Continue anyway - tracking might already be cancelled
        } else {
          toast.success("Existing tracking cancelled");
        }
      }

      // Step 2: Update order details in database
      const updateData: any = {
        quantity: editForm.quantity,
        total_price: editForm.totalPrice,
        payment_method: editForm.paymentMethod,
        nota_staff: editForm.notaStaff,
        alamat: editForm.address,
        negeri: editForm.state,
        poskod: editForm.postcode,
        bandar: editForm.city,
        no_phone: editForm.phone,
        marketer_name: editForm.customerName,
      };

      // If product changed
      if (editForm.productId && editForm.productId !== editingOrder.product_id) {
        updateData.product_id = editForm.productId;
      }

      // Clear tracking number if it was cancelled
      if (hasExistingTracking && isNinjavan) {
        updateData.tracking_number = null;
        updateData.ninjavan_order_id = null;
      }

      const { error: updateError } = await supabase
        .from("customer_purchases")
        .update(updateData)
        .eq("id", editingOrder.id);

      if (updateError) throw updateError;

      // Also update customer record if exists
      if (editingOrder.customer_id) {
        await supabase
          .from("customers")
          .update({
            name: editForm.customerName,
            phone: editForm.phone,
            address: editForm.address,
            postcode: editForm.postcode,
            city: editForm.city,
            state: editForm.state,
          })
          .eq("id", editingOrder.customer_id);
      }

      // Step 3: Generate new tracking for NinjaVan platforms
      if (isNinjavan) {
        toast.info("Generating new tracking...");

        const product = allProducts.find((p: any) => p.id === editForm.productId) || editingOrder.product;

        const orderData = {
          profileId: user?.id,
          customerName: editForm.customerName,
          phone: editForm.phone,
          address: editForm.address,
          postcode: editForm.postcode,
          city: editForm.city,
          state: editForm.state,
          price: editForm.totalPrice,
          paymentMethod: editForm.paymentMethod,
          productName: product?.name || editingOrder.produk || "Product",
          productSku: product?.sku || "",
          quantity: editForm.quantity,
          nota: editForm.notaStaff,
          marketerIdStaff: editingOrder.marketer?.idstaff || editingOrder.marketer_id_staff || "",
        };

        const response = await supabase.functions.invoke("ninjavan-order", {
          body: orderData,
          headers: { Authorization: `Bearer ${session?.session?.access_token}` },
        });

        if (response.error) {
          throw new Error(response.error.message || "Failed to generate tracking");
        }

        const result = response.data;

        if (!result.success || !result.trackingNumber) {
          throw new Error(result.error || "Failed to get tracking number");
        }

        // Update order with new tracking number
        await supabase
          .from("customer_purchases")
          .update({ tracking_number: result.trackingNumber })
          .eq("id", editingOrder.id);

        toast.success(`Order updated! New tracking: ${result.trackingNumber}`);
      } else {
        toast.success("Order updated successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
      setEditDialogOpen(false);
      setEditingOrder(null);
    } catch (error: any) {
      console.error("Save edit error:", error);
      toast.error(error.message || "Failed to save changes");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Malaysian states list
  const MALAYSIAN_STATES = [
    "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan",
    "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah",
    "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Labuan", "Putrajaya"
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Order Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage pending orders ready for shipment
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setPlatformFilter("All")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-orange-500" />
              <div>
                <p className="text-xl font-bold">{counts.total}</p>
                <p className="text-xs text-muted-foreground">Total Order</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setPlatformFilter("Tiktok")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Music2 className="w-6 h-6 text-pink-500" />
              <div>
                <p className="text-xl font-bold">{counts.tiktok}</p>
                <p className="text-xs text-muted-foreground">Order Tiktok</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setPlatformFilter("Shopee")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-orange-600" />
              <div>
                <p className="text-xl font-bold">{counts.shopee}</p>
                <p className="text-xs text-muted-foreground">Order Shopee</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setPlatformFilter("Ninjavan")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Truck className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-xl font-bold">{counts.ninjavan}</p>
                <p className="text-xs text-muted-foreground">Order Ninjavan</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-yellow-600" />
              <div>
                <p className="text-xl font-bold">{counts.ninjavanCod}</p>
                <p className="text-xs text-muted-foreground">Ninjavan COD</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-xl font-bold">{counts.ninjavanCash}</p>
                <p className="text-xs text-muted-foreground">Ninjavan CASH</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customer name or phone..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="default"
                  onClick={() => { setStartDate(""); setEndDate(""); handleFilterChange(); }}
                  className="shrink-0"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); handleFilterChange(); }}
                  className="w-40"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); handleFilterChange(); }}
                  className="w-40"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Platform:</span>
                <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt === "All" ? "All Order" : opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Payment:</span>
                <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">User:</span>
                <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Order</SelectItem>
                    <SelectItem value="Marketer">Marketer</SelectItem>
                    <SelectItem value="Branch">Branch</SelectItem>
                    {marketers?.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.idstaff || m.full_name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(v === "All" ? "All" : Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size.toString()} value={size.toString()}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">entries</span>
              </div>

              <div className="flex-1" />

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={selectedOrders.size === 0 || isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete ({selectedOrders.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBulkPrint}
                  disabled={selectedOrders.size === 0 || isPrinting}
                >
                  {isPrinting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
                  Print ({selectedOrders.size})
                </Button>
                <Button
                  onClick={handleBulkShipped}
                  disabled={selectedOrders.size === 0 || isShipping}
                >
                  {isShipping ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Shipped ({selectedOrders.size})
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left w-10">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="p-3 text-left">No</th>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">ID Marketer</th>
                      <th className="p-3 text-left">Marketer</th>
                      <th className="p-3 text-left">Customer</th>
                      <th className="p-3 text-left">Phone</th>
                      <th className="p-3 text-left">Product</th>
                      <th className="p-3 text-left">Qty</th>
                      <th className="p-3 text-left">Total</th>
                      <th className="p-3 text-left">Payment</th>
                      <th className="p-3 text-left">Platform</th>
                      <th className="p-3 text-left">Closing</th>
                      <th className="p-3 text-left">Tracking</th>
                      <th className="p-3 text-left">State</th>
                      <th className="p-3 text-left">Address</th>
                      <th className="p-3 text-left">Nota</th>
                      <th className="p-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.length > 0 ? (
                      paginatedOrders.map((order: any, index: number) => (
                        <tr key={order.id} className="border-b hover:bg-muted/30">
                          <td className="p-3">
                            <Checkbox
                              checked={selectedOrders.has(order.id)}
                              onCheckedChange={(checked) => handleSelectOrder(order.id, !!checked)}
                            />
                          </td>
                          <td className="p-3">{pageSize === "All" ? index + 1 : (currentPage - 1) * (pageSize as number) + index + 1}</td>
                          <td className="p-3">{order.date_order || "-"}</td>
                          <td className="p-3 font-mono text-xs">{order.marketer?.idstaff || order.marketer_id_staff || "-"}</td>
                          <td className="p-3">{order.marketer?.full_name || (order.marketer_id ? "-" : "Branch")}</td>
                          <td className="p-3">{order.customer?.name || order.marketer_name || "-"}</td>
                          <td className="p-3">{order.customer?.phone || order.no_phone || "-"}</td>
                          <td className="p-3">
                            {order.product?.name || order.produk || order.storehub_product ? (
                              order.product?.name || order.produk || order.storehub_product
                            ) : (
                              <Select onValueChange={(v) => handleUpdateProduct(order.id, v)}>
                                <SelectTrigger className="w-[180px] h-8 text-xs">
                                  <SelectValue placeholder="Select product..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {allProducts.map((product: any) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="p-3">{order.quantity}</td>
                          <td className="p-3">RM {Number(order.total_price || 0).toFixed(2)}</td>
                          <td className="p-3">
                            {isPaymentClickable(order) ? (
                              <button
                                onClick={() => handleOpenPaymentDetails(order)}
                                className="text-blue-600 font-medium hover:underline cursor-pointer"
                              >
                                {order.payment_method}
                              </button>
                            ) : (
                              <span className={order.payment_method === "COD" ? "text-orange-600 font-medium" : "text-blue-600 font-medium"}>
                                {order.payment_method}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={
                              getOrderPlatform(order) === "Tiktok" ? "text-pink-600 font-medium" :
                              getOrderPlatform(order) === "Shopee" ? "text-orange-500 font-medium" :
                              getOrderPlatform(order) === "Facebook" ? "text-blue-600 font-medium" :
                              getOrderPlatform(order) === "Google" ? "text-green-600 font-medium" :
                              getOrderPlatform(order) === "Database" ? "text-purple-600 font-medium" :
                              getOrderPlatform(order) === "StoreHub" ? "text-teal-600 font-medium" :
                              "text-gray-600"
                            }>
                              {getOrderPlatform(order) || "-"}
                            </span>
                          </td>
                          <td className="p-3">{order.closing_type || order.jenis_closing || "-"}</td>
                          <td className="p-3">
                            {order.tracking_number ? (
                              <span className="font-mono text-sm">{order.tracking_number}</span>
                            ) : needsTrackingGeneration(order) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateTracking(order)}
                                disabled={generatingTrackingFor === order.id}
                                className="h-7 px-2 text-xs"
                              >
                                {generatingTrackingFor === order.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <Navigation className="w-3 h-3 mr-1" />
                                )}
                                Generate
                              </Button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-3">{order.customer?.state || order.negeri || "-"}</td>
                          <td className="p-3">
                            <div className="max-w-xs">
                              <p className="text-sm truncate">{order.alamat || order.customer?.address || "-"}</p>
                              <p className="text-xs text-muted-foreground">
                                {order.customer?.postcode} {order.customer?.city}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            <p className="text-sm truncate max-w-xs">{order.nota_staff || "-"}</p>
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(order)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={18} className="text-center py-12 text-muted-foreground">
                          No pending orders found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={editForm.customerName}
                  onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={editForm.postcode}
                  onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={editForm.state}
                  onValueChange={(v) => setEditForm({ ...editForm, state: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {MALAYSIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalPrice">Total Price (RM)</Label>
                <Input
                  id="totalPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.totalPrice}
                  onChange={(e) => setEditForm({ ...editForm, totalPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={editForm.paymentMethod}
                  onValueChange={(v) => setEditForm({ ...editForm, paymentMethod: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Online Transfer">Online Transfer</SelectItem>
                    <SelectItem value="COD">COD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={editForm.productId}
                onValueChange={(v) => setEditForm({ ...editForm, productId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {allProducts.map((product: any) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notaStaff">Notes</Label>
              <Input
                id="notaStaff"
                value={editForm.notaStaff}
                onChange={(e) => setEditForm({ ...editForm, notaStaff: e.target.value })}
                placeholder="Staff notes..."
              />
            </div>

            {editingOrder && isNinjavanPlatform(editingOrder) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This is a NinjaVan order ({getOrderPlatform(editingOrder)}).
                  {editingOrder.tracking_number ? (
                    <> Current tracking <span className="font-mono">{editingOrder.tracking_number}</span> will be cancelled and a new one will be generated.</>
                  ) : (
                    <> A new tracking number will be generated.</>
                  )}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        order={paymentModalOrder}
      />
    </div>
  );
};

export default LogisticsOrder;
