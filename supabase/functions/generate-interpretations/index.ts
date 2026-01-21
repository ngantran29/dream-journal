import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { GoogleGenerativeAI, SchemaType } from "npm:@google/generative-ai@0.21.0";

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
    const { entryText } = await req.json();

    if (!entryText) {
      return new Response(
        JSON.stringify({ error: "Entry text is required" }),
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

    const schema = {
      description: "Interpretation and tags for a journal entry",
      type: SchemaType.OBJECT,
      properties: {
        interpretation: {
          type: SchemaType.STRING,
          description: "In 1 sentence, analyze this dream using down-to-earth language. In 1-2 sentence, provide relevant advice for Life and/or Career and/or Health and/or Relationship",
        },
        tags: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "A list of 3-5 relevant tags.",
        },
      },
      required: ["interpretation", "tags"],
    };

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const prompt = `Analyze the following dream and provide a thoughtful interpretation and relevant tags: "${entryText}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
 