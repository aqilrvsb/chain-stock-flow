import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User, Lock, Eye, EyeOff, Save } from "lucide-react";

const MarketerProfile = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Fetch full profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["marketer-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      if (error) throw error;

      // Initialize form values
      setFullName(data.full_name || "");
      setPhone(data.phone || data.whatsapp_number || "");

      return data;
    },
    enabled: !!user?.id,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone,
          whatsapp_number: phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["marketer-profile"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      // Verify current password
      if (!currentPassword) {
        throw new Error("Current password is required");
      }

      // Check if current password matches
      const { data: profileData } = await supabase
        .from("profiles")
        .select("password_hash")
        .eq("id", user?.id)
        .single();

      if (profileData?.password_hash !== currentPassword.toUpperCase()) {
        throw new Error("Current password is incorrect");
      }

      // Validate new password
      if (newPassword.length < 4) {
        throw new Error("New password must be at least 4 characters");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match");
      }

      // Update password
      const { error } = await supabase
        .from("profiles")
        .update({
          password_hash: newPassword.toUpperCase(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to change password");
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate();
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    changePasswordMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your account settings</p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <Label className="text-muted-foreground">Staff ID</Label>
              <p className="text-lg font-medium">{profile?.idstaff || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Role</Label>
              <p className="text-lg font-medium">Marketer</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <p className={`text-lg font-medium ${profile?.is_active ? "text-green-600" : "text-red-600"}`}>
                {profile?.is_active ? "Active" : "Inactive"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Member Since</Label>
              <p className="text-lg font-medium">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone / WhatsApp</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 60123456789"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Password will be stored in uppercase
            </p>
            <div className="flex justify-end">
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Change Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketerProfile;
