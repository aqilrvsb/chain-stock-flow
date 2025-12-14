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
import { cn } from "@/lib/utils";

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

const MarketerOrders = () => {
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
    const today = new Date().toISOString().split("T")[0];

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

  // Auto-create lead with yesterday's date
  const autoCreateLead = async (phoneNumber: string, customerName: string, productName: string): Promise<string | null> => {
    const marketerIdStaff = userProfile?.idstaff || "";

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("prospects")
      .insert({
        nama_prospek: customerName.toUpperCase(),
        no_telefon: phoneNumber,
        niche: productName,
        jenis_prospek: "EP",
        tarikh_phone_number: yesterdayDate,
        marketer_id_staff: marketerIdStaff,
        admin_id_staff: "",
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.namaPelanggan || !formData.noPhone || !formData.poskod || !formData.daerah || !formData.negeri || !formData.alamat || !formData.produk || !formData.jenisClosing || !formData.caraBayaran || !formData.jenisCustomer) {
      toast.error("Sila lengkapkan semua medan yang diperlukan.");
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

    const dateOrder = new Date().toISOString().split("T")[0];

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

      // Check if customer exists by phone for this branch
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", formData.noPhone)
        .eq("created_by", branchId)
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
        // Create new customer under branch
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            name: formData.namaPelanggan,
            phone: formData.noPhone,
            address: formData.alamat,
            postcode: formData.poskod,
            city: formData.daerah,
            state: formData.negeri,
            created_by: branchId,
          })
          .select("id")
          .single();

        if (customerError) {
          console.error("Error creating customer:", customerError);
          throw new Error("Gagal mencipta rekod pelanggan.");
        }
        customerId = newCustomer.id;
      }

      // For COD and CASH orders (non Shopee/Tiktok), call NinjaVan API
      let trackingNumber = isShopeeOrTiktokPlatform ? formData.trackingNumber : "";

      if (!isShopeeOrTiktokPlatform && ninjavanConfig && branchId) {
        try {
          const { data: session } = await supabase.auth.getSession();
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
              quantity: formData.quantity,
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

      // Create order - seller_id is the BRANCH so it appears in Branch logistics
      const { error: orderError } = await supabase
        .from("customer_purchases")
        .insert({
          customer_id: customerId,
          seller_id: branchId, // Branch ID so it appears in Branch logistics
          product_id: formData.productId,
          marketer_id: user?.id,
          marketer_id_staff: userProfile?.idstaff,
          marketer_name: userProfile?.full_name || userProfile?.idstaff,
          no_phone: formData.noPhone,
          alamat: formData.alamat,
          poskod: formData.poskod,
          bandar: formData.daerah,
          negeri: formData.negeri,
          produk: formData.produk,
          sku: selectedProduct?.sku || formData.produk,
          quantity: formData.quantity,
          unit_price: formData.hargaJualan / formData.quantity,
          total_price: formData.hargaJualan,
          profit: formData.hargaJualan,
          kurier,
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
          platform: "Marketer",
        });

      if (orderError) throw orderError;

      toast.success("Order berjaya disimpan!");
      queryClient.invalidateQueries({ queryKey: ["marketer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer-marketer"] });
      queryClient.invalidateQueries({ queryKey: ["logistics-order"] });
      resetForm();
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Tempahan Baru
        </h1>
        <p className="text-muted-foreground">
          Isi butiran untuk membuat tempahan baru
        </p>
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

            {/* Produk */}
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
              />
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
