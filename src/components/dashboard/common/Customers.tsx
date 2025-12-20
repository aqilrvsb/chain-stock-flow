import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Users, ShoppingCart, DollarSign, Package, Plus, RefreshCw, Loader2, FileText, Trash2, Search, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Swal from "sweetalert2";
import AddCustomerModal, { CustomerPurchaseData } from "./AddCustomerModal";
import { getMalaysiaDate, getMalaysiaYesterday } from "@/lib/utils";
import PaymentDetailsModal from "../branch/PaymentDetailsModal";

interface CustomersProps {
  userType: "master_agent" | "agent" | "branch";
}

const Customers = ({ userType }: CustomersProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = getMalaysiaDate();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Quick search state (search without date filter)
  const [quickSearch, setQuickSearch] = useState("");
  const [isQuickSearchActive, setIsQuickSearchActive] = useState(false);

  // Payment details modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalOrder, setPaymentModalOrder] = useState<any>(null);

  // State for tracking payment method updates
  const [updatingPaymentFor, setUpdatingPaymentFor] = useState<string | null>(null);

  // State for payment method modal
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

  // State for price edit modal
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [selectedPurchaseForPrice, setSelectedPurchaseForPrice] = useState<any>(null);
  const [newPrice, setNewPrice] = useState<string>("");

  // Fetch profile for StoreHub credentials and idstaff (Branch only)
  const { data: profile } = useQuery({
    queryKey: ["profile-storehub", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("storehub_username, storehub_password, idstaff")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: userType === "branch" && !!user?.id,
  });

  // Fetch products for the dropdown
  const { data: products } = useQuery({
    queryKey: ["products-for-customer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch bundles for Branch (with items and product info)
  // For branch users, their user.id IS the branch_id for their bundles
  const { data: bundles } = useQuery({
    queryKey: ["bundles-for-customer", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_bundles")
        .select(`
          id,
          name,
          description,
          sku,
          total_price,
          is_active,
          branch_bundle_items (
            id,
            product_id,
            quantity,
            products:product_id (
              id,
              name,
              sku
            )
          )
        `)
        .eq("branch_id", user?.id)
        .eq("is_active", true);

      if (error) throw error;

      // Transform items to match the expected format
      return (data || []).map((bundle: any) => ({
        ...bundle,
        items: (bundle.branch_bundle_items || []).map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          product: item.products,
        })),
      }));
    },
    enabled: userType === "branch" && !!user?.id,
  });

  // Fetch customer purchases
  const { data: purchases, isLoading } = useQuery({
    queryKey: ["customer_purchases", user?.id, startDate, endDate, platformFilter],
    queryFn: async () => {
      let query = supabase
        .from("customer_purchases")
        .select("*")
        .eq("seller_id", user?.id)
        .is("marketer_id", null) // Only show direct branch orders (not from marketers)
        .order("date_order", { ascending: false, nullsFirst: false });

      // Use date_order for filtering (actual transaction date, not import timestamp)
      if (startDate) {
        query = query.gte("date_order", startDate);
      }
      if (endDate) {
        query = query.lte("date_order", endDate);
      }
      if (platformFilter !== "all") {
        query = query.eq("platform", platformFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate statistics - exclude products named "COD" from stats
  const filteredPurchases = purchases?.filter(p => {
    const productName = p.produk || p.storehub_product || "";
    return !productName.toUpperCase().includes("COD");
  }) || [];
  const totalCustomers = new Set(filteredPurchases.map(p => p.customer_id)).size || 0;
  const totalUnitsPurchased = filteredPurchases.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;

  // For Total Revenue: Use transaction_total (StoreHub invoice total) when available
  // Group by invoice and sum unique transaction totals to match StoreHub exactly
  const invoiceTotals = new Map<string, number>();
  (purchases || []).forEach((p: any) => {
    // Extract invoice number from StoreHub remarks or storehub_invoice field
    const invoiceMatch = p.remarks?.match(/^StoreHub: ([^-]+)/);
    const invoiceNumber = p.storehub_invoice || (invoiceMatch ? invoiceMatch[1] : null);

    if (invoiceNumber && p.transaction_total) {
      // StoreHub transaction - use transaction_total (only count once per invoice)
      if (!invoiceTotals.has(invoiceNumber)) {
        invoiceTotals.set(invoiceNumber, Number(p.transaction_total) || 0);
      }
    } else if (!invoiceNumber) {
      // Manual entry - use total_price and unique ID
      const productName = p.produk || p.storehub_product || "";
      if (!productName.toUpperCase().includes("COD")) {
        invoiceTotals.set(p.id, Number(p.total_price) || 0);
      }
    }
  });

  // For StoreHub entries without transaction_total (old data), fall back to summing item prices
  const storehubInvoicesWithTotal = new Set(
    (purchases || []).filter((p: any) => p.transaction_total).map((p: any) => {
      const match = p.remarks?.match(/^StoreHub: ([^-]+)/);
      return p.storehub_invoice || (match ? match[1] : null);
    }).filter(Boolean)
  );

  // Add item prices for StoreHub entries without transaction_total
  filteredPurchases.forEach((p: any) => {
    const invoiceMatch = p.remarks?.match(/^StoreHub: ([^-]+)/);
    const invoiceNumber = p.storehub_invoice || (invoiceMatch ? invoiceMatch[1] : null);
    if (invoiceNumber && !storehubInvoicesWithTotal.has(invoiceNumber)) {
      // Old StoreHub data without transaction_total - sum item prices
      const currentTotal = invoiceTotals.get(invoiceNumber) || 0;
      invoiceTotals.set(invoiceNumber, currentTotal + (Number(p.total_price) || 0));
    }
  });

  const totalPrice = Array.from(invoiceTotals.values()).reduce((sum, val) => sum + val, 0);

  // Group purchases by invoice for display (one row per transaction)
  const groupedPurchases = (() => {
    const grouped = new Map<string, any>();

    (purchases || []).forEach((p: any) => {
      // Extract invoice number from StoreHub remarks or storehub_invoice field
      const invoiceMatch = p.remarks?.match(/^StoreHub: ([^-]+)/);
      const invoiceNumber = p.storehub_invoice || (invoiceMatch ? invoiceMatch[1] : null);

      // Skip COD products
      const productName = p.produk || p.storehub_product || "";
      if (productName.toUpperCase().includes("COD")) return;

      const key = invoiceNumber || p.id; // Use invoice for StoreHub, or purchase ID for manual

      if (!grouped.has(key)) {
        // First item for this invoice - create new entry
        grouped.set(key, {
          id: p.id,
          invoiceNumber: invoiceNumber,
          created_at: p.created_at,
          date_order: p.date_order,
          // Use direct columns (marketer_name is customer name, no_phone, alamat, negeri)
          customerName: p.marketer_name || "-",
          customerPhone: p.no_phone || "-",
          customerAddress: p.alamat || "-",
          customerState: p.negeri || "-",
          payment_method: p.cara_bayaran || p.payment_method,
          closing_type: p.jenis_closing || p.closing_type,
          tracking_number: p.tracking_number,
          platform: p.platform || "Manual",
          // For StoreHub: use transaction_total, for manual: use total_price
          total_price: p.transaction_total || p.total_price,
          // Combine product names
          products: [productName],
          // Sum quantities
          total_quantity: p.quantity || 0,
          // Payment details for modal
          tarikh_bayaran: p.tarikh_bayaran,
          jenis_bayaran: p.jenis_bayaran,
          bank: p.bank,
          receipt_image_url: p.receipt_image_url,
        });
      } else {
        // Additional item for same invoice - aggregate
        const existing = grouped.get(key);
        existing.products.push(productName);
        existing.total_quantity += p.quantity || 0;
        // Don't add to total_price if we have transaction_total (it's already the full amount)
        if (!p.transaction_total) {
          existing.total_price = (Number(existing.total_price) || 0) + (Number(p.total_price) || 0);
        }
      }
    });

    // Convert to array and sort by date_order descending (use created_at as fallback)
    return Array.from(grouped.values()).sort((a, b) => {
      const dateA = a.date_order || a.created_at;
      const dateB = b.date_order || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  })();

  // Quick search filtered purchases
  const quickSearchFilteredPurchases = isQuickSearchActive && quickSearch
    ? groupedPurchases.filter((p: any) => {
        const searchTerm = quickSearch.toLowerCase();
        return (
          p.customerName?.toLowerCase().includes(searchTerm) ||
          p.customerPhone?.includes(quickSearch) ||
          p.tracking_number?.toLowerCase().includes(searchTerm)
        );
      })
    : groupedPurchases;

  // Count unique transactions (by invoice number from remarks) to match StoreHub
  const totalTransactions = groupedPurchases.length;

  // Platform breakdown stats with all metrics
  const getPlatformStats = (platformName: string) => {
    const platformPurchases = groupedPurchases.filter(p => p.platform === platformName);
    return {
      customers: new Set(platformPurchases.map(p => p.customerPhone)).size,
      transactions: platformPurchases.length,
      units: platformPurchases.reduce((sum, p) => sum + (p.total_quantity || 0), 0),
      revenue: platformPurchases.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0),
    };
  };

  const platformStats = [
    { title: "Facebook", ...getPlatformStats("Facebook"), color: "bg-blue-100 text-blue-800" },
    { title: "Tiktok HQ", ...getPlatformStats("Tiktok HQ"), color: "bg-pink-100 text-pink-800" },
    { title: "Shopee HQ", ...getPlatformStats("Shopee HQ"), color: "bg-orange-100 text-orange-800" },
    { title: "Database", ...getPlatformStats("Database"), color: "bg-purple-100 text-purple-800" },
    { title: "Google", ...getPlatformStats("Google"), color: "bg-green-100 text-green-800" },
    { title: "StoreHub", ...getPlatformStats("StoreHub"), color: "bg-cyan-100 text-cyan-800" },
  ];

  const stats = [
    {
      title: "Total Customers",
      value: totalCustomers,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Total Transactions",
      value: totalTransactions,
      icon: ShoppingCart,
      color: "text-purple-600",
    },
    {
      title: "Total Units Sold",
      value: totalUnitsPurchased,
      icon: Package,
      color: "text-emerald-600",
    },
    {
      title: "Total Revenue",
      value: `RM ${totalPrice.toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600",
    },
  ];

  // Check if payment details should be clickable (Online Transfer from Facebook, Google, Database)
  const isPaymentClickable = (purchase: any) => {
    const platform = purchase.platform?.toLowerCase() || "";
    const isNinjavanSource = platform === "facebook" || platform === "google" || platform === "database";
    const isOnlinePayment = purchase.payment_method === "Online Transfer";
    return isNinjavanSource && isOnlinePayment;
  };

  // Open payment details modal
  const handleOpenPaymentDetails = (purchase: any) => {
    // Transform purchase to match modal expected format
    setPaymentModalOrder({
      tarikh_bayaran: purchase.tarikh_bayaran,
      jenis_bayaran: purchase.jenis_bayaran,
      bank: purchase.bank,
      receipt_image_url: purchase.receipt_image_url,
      payment_method: purchase.payment_method,
      total_price: purchase.total_price,
      customer: { name: purchase.customerName },
    });
    setPaymentModalOpen(true);
  };

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(quickSearchFilteredPurchases.map((p: any) => p.id)));
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

  const isAllSelected = quickSearchFilteredPurchases.length > 0 && quickSearchFilteredPurchases.every((p: any) => selectedOrders.has(p.id));

  // Handle quick search button click
  const handleQuickSearch = () => {
    if (quickSearch.trim()) {
      setIsQuickSearchActive(true);
    }
  };

  // Clear quick search
  const clearQuickSearch = () => {
    setQuickSearch("");
    setIsQuickSearchActive(false);
  };

  // Helper function to check if SKU is a bundle SKU (contains " + ")
  const isBundleSku = (sku: string | null | undefined): boolean => {
    return sku ? sku.includes(' + ') : false;
  };

  // Helper function to parse bundle SKU and get individual products with quantities
  const parseBundleSku = (bundleSku: string): Array<{ sku: string; quantity: number }> => {
    if (!bundleSku) return [];
    const parts = bundleSku.split(' + ');
    return parts.map((part) => {
      const trimmed = part.trim();
      const lastHyphenIndex = trimmed.lastIndexOf('-');
      if (lastHyphenIndex === -1) {
        return { sku: trimmed, quantity: 1 };
      }
      const potentialQty = parseInt(trimmed.substring(lastHyphenIndex + 1), 10);
      if (!isNaN(potentialQty) && potentialQty > 0) {
        return { sku: trimmed.substring(0, lastHyphenIndex), quantity: potentialQty };
      }
      return { sku: trimmed, quantity: 1 };
    });
  };

  // Delete selected orders
  const handleDeleteSelected = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Please select orders to delete");
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Delete Orders?",
      html: `<p>Are you sure you want to delete <strong>${selectedOrders.size}</strong> order(s)?</p><p class="text-red-600 mt-2">This action cannot be undone. Inventory will be restored.</p>`,
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsDeleting(true);
    try {
      // Get selected orders for inventory restoration BEFORE deleting
      const selectedOrdersList = groupedPurchases.filter((p: any) => selectedOrders.has(p.id));

      // Restore inventory for each order (add back the quantity)
      // Only restore if order was Shipped (inventory was deducted)
      for (const order of selectedOrdersList) {
        if (order.delivery_status !== "Shipped") continue; // Only restore shipped orders

        const orderSku = order.sku;
        const orderQuantity = order.quantity || 1;

        if (isBundleSku(orderSku)) {
          // Bundle: parse SKU and restore each product's inventory
          const bundleItems = parseBundleSku(orderSku);

          for (const bundleItem of bundleItems) {
            const product = products?.find((p: any) => p.sku === bundleItem.sku);
            if (product) {
              const totalQty = bundleItem.quantity * orderQuantity;

              const { data: inventoryData } = await supabase
                .from("inventory")
                .select("id, quantity")
                .eq("user_id", user?.id)
                .eq("product_id", product.id)
                .single();

              if (inventoryData) {
                const newQty = inventoryData.quantity + totalQty;
                await supabase
                  .from("inventory")
                  .update({ quantity: newQty })
                  .eq("id", inventoryData.id);
                console.log(`Restored bundle item ${bundleItem.sku}: +${totalQty}`);
              }
            }
          }
        } else {
          // Single product: restore using product_id
          const productId = order.product_id;
          const quantity = order.quantity || 0;

          if (productId && quantity > 0) {
            const { data: inventoryData } = await supabase
              .from("inventory")
              .select("id, quantity")
              .eq("user_id", user?.id)
              .eq("product_id", productId)
              .single();

            if (inventoryData) {
              const newQuantity = inventoryData.quantity + quantity;
              await supabase
                .from("inventory")
                .update({ quantity: newQuantity })
                .eq("id", inventoryData.id);
            }
          }
        }
      }

      // Delete all selected orders
      const deletePromises = Array.from(selectedOrders).map((orderId) =>
        supabase.from("customer_purchases").delete().eq("id", orderId)
      );

      await Promise.all(deletePromises);

      toast.success(`${selectedOrders.size} order(s) deleted. Inventory restored.`);
      queryClient.invalidateQueries({ queryKey: ["customer_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["branch-inventory"] });
      setSelectedOrders(new Set());
    } catch (error: any) {
      toast.error(error.message || "Failed to delete orders");
    } finally {
      setIsDeleting(false);
    }
  };

  // Fetch NinjaVan config for Branch
  const { data: ninjavanConfig } = useQuery({
    queryKey: ["ninjavan-config", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ninjavan_config")
        .select("*")
        .eq("profile_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: userType === "branch" && !!user?.id,
  });

  // Sources that use manual tracking (Tiktok/Shopee) vs NinjaVan
  const MANUAL_TRACKING_SOURCES = ["Tiktok HQ", "Shopee HQ"];

  // Helper function to check lead and determine NP/EP/EC type for branch
  const checkLeadAndDetermineType = async (phoneNumber: string): Promise<{
    type: "NP" | "EP" | "EC";
    leadId?: string;
    isNewLead?: boolean;
    countOrder?: number
  }> => {
    const today = getMalaysiaDate();

    // Search for existing lead by phone number created by this branch
    const { data: existingLead } = await supabase
      .from("prospects")
      .select("id, tarikh_phone_number, jenis_prospek, count_order")
      .eq("created_by", user?.id)
      .eq("no_telefon", phoneNumber)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      const existingType = existingLead.jenis_prospek?.toUpperCase();
      const currentCountOrder = existingLead.count_order || 0;

      // If already EC or has orders, it's EC
      if (existingType === "EC" || currentCountOrder > 0) {
        return { type: "EC", leadId: existingLead.id, countOrder: currentCountOrder };
      }

      // If NP or EP that hasn't ordered yet
      if (existingLead.tarikh_phone_number === today) {
        return { type: "NP", leadId: existingLead.id, countOrder: currentCountOrder };
      } else {
        return { type: "EP", leadId: existingLead.id, countOrder: currentCountOrder };
      }
    } else {
      // No lead found - will be EP (new lead auto-created with yesterday's date)
      return { type: "EP", isNewLead: true, countOrder: 0 };
    }
  };

  // Auto-create lead with yesterday's date (only if not exists)
  const autoCreateLead = async (phoneNumber: string, customerName: string, productName: string): Promise<string | null> => {
    // Double-check if lead already exists to prevent duplicates
    const { data: existingLead } = await supabase
      .from("prospects")
      .select("id")
      .eq("created_by", user?.id)
      .eq("no_telefon", phoneNumber)
      .maybeSingle();

    if (existingLead) {
      // Lead already exists, return existing ID
      return existingLead.id;
    }

    const yesterdayDate = getMalaysiaYesterday();

    const { data, error } = await supabase
      .from("prospects")
      .insert({
        nama_prospek: customerName.toUpperCase(),
        no_telefon: phoneNumber,
        niche: productName,
        jenis_prospek: "EP",
        tarikh_phone_number: yesterdayDate,
        created_by: user?.id,
        status_closed: "",
        price_closed: 0,
        count_order: 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error auto-creating lead:", error);
      return null;
    }
    return data?.id || null;
  };

  const createCustomerPurchase = useMutation({
    mutationFn: async (data: CustomerPurchaseData) => {
      // Handle bundle vs single product
      const isBundle = data.isBundle && data.bundleId && data.bundleItems;

      let selectedProduct: any = null;
      let productName = "Product";

      if (isBundle) {
        // For bundles: check inventory for ALL products in bundle
        for (const bundleItem of data.bundleItems!) {
          const { data: inventoryData, error: inventoryError } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('user_id', user?.id)
            .eq('product_id', bundleItem.product_id)
            .single();

          if (inventoryError || !inventoryData) {
            const itemProduct = bundleItem.product?.name || bundleItem.product_id;
            throw new Error(`Inventory not found for product: ${itemProduct}`);
          }

          const requiredQty = bundleItem.quantity * data.quantity; // quantity = number of bundles
          if (inventoryData.quantity < requiredQty) {
            const itemProduct = bundleItem.product?.name || bundleItem.product_id;
            throw new Error(`Insufficient inventory for ${itemProduct}. Available: ${inventoryData.quantity}, Required: ${requiredQty}`);
          }
        }
        // Use bundle name as product name
        productName = data.bundleName || "Bundle";
      } else {
        // For single product: check inventory
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('user_id', user?.id)
          .eq('product_id', data.productId)
          .single();

        if (inventoryError || !inventoryData) {
          throw new Error('Inventory not found for this product');
        }

        if (inventoryData.quantity < data.quantity) {
          throw new Error(`Insufficient inventory. Available: ${inventoryData.quantity}, Required: ${data.quantity}`);
        }

        // Get product info for NinjaVan
        selectedProduct = products?.find(p => p.id === data.productId);
        productName = selectedProduct?.name || "Product";
      }

      // Check if customer exists (only if phone provided)
      let customerId: string | null = null;

      if (data.customerPhone) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', data.customerPhone)
          .eq('created_by', user?.id)
          .maybeSingle();

        customerId = existingCustomer?.id || null;
      }

      // Create customer if doesn't exist
      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: data.customerName,
            phone: data.customerPhone || `walk-in-${Date.now()}`, // Generate unique phone for walk-in
            address: data.customerAddress,
            postcode: data.customerPostcode || null,
            city: data.customerCity || null,
            state: data.customerState,
            created_by: user?.id,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      } else {
        // Update existing customer with postcode/city if provided
        if (data.customerPostcode || data.customerCity) {
          await supabase
            .from('customers')
            .update({
              postcode: data.customerPostcode || null,
              city: data.customerCity || null,
            })
            .eq('id', customerId);
        }
      }

      // Determine if this order uses NinjaVan or manual tracking
      const orderFromValue = data.orderFrom?.trim() || '';
      const usesManualTracking = orderFromValue && MANUAL_TRACKING_SOURCES.includes(orderFromValue);
      const usesNinjaVan = userType === 'branch' && orderFromValue && !usesManualTracking;

      // For COD payments with NinjaVan sources, create NinjaVan order
      let trackingNumber = data.trackingNumber || null;
      let ninjavanOrderId = null;
      let attachmentUrl = null;

      // Upload PDF attachment for Tiktok/Shopee orders
      if (usesManualTracking && data.attachmentFile) {
        const fileExt = data.attachmentFile.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}_${data.trackingNumber}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('public')
          .upload(fileName, data.attachmentFile);

        if (uploadError) {
          console.error("Failed to upload attachment:", uploadError);
          toast.error("Failed to upload PDF attachment");
        } else {
          const { data: publicUrl } = supabase.storage
            .from('public')
            .getPublicUrl(fileName);
          attachmentUrl = publicUrl.publicUrl;
        }
      }

      // Use NinjaVan for non-Tiktok/Shopee sources (both Online Transfer and COD)
      if (ninjavanConfig && usesNinjaVan) {
        try {
          const { data: session } = await supabase.auth.getSession();

          // For bundles: use bundleSku directly (already in SKU-qty + SKU-qty format)
          // For single products: use product SKU with quantity
          let skuForWaybill = '';
          if (isBundle && data.bundleSku) {
            // Use bundle SKU directly: "ZP250-2 + ZP100-1"
            skuForWaybill = data.bundleSku;
          } else if (selectedProduct?.sku) {
            // Single product: "ZP250-3" format
            skuForWaybill = `${selectedProduct.sku}-${data.quantity}`;
          }

          const ninjavanResponse = await supabase.functions.invoke("ninjavan-order", {
            body: {
              profileId: user?.id,
              customerName: data.customerName,
              phone: data.customerPhone,
              address: data.customerAddress,
              postcode: data.customerPostcode || "",
              city: data.customerCity || "",
              state: data.customerState,
              price: data.price,
              paymentMethod: data.paymentMethod,
              productName: productName,
              productSku: skuForWaybill, // Bundle SKU (ZP250-2 + ZP100-1) or product SKU (ZP250-3)
              quantity: data.quantity,
              nota: "", // No nota field in customer purchase form
              marketerIdStaff: profile?.idstaff || "", // Branch's idstaff for delivery instructions
            },
            headers: {
              Authorization: `Bearer ${session?.session?.access_token}`,
            },
          });

          if (ninjavanResponse.error) {
            console.error("NinjaVan error:", ninjavanResponse.error);
            // Don't throw - allow purchase to proceed without NinjaVan
            toast.error("NinjaVan order failed: " + (ninjavanResponse.error.message || "Unknown error"));
          } else if (ninjavanResponse.data?.success) {
            trackingNumber = ninjavanResponse.data.trackingNumber;
            ninjavanOrderId = ninjavanResponse.data.trackingNumber;
            console.log("NinjaVan order created:", trackingNumber);
          }
        } catch (ninjavanError: any) {
          console.error("NinjaVan API error:", ninjavanError);
          // Don't throw - allow purchase to proceed without NinjaVan
          toast.error("NinjaVan order failed: " + (ninjavanError.message || "Unknown error"));
        }
      }

      // Map orderFrom to platform and jenis_platform
      let platform = 'Manual';
      let jenisPlatform = 'Website'; // Default for NinjaVan orders
      if (orderFromValue) {
        // Use orderFrom value directly as platform (Tiktok HQ, Shopee HQ, Online, StoreHub)
        platform = orderFromValue;
        // Map to jenis_platform for Logistics Order display
        // "Tiktok HQ" -> "Tiktok", "Shopee HQ" -> "Shopee", others -> "Facebook" (NinjaVan)
        if (orderFromValue === 'Tiktok HQ') {
          jenisPlatform = 'Tiktok';
        } else if (orderFromValue === 'Shopee HQ') {
          jenisPlatform = 'Shopee';
        } else {
          // Facebook, Database, Google, StoreHub -> use as-is
          jenisPlatform = orderFromValue;
        }
      }

      // Tiktok HQ, Shopee HQ, and StoreHub orders go directly to Shipped status (auto-deduct inventory)
      // NinjaVan sources (Facebook, Database, Google) go to Pending - inventory deducted when shipped via Logistics
      const isDirectShipped = orderFromValue === 'Tiktok HQ' || orderFromValue === 'Shopee HQ' || orderFromValue === 'StoreHub';
      const deliveryStatus = isDirectShipped ? 'Shipped' : 'Pending';
      const dateProcessed = isDirectShipped ? getMalaysiaDate() : null;

      console.log('Order creation debug:', {
        orderFrom: data.orderFrom,
        orderFromValue,
        isDirectShipped,
        deliveryStatus
      });

      // Create customer purchase record(s)
      // For bundles: we create one main purchase record with bundle info
      // and then create individual product transactions for reporting
      if (isBundle) {
        // Generate multiplied SKU for bundle based on order quantity
        // Example: If bundle base is ABC001-2 + XYZ002-1 and quantity is 2
        // Final SKU becomes: ABC001-4 + XYZ002-2
        const multipliedBundleSku = data.bundleItems
          ? data.bundleItems
              .map((item) => {
                const itemSku = item.product?.sku || '';
                const totalQty = item.quantity * data.quantity;
                return `${itemSku}-${totalQty}`;
              })
              .join(' + ')
          : data.bundleSku;

        // Create main bundle purchase record
        const { data: bundlePurchase, error: purchaseError } = await supabase
          .from('customer_purchases')
          .insert({
            customer_id: customerId,
            seller_id: user?.id,
            product_id: null, // No single product for bundle
            branch_bundle_id: data.bundleId, // Link to bundle
            quantity: data.quantity,
            unit_price: data.price / data.quantity,
            total_price: data.price,
            payment_method: data.paymentMethod,
            closing_type: data.closingType,
            tracking_number: trackingNumber,
            remarks: `Bundle: ${data.bundleName}`,
            platform: platform,
            jenis_platform: jenisPlatform,
            ninjavan_order_id: ninjavanOrderId,
            order_from: data.orderFrom || null,
            attachment_url: attachmentUrl,
            delivery_status: deliveryStatus,
            date_processed: dateProcessed,
            // Save direct columns for display
            marketer_name: data.customerName,
            no_phone: data.customerPhone,
            alamat: data.customerAddress,
            poskod: data.customerPostcode || null,
            bandar: data.customerCity || null,
            negeri: data.customerState,
            produk: data.bundleName, // Bundle name as product
            sku: multipliedBundleSku || null, // Bundle SKU with multiplied quantities
            cara_bayaran: data.paymentMethod,
            jenis_closing: data.closingType,
            date_order: getMalaysiaDate(),
          } as any)
          .select('id')
          .single();

        if (purchaseError) throw purchaseError;

        // Only deduct inventory for auto-shipped orders
        if (isDirectShipped) {
          for (const bundleItem of data.bundleItems!) {
            const totalItemQty = bundleItem.quantity * data.quantity;

            // Get current inventory
            const { data: invData } = await supabase
              .from('inventory')
              .select('quantity')
              .eq('user_id', user?.id)
              .eq('product_id', bundleItem.product_id)
              .single();

            if (invData) {
              await supabase
                .from('inventory')
                .update({ quantity: invData.quantity - totalItemQty })
                .eq('user_id', user?.id)
                .eq('product_id', bundleItem.product_id);
            }
          }
        }
      } else {
        // Single product purchase (original logic)
        const { error: purchaseError } = await supabase
          .from('customer_purchases')
          .insert({
            customer_id: customerId,
            seller_id: user?.id,
            product_id: data.productId,
            quantity: data.quantity,
            unit_price: data.price / data.quantity,
            total_price: data.price,
            payment_method: data.paymentMethod,
            closing_type: data.closingType,
            tracking_number: trackingNumber,
            remarks: 'Customer purchase',
            platform: platform,
            jenis_platform: jenisPlatform,
            ninjavan_order_id: ninjavanOrderId,
            order_from: data.orderFrom || null,
            attachment_url: attachmentUrl,
            delivery_status: deliveryStatus,
            date_processed: dateProcessed,
            // Save direct columns for display (since we use select("*") without joins)
            marketer_name: data.customerName,
            no_phone: data.customerPhone,
            alamat: data.customerAddress,
            poskod: data.customerPostcode || null,
            bandar: data.customerCity || null,
            negeri: data.customerState,
            produk: productName,
            sku: selectedProduct?.sku || null,
            cara_bayaran: data.paymentMethod,
            jenis_closing: data.closingType,
            date_order: getMalaysiaDate(), // Use Malaysia timezone for order date
          } as any);

        if (purchaseError) throw purchaseError;

        // Only deduct inventory for auto-shipped orders (Tiktok HQ, Shopee HQ, StoreHub)
        // NinjaVan orders (Facebook/Database/Google) will deduct when moved to "Shipped" in Logistics Order
        if (isDirectShipped) {
          // Get current inventory
          const { data: invData } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('user_id', user?.id)
            .eq('product_id', data.productId)
            .single();

          if (invData) {
            const { error: updateError } = await supabase
              .from('inventory')
              .update({ quantity: invData.quantity - data.quantity })
              .eq('user_id', user?.id)
              .eq('product_id', data.productId);

            if (updateError) throw updateError;
          }
        }
      }

      // For Branch: Track prospect status (NP/EP/EC) for leads reporting (only if phone provided)
      if (userType === 'branch' && data.customerPhone && data.customerPhone.trim()) {
        try {
          // Check lead and determine type
          const leadResult = await checkLeadAndDetermineType(data.customerPhone);

          // If lead is new, auto-create it with yesterday's date
          let finalLeadId = leadResult.leadId;
          if (leadResult.isNewLead) {
            finalLeadId = await autoCreateLead(data.customerPhone, data.customerName, productName) || undefined;
          }

          // Update lead with jenis_prospek, count_order, status_closed, price_closed
          if (finalLeadId) {
            await supabase
              .from("prospects")
              .update({
                jenis_prospek: leadResult.type,
                count_order: (leadResult.countOrder || 0) + 1,
                status_closed: "Closed",
                price_closed: data.price,
              })
              .eq("id", finalLeadId);

            console.log(`Lead updated: ${finalLeadId}, Type: ${leadResult.type}, Order #${(leadResult.countOrder || 0) + 1}`);
          }
        } catch (leadError) {
          console.error("Error updating lead status:", leadError);
          // Don't throw - purchase is already created, lead tracking is supplementary
        }
      }

      return { trackingNumber };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["customer_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["branch-prospects"] }); // Refresh leads data
      setIsModalOpen(false);

      let successMessage = "Customer purchase recorded successfully. Inventory has been updated.";
      if (result?.trackingNumber) {
        successMessage += `\n\nTracking Number: ${result.trackingNumber}`;
      }

      Swal.fire({
        icon: "success",
        title: "Success!",
        text: successMessage,
        confirmButtonText: "OK"
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create customer purchase");
    },
  });

  // Open payment method modal
  const openPaymentMethodModal = (purchase: any) => {
    setSelectedPurchaseForPayment(purchase);
    setSelectedPaymentMethod(purchase.payment_method || "Cash");
    setPaymentMethodModalOpen(true);
  };

  // Save payment method from modal
  const savePaymentMethod = async () => {
    if (!selectedPurchaseForPayment) return;

    setUpdatingPaymentFor(selectedPurchaseForPayment.id);
    try {
      const { error } = await supabase
        .from("customer_purchases")
        .update({ payment_method: selectedPaymentMethod })
        .eq("id", selectedPurchaseForPayment.id);

      if (error) throw error;

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["customer_purchases"] });
      toast.success("Payment method updated");
      setPaymentMethodModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update payment method");
    } finally {
      setUpdatingPaymentFor(null);
    }
  };

  // Open price edit modal
  const openPriceModal = (purchase: any) => {
    setSelectedPurchaseForPrice(purchase);
    setNewPrice(String(Number(purchase.total_price || 0).toFixed(2)));
    setPriceModalOpen(true);
  };

  // Save new price from modal
  const savePrice = async () => {
    if (!selectedPurchaseForPrice) return;

    const priceValue = parseFloat(newPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    try {
      const { error } = await supabase
        .from("customer_purchases")
        .update({ total_price: priceValue })
        .eq("id", selectedPurchaseForPrice.id);

      if (error) throw error;

      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ["customer_purchases"] });
      toast.success("Price updated");
      setPriceModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update price");
    }
  };

  // Sync from StoreHub (Branch only)
  const handleStorehubSync = async () => {
    if (!profile?.storehub_username || !profile?.storehub_password) {
      Swal.fire({
        icon: "warning",
        title: "StoreHub Not Configured",
        text: "Please configure your StoreHub credentials in Settings first.",
        confirmButtonText: "OK"
      });
      return;
    }

    // Show date picker popup first
    const malaysiaDateNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
    const defaultDate = format(malaysiaDateNow, "yyyy-MM-dd");

    const { value: selectedDate, isConfirmed } = await Swal.fire({
      title: "Select Date to Sync",
      html: `
        <input type="date" id="sync-date" class="swal2-input" value="${defaultDate}" max="${defaultDate}" style="width: 250px;">
        <p style="margin-top: 10px; font-size: 14px; color: #666;">Select the date to sync transactions from StoreHub</p>
      `,
      width: 400,
      showCancelButton: true,
      confirmButtonText: "Sync",
      cancelButtonText: "Cancel",
      preConfirm: () => {
        const dateInput = document.getElementById('sync-date') as HTMLInputElement;
        if (!dateInput?.value) {
          Swal.showValidationMessage('Please select a date');
          return false;
        }
        return dateInput.value;
      }
    });

    if (!isConfirmed || !selectedDate) {
      return;
    }

    setIsSyncing(true);
    const syncDate = selectedDate;

    try {
      // Call Edge Function to fetch from StoreHub
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("storehub-sync", {
        body: {
          storehub_username: profile.storehub_username,
          storehub_password: profile.storehub_password,
          date: syncDate,
        },
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to sync from StoreHub");
      }

      const { transactions, customers: storehubCustomers, products: storehubProducts } = response.data;

      // Debug: Log ALL transactions with invoice numbers and times for comparison
      console.log("========== STOREHUB SYNC DEBUG ==========");
      console.log(`Date requested: ${syncDate}`);
      console.log(`Total transactions received: ${transactions?.length || 0}`);
      console.log("All transactions (sorted by time):");
      const sortedTransactions = [...(transactions || [])].sort((a: any, b: any) =>
        new Date(a.transactionTime).getTime() - new Date(b.transactionTime).getTime()
      );
      let expectedTotal = 0;
      sortedTransactions.forEach((t: any, idx: number) => {
        const utcDate = new Date(t.transactionTime);
        const malaysiaDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
        const timeStr = malaysiaDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
        expectedTotal += Number(t.total) || 0;

        // For multi-item transactions, show item details
        if ((t.items?.length || 0) > 1) {
          console.log(`${idx + 1}. ${timeStr} | Invoice: ${t.invoiceNumber} | Total: RM ${t.total} | Items: ${t.items?.length || 0}`);
          t.items?.forEach((item: any, itemIdx: number) => {
            if (item.itemType === "Item") {
              const itemName = item.itemName || item.name || "Unknown";
              const isCOD = itemName.toUpperCase() === "COD";
              console.log(`   Item ${itemIdx}: ${itemName} | Qty: ${item.quantity} | Total: RM ${item.total || item.subTotal}${isCOD ? ' [SKIPPED - COD]' : ''}`);
            }
          });
        } else {
          console.log(`${idx + 1}. ${timeStr} | Invoice: ${t.invoiceNumber} | Total: RM ${t.total} | Items: ${t.items?.length || 0}`);
        }
      });
      // Calculate total excluding cancelled/return transactions
      let cancelledTotal = 0;
      sortedTransactions.forEach((t: any) => {
        if (t.isCancelled || t.transactionType === "Return") {
          cancelledTotal += Number(t.total) || 0;
        }
      });
      const validTotal = expectedTotal - cancelledTotal;
      const cancelledCount = sortedTransactions.filter((t: any) => t.isCancelled || t.transactionType === "Return").length;

      console.log(`========== SUMMARY ==========`);
      console.log(`Total Transactions: ${transactions?.length || 0}`);
      console.log(`Cancelled/Return: ${cancelledCount} (RM ${cancelledTotal})`);
      console.log(`Valid Transactions: ${(transactions?.length || 0) - cancelledCount}`);
      console.log(`Expected Total (all): RM ${expectedTotal}`);
      console.log(`Expected Total (valid): RM ${validTotal}`);
      console.log(`=============================`);

      if (!transactions || transactions.length === 0) {
        Swal.fire({
          icon: "info",
          title: "No Transactions",
          text: `No transactions found in StoreHub for ${syncDate}.`,
          confirmButtonText: "OK"
        });
        setIsSyncing(false);
        return;
      }

      let importedCount = 0;
      let skippedCount = 0;

      let skippedCancelled = 0;
      let skippedDuplicate = 0;
      let skippedCOD = 0;
      let updatedCustomerCount = 0;

      // Process each transaction
      for (const transaction of transactions) {
        // Skip cancelled or return transactions
        if (transaction.isCancelled || transaction.transactionType === "Return") {
          console.log(`SKIPPED (cancelled/return): Invoice ${transaction.invoiceNumber} | RM ${transaction.total}`);
          skippedCount++;
          skippedCancelled++;
          continue;
        }

        // Get customer info from StoreHub
        let customerName = "Walk-In Customer";
        let customerPhone = "walk-in";
        let customerAddress = "";
        let customerState = "Walk-In";

        // StoreHub API: customerRefId in transaction maps to refId in customers list
        const custId = transaction.customerRefId;

        // Debug: Log first few transactions to see customer field structure
        if (importedCount < 5) {
          console.log(`Transaction ${transaction.invoiceNumber} customer fields:`, {
            customerRefId: transaction.customerRefId,
            contactDetail: transaction.contactDetail,
            deliveryInformation: transaction.deliveryInformation,
          });
        }

        // PRIORITY 1: Check contactDetail (for online orders - has customer name/phone)
        if (transaction.contactDetail) {
          const contact = transaction.contactDetail;
          if (contact.name && contact.name !== "Walk-In Customer") {
            customerName = contact.name;
          }
          if (contact.phone && contact.phone !== "walk-in") {
            customerPhone = contact.phone;
          }
        }

        // PRIORITY 2: Check deliveryInformation.address (for delivery orders)
        if (transaction.deliveryInformation && transaction.deliveryInformation.length > 0) {
          const delivery = transaction.deliveryInformation[0];
          if (delivery.address) {
            const addr = delivery.address;
            if (addr.name && customerName === "Walk-In Customer") {
              customerName = addr.name;
            }
            if (addr.phone && customerPhone === "walk-in") {
              customerPhone = addr.phone;
            }
            if (addr.address) {
              customerAddress = [addr.address, addr.city, addr.postCode].filter(Boolean).join(", ");
            }
            if (addr.state) {
              customerState = addr.state;
            }
          }
        }

        // PRIORITY 3: Look up customer by customerRefId from customers list
        if (custId && customerName === "Walk-In Customer") {
          // StoreHub customers have refId field that matches transaction.customerRefId
          const storehubCustomer = storehubCustomers?.find(
            (c: any) => c.refId === custId
          );

          // Debug: Log if customer was found
          if (importedCount < 5) {
            console.log(`Customer lookup for refId ${custId}:`, storehubCustomer ? "FOUND" : "NOT FOUND");
            if (!storehubCustomer && storehubCustomers?.length > 0) {
              console.log(`Sample customer fields:`, Object.keys(storehubCustomers[0]));
            }
          }

          if (storehubCustomer) {
            // StoreHub customer schema: firstName, lastName, phone, address1, address2, city, state
            const fullName = `${storehubCustomer.firstName || ""} ${storehubCustomer.lastName || ""}`.trim();
            if (fullName) {
              customerName = fullName;
            }
            if (storehubCustomer.phone && customerPhone === "walk-in") {
              customerPhone = storehubCustomer.phone;
            }
            if (!customerAddress) {
              customerAddress = [storehubCustomer.address1, storehubCustomer.address2, storehubCustomer.city]
                .filter(Boolean)
                .join(", ");
            }
            if (customerState === "Walk-In" && storehubCustomer.state) {
              customerState = storehubCustomer.state;
            }
          }
        }

        // Debug log final customer info
        if (importedCount < 5) {
          console.log(`Final customer for ${transaction.invoiceNumber}:`, {
            name: customerName,
            phone: customerPhone
          });
        }

        // Create or get customer - use single "Walk-In Customer" for walk-in sales
        let customerId: string | null = null;

        // Check if customer exists by phone
        const { data: existingCustomers } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", customerPhone)
          .eq("created_by", user?.id);

        if (existingCustomers && existingCustomers.length > 0) {
          customerId = existingCustomers[0].id;
        } else {
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert({
              name: customerName,
              phone: customerPhone,
              address: customerAddress,
              state: customerState,
              created_by: user?.id,
            })
            .select()
            .single();

          if (customerError) {
            console.error("Failed to create customer:", customerError);
            skippedCount++;
            continue;
          }
          customerId = newCustomer.id;
        }

        // Process each item in the transaction
        for (let itemIndex = 0; itemIndex < (transaction.items || []).length; itemIndex++) {
          const item = transaction.items[itemIndex];
          if (item.itemType !== "Item") continue;

          // Create unique remarks for each item: InvoiceNumber-ItemIndex
          const itemRemarks = `StoreHub: ${transaction.invoiceNumber}-${itemIndex}`;

          // Check if this specific item already exists
          const { data: existingItem } = await supabase
            .from("customer_purchases")
            .select("id, customer_id")
            .eq("seller_id", user?.id)
            .eq("remarks", itemRemarks);

          if (existingItem && existingItem.length > 0) {
            // Item exists - check if we need to update customer details in customer_purchases table
            const existingPurchase = existingItem[0];

            // Check if we need to update the marketer_name column (customer name for display)
            if (customerName !== "Walk-In Customer") {
              // Get the current purchase record to check if marketer_name needs updating
              const { data: currentPurchase } = await supabase
                .from("customer_purchases")
                .select("id, marketer_name, no_phone, alamat, negeri")
                .eq("id", existingPurchase.id)
                .single();

              // Debug: Log what we found in the database
              if (skippedDuplicate < 5) {
                console.log(`DB Purchase for Invoice ${transaction.invoiceNumber}:`, {
                  dbMarketerName: currentPurchase?.marketer_name,
                  dbPhone: currentPurchase?.no_phone,
                  storehubName: customerName,
                  storehubPhone: customerPhone,
                  needsUpdate: currentPurchase && (!currentPurchase.marketer_name || currentPurchase.marketer_name === "Walk-In Customer" || currentPurchase.marketer_name === "-")
                });
              }

              // Update marketer_name if it's empty, "Walk-In Customer", or "-"
              if (currentPurchase && (!currentPurchase.marketer_name || currentPurchase.marketer_name === "Walk-In Customer" || currentPurchase.marketer_name === "-")) {
                // Update the customer_purchases record with customer details
                const { error: updateError } = await supabase
                  .from("customer_purchases")
                  .update({
                    marketer_name: customerName,
                    no_phone: customerPhone !== "walk-in" ? customerPhone : currentPurchase.no_phone,
                    alamat: customerAddress || currentPurchase.alamat,
                    negeri: customerState !== "Walk-In" ? customerState : currentPurchase.negeri,
                  })
                  .eq("id", existingPurchase.id);

                if (!updateError) {
                  console.log(`UPDATED customer_purchases for Invoice ${transaction.invoiceNumber}: ${customerName}`);
                  updatedCustomerCount++;
                } else {
                  console.error(`Failed to update customer_purchases for Invoice ${transaction.invoiceNumber}:`, updateError);
                }
              }
            }

            console.log(`SKIPPED (duplicate): Invoice ${transaction.invoiceNumber} Item ${itemIndex}`);
            skippedCount++;
            skippedDuplicate++;
            continue; // Skip this item, already imported
          }

          // Get StoreHub product info - match by id
          const storehubProduct = storehubProducts?.find((p: any) => p.id === item.productId);
          const storehubProductName = storehubProduct?.name || item.itemName || item.name || "Unknown Product";

          // Skip products named "COD" - don't import them at all
          if (storehubProductName.toUpperCase() === "COD") {
            console.log(`SKIPPED (COD product): Invoice ${transaction.invoiceNumber} Item ${itemIndex} | ${storehubProductName}`);
            skippedCount++;
            skippedCOD++;
            continue;
          }

          // Get StoreHub product SKU if available
          const storehubSku = storehubProduct?.sku || item.sku || "";
          const itemQuantity = item.quantity || 1;

          // Check if this is a bundle SKU (contains " + ")
          const isBundleSku = storehubSku.includes(' + ');

          let matchedProductId: string | null = null;
          let matchedSku: string | null = null;
          let bundleItemsForDeduction: Array<{ productId: string; sku: string; quantity: number }> = [];

          if (isBundleSku) {
            // Bundle SKU format: "SKU-qty + SKU-qty"
            // Parse and look up each product
            console.log(`BUNDLE SKU detected: ${storehubSku}`);
            const skuParts = storehubSku.split(' + ');

            for (const skuPart of skuParts) {
              const trimmedPart = skuPart.trim();
              // Parse SKU-quantity format (e.g., "ABC001-2")
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
              const bundleProduct = products?.find((p) => p.sku === baseSku);
              if (bundleProduct) {
                bundleItemsForDeduction.push({
                  productId: bundleProduct.id,
                  sku: bundleProduct.sku,
                  quantity: skuQty * itemQuantity // Multiply by order quantity
                });
                console.log(`Bundle item found: ${baseSku} x ${skuQty * itemQuantity}`);
              } else {
                console.warn(`Bundle item SKU not found: ${baseSku}`);
              }
            }

            // Use bundle SKU as the stored SKU
            matchedSku = storehubSku;
          } else {
            // Single product - try to match by SKU first, then by name
            let matchedProduct = null;
            let skuHasQuantity = false;

            // First try exact SKU match
            if (storehubSku) {
              // Parse SKU-quantity format (e.g., "ZP250-6")
              // Or handle SKU without quantity (e.g., "ZP250") - will use itemQuantity from order
              const lastHyphenIndex = storehubSku.lastIndexOf('-');
              let baseSku = storehubSku;

              if (lastHyphenIndex !== -1) {
                const potentialQty = parseInt(storehubSku.substring(lastHyphenIndex + 1), 10);
                if (!isNaN(potentialQty) && potentialQty > 0) {
                  baseSku = storehubSku.substring(0, lastHyphenIndex);
                  skuHasQuantity = true;
                }
              }

              matchedProduct = products?.find((p) => p.sku === baseSku);
              if (matchedProduct) {
                // If SKU doesn't have quantity suffix, combine with order quantity
                // e.g., "ZP250" with itemQuantity 3 -> stored as "ZP250-3"
                if (!skuHasQuantity && itemQuantity > 0) {
                  matchedSku = `${matchedProduct.sku}-${itemQuantity}`;
                  console.log(`MATCHED by SKU (no qty): StoreHub "${storehubSku}" + qty ${itemQuantity} -> "${matchedSku}"`);
                } else {
                  matchedSku = storehubSku; // Keep original SKU with quantity
                  console.log(`MATCHED by SKU: StoreHub "${storehubSku}" -> Local "${matchedProduct.name}" (SKU: ${matchedProduct.sku})`);
                }
              }
            }

            // Fallback to name match if SKU match failed
            if (!matchedProduct) {
              matchedProduct = products?.find((p) => {
                const localName = p.name.toLowerCase();
                const storehubName = storehubProductName.toLowerCase();
                return localName.includes(storehubName) || storehubName.includes(localName);
              });

              if (matchedProduct) {
                // For name-matched products, always combine SKU with order quantity
                // since they don't have SKU in StoreHub format
                matchedSku = `${matchedProduct.sku}-${itemQuantity}`;
                console.log(`MATCHED by name: StoreHub "${storehubProductName}" -> "${matchedSku}"`);
              }
            }

            if (matchedProduct) {
              matchedProductId = matchedProduct.id;
              // matchedSku is already set above (either from SKU match or name match)
              if (!matchedSku) {
                // Fallback: if matchedSku wasn't set, use product SKU with quantity
                matchedSku = `${matchedProduct.sku}-${itemQuantity}`;
              }
            } else {
              console.log(`NO MATCH: StoreHub "${storehubProductName}" (SKU: ${storehubSku}) - no local product found`);
            }
          }

          // Determine payment method (must be: 'Online Transfer', 'COD', or 'Cash')
          let paymentMethod = "Cash";
          if (transaction.payments && transaction.payments.length > 0) {
            const payment = transaction.payments[0];
            const method = payment.paymentMethod?.toLowerCase() || "";
            if (method.includes("card") || method.includes("credit") ||
                method.includes("debit") || method.includes("transfer") ||
                method.includes("online") || method.includes("ewallet") ||
                method.includes("grab") || method.includes("touch") ||
                method.includes("boost") || method.includes("shopee") ||
                method.includes("qr")) {
              paymentMethod = "Online Transfer";
            } else if (method.includes("cod") || method.includes("delivery")) {
              paymentMethod = "COD";
            } else {
              paymentMethod = "Cash"; // Default to Cash for all other methods
            }
          }

          // Use the user-selected sync date (the date they picked in the popup)
          // This is more reliable than extracting from transactionTime which has timezone issues

          // Get matched product name for display
          const matchedProductName = matchedProductId
            ? products?.find((p) => p.id === matchedProductId)?.name || null
            : null;

          // For bundles: generate product name from bundle items
          const displayProductName = isBundleSku && bundleItemsForDeduction.length > 0
            ? bundleItemsForDeduction.map((bi) => {
                const prod = products?.find((p) => p.id === bi.productId);
                return `${prod?.name || bi.sku} x${bi.quantity}`;
              }).join(' + ')
            : matchedProductName;

          // Create customer purchase record with storehub_product
          const { error: purchaseError } = await supabase
            .from("customer_purchases")
            .insert({
              customer_id: customerId,
              seller_id: user?.id,
              product_id: isBundleSku ? null : matchedProductId, // No single product for bundle
              sku: matchedSku, // SKU from matched product or bundle SKU
              produk: displayProductName, // Local product name or bundle description
              storehub_product: storehubProductName, // Store StoreHub product name
              quantity: itemQuantity,
              unit_price: item.unitPrice || item.subTotal / itemQuantity,
              total_price: item.total || item.subTotal,
              payment_method: paymentMethod,
              closing_type: "Walk In", // StoreHub transactions are Walk In
              remarks: itemRemarks, // Unique per item: InvoiceNumber-ItemIndex
              transaction_total: transaction.total, // Full invoice total from StoreHub
              storehub_invoice: transaction.invoiceNumber, // Invoice number for grouping
              platform: "StoreHub", // Track source platform
              date_order: syncDate, // Store the user-selected sync date
              delivery_status: "Shipped", // StoreHub orders are already fulfilled
              date_processed: syncDate, // Mark as processed on sync date
              // Customer info from StoreHub
              marketer_name: customerName, // Customer name
              no_phone: customerPhone, // Customer phone
              alamat: customerAddress, // Customer address
              negeri: customerState, // Customer state
            } as any);

          if (purchaseError) {
            console.error("Failed to create purchase:", purchaseError);
            skippedCount++;
          } else {
            importedCount++;

            // Deduct inventory for bundles (foreach each product in bundle)
            // StoreHub orders are already "Shipped", so deduct immediately
            if (isBundleSku && bundleItemsForDeduction.length > 0) {
              console.log(`Deducting inventory for bundle: ${storehubSku}`);
              for (const bundleItem of bundleItemsForDeduction) {
                // Get current inventory
                const { data: invData } = await supabase
                  .from('inventory')
                  .select('quantity')
                  .eq('user_id', user?.id)
                  .eq('product_id', bundleItem.productId)
                  .single();

                if (invData) {
                  const newQty = invData.quantity - bundleItem.quantity;
                  await supabase
                    .from('inventory')
                    .update({ quantity: newQty })
                    .eq('user_id', user?.id)
                    .eq('product_id', bundleItem.productId);
                  console.log(`Deducted ${bundleItem.sku}: ${invData.quantity} -> ${newQty}`);
                }
              }
            }
            // Note: Single product inventory deduction is handled by database trigger
            // when delivery_status = 'Shipped' and product_id is set
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["customer_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });

      console.log(`========== SYNC RESULTS ==========`);
      console.log(`Imported: ${importedCount}`);
      console.log(`Skipped - Cancelled/Return: ${skippedCancelled}`);
      console.log(`Skipped - Duplicate: ${skippedDuplicate}`);
      console.log(`Skipped - COD Product: ${skippedCOD}`);
      console.log(`Total Skipped: ${skippedCount}`);
      console.log(`Customer Details Updated: ${updatedCustomerCount}`);

      Swal.fire({
        icon: "success",
        title: "Sync Complete!",
        html: `
          <p>StoreHub sync completed for ${syncDate}</p>
          <p><strong>Imported:</strong> ${importedCount} items</p>
          ${updatedCustomerCount > 0 ? `<p><strong>Customer Updated:</strong> ${updatedCustomerCount}</p>` : ''}
          <p><strong>Skipped:</strong> ${skippedCount}</p>
          <p style="font-size: 12px; color: #666;">Cancelled: ${skippedCancelled} | Duplicate: ${skippedDuplicate} | COD: ${skippedCOD}</p>
        `,
        confirmButtonText: "OK"
      });

    } catch (error: any) {
      console.error("StoreHub sync error:", error);
      Swal.fire({
        icon: "error",
        title: "Sync Failed",
        text: error.message || "Failed to sync from StoreHub",
        confirmButtonText: "OK"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Customer HQ</h1>
          <p className="text-muted-foreground mt-2">
            Manage your customer purchases and track sales
          </p>
        </div>
        <div className="flex gap-2">
          {selectedOrders.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete ({selectedOrders.size})
            </Button>
          )}
          {userType === "branch" && (
            <Button
              variant="outline"
              onClick={handleStorehubSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isSyncing ? "Syncing..." : "Sync StoreHub"}
            </Button>
          )}
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer Purchase
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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

      {/* Platform Breakdown Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {platformStats.map((platform) => (
          <Card key={platform.title}>
            <CardContent className="p-4">
              <div className="mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${platform.color}`}>
                  {platform.title}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Customers</p>
                  <p className="font-bold">{platform.customers}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Transactions</p>
                  <p className="font-bold">{platform.transactions}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Units</p>
                  <p className="font-bold">{platform.units}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="font-bold text-green-600">RM {platform.revenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Card with Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Purchases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Search - Search by Name/Phone/Tracking without Date */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Quick Search</span>
                </div>
                <div className="flex flex-1 gap-2 items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter name, phone, or tracking number..."
                      value={quickSearch}
                      onChange={(e) => {
                        setQuickSearch(e.target.value);
                        if (!e.target.value) setIsQuickSearchActive(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleQuickSearch();
                      }}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleQuickSearch} className="bg-primary hover:bg-primary/90">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                  {isQuickSearchActive && (
                    <Button variant="outline" onClick={clearQuickSearch}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  )}
                </div>
                {isQuickSearchActive && (
                  <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                    Showing results for: "{quickSearch}"
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setIsQuickSearchActive(false);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setIsQuickSearchActive(false);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Jenis Platform</label>
                    <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setIsQuickSearchActive(false); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Jenis Platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Jenis Platform</SelectItem>
                        <SelectItem value="Facebook">Facebook</SelectItem>
                        <SelectItem value="Tiktok HQ">Tiktok HQ</SelectItem>
                        <SelectItem value="Shopee HQ">Shopee HQ</SelectItem>
                        <SelectItem value="Database">Database</SelectItem>
                        <SelectItem value="Google">Google</SelectItem>
                        <SelectItem value="StoreHub">StoreHub</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {isLoading ? (
            <p>Loading customer purchases...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Name Customer</TableHead>
                  <TableHead>Phone Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Jenis Closing</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Tracking No.</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quickSearchFilteredPurchases.map((purchase: any, index) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.has(purchase.id)}
                        onCheckedChange={(checked) => handleSelectOrder(purchase.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {format(new Date(purchase.date_order || purchase.created_at), "dd-MM-yyyy")}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        purchase.platform === "Facebook"
                          ? "bg-blue-100 text-blue-800"
                          : purchase.platform === "Tiktok HQ"
                          ? "bg-pink-100 text-pink-800"
                          : purchase.platform === "Shopee HQ"
                          ? "bg-orange-100 text-orange-800"
                          : purchase.platform === "Database"
                          ? "bg-purple-100 text-purple-800"
                          : purchase.platform === "Google"
                          ? "bg-green-100 text-green-800"
                          : purchase.platform === "StoreHub"
                          ? "bg-cyan-100 text-cyan-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {purchase.platform || "Manual"}
                      </span>
                    </TableCell>
                    <TableCell>{purchase.customerName || "-"}</TableCell>
                    <TableCell>{purchase.customerPhone || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {purchase.customerAddress || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{purchase.customerState || "-"}</TableCell>
                    <TableCell>
                      {(purchase.platform === "Tiktok HQ" || purchase.platform === "Shopee HQ" || purchase.platform === "StoreHub") ? (
                        <span
                          onClick={() => openPaymentMethodModal(purchase)}
                          className={`cursor-pointer hover:underline px-2 py-1 rounded text-xs font-medium ${
                            purchase.payment_method === "COD" ? "text-orange-600 bg-orange-50" :
                            purchase.payment_method === "Online Transfer" ? "text-blue-600 bg-blue-50" :
                            "text-green-600 bg-green-50"
                          }`}
                        >
                          {purchase.payment_method || "Cash"}
                        </span>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          purchase.payment_method === "COD" ? "text-orange-600 bg-orange-50" :
                          purchase.payment_method === "Online Transfer" ? "text-blue-600 bg-blue-50" :
                          "text-green-600 bg-green-50"
                        }`}>
                          {purchase.payment_method || "Cash"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{purchase.closing_type || "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm" title={purchase.products.join(", ")}>
                        {purchase.products.length > 1
                          ? `${purchase.products[0]} (+${purchase.products.length - 1} more)`
                          : purchase.products[0] || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{purchase.total_quantity}</TableCell>
                    <TableCell>
                      {(purchase.platform === "Tiktok HQ" || purchase.platform === "Shopee HQ" || purchase.platform === "StoreHub") ? (
                        <span
                          onClick={() => openPriceModal(purchase)}
                          className="cursor-pointer hover:underline text-green-600 font-medium"
                        >
                          RM {Number(purchase.total_price || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-green-600 font-medium">
                          RM {Number(purchase.total_price || 0).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{purchase.tracking_number || "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Navigate to invoice page in new tab
                          const invoiceId = purchase.invoiceNumber
                            ? `SH-${purchase.invoiceNumber}`
                            : purchase.id;
                          window.open(`/invoice?order=${invoiceId}&type=customer`, '_blank');
                        }}
                        title="View Invoice"
                      >
                        <FileText className="h-4 w-4 text-blue-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Modal */}
      <AddCustomerModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={(data) => createCustomerPurchase.mutate(data)}
        isLoading={createCustomerPurchase.isPending}
        products={products || []}
        bundles={bundles || []}
        userType={userType}
      />

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        order={paymentModalOrder}
      />

      {/* Payment Method Edit Modal */}
      <Dialog open={paymentMethodModalOpen} onOpenChange={setPaymentMethodModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Payment Method</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Select Payment Method</label>
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COD">COD</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Online Transfer">Online Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentMethodModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={savePaymentMethod}
              disabled={updatingPaymentFor === selectedPurchaseForPayment?.id}
            >
              {updatingPaymentFor === selectedPurchaseForPayment?.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Edit Modal */}
      <Dialog open={priceModalOpen} onOpenChange={setPriceModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Price</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">New Price (RM)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Enter new price"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePrice}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
