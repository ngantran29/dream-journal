import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
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

export default function EntriesView() {
  const { user } = useAuth();
  const {
    entries,
    loading,
    error,
    hasMore,
    fetchEntries,
    fetchMore,
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

  // --- Summary Box state
  const [summaryTab, setSummaryTab] = useState<"tags" | "calendar" | "latest">("latest");
  const [allTagsList, setAllTagsList] = useState<string[]>([]);
  const [totalTagCount, setTotalTagCount] = useState(0);
  const [entryDates, setEntryDates] = useState<string[]>([]);
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const TOP_TAGS = 10;
  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // --- Entry form state
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "friends">("public");
  const [isCreating, setIsCreating] = useState(false);

  // --- AI Generator state
  const [prompt, setPrompt] = useState("");
  const [_selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Fetch all entry dates + tags from DB (no user filter)
  useEffect(() => {
    async function fetchMeta() {
      const { data } = await supabase.from("entries").select("date, tags");
      const rows = data || [];
      setEntryDates(rows.map((r) => r.date).filter(Boolean));
      const allTags = rows.flatMap((r) => r.tags || []);
      setAllTagsList(allTags);
      setTotalTagCount(new Set(allTags).size);
    }
    fetchMeta();
  }, []);

  const tagStats = useMemo(() => {
    const map: Record<string, number> = {};
    allTagsList.forEach((tag) => { map[tag] = (map[tag] || 0) + 1; });
    return Object.entries(map).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  }, [allTagsList]);

  const entryDateSet = useMemo(() => new Set(entryDates), [entryDates]);

  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return { year, month, days };
  }, [calMonth]);

  function toDateStr(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function prevMonth() { setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  const [visibilityFilter, setVisibilityFilter] = useState<"" | "public" | "private" | "friends">("");

  function handleSummaryTab(tab: "tags" | "calendar" | "latest") {
    setSummaryTab(tab);
    if (tab === "latest") {
      setActiveTag(null);
      fetchEntries(true, { filterBy: "all", selectedDate: "", selectedTag: "", visibility: "" });
      setVisibilityFilter("");
    }
  }

  function handleVisibilityFilter(v: "" | "public" | "private" | "friends") {
    setVisibilityFilter(v);
    fetchEntries(true, { filterBy: "all", selectedDate: "", selectedTag: "", visibility: v });
  }

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
      tags: [],
      visibility,
    });

    setIsCreating(false);

    if (result.data) {
      // Reset form
      setTitle("");
      setText("");
      setVisibility("public");
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

      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt, imageUrls: uploadedImageUrls || [] },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      console.log("Full response:", data);

      setGeneratedImage(data.imageUrl);
      toast.success("Image generated!");
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Failed to generate image";
      try { const body = await err?.context?.json?.(); if (body?.error) msg = body.error; } catch {}
      toast.error(msg);
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

      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-text", {
        body: { prompt },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGeneratedText(data.text);
      toast.success("Text generated!");
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Failed to generate text";
      try { const body = await err?.context?.json?.(); if (body?.error) msg = body.error; } catch {}
      toast.error(msg);
      setGeneratedText(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="text-center">
        <div className="flex justify-center items-center gap-4">
          <img 
            src="https://jeggqdlnxakucuwlbchz.supabase.co/storage/v1/object/public/user-images/ChatGPT%20Image%20Jan%2017,%202026%20at%2010_44_41%20PM.png" 
            alt="Logo" 
            className="w-40 h-40 rounded-full object-cover" 
          /> 
        </div>
        <h1 className="text-center overflow-mb-6">
        Dream - Visualize - Interpret - Connect
        </h1>

        <p className="text-lg">Your dream journal with AI-visualization and deep insights interpretation. Share the learnings and inspirations with others.</p>
        

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
              onClick={() => navigate(`/profile/${user.id}`)}
              className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              View Profile
            </button>
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
      <div className="p-6 border-b border-neutral-700 shadow-sm w-full flex flex-col gap-4">
        

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
        
        <div
          ref={containerRef}
          className="flex justify-between gap-2 relative">

          {/* Visibility selector */}
          <div className="flex rounded-lg overflow-hidden w-full">
            {(["public", "friends", "private"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  visibility === v
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {v === "public" ? "Public" : v === "friends" ? "Friends" : "Private"}
              </button>
            ))}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Content"
          className="w-full p-3 border rounded focus:outline-none focus:ring focus:ring-blue-200 min-h-[120px] resize-y mb-3 mt-3"
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
            className="flex-1 px-4 py-2 font-bold text-blue-400 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "rgb(81 162 255)" }}
            disabled={isCreating || !user}
          >
            {isCreating ? "Publishing..." : "✨ Publish Entry and Generate Interpretation"}
          </button>
        </div>


      </form>

      {/* Profile Summary Box */}
      <h2 className="mb-3 p-2 w-full">Explore New Inspirations</h2>
      <div className="mb-6 rounded-xl border-b border-neutral-700 overflow-hidden w-full">
        {/* Tab bar */}
        <div className="flex">
          {(["latest", "tags", "calendar"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleSummaryTab(tab)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                summaryTab === tab
                  ? "bg-neutral-800 text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "tags" ? `Tags (${totalTagCount})` : tab === "calendar" ? "Calendar" : "Latest"}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* Tab: Latest */}
          {summaryTab === "latest" && (
            <div className="flex justify-center py-2">
              <select
                value={visibilityFilter}
                onChange={(e) => handleVisibilityFilter(e.target.value as "" | "public" | "friends" | "private")}
                className="w-160 bg-neutral-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 text-center"
              >
                <option value="">All</option>
                <option value="public">Public</option>
                <option value="friends">Friends</option>
                <option value="private">Private</option>
              </select>
            </div>
          )}

          {/* Tab: Tags */}
          {summaryTab === "tags" && (
            <div className="p-4">
              {tagStats.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-4">No tags yet.</p>
              ) : (
                <>
                  <div className="flex flex-wrap justify-center items-center gap-2">
                    {(showAllTags ? tagStats : tagStats.slice(0, TOP_TAGS)).map(({ tag, count }) => {
                      const fontSize = Math.min(14, 10 + count);
                      const padding = Math.max(16, 12 + count * 4);
                      return (
                        <motion.div
                          key={tag}
                          layout
                          whileHover={{ scale: 1.08 }}
                          onClick={() => {
                            const next = activeTag === tag ? null : tag;
                            setActiveTag(next);
                            if (next) {
                              fetchEntries(true, { filterBy: "tags", selectedTag: next, selectedDate: "" });
                            } else {
                              fetchEntries(true, { filterBy: "all", selectedTag: "", selectedDate: "" });
                            }
                          }}
                          className="rounded-full cursor-pointer flex flex-col items-center justify-center select-none shrink-0"
                          style={{
                            padding,
                            aspectRatio: "1 / 1",
                            minWidth: fontSize * tag.length * 0.65 + padding * 2,
                            opacity: !activeTag || activeTag === tag ? 1 : 0.5,
                            backgroundColor: `hsl(215, 70%, ${Math.max(30, 85 - count * 6)}%)`,
                            color: "#0f172a",
                            outline: activeTag === tag ? "2px solid #3b82f6" : "none",
                          }}
                        >
                          <span className="text-center leading-tight whitespace-nowrap" style={{ fontSize, fontWeight: 600 }}>{tag}</span>
                          <span className="text-[9px] opacity-60">{count}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                  {tagStats.length > TOP_TAGS && (
                    <div className="mt-3 text-center">
                      <button onClick={() => setShowAllTags((v) => !v)} className="text-sm text-blue-400 hover:underline">
                        {showAllTags ? "Show less" : `Show all ${tagStats.length} tags`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab: Calendar */}
          {summaryTab === "calendar" && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4 w-full" style={{ fontSize: 22 }}>
                <button onClick={prevMonth} className="text-gray-400 hover:text-white">‹</button>
                <span style={{ fontSize: 22 }}>{MONTH_NAMES[calendarDays.month]} {calendarDays.year}</span>
                <button onClick={nextMonth} className="text-gray-400 hover:text-white">›</button>
              </div>
              <div className="grid grid-cols-7 mb-2 w-full">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-2 w-full" style={{ fontSize: 22 }}>
                {calendarDays.days.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const dateStr = toDateStr(calendarDays.year, calendarDays.month, day);
                  const hasEntry = entryDateSet.has(dateStr);
                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        if (!hasEntry) return;
                        fetchEntries(true, { filterBy: "date", selectedDate: dateStr, selectedTag: "" });
                      }}
                      className={`text-center rounded-full flex items-center justify-center aspect-square w-full transition-colors ${hasEntry ? "bg-blue-500 text-white font-bold cursor-pointer hover:bg-blue-400" : "text-gray-400"}`}
                      style={{ fontSize: 22 }}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
        onViewUserProfile={handleViewUserProfile}
      />

      {/* Load More Button */}
      {!loading && !error && hasMore && (
        <div className="text-center py-6">
          <button
            onClick={fetchMore}
            className="px-6 py-3 rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
          >
            See More
          </button>
        </div>
      )}
    </div>
  );
}