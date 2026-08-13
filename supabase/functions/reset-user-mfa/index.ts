import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const { userId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.auth.admin.mfa.listFactors({
      userId,
    });

    if (error) throw error;

    for (const factor of data.factors) {
      await supabase.auth.admin.mfa.deleteFactor({
        userId,
        id: factor.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
    // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message,
      }),
      {
        status: 400,
      },
    );
  }
});
