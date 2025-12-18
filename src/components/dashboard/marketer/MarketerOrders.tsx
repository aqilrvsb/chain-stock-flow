import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Save, CalendarIcon, Upload, Search } from "lucide-react";
import { format } from "date-fns";
import { cn, getMalaysiaDate, getMalaysiaYesterday } from "@/lib/utils";

const NEGERI_OPTIONS = [
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Melaka",
  "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Putrajaya",
  "Sabah", "Sarawak", "Selangor", "Terengganu",
];

const PLATFORM_OPTIONS = ["Facebook", "Tiktok", "Shopee", "Database", "Google"];
const JENIS_CLOSING_OPTIONS = ["Manual", "WhatsappBot", "Website", "Call"];
const JENIS_CLOSING_MARKETPLACE_OPTIONS = ["Manual", "WhatsappBot", "Website", "Call", "Live", "Shop"];
const CARA_BAYARAN_OPTIONS = ["CASH", "COD"];
const JENIS_BAYARAN_OPTIONS = ["Online Transfer", "Credit Card", "CDM", "CASH"];
const BANK_OPTIONS = [
  "Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank",
  "AmBank", "Bank Islam", "Bank Rakyat", "Affin Bank", "Alliance Bank",
  "OCBC Bank", "HSBC Bank", "Standard Chartered", "UOB Bank", "BSN",
];

