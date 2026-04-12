import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Rate limit: 10 generations per user per day ---
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Rate limit ---
    const today = new Date().toISOString().slice(0, 10);
    const DAILY_LIMIT = 10;
    const fnName = "generate-text";

    const { data: existing } = await supabaseAdmin
      .from("generation_usage")
      .select("count")
      .eq("user_id", user.id)
      .eq("function_name", fnName)
      .eq("usage_date", today)
      .maybeSingle();

    const currentCount = existing?.count ?? 0;

    if (currentCount >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: `Daily limit of ${DAILY_LIMIT} text generations reached. Try again tomorrow.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabaseAdmin
      .from("generation_usage")
      .upsert(
        { user_id: user.id, function_name: fnName, usage_date: today, count: currentCount + 1 },
        { onConflict: "user_id,function_name,usage_date" }
      );
    // --- End rate limit ---

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(
      Deno.env.get("GEMINI_API_KEY")!
    );

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    // Generate text
    const result = await model.generateContent(prompt);
    const response = await result.response;

    const text =
      response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join("") || "";

    if (!text) {
      throw new Error("No text returned from Gemini");
    }

    return new Response(
      JSON.stringify({
        success: true,
        text,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Text Generation Error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
 