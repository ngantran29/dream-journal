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
 