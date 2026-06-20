import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { username, password } = await request.json();
    const normalizedUsername =
      typeof username === "string" ? username.trim().toLowerCase() : "";

    if (
      !/^[a-z0-9._-]{3,40}$/.test(normalizedUsername) ||
      typeof password !== "string" ||
      password.length < 1
    ) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing Supabase function secrets");
      return jsonResponse({ error: "Service unavailable" }, 503);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("app_profiles")
      .select("user_id")
      .eq("username", normalizedUsername)
      .eq("is_active", true)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("username-login: profile lookup failed", {
        hasProfile: Boolean(profile),
        errorCode: profileError?.code || null,
        errorMessage: profileError?.message || null,
      });
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(profile.user_id);
    const email = userData.user?.email;

    if (userError || !email) {
      console.error("username-login: auth user lookup failed", {
        hasEmail: Boolean(email),
        errorMessage: userError?.message || null,
      });
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } =
      await authClient.auth.signInWithPassword({ email, password });

    if (authError || !authData.session) {
      console.error("username-login: password sign-in failed", {
        hasSession: Boolean(authData.session),
        status: authError?.status || null,
        errorCode: authError?.code || null,
        errorMessage: authError?.message || null,
      });
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    return jsonResponse(
      {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
      },
      200
    );
  } catch (error) {
    console.error("username-login error", error);
    return jsonResponse({ error: "Invalid credentials" }, 401);
  }
});
