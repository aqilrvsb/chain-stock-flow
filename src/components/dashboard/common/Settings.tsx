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
import { Loader2, Upload } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

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