const FormLabel: React.FC<{ required?: boolean; children: React.ReactNode }> = ({ required, children }) => (
  <label className="block text-sm font-medium text-foreground mb-1.5">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

interface EditOrderData {
  id: string;
  marketer_name: string;
  no_phone: string;
  jenis_platform: string;
  jenis_closing: string;
  jenis_customer: string;
  poskod: string;
  bandar: string;
  negeri: string;
  alamat: string;
  produk: string;
  total_price: number;
  cara_bayaran: string;
  jenis_bayaran: string;
  bank: string;
  nota_staff: string;
  tracking_number: string;
  tarikh_bayaran: string;
  receipt_image_url: string;
  waybill_url: string;
  product_id: string;
  customer_id: string;
}

interface MarketerOrdersProps {
  onNavigate?: (view: string) => void;
  editOrder?: EditOrderData | null;
  onCancelEdit?: () => void;
}

const MarketerOrders = ({ onNavigate, editOrder, onCancelEdit }: MarketerOrdersProps) => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tarikhBayaran, setTarikhBayaran] = useState<Date>();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const [determinedCustomerType, setDeterminedCustomerType] = useState<"NP" | "EP" | "EC" | "">("");
  const [isCheckingLead, setIsCheckingLead] = useState(false);
  const [leadInfo, setLeadInfo] = useState<{ id?: string; isNewLead?: boolean; countOrder?: number } | null>(null);
  const [waybillFile, setWaybillFile] = useState<File | null>(null);
  const [waybillFileName, setWaybillFileName] = useState<string>("");

  const isEditMode = !!editOrder;

  // Fetch branch_id - first try from profile, then fallback to user_roles.created_by
  const { data: branchId } = useQuery({
    queryKey: ["marketer-branch-id", user?.id, userProfile?.branch_id],
    queryFn: async () => {
      // If profile already has branch_id, use it
      if (userProfile?.branch_id) {
        return userProfile.branch_id;
      }

      // Fallback: get branch_id from user_roles.created_by
      const { data, error } = await supabase
        .from("user_roles")
        .select("created_by")
        .eq("user_id", user?.id)
        .eq("role", "marketer")
        .single();

      if (error || !data?.created_by) {
        console.error("Could not determine branch_id:", error);
        return null;
      }

      return data.created_by;
    },
    enabled: !!user?.id,
  });

  const [formData, setFormData] = useState({
    namaPelanggan: "",
    noPhone: "",
    jenisPlatform: "",
    jenisClosing: "",
    jenisCustomer: "",
    poskod: "",
    daerah: "",
    negeri: "",
    alamat: "",
    produk: "",
    productId: "",
    quantity: 1,
    hargaJualan: 0,
    caraBayaran: "",
    jenisBayaran: "",
    pilihBank: "",
    nota: "",
    trackingNumber: "",
  });

  // Bundle selection state
  const [selectionType, setSelectionType] = useState<"product" | "bundle">("product");
  const [bundleId, setBundleId] = useState("");

  // Pre-fill form in edit mode
  useEffect(() => {
    if (editOrder) {
      setFormData({
        namaPelanggan: editOrder.marketer_name || "",
        noPhone: editOrder.no_phone || "",
        jenisPlatform: editOrder.jenis_platform || "",
        jenisClosing: editOrder.jenis_closing || "",
        jenisCustomer: editOrder.jenis_customer || "",
        poskod: editOrder.poskod || "",
        daerah: editOrder.bandar || "",
        negeri: editOrder.negeri || "",
        alamat: editOrder.alamat || "",
        produk: editOrder.produk || "",
        productId: editOrder.product_id || "",
        quantity: 1,
        hargaJualan: editOrder.total_price || 0,
        caraBayaran: editOrder.cara_bayaran || "",
        jenisBayaran: editOrder.jenis_bayaran || "",
        pilihBank: editOrder.bank || "",
        nota: editOrder.nota_staff || "",
        trackingNumber: editOrder.tracking_number || "",
      });
      // Set customer type
      if (editOrder.jenis_customer) {
        setDeterminedCustomerType(editOrder.jenis_customer as "NP" | "EP" | "EC");
      }
      // Set tarikh bayaran if exists
      if (editOrder.tarikh_bayaran) {
        setTarikhBayaran(new Date(editOrder.tarikh_bayaran));
      }
    }
  }, [editOrder]);

  // Fetch products - just get all active products for marketer
  // Note: Inventory quantity check is handled at order submission time
  const { data: branchProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products-for-marketer", branchId],
    queryFn: async () => {
      if (!branchId) return [];

      // Get all active products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true);

      if (productsError) throw productsError;

      return (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        available_quantity: 0, // Quantity check is done server-side
      }));
    },
    enabled: !!branchId,
  });

  // Fetch bundles for this branch
  const { data: bundles = [] } = useQuery({
    queryKey: ["branch-bundles-marketer", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from("branch_bundles")
        .select(`
          id,
          name,
          description,
          sku,
          total_price,
          is_active,
          items:branch_bundle_items(
            id,
            quantity,
            product:products(id, name, sku)
          )
        `)
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!branchId,
  });

  // Get selected bundle details
  const selectedBundle = bundles.find((b: any) => b.id === bundleId);

  // Handle bundle selection change
  const handleBundleChange = (newBundleId: string) => {
    setBundleId(newBundleId);
    const bundle = bundles.find((b: any) => b.id === newBundleId);
    if (bundle) {
      // Auto-fill price from bundle
      setFormData((prev) => ({
        ...prev,
        hargaJualan: bundle.total_price || 0,
        quantity: 1, // Bundle quantity is always 1
        produk: bundle.name, // Set product name as bundle name for display
        productId: "", // Clear product ID as we're using bundle
      }));
    }
  };

  // Fetch NinjaVan config for branch
  const { data: ninjavanConfig } = useQuery({
    queryKey: ["ninjavan-config-branch", branchId],
    queryFn: async () => {
      if (!branchId) return null;
      const { data, error } = await (supabase as any)
        .from("ninjavan_config")
        .select("*")
        .eq("profile_id", branchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  // Clear customer type when phone number changes
  useEffect(() => {
    setDeterminedCustomerType("");
    setLeadInfo(null);
    setFormData(prev => ({ ...prev, jenisCustomer: "" }));
  }, [formData.noPhone]);

  // Check lead by phone number and determine NP/EP/EC
  const checkLeadAndDetermineType = async (phoneNumber: string): Promise<{ type: "NP" | "EP" | "EC"; leadId?: string; isNewLead?: boolean; countOrder?: number }> => {
    const marketerIdStaff = userProfile?.idstaff || "";
    const today = getMalaysiaDate();

    // Search for existing lead by phone number for this marketer
    const { data: existingLead } = await supabase
      .from("prospects")
      .select("id, tarikh_phone_number, jenis_prospek, count_order")
      .eq("marketer_id_staff", marketerIdStaff)
      .eq("no_telefon", phoneNumber)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      const existingType = existingLead.jenis_prospek?.toUpperCase();
      const currentCountOrder = existingLead.count_order || 0;

      if (existingType === "EC") {
        return { type: "EC", leadId: existingLead.id, countOrder: currentCountOrder };
      }

      if (existingType === "NP" || existingType === "EP") {
        return { type: "EC", leadId: existingLead.id, countOrder: currentCountOrder };
      }

      if (existingLead.tarikh_phone_number === today) {
        return { type: "NP", leadId: existingLead.id, countOrder: currentCountOrder };
      } else {
        return { type: "EP", leadId: existingLead.id, countOrder: currentCountOrder };
      }
    } else {
      return { type: "EP", isNewLead: true, countOrder: 0 };
    }
  };

  // Handle Check button click
  const handleCheckCustomerType = async () => {
    if (!formData.noPhone || !formData.noPhone.startsWith("6") || formData.noPhone.length < 10) {
      toast.error("Sila masukkan no. telefon yang sah (bermula dengan 6).");
      return;
    }

    setIsCheckingLead(true);
    try {
      const result = await checkLeadAndDetermineType(formData.noPhone);
      setDeterminedCustomerType(result.type);
      setLeadInfo({
        id: result.leadId,
        isNewLead: result.isNewLead,
        countOrder: result.countOrder,
      });

      setFormData(prev => ({ ...prev, jenisCustomer: result.type }));

      let description = "";
      if (result.type === "NP") {
        description = "Lead ditemui - Tarikh sama hari ini (New Prospect)";
      } else if (result.type === "EP") {
        description = result.isNewLead
          ? "Lead tidak ditemui - akan dicipta automatik (Existing Prospect)"
          : "Lead ditemui - Tarikh berbeza (Existing Prospect)";
      } else if (result.type === "EC") {
        description = `Lead telah membeli sebelum ini (Existing Customer) - Order ke-${(result.countOrder || 0) + 1}`;
      }

      toast.success(`Jenis Customer: ${result.type}`, { description });
    } catch (err) {
      console.error("Error checking lead:", err);
      toast.error("Gagal menyemak lead. Sila cuba lagi.");
    } finally {
      setIsCheckingLead(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => {
      let processedValue = value;
      if (typeof value === "string" && !["jenisPlatform", "jenisClosing", "jenisCustomer", "caraBayaran", "jenisBayaran", "pilihBank", "produk", "productId", "negeri"].includes(field)) {
        processedValue = value.toUpperCase();
      }

      const newData = { ...prev, [field]: processedValue };

      // When product is selected, update productId
      if (field === "produk") {
        const selectedProduct = branchProducts.find((p: any) => p.name === value);
        if (selectedProduct) {
          newData.productId = selectedProduct.id;
        }
      }

      return newData;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWaybillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Sila muat naik fail PDF sahaja.");
        return;
      }
      setWaybillFile(file);
      setWaybillFileName(file.name);
    }
  };

  // Auto-create lead with yesterday's date (only if not exists)
  const autoCreateLead = async (phoneNumber: string, customerName: string, productName: string): Promise<string | null> => {
    const marketerIdStaff = userProfile?.idstaff || "";

    // Double-check if lead already exists to prevent duplicates
    const { data: existingLead } = await supabase
      .from("prospects")
      .select("id")
      .eq("marketer_id_staff", marketerIdStaff)
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
        marketer_id_staff: marketerIdStaff,
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

  const resetForm = () => {
    setFormData({
      namaPelanggan: "",
      noPhone: "",
      jenisPlatform: "",
      jenisClosing: "",
      jenisCustomer: "",
      poskod: "",
      daerah: "",
      negeri: "",
      alamat: "",
      produk: "",
      productId: "",
      quantity: 1,
      hargaJualan: 0,
      caraBayaran: "",
      jenisBayaran: "",
      pilihBank: "",
      nota: "",
      trackingNumber: "",
    });
    setTarikhBayaran(undefined);
    setReceiptFile(null);
    setReceiptPreview("");
    setWaybillFile(null);
    setWaybillFileName("");
    setDeterminedCustomerType("");
    setLeadInfo(null);
    setSelectionType("product");
    setBundleId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if bundle is selected
    const isBundleSelected = selectionType === "bundle" && bundleId;

    // Validation
    if (!formData.namaPelanggan || !formData.noPhone || !formData.poskod || !formData.daerah || !formData.negeri || !formData.alamat || !formData.jenisClosing || !formData.caraBayaran || !formData.jenisCustomer) {
      toast.error("Sila lengkapkan semua medan yang diperlukan.");
      return;
    }

    // Validate product or bundle is selected
    if (!isBundleSelected && !formData.produk) {
      toast.error("Sila pilih produk atau bundle.");
      return;
    }

    // Validate quantity
    if (!formData.quantity || formData.quantity < 1) {
      toast.error("Sila masukkan kuantiti yang sah.");
      return;
    }

    // Validate that customer type is NP/EP/EC
    if (!["NP", "EP", "EC"].includes(formData.jenisCustomer)) {
      toast.error("Sila klik butang 'Semak' untuk menyemak jenis customer.");
      return;
    }

    // Validate payment details for CASH (non-Shopee/TikTok)
    const isShopeeOrTiktokPlatform = formData.jenisPlatform === "Shopee" || formData.jenisPlatform === "Tiktok";
    if (!isShopeeOrTiktokPlatform && formData.caraBayaran === "CASH") {
      if (!tarikhBayaran) {
        toast.error("Sila pilih Tarikh Bayaran.");
        return;
      }
      if (!formData.jenisBayaran) {
        toast.error("Sila pilih Jenis Bayaran.");
        return;
      }
      if (!formData.pilihBank) {
        toast.error("Sila pilih Bank.");
        return;
      }
    }

    // Validate phone starts with 6
    if (!formData.noPhone.toString().startsWith("6")) {
      toast.error("No. Telefon mesti bermula dengan 6.");
      return;
    }

    const selectedProduct = branchProducts.find((p: any) => p.id === formData.productId);

    setIsSubmitting(true);

    const dateOrder = getMalaysiaDate();

    // Set kurier based on platform and cara bayaran
    let kurier = "";
    if (isShopeeOrTiktokPlatform) {
      kurier = formData.jenisPlatform;
    } else {
      kurier = formData.caraBayaran === "COD" ? "Ninjavan COD" : "Ninjavan CASH";
    }

    try {
      // If lead is new, auto-create it
      let finalLeadId = leadInfo?.id;
      if (leadInfo?.isNewLead) {
        finalLeadId = await autoCreateLead(formData.noPhone, formData.namaPelanggan, formData.produk) || undefined;
      }

      // Update lead with jenis_prospek if it's the first order
      if (finalLeadId && formData.jenisCustomer) {
        await supabase
          .from("prospects")
          .update({
            jenis_prospek: formData.jenisCustomer,
            count_order: (leadInfo?.countOrder || 0) + 1,
            status_closed: "Closed",
            price_closed: formData.hargaJualan,
          })
          .eq("id", finalLeadId);
      }

      // Create or get customer (for Branch logistics to work with)
      let customerId: string | null = null;

      // Check if customer exists by phone for this marketer or branch
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", formData.noPhone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        // Update customer address if needed
        await supabase
          .from("customers")
          .update({
            name: formData.namaPelanggan,
            address: formData.alamat,
            postcode: formData.poskod,
            city: formData.daerah,
            state: formData.negeri,
          })
          .eq("id", customerId);
      } else {
        // Create new customer under marketer (RLS allows marketer to create with their own ID)
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            name: formData.namaPelanggan,
            phone: formData.noPhone,
            address: formData.alamat,
            postcode: formData.poskod,
            city: formData.daerah,
            state: formData.negeri,
            created_by: user?.id,
          })
          .select("id")
          .single();

        if (customerError) {
          console.error("Error creating customer:", customerError);
          throw new Error("Gagal mencipta rekod pelanggan.");
        }
        customerId = newCustomer.id;
      }

      // Upload receipt image if provided (same bucket as master agent)
      let receiptImageUrl = "";
      if (receiptFile && showPaymentDetails) {
        try {
          const fileExt = receiptFile.name.split(".").pop();
          const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
          const filePath = `receipts/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("payment-receipts")
            .upload(filePath, receiptFile);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            toast.error("Gagal memuat naik resit. Order tetap disimpan.");
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from("payment-receipts")
              .getPublicUrl(filePath);
            receiptImageUrl = publicUrl;
          }
        } catch (uploadErr) {
          console.error("Receipt upload error:", uploadErr);
          toast.error("Gagal memuat naik resit. Order tetap disimpan.");
        }
      }

      // Upload waybill if provided (Shopee/Tiktok)
      let waybillUrl = "";
      if (waybillFile && isShopeeOrTiktokPlatform) {
        try {
          const fileExt = waybillFile.name.split(".").pop();
          const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
          const filePath = `waybills/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("payment-receipts")
            .upload(filePath, waybillFile);

          if (uploadError) {
            console.error("Waybill upload error:", uploadError);
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from("payment-receipts")
              .getPublicUrl(filePath);
            waybillUrl = publicUrl;
          }
        } catch (uploadErr) {
          console.error("Waybill upload error:", uploadErr);
        }
      }

      // For COD and CASH orders (non Shopee/Tiktok), call NinjaVan API
      let trackingNumber = isShopeeOrTiktokPlatform ? formData.trackingNumber : "";
      let idSale = "";

      if (!isShopeeOrTiktokPlatform && ninjavanConfig && branchId) {
        try {
          const { data: session } = await supabase.auth.getSession();

          // Generate incremental sale ID using database function (OJ00001, OJ00002, etc.)
          const { data: saleIdData, error: saleIdError } = await supabase.rpc("generate_sale_id");
          if (saleIdError) {
            console.error("Error generating sale ID:", saleIdError);
            // Fallback: generate based on timestamp
            const ts = Date.now().toString().slice(-5);
            idSale = `OJ${ts}`;
          } else {
            idSale = saleIdData as string;
          }
          console.log("Generated Sale ID:", idSale);

          const ninjavanResponse = await supabase.functions.invoke("ninjavan-order", {
            body: {
              profileId: branchId,
              customerName: formData.namaPelanggan,
              phone: formData.noPhone,
              address: formData.alamat,
              postcode: formData.poskod,
              city: formData.daerah,
              state: formData.negeri,
              price: formData.hargaJualan,
              paymentMethod: formData.caraBayaran,
              productName: formData.produk,
              productSku: selectedProduct?.sku,
              quantity: formData.quantity,
              nota: formData.nota || "",
              idSale: idSale,
              marketerIdStaff: userProfile?.idstaff || "",
            },
            headers: {
              Authorization: `Bearer ${session?.session?.access_token}`,
            },
          });

          if (ninjavanResponse.error) {
            console.error("NinjaVan error:", ninjavanResponse.error);
            toast.error("NinjaVan order gagal: " + (ninjavanResponse.error.message || "Unknown error"));
          } else if (ninjavanResponse.data?.success) {
            trackingNumber = ninjavanResponse.data.trackingNumber;
            toast.success(`NinjaVan order berjaya! Tracking: ${trackingNumber}`);
          }
        } catch (ninjavanError: any) {
          console.error("NinjaVan API error:", ninjavanError);
          toast.error("NinjaVan order gagal: " + (ninjavanError.message || "Unknown error"));
        }
      }

      // Handle Edit Mode vs Create Mode
      if (isEditMode && editOrder) {
        // In edit mode, cancel old NinjaVan if it was a NinjaVan order and has tracking
        const wasNinjavanOrder = editOrder.jenis_platform !== "Shopee" && editOrder.jenis_platform !== "Tiktok";
        if (wasNinjavanOrder && editOrder.tracking_number && branchId) {
          try {
            await supabase.functions.invoke("ninjavan-cancel", {
              body: { trackingNumber: editOrder.tracking_number, profileId: branchId },
            });
          } catch (err) {
            console.error("Cancel old NinjaVan order failed:", err);
          }
        }

        // Delete old receipt image if new one is uploaded
        if (receiptFile && editOrder.receipt_image_url) {
          try {
            const urlParts = editOrder.receipt_image_url.split("/storage/v1/object/public/payment-receipts/");
            if (urlParts.length > 1) {
              await supabase.storage.from("payment-receipts").remove([urlParts[1]]);
            }
          } catch (err) {
            console.error("Delete old receipt error:", err);
          }
        }

        // Delete old waybill if new one is uploaded
        if (waybillFile && editOrder.waybill_url) {
          try {
            const urlParts = editOrder.waybill_url.split("/storage/v1/object/public/payment-receipts/");
            if (urlParts.length > 1) {
              await supabase.storage.from("payment-receipts").remove([urlParts[1]]);
            }
          } catch (err) {
            console.error("Delete old waybill error:", err);
          }
        }

        // Update existing order
        const { error: updateError } = await supabase
          .from("customer_purchases")
          .update({
            marketer_name: formData.namaPelanggan,
            no_phone: formData.noPhone,
            alamat: formData.alamat,
            poskod: formData.poskod,
            bandar: formData.daerah,
            negeri: formData.negeri,
            produk: formData.produk,
            product_id: formData.productId || null,
            sku: selectedProduct?.sku,
            quantity: formData.quantity,
            unit_price: formData.hargaJualan / formData.quantity,
            total_price: formData.hargaJualan,
            profit: formData.hargaJualan,
            kurier,
            tracking_number: trackingNumber || editOrder.tracking_number,
            no_tracking: trackingNumber || editOrder.tracking_number,
            jenis_platform: formData.jenisPlatform,
            jenis_customer: formData.jenisCustomer,
            jenis_closing: formData.jenisClosing,
            cara_bayaran: formData.caraBayaran,
            payment_method: formData.caraBayaran === "CASH" ? "Online Transfer" : "COD",
            nota_staff: formData.nota,
            tarikh_bayaran: showPaymentDetails && tarikhBayaran ? format(tarikhBayaran, "yyyy-MM-dd") : null,
            jenis_bayaran: showPaymentDetails ? formData.jenisBayaran : null,
            bank: showPaymentDetails ? formData.pilihBank : null,
            receipt_image_url: receiptImageUrl || editOrder.receipt_image_url || null,
            waybill_url: waybillUrl || editOrder.waybill_url || null,
          })
          .eq("id", editOrder.id);

        if (updateError) throw updateError;

        toast.success("Order berjaya dikemaskini!");
        queryClient.invalidateQueries({ queryKey: ["marketer-history"] });

        // Go back to history
        if (onCancelEdit) {
          onCancelEdit();
        } else if (onNavigate) {
          onNavigate("history");
        }
      } else {
        // Determine SKU and product name based on selection type
        let orderSku = selectedProduct?.sku || "";
        let orderProductName = formData.produk;
        let orderProductId = formData.productId || null;

        if (isBundleSelected && selectedBundle) {
          // Use bundle SKU format: SKU_A-unit + SKU_B-unit
          orderSku = selectedBundle.sku || "";
          orderProductName = selectedBundle.name;
          orderProductId = null; // No single product for bundle
        }

        // Create new order - seller_id is the BRANCH so it appears in Branch logistics
        const { error: orderError } = await supabase
          .from("customer_purchases")
          .insert({
            customer_id: customerId,
            seller_id: branchId, // Branch ID so it appears in Branch logistics
            product_id: orderProductId,
            branch_bundle_id: isBundleSelected ? bundleId : null, // Track bundle ID
            marketer_id: user?.id,
            marketer_id_staff: userProfile?.idstaff,
            marketer_name: formData.namaPelanggan,
            no_phone: formData.noPhone,
            alamat: formData.alamat,
            poskod: formData.poskod,
            bandar: formData.daerah,
            negeri: formData.negeri,
            produk: orderProductName,
            sku: orderSku,
            quantity: formData.quantity,
            unit_price: formData.hargaJualan / formData.quantity,
            total_price: formData.hargaJualan,
            profit: formData.hargaJualan,
            kurier,
            id_sale: idSale || null, // Incremental Sale ID (OJ00001, OJ00002, etc.)
            tracking_number: trackingNumber,
            no_tracking: trackingNumber,
            jenis_platform: formData.jenisPlatform,
            jenis_customer: formData.jenisCustomer,
            jenis_closing: formData.jenisClosing,
            cara_bayaran: formData.caraBayaran,
            payment_method: formData.caraBayaran === "CASH" ? "Online Transfer" : "COD",
            nota_staff: formData.nota,
            delivery_status: "Pending",
            date_order: dateOrder,
            tarikh_bayaran: showPaymentDetails && tarikhBayaran ? format(tarikhBayaran, "yyyy-MM-dd") : null,
            jenis_bayaran: showPaymentDetails ? formData.jenisBayaran : null,
            bank: showPaymentDetails ? formData.pilihBank : null,
            receipt_image_url: receiptImageUrl || null,
            waybill_url: waybillUrl || null,
            platform: "Marketer",
          });

        if (orderError) throw orderError;

        toast.success("Order berjaya disimpan!");
        queryClient.invalidateQueries({ queryKey: ["marketer-orders"] });
        queryClient.invalidateQueries({ queryKey: ["customer-marketer"] });
        queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
        queryClient.invalidateQueries({ queryKey: ["marketer-history"] });
        resetForm();

        // Navigate to history page after successful submit
        if (onNavigate) {
          onNavigate("history");
        }
      }
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error(error.message || "Gagal menyimpan tempahan. Sila cuba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isShopeeOrTiktok = formData.jenisPlatform === "Shopee" || formData.jenisPlatform === "Tiktok";
  const showPaymentDetails = formData.caraBayaran === "CASH" && !isShopeeOrTiktok;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditMode ? "Edit Tempahan" : "Tempahan Baru"}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Kemaskini butiran tempahan" : "Isi butiran untuk membuat tempahan baru"}
          </p>
        </div>
        {isEditMode && onCancelEdit && (
          <Button type="button" variant="outline" onClick={onCancelEdit}>
            Batal Edit
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Order Information */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Nama Pelanggan */}
            <div>
              <FormLabel required>Nama Pelanggan</FormLabel>
              <Input
                placeholder="Masukkan nama pelanggan"
                value={formData.namaPelanggan}
                onChange={(e) => handleChange("namaPelanggan", e.target.value)}
                className="bg-background"
              />
            </div>

            {/* No. Telefon */}
            <div>
              <FormLabel required>No. Telefon (digit start with 6)</FormLabel>
              <Input
                type="number"
                placeholder="60123456789"
                value={formData.noPhone}
                onChange={(e) => handleChange("noPhone", e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Jenis Platform */}
            <div>
              <FormLabel required>Jenis Platform</FormLabel>
              <Select
                value={formData.jenisPlatform}
                onValueChange={(value) => handleChange("jenisPlatform", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Pilih Platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Jenis Closing */}
            <div>
              <FormLabel required>Jenis Closing</FormLabel>
              <Select
                value={formData.jenisClosing}
                onValueChange={(value) => handleChange("jenisClosing", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Pilih Jenis Closing" />
                </SelectTrigger>
                <SelectContent>
                  {(formData.jenisPlatform === "Shopee" || formData.jenisPlatform === "Tiktok"
                    ? JENIS_CLOSING_MARKETPLACE_OPTIONS
                    : JENIS_CLOSING_OPTIONS
                  ).map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Jenis Customer */}
            <div>
              <FormLabel required>Jenis Customer</FormLabel>
              <div className="flex gap-2">
                <Input
                  value={formData.jenisCustomer ? (
                    formData.jenisCustomer === "NP" ? "New Prospect (NP)" :
                    formData.jenisCustomer === "EP" ? "Existing Prospect (EP)" :
                    formData.jenisCustomer === "EC" ? "Existing Customer (EC)" :
                    formData.jenisCustomer
                  ) : ""}
                  placeholder="Klik Semak untuk menyemak"
                  readOnly
                  className={cn(
                    "bg-muted cursor-not-allowed flex-1",
                    formData.jenisCustomer === "NP" && "text-green-600 font-medium",
                    formData.jenisCustomer === "EP" && "text-purple-600 font-medium",
                    formData.jenisCustomer === "EC" && "text-amber-600 font-medium"
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCheckCustomerType}
                  disabled={isCheckingLead || !formData.noPhone || formData.noPhone.length < 10}
                  className="shrink-0"
                >
                  {isCheckingLead ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-1" />
                      Semak
                    </>
                  )}
                </Button>
              </div>
              {leadInfo && formData.jenisCustomer && (
                <p className="text-xs text-muted-foreground mt-1">
                  {leadInfo.isNewLead
                    ? "Lead baru akan dicipta automatik"
                    : `Order ke-${(leadInfo.countOrder || 0) + 1} untuk lead ini`
                  }
                </p>
              )}
            </div>

            {/* Poskod */}
            <div>
              <FormLabel required>Poskod</FormLabel>
              <Input
                type="number"
                placeholder="Masukkan poskod"
                value={formData.poskod}
                onChange={(e) => handleChange("poskod", e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Daerah */}
            <div>
              <FormLabel required>Daerah</FormLabel>
              <Input
                placeholder="Masukkan daerah"
                value={formData.daerah}
                onChange={(e) => handleChange("daerah", e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Negeri */}
            <div>
              <FormLabel required>Negeri</FormLabel>
              <Select
                value={formData.negeri}
                onValueChange={(value) => handleChange("negeri", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Pilih Negeri" />
                </SelectTrigger>
                <SelectContent>
                  {NEGERI_OPTIONS.map((state) => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alamat */}
            <div className="lg:col-span-4">
              <FormLabel required>Alamat</FormLabel>
              <Textarea
                placeholder="Masukkan alamat penuh"
                value={formData.alamat}
                onChange={(e) => handleChange("alamat", e.target.value)}
                className="bg-background resize-none"
                rows={3}
              />
            </div>

            {/* Item Type Selection - Only show if bundles available */}
            {bundles.length > 0 && (
              <div>
                <FormLabel required>Jenis Item</FormLabel>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="selectionType"
                      value="product"
                      checked={selectionType === "product"}
                      onChange={() => {
                        setSelectionType("product");
                        setBundleId("");
                        setFormData((prev) => ({ ...prev, quantity: 1 }));
                      }}
                      className="w-4 h-4"
                    />
                    <span>Produk</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="selectionType"
                      value="bundle"
                      checked={selectionType === "bundle"}
                      onChange={() => {
                        setSelectionType("bundle");
                        setFormData((prev) => ({
                          ...prev,
                          produk: "",
                          productId: "",
                          quantity: 1,
                        }));
                      }}
                      className="w-4 h-4"
                    />
                    <span>Bundle</span>
                  </label>
                </div>
              </div>
            )}

            {/* Produk Selection */}
            {selectionType === "product" && (
              <div>
                <FormLabel required>Produk</FormLabel>
                <Select
                  value={formData.produk}
                  onValueChange={(value) => handleChange("produk", value)}
                  disabled={productsLoading}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={productsLoading ? "Loading..." : "Pilih Produk"} />
                  </SelectTrigger>
                  <SelectContent>
                    {productsLoading ? (
                      <SelectItem value="loading" disabled>Loading products...</SelectItem>
                    ) : branchProducts.length === 0 ? (
                      <SelectItem value="empty" disabled>No products available</SelectItem>
                    ) : (
                      branchProducts.map((product: any) => (
                        <SelectItem key={product.id} value={product.name}>
                          {product.name} ({product.sku})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Bundle Selection */}
            {selectionType === "bundle" && (
              <div className="lg:col-span-2">
                <FormLabel required>Bundle</FormLabel>
                <Select value={bundleId} onValueChange={handleBundleChange}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih Bundle" />
                  </SelectTrigger>
                  <SelectContent>
                    {bundles.map((bundle: any) => (
                      <SelectItem key={bundle.id} value={bundle.id}>
                        {bundle.name} - RM {bundle.total_price?.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Show bundle contents */}
                {selectedBundle && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm">
                    {selectedBundle.sku && (
                      <div className="mb-2 p-2 bg-blue-50 rounded">
                        <p className="text-xs text-blue-600">Bundle SKU:</p>
                        <code className="text-xs font-mono font-bold text-blue-900">
                          {selectedBundle.sku}
                        </code>
                      </div>
                    )}
                    <p className="font-medium mb-2">Kandungan Bundle:</p>
                    <ul className="space-y-1">
                      {selectedBundle.items?.map((item: any, idx: number) => (
                        <li key={idx} className="flex justify-between">
                          <span>{item.product?.name || 'Unknown'}</span>
                          <span className="text-muted-foreground">x {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Quantity */}
            <div>
              <FormLabel required>Kuantiti (Unit)</FormLabel>
              <Input
                type="number"
                min="1"
                placeholder="1"
                value={formData.quantity}
                onChange={(e) => handleChange("quantity", parseInt(e.target.value) || 1)}
                className="bg-background"
                disabled={selectionType === "bundle"}
              />
              {selectionType === "bundle" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Kuantiti bundle ditetapkan kepada 1.
                </p>
              )}
            </div>

            {/* Harga Jualan */}
            <div>
              <FormLabel required>Harga Jualan (RM)</FormLabel>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.hargaJualan || ""}
                onChange={(e) => handleChange("hargaJualan", parseFloat(e.target.value) || 0)}
                className="bg-background"
              />
            </div>

            {/* Cara Bayaran */}
            <div>
              <FormLabel required>Cara Bayaran</FormLabel>
              <Select
                value={formData.caraBayaran}
                onValueChange={(value) => handleChange("caraBayaran", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Pilih Cara Bayaran" />
                </SelectTrigger>
                <SelectContent>
                  {CARA_BAYARAN_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tracking Number - Only for Shopee/Tiktok */}
            {isShopeeOrTiktok && (
              <div>
                <FormLabel required>No. Tracking</FormLabel>
                <Input
                  placeholder="Masukkan tracking number"
                  value={formData.trackingNumber}
                  onChange={(e) => handleChange("trackingNumber", e.target.value)}
                  className="bg-background"
                />
              </div>
            )}

            {/* Waybill Attachment - Only for Shopee/Tiktok */}
            {isShopeeOrTiktok && (
              <div>
                <FormLabel required>Waybill Attachment (PDF)</FormLabel>
                <div className="relative">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleWaybillChange}
                    className="hidden"
                    id="waybill-upload"
                  />
                  <label
                    htmlFor="waybill-upload"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors bg-background"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm text-muted-foreground">
                      {waybillFileName || "Upload PDF Waybill"}
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Nota - Always visible */}
            <div className="lg:col-span-2">
              <FormLabel>Nota</FormLabel>
              <Textarea
                placeholder="Masukkan nota tambahan (optional)"
                value={formData.nota}
                onChange={(e) => handleChange("nota", e.target.value)}
                className="bg-background resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Payment Details - Only show if CASH is selected */}
        {showPaymentDetails && (
          <div className="bg-card border border-border rounded-lg p-6 border-l-4 border-l-emerald-500">
            <h3 className="text-lg font-semibold text-foreground mb-4">Butiran Bayaran</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Tarikh Bayaran */}
              <div>
                <FormLabel required>Tarikh Bayaran</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background",
                        !tarikhBayaran && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tarikhBayaran ? format(tarikhBayaran, "dd/MM/yyyy") : "Pilih tarikh"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tarikhBayaran}
                      onSelect={setTarikhBayaran}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Jenis Bayaran */}
              <div>
                <FormLabel required>Jenis Bayaran</FormLabel>
                <Select
                  value={formData.jenisBayaran}
                  onValueChange={(value) => handleChange("jenisBayaran", value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih Jenis Bayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    {JENIS_BAYARAN_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pilih Bank */}
              <div>
                <FormLabel required>Pilih Bank</FormLabel>
                <Select
                  value={formData.pilihBank}
                  onValueChange={(value) => handleChange("pilihBank", value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih Bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Resit Bayaran */}
              <div>
                <FormLabel required>Resit Bayaran</FormLabel>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="receipt-upload"
                  />
                  <label
                    htmlFor="receipt-upload"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors bg-background"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm text-muted-foreground">
                      {receiptFile ? receiptFile.name : "Upload Resit"}
                    </span>
                  </label>
                  {receiptPreview && (
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      className="mt-2 w-full h-32 object-cover rounded-lg border border-border"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
          >
            Reset
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Submit
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MarketerOrders;
