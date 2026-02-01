import React, { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useEntries } from "../hooks/useEntries";
import EntryList from "../components/entries/EntryList";
import ImageUploadArea from "../components/ImageUploadArea";
import PromptInput from "../components/PromptInput";
import { signInWithGoogle, signOut } from "../integrations/supabase/auth";
import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";
import { EmojiPicker } from "@ferrucc-io/emoji-picker";
import { useNavigate } from "react-router-dom";

type FilterBy = "all" | "date" | "reactions" | "tags" ;

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

    // Navigation state
    const navigate = useNavigate();

    const handleViewUserProfile = (userId: string) => {
      // Instead of setting state, we change the URL
      navigate(`/profile/${userId}`);
    };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current ?? inputRef.current;
    if (!el) return;
  
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
  
    setText((prev) => {
      const newText =
        prev.slice(0, start) + emoji + prev.slice(end);
  
      // Restore cursor position after state update
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + emoji.length;
      });
  
      return newText;
    });
  
    setShowEmojiPicker(false);
  };
    // --- Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Pagination state
  const [showAll, setShowAll] = useState(false);
  const ENTRIES_PER_PAGE = 5;

  // --- Filter state
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [minReactions, setMinReactions] = useState(0);

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

  // Get unique values for filter options
  const uniqueDates = useMemo(() => {
    const dates = entries.map(e => e.date).filter(Boolean);
    return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const uniqueTags = useMemo(() => {
    const tags = entries.flatMap(e => e.tags || []);
    return [...new Set(tags)].sort();
  }, [entries]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let result = [...entries];
    
    switch (filterBy) {
      case "date":
        if (selectedDate) {
          result = result.filter(e => e.date === selectedDate);
        }
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      
      case "reactions":
        result = result.filter(e => (e.love_count || 0) >= minReactions);
        result.sort((a, b) => (b.love_count || 0) - (a.love_count || 0));
        break;
      
      case "tags":
        if (selectedTag) {
          result = result.filter(e => e.tags?.includes(selectedTag));
        }
        result.sort((a, b) => (b.tags?.length || 0) - (a.tags?.length || 0));
        break;
      
      case "all":
      default:
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
    }
    
    return result;
  }, [entries, filterBy, selectedDate, selectedTag, minReactions]);

  // Get entries to display based on showAll state
  const displayedEntries = showAll ? filteredEntries : filteredEntries.slice(0, ENTRIES_PER_PAGE);
  const hasMoreEntries = filteredEntries.length > ENTRIES_PER_PAGE;

  // Reset filters when changing filter type
  const handleFilterChange = (newFilter: FilterBy) => {
    setFilterBy(newFilter);
    setShowAll(false);
    setSelectedDate("");
    setSelectedTag("");
    setMinReactions(0);
  };

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
        
        <p className="text-center overflow-mb-6">
        AI-visualize your dream journal, reveal deep insights, share the learnings and inspirations.
        </p>

        <h2 className="mb-6 overflow-mb-6 p-2 w-full">Generate Your Ideas</h2>

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
        <div className="flex flex-col sm:flex-row gap-2 w-full font-bold text-blue-400">
          <button
            onClick={handleGenerateImage}
            disabled={isGenerating || isUploadingImages}
            className="flex-1 px-4 py-2 font-bold text-blue-400 rounded text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "rgb(81 162 255)" }}
          >
            {isGenerating ? "✨ Generating..." : "✨ Generate Image"}
          </button>
          <button
            onClick={handleGenerateText}
            disabled={isGenerating || isUploadingImages}
            className="flex-1 px-4 py-2 font-bold text-blue-400 rounded text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "rgb(81 162 255)" }}
          >
            {isGenerating ? "✨ Generating..." : "✨ Generate Text"}
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
        <h2 className="mb-6 overflow-mb-6 p-2 w-full">Publish New Entry</h2>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full p-3 border rounded focus:outline-none focus:ring focus:ring-blue-200 resize-y mb-3"
          disabled={isCreating}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Content"
          className="w-full p-3 border rounded focus:outline-none focus:ring focus:ring-blue-200 min-h-[120px] resize-y mb-3"
          disabled={isCreating}
        />
        <div
          ref={containerRef}
          className="flex justify-between gap-2 relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className="auto px-3 py-2 rounded hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isCreating}
            title="Add emoji"
          >
            😊
          </button>

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-2 z-50 w-80 max-w-full shadow-lg rounded-lg">
              <EmojiPicker onEmojiSelect={insertEmoji}>
                <EmojiPicker.Header>
                  <EmojiPicker.Input placeholder="Search emoji" hideIcon />
                </EmojiPicker.Header>
                <EmojiPicker.Group>
                  <EmojiPicker.List containerHeight={200} />
                </EmojiPicker.Group>
              </EmojiPicker>
            </div>
          )}

          <button
            type="submit"
            className="px-4 py-2 font-bold rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isCreating || !user}
          >
            {isCreating ? "Publishing..." : "Publish Entry and Generate Interpretation"}
          </button>
        </div>


      </form>

      {/* Navigation Tabs with Filters */}
      <h2 className="mb-6 overflow-mb-6 p-2 w-full">Explore New Inspirations</h2>
      <div className="mb-6 border border-gray-300 rounded-lg overflow-mb-6 p-6 w-full border-b border-neutral-700 gap-4">
        {/* Tabs */}
        <div className="flex">
          <button
            onClick={() => handleFilterChange("all")}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              filterBy === "all"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Newest
          </button>
          <button
            onClick={() => handleFilterChange("date")}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              filterBy === "date"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Date
          </button>
          <button
            onClick={() => handleFilterChange("reactions")}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              filterBy === "reactions"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Likes
          </button>
          <button
            onClick={() => handleFilterChange("tags")}
            className={`flex-1 px-4 py-3 font-medium transition-colors ${
              filterBy === "tags"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Tags
          </button>
        </div>

        {/* Filter Options */}
        {filterBy !== "all" && (
          <div className="p-4">
            {filterBy === "date" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Select Date:
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="p-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                >
                  <option value="">All Dates</option>
                  {uniqueDates.map(date => (
                    <option key={date} value={date}>
                      {new Date(date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filterBy === "reactions" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Minimum Reactions: {minReactions}
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={minReactions}
                  onChange={(e) => setMinReactions(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            {filterBy === "tags" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Select Tag:
                </label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="p-2 border rounded focus:outline-none focus:ring focus:ring-blue-200"
                >
                  <option value="">All Tags</option>
                  {uniqueTags.map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Results Count */}
        <div className="px-4 py-2 text-sm text-gray-600">
          Showing {displayedEntries.length} of {filteredEntries.length} entries
        </div>
      </div>

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

      {!loading && !error && filteredEntries.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            {filterBy === "all" 
              ? "No entries yet. Create the first one!"
              : "No entries match the current filter."}
          </p>
        </div>
      )}

      <EntryList
        entries={displayedEntries}
        userId={user?.id || null}
        loading={loading}
        error={error}
        onDelete={deleteEntry}
        onToggleReaction={toggleReaction}
        onAddComment={addComment}
        onDeleteComment={deleteComment}
        onUpdateEntry={updateEntry}
        onViewUserProfile={handleViewUserProfile}
      />

      {/* See More / Show Less Button */}
      {!loading && !error && hasMoreEntries && (
        <div className="text-center py-6">
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-6 py-3 rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
          >
            {showAll ? "Show Less" : `See More (${filteredEntries.length - ENTRIES_PER_PAGE} more)`}
          </button>
        </div>
      )}
    </div>
  );
}