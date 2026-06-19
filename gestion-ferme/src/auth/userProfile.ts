import { supabase } from "../supabaseClient";

export type UserRole = "admin" | "user";

export type UserProfile = {
  user_id: string;
  username: string;
  display_name: string | null;
  role: UserRole;
  is_active: boolean;
};

export async function chargerProfilUtilisateur(
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("app_profiles")
    .select("user_id, username, display_name, role, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Profil utilisateur indisponible :", error.message);
    return null;
  }

  return data as UserProfile | null;
}
