import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prompt, imageUrls } = body;

    if (!prompt && (!imageUrls || imageUrls.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Provide a prompt or image" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);
    // Using Imagen 3 for high-quality generation
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });
    

    let result;

    if (imageUrls && imageUrls.length > 0) {
      // CASE: Image-to-Image / Editing
      const imageRes = await fetch(imageUrls[0]);
      const imageBlob = await imageRes.blob();
      const base64Data = btoa(
        String.fromCharCode(...new Uint8Array(await imageBlob.arrayBuffer()))
      );

      result = await model.generateContent([
        prompt || "Modify this image",
        {
          inlineData: {
            data: base64Data,
            mimeType: imageBlob.type || "image/png",
          },
        },
      ]);
    } else {
      // CASE: Text-to-Image
      result = await model.generateContent(prompt);
    }

    // Extract the generated image (Gemini returns it as a Part)
    const response = await result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData
    );

    if (!imagePart?.inlineData?.data) {
      throw new Error("Gemini did not return any image data");
    }

    // Convert Base64 string to Uint8Array for Supabase Upload
    const base64String = imagePart.inlineData.data;
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Supabase Upload Logic
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, // Change this to match your env variable
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fileName = `gemini-${Date.now()}-${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(fileName, bytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data } = supabase.storage.from("generated-images").getPublicUrl(fileName);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: data.publicUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Gemini Edge Function Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});