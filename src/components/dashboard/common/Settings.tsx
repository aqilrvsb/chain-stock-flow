import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Truck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Putrajaya",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
];

const Settings = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [billplzApiKey, setBillplzApiKey] = useState("");
  const [billplzCollectionId, setBillplzCollectionId] = useState("");
  const [storehubUsername, setStorehubUsername] = useState("");
  const [storehubPassword, setStorehubPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // NinjaVan config states
  const [ninjavanClientId, setNinjavanClientId] = useState("");
  const [ninjavanClientSecret, setNinjavanClientSecret] = useState("");
  const [ninjavanSenderName, setNinjavanSenderName] = useState("");
  const [ninjavanSenderPhone, setNinjavanSenderPhone] = useState("");
  const [ninjavanSenderEmail, setNinjavanSenderEmail] = useState("");
  const [ninjavanSenderAddress, setNinjavanSenderAddress] = useState("");
  const [ninjavanSenderPostcode, setNinjavanSenderPostcode] = useState("");
  const [ninjavanSenderCity, setNinjavanSenderCity] = useState("");
  const [ninjavanSenderState, setNinjavanSenderState] = useState("");
  const [savingNinjavan, setSavingNinjavan] = useState(false);

  const { data: profile, isLoading } = useQuery({
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

  // Fetch system settings (HQ only)
  const { data: systemSettings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data: apiKey } = await (supabase as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "billplz_api_key")
        .maybeSingle();

      const { data: collectionId } = await (supabase as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "billplz_collection_id")
        .maybeSingle();

      const { data: logoUrl } = await (supabase as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "logo_url")
        .maybeSingle();

      const { data: faviconUrl } = await (supabase as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "favicon_url")
        .maybeSingle();

      const { data: customerSegmentEnabled } = await (supabase as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "customer_segment_enabled")
        .maybeSingle();

      return {
        apiKey: apiKey?.setting_value || "",
        collectionId: collectionId?.setting_value || "",
        logoUrl: logoUrl?.setting_value || "",
        faviconUrl: faviconUrl?.setting_value || "",
        customerSegmentEnabled: customerSegmentEnabled?.setting_value === 'true',
      };
    },
    enabled: userRole === 'hq',
  });

  // Keep billplzConfig for backward compatibility
  const billplzConfig = systemSettings;

  // Fetch NinjaVan config (Branch only)
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
    enabled: !!user?.id && userRole === 'branch',
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePassword = useMutation({
    mutationFn: async (password: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('update-user-password', {
        body: { userId: user?.id, password },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Password update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProfileUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Remove + symbol and keep only digits
    const phoneNumber = (formData.get("phone_number") as string || "").replace(/\+/g, "").replace(/\D/g, "");
    const whatsappNumber = (formData.get("whatsapp_number") as string || "").replace(/\+/g, "").replace(/\D/g, "");

    updateProfile.mutate({
      phone_number: phoneNumber || null,
      whatsapp_number: whatsappNumber || null,
      delivery_address: formData.get("delivery_address"),
    });
  };

  const handlePasswordUpdate = () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match",
        variant: "destructive",
      });
      return;
    }

    updatePassword.mutate(newPassword);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `system/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      // Update system settings (types will be regenerated after deployment)
      const { error: updateError } = await (supabase as any)
        .from('system_settings')
        .upsert({
          setting_key: 'logo_url',
          setting_value: publicUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (updateError) throw updateError;

      toast({ title: "Logo uploaded successfully" });

      // Invalidate system settings to refetch logo URL
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (accept .ico, .png, .svg)
    const validTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file",
        description: "Please select a valid favicon file (.ico, .png, or .svg)",
        variant: "destructive",
      });
      return;
    }

    setUploadingFavicon(true);

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `favicon.${fileExt}`;
      const filePath = `system/${fileName}`;

      // Remove old favicon if exists
      await supabase.storage.from('public').remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      // Update system settings
      const { error: updateError } = await (supabase as any)
        .from('system_settings')
        .upsert({
          setting_key: 'favicon_url',
          setting_value: publicUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (updateError) throw updateError;

      toast({
        title: "Favicon uploaded successfully",
        description: "Please refresh the page to see the new favicon"
      });

      // Invalidate system settings to refetch favicon URL
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });

      // Reset file input
      if (faviconInputRef.current) {
        faviconInputRef.current.value = '';
      }

      // Update the favicon in the document
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = publicUrl;
      document.getElementsByTagName('head')[0].appendChild(link);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleBillplzUpdate = async () => {
    if (!billplzApiKey || !billplzCollectionId) {
      toast({
        title: "Missing information",
        description: "Please provide both API Key and Collection ID",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update both settings
      await (supabase as any).rpc('upsert_system_setting', {
        p_key: 'billplz_api_key',
        p_value: billplzApiKey
      });

      await (supabase as any).rpc('upsert_system_setting', {
        p_key: 'billplz_collection_id',
        p_value: billplzCollectionId
      });

      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast({ title: "Billplz configuration updated successfully" });
      setBillplzApiKey("");
      setBillplzCollectionId("");
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCustomerSegmentToggle = async (enabled: boolean) => {
    try {
      await (supabase as any).rpc('upsert_system_setting', {
        p_key: 'customer_segment_enabled',
        p_value: enabled.toString()
      });

      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["customer-segment-enabled"] });

      toast({
        title: enabled ? "Customer segment enabled" : "Customer segment disabled",
        description: enabled
          ? "Customer features are now visible across all roles"
          : "Customer features are now hidden across all roles"
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStorehubUpdate = async () => {
    if (!storehubUsername || !storehubPassword) {
      toast({
        title: "Missing information",
        description: "Please provide both Username and Password",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          storehub_username: storehubUsername,
          storehub_password: storehubPassword,
        })
        .eq("id", user?.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Storehub credentials updated successfully" });
      setStorehubUsername("");
      setStorehubPassword("");
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleNinjavanUpdate = async () => {
    // Validate required fields
    if (!ninjavanClientId || !ninjavanClientSecret || !ninjavanSenderName ||
        !ninjavanSenderPhone || !ninjavanSenderEmail || !ninjavanSenderAddress ||
        !ninjavanSenderPostcode || !ninjavanSenderCity || !ninjavanSenderState) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSavingNinjavan(true);

    try {
      const configData = {
        profile_id: user?.id,
        client_id: ninjavanClientId,
        client_secret: ninjavanClientSecret,
        sender_name: ninjavanSenderName,
        sender_phone: ninjavanSenderPhone,
        sender_email: ninjavanSenderEmail,
        sender_address1: ninjavanSenderAddress,
        sender_postcode: ninjavanSenderPostcode,
        sender_city: ninjavanSenderCity,
        sender_state: ninjavanSenderState,
        updated_at: new Date().toISOString(),
      };

      if (ninjavanConfig?.id) {
        // Update existing config
        const { error } = await (supabase as any)
          .from("ninjavan_config")
          .update(configData)
          .eq("id", ninjavanConfig.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await (supabase as any)
          .from("ninjavan_config")
          .insert([configData]);

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["ninjavan-config"] });
      toast({ title: "NinjaVan configuration saved successfully" });

      // Clear form fields
      setNinjavanClientId("");
      setNinjavanClientSecret("");
      setNinjavanSenderName("");
      setNinjavanSenderPhone("");
      setNinjavanSenderEmail("");
      setNinjavanSenderAddress("");
      setNinjavanSenderPostcode("");
      setNinjavanSenderCity("");
      setNinjavanSenderState("");
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingNinjavan(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {userRole === 'hq' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>System Logo</CardTitle>
              <CardDescription>Upload a logo to display on the login page</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemSettings?.logoUrl && (
                  <div className="space-y-2">
                    <Label>Current Logo</Label>
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <img
                        src={`${systemSettings.logoUrl}?v=${Date.now()}`}
                        alt="Current logo"
                        className="max-h-32 object-contain"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="logo">Upload New Logo</Label>
                  <Input
                    ref={fileInputRef}
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                </div>
                {uploadingLogo && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading logo...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Favicon</CardTitle>
              <CardDescription>Upload a favicon to display in browser tabs (.ico, .png, or .svg)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemSettings?.faviconUrl && (
                  <div className="space-y-2">
                    <Label>Current Favicon</Label>
                    <div className="p-4 border rounded-lg bg-muted/50 flex items-center gap-3">
                      <img
                        src={`${systemSettings.faviconUrl}?v=${Date.now()}`}
                        alt="Current favicon"
                        className="w-8 h-8"
                      />
                      <span className="text-sm text-muted-foreground">Favicon is active</span>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="favicon">Upload New Favicon</Label>
                  <Input
                    ref={faviconInputRef}
                    id="favicon"
                    type="file"
                    accept=".ico,.png,.svg,image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml"
                    onChange={handleFaviconUpload}
                    disabled={uploadingFavicon}
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 32x32 or 16x16 pixels. Supports .ico, .png, and .svg formats.
                  </p>
                </div>
                {uploadingFavicon && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading favicon...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billplz Payment Gateway</CardTitle>
              <CardDescription>Configure Billplz for payment processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {billplzConfig && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  <p className="font-medium">Current Configuration:</p>
                  <p className="text-muted-foreground">API Key: {billplzConfig.apiKey ? '••••••••' : 'Not set'}</p>
                  <p className="text-muted-foreground">Collection ID: {billplzConfig.collectionId || 'Not set'}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="billplz_api_key">Billplz API Key</Label>
                <Input
                  id="billplz_api_key"
                  type="password"
                  value={billplzApiKey}
                  onChange={(e) => setBillplzApiKey(e.target.value)}
                  placeholder="Enter Billplz API Key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billplz_collection_id">Billplz Collection ID</Label>
                <Input
                  id="billplz_collection_id"
                  type="text"
                  value={billplzCollectionId}
                  onChange={(e) => setBillplzCollectionId(e.target.value)}
                  placeholder="Enter Collection ID (e.g., watojri1)"
                />
              </div>

              <Button onClick={handleBillplzUpdate}>
                Save Billplz Configuration
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Segment</CardTitle>
              <CardDescription>
                Enable or disable customer-related features across all roles (HQ, Master Agent, Agent)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="customer-segment-toggle" className="text-base">
                    Customer Features
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {systemSettings?.customerSegmentEnabled
                      ? "Customer features are visible in all dashboards and sidebars"
                      : "Customer features are hidden across the platform"}
                  </p>
                </div>
                <Switch
                  id="customer-segment-toggle"
                  checked={systemSettings?.customerSegmentEnabled ?? true}
                  onCheckedChange={handleCustomerSegmentToggle}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {userRole === 'branch' && (
        <>
        <Card>
          <CardHeader>
            <CardTitle>Storehub API Integration</CardTitle>
            <CardDescription>Configure your Storehub API credentials for POS integration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium">Current Configuration:</p>
                <p className="text-muted-foreground">Username: {profile.storehub_username || 'Not set'}</p>
                <p className="text-muted-foreground">Password: {profile.storehub_password ? '••••••••' : 'Not set'}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="storehub_username">Storehub Username</Label>
              <Input
                id="storehub_username"
                type="text"
                value={storehubUsername}
                onChange={(e) => setStorehubUsername(e.target.value)}
                placeholder="Enter Storehub Username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storehub_password">Storehub Password</Label>
              <Input
                id="storehub_password"
                type="password"
                value={storehubPassword}
                onChange={(e) => setStorehubPassword(e.target.value)}
                placeholder="Enter Storehub Password"
              />
            </div>

            <Button onClick={handleStorehubUpdate}>
              Save Storehub Configuration
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>NinjaVan Courier Integration</CardTitle>
                <CardDescription>Configure NinjaVan API for automatic tracking number generation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {ninjavanConfig && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium">Current Configuration:</p>
                <p className="text-muted-foreground">Client ID: {ninjavanConfig.client_id ? '••••••••' : 'Not set'}</p>
                <p className="text-muted-foreground">Sender: {ninjavanConfig.sender_name || 'Not set'}</p>
                <p className="text-muted-foreground">Address: {ninjavanConfig.sender_address1 ? `${ninjavanConfig.sender_city}, ${ninjavanConfig.sender_state}` : 'Not set'}</p>
              </div>
            )}

            {/* API Credentials */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">API Credentials</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ninjavan_client_id">Client ID *</Label>
                  <Input
                    id="ninjavan_client_id"
                    type="password"
                    value={ninjavanClientId}
                    onChange={(e) => setNinjavanClientId(e.target.value)}
                    placeholder="Enter NinjaVan Client ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ninjavan_client_secret">Client Secret *</Label>
                  <Input
                    id="ninjavan_client_secret"
                    type="password"
                    value={ninjavanClientSecret}
                    onChange={(e) => setNinjavanClientSecret(e.target.value)}
                    placeholder="Enter NinjaVan Client Secret"
                  />
                </div>
              </div>
            </div>

            {/* Sender Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Sender Information (From)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ninjavan_sender_name">Sender Name *</Label>
                  <Input
                    id="ninjavan_sender_name"
                    value={ninjavanSenderName}
                    onChange={(e) => setNinjavanSenderName(e.target.value)}
                    placeholder="e.g. My Company Sdn. Bhd."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ninjavan_sender_phone">Sender Phone *</Label>
                  <Input
                    id="ninjavan_sender_phone"
                    value={ninjavanSenderPhone}
                    onChange={(e) => setNinjavanSenderPhone(e.target.value)}
                    placeholder="e.g. 60123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ninjavan_sender_email">Sender Email *</Label>
                  <Input
                    id="ninjavan_sender_email"
                    type="email"
                    value={ninjavanSenderEmail}
                    onChange={(e) => setNinjavanSenderEmail(e.target.value)}
                    placeholder="e.g. shipping@company.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ninjavan_sender_address">Address *</Label>
                <Textarea
                  id="ninjavan_sender_address"
                  value={ninjavanSenderAddress}
                  onChange={(e) => setNinjavanSenderAddress(e.target.value)}
                  placeholder="Enter pickup address (max 100 characters)"
                  rows={2}
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ninjavan_sender_postcode">Postcode *</Label>
                  <Input
                    id="ninjavan_sender_postcode"
                    value={ninjavanSenderPostcode}
                    onChange={(e) => setNinjavanSenderPostcode(e.target.value)}
                    placeholder="e.g. 50000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ninjavan_sender_city">City *</Label>
                  <Input
                    id="ninjavan_sender_city"
                    value={ninjavanSenderCity}
                    onChange={(e) => setNinjavanSenderCity(e.target.value)}
                    placeholder="e.g. Kuala Lumpur"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ninjavan_sender_state">State *</Label>
                  <Select
                    value={ninjavanSenderState}
                    onValueChange={setNinjavanSenderState}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {MALAYSIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button onClick={handleNinjavanUpdate} disabled={savingNinjavan}>
              {savingNinjavan && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save NinjaVan Configuration
            </Button>
          </CardContent>
        </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contact & Delivery Information</CardTitle>
          <CardDescription>Update your contact details and delivery address</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                name="phone_number"
                type="tel"
                defaultValue={profile?.phone_number || ""}
                placeholder="e.g., 60123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
              <Input
                id="whatsapp_number"
                name="whatsapp_number"
                type="tel"
                defaultValue={profile?.whatsapp_number || ""}
                placeholder="e.g., 60123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_address">Delivery Address</Label>
              <Textarea
                id="delivery_address"
                name="delivery_address"
                rows={4}
                defaultValue={profile?.delivery_address || ""}
                placeholder="Enter your complete delivery address"
              />
            </div>

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Contact Information
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">New Password</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min. 6 characters)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <Button onClick={handlePasswordUpdate} disabled={updatePassword.isPending}>
            {updatePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
