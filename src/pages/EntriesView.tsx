import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useEntries } from "../hooks/useEntries";
import EntryList from "../components/entries/EntryList";
import ImageUploadArea from "../components/ImageUploadArea";
import PromptInput from "../components/PromptInput";
import { signInWithGoogle, signOut } from "../integrations/supabase/auth";
import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";

export default function EntriesView() {
  const { user } = useAuth();
  const { 
    entries, 
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    toggleReaction,
    addComment,
    deleteComment
  } = useEntries();


  // --- Entry form state
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // --- AI Generator state
  const [prompt, setPrompt] = useState("");
  const [_selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const addTextToTitle = () => {
    if (!generatedText) return;
  
    // Optional: trim & shorten for title
    const cleanText = generatedText.trim().split("\n")[0].slice(0, 100);
  
    setTitle((prev) => (prev ? `${prev} ${cleanText}` : cleanText));
  };
  
  const addTextToContent = () => {
    if (!generatedText) return;
  
    setText((prev) =>
      prev ? `${prev}\n\n${generatedText.trim()}` : generatedText.trim()
    );
  };

  // --- Entry creation
  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!user) {
      toast.error("Please sign in to create an entry");
      return;
    }

    setIsCreating(true);

    // priority: generated image → uploaded preview → none
    const previewImage = generatedImage || uploadedImageUrls[0] || undefined;

    const result = await createEntry({
      user_id: user.id,
      title: title.trim(),
      text: text.trim(),
      date: new Date().toISOString().split("T")[0],
      image_url: previewImage,
      interpretation: "",
      tags: []
    });

    setIsCreating(false);

    if (result.data) {
      // Reset form
      setTitle("");
      setText("");
      setGeneratedImage(null);
      setGeneratedText(null);
      setPrompt("");
      setUploadedImageUrls([]);
      setSelectedImages([]);
      toast.success("Entry published!");
    } else if (result.error) {
      toast.error(result.error.message);
    }
  }

  // --- Image upload
  const uploadImagesToSupabase = async (files: File[]) => {    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const uploads = files.map(async (file) => {
      console.log(file.name, file.size, file.type);
      const fileName = `${crypto.randomUUID()}_${file.name}`;
      const filePath = `${session.user.id}/${fileName}`;
  
      const { error } = await supabase.storage
        .from("user-images")
        .upload(filePath, file, {
          contentType: file.type,
        });
      
      if (error) {
        console.error("Upload error:", error);
        throw error;
      }
  
      const { data } = supabase.storage
        .from("user-images")
        .getPublicUrl(filePath);

      console.log("File path:", filePath);
  
      return data.publicUrl;
    });
  
    return Promise.all(uploads);
  };

  const handleImagesSelected = async (images: File[]) => {
    setSelectedImages(images);
    setIsUploadingImages(true);
    setUploadedImageUrls([]);

    try {
      toast.info("Uploading images...");
  
      const urls = await uploadImagesToSupabase(images);
      setUploadedImageUrls(urls);
  
      toast.success("Images uploaded!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Image upload failed");
    } finally {
      setIsUploadingImages(false);
      console.log("Uploaded files:", images);
    }
  };

  // --- Generate Image
  const handleGenerateImage = async () => {
    if (!prompt.trim()) return toast.error("Please enter a prompt");
    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      toast.info("Generating image...");

      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt, imageUrls: uploadedImageUrls || [] },
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      console.log("Full response:", data);

      setGeneratedImage(data.imageUrl);
      toast.success("Image generated!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Generate Text
  const handleGenerateText = async () => {
    if (!prompt.trim()) return toast.error("Please enter a prompt");
    setIsGenerating(true);
    setGeneratedText(null);

    try {
      toast.info("Generating text...");

      const { data, error } = await supabase.functions.invoke("generate-text", {
        body: { prompt },
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      console.log("Full response:", data);

      setGeneratedText(data.text);
      toast.success("Text generated!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate text");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="text-center mb-6">
        <div className="flex justify-center items-center gap-4">
          <img 
            src="https://jeggqdlnxakucuwlbchz.supabase.co/storage/v1/object/public/user-images/ChatGPT%20Image%20Jan%2017,%202026%20at%2010_44_41%20PM.png" 
            alt="Logo" 
            className="w-40 h-40 rounded-full object-cover" 
          /> 
        </div>
        <h1 className="font-bold text-lg">Dream. Visualize. Interpret. Connect.</h1>

        {!user && (
          <button
            onClick={signInWithGoogle}
            className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
          >
            Sign in with Google
          </button>
        )}
        {user && (
          <div className="flex justify-center items-center gap-4">
            <span className="text-gray-700">Signed in as {user.email}</span>
            <button
              onClick={() => signOut()}
              className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      {/* AI Generator Panel */}
      <div className="mb-6 p-6 border-b border-neutral-700 shadow-sm w-full flex flex-col gap-4">
        <p className="text-small text-lg">
        AI-visualize your stories, reveal deep insights, and share the inspiration.
        </p>

        {/* Image Upload */}
        <div className="w-full border-b border-neutral-700 pb-4">
          <ImageUploadArea onImagesSelected={handleImagesSelected} />
        </div>

        {uploadedImageUrls.length > 0 && (
          <div className="border-b border-gray-200 pb-4 mt-4">
            {uploadedImageUrls.map((url) => (
              <img
                key={url}
                src={url}
                alt="Uploaded"
                className="w-full h-32 object-cover rounded-md border"
              />
            ))}
          </div>
        )}

        {isUploadingImages && (
          <p className="text-sm text-muted-foreground mt-2">
            Uploading images…
          </p>
        )}

        {/* Prompt Input */}
        <div className="w-full">
          <PromptInput 
            value={prompt} 
            onChange={(val) => setPrompt(val)} 
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <button
            onClick={handleGenerateImage}
            disabled={isGenerating || isUploadingImages}
            className="flex-1 px-4 py-2 rounded text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? "Generating..." : "Generate Image"}
          </button>
          <button
            onClick={handleGenerateText}
            disabled={isGenerating || isUploadingImages}
            className="flex-1 px-4 py-2 rounded text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? "Generating..." : "Generate Text"}
          </button>
        </div>

        {/* Generated Preview */}
        {generatedImage && (
          <div className="w-full mt-2">
            <img 
              src={generatedImage} 
              alt="Generated" 
              className="w-full rounded-lg border-2 border-blue-500 shadow-lg"
            />
          </div>
        )}
        
        {generatedText && (
          <>
            <p className="whitespace-pre-wrap">{generatedText}</p>
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button
                onClick={addTextToTitle}
                className="flex-1 px-4 py-2 rounded text-white hover:bg-blue-600"
              >
                Add text to title
              </button>
              <button
                onClick={addTextToContent}
                className="flex-1 px-4 py-2 rounded text-white hover:bg-green-600"
              >
                Add text to content
              </button>
            </div>
          </>
        )}
      </div>

      {/* Entry Form */}
      <form
        onSubmit={handleCreateEntry}
        className="mb-6 p-6 w-full border-b border-neutral-700 gap-4"
      >
        <p className="mb-4">Publish New Entry</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full p-3 border rounded focus:outline-none focus:ring focus:ring-blue-200 resize-y mb-3"
          disabled={isCreating}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Content"
          className="w-full p-3 border rounded focus:outline-none focus:ring focus:ring-blue-200 min-h-[120px] resize-y mb-3"
          disabled={isCreating}
        />
        <button
          type="submit"
          className="w-full px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isCreating || !user}
        >
          {isCreating ? "Publishing..." : "Publish Entry"}
        </button>
      </form>

      {/* Entries List */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error loading entries</p>
          <p>{error.message}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading entries...</p>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No entries yet. Create the first one!</p>
        </div>
      )}

      <EntryList
          entries={entries}
          userId={user?.id || null}
          loading={loading}
          error={error}
          onDelete={deleteEntry}
          onToggleReaction={toggleReaction}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
          onUpdateEntry={updateEntry}
        />
    </div>
  );
}