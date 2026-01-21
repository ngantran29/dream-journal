import { useState } from "react";
import type { Entry, Comment } from "../../hooks/useEntries";
import EntryActions from "./EntryActions";
import CommentList from "../comments/CommentList";
import { supabase } from "../../integrations/supabase/client";

type Props = {
  entry: Entry;
  userId: string | null;
  onUpdateEntry?: (id: string, updates: any) => Promise<{success: boolean | null; error: { message: string } | null }>;
  onDelete?: (id: string) => Promise<{ success: boolean; error: { message: string } | null }>;
  onToggleReaction?: (
    entryId: string, 
    reactionType: "love" | "hate", 
    userId: string
  ) => Promise<{ success: boolean; error: { message: string } | null }>;
  onAddComment?: (
    entryId: string, 
    text: string, 
    userId: string
  ) => Promise<{ data: Comment | null; error: { message: string } | null }>;
  onDeleteComment?: (
    entryId: string, 
    commentId: string
  ) => Promise<{ success: boolean; error: { message: string } | null }>;
};

export default function EntryCard({ 
  entry, 
  userId, 
  onDelete,
  onUpdateEntry,
  onToggleReaction,
  onAddComment,
  onDeleteComment
}: Props) {
  const [expandedText, setExpandedText] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(entry.title);
  const [editText, setEditText] = useState(entry.text);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiData, setAiData] = useState<{ interpretation: string; tags: string[] } | null>(
    entry.interpretation ? { interpretation: entry.interpretation, tags: entry.tags || [] } : null
  );
  const [isAiVisible, setIsAiVisible] = useState(false);

  const handleUpdate = async () => {
    if (!onUpdateEntry) {
      console.error("onUpdateEntry is not defined");
      return;
    }
    
    setIsSavingEdit(true);
    
    try {
      const result = await onUpdateEntry(entry.id, {
        title: editTitle,
        text: editText,
      });
      
      // Check if there's an error OR if data is null
      if (result.error) {
        console.error(result.error.message);
        alert(`Failed to update: ${result.error.message}`);
      } else if (result.success) {
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update entry");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleGenerateAI = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-interpretations", {
        body: { entryText: entry.text },
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (error) throw error;
      setAiData(data.data);
    } catch (err) {
      console.error("AI Generation failed:", err);
      alert("Failed to generate AI interpretation.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAI = async () => {
    if (!aiData || !onUpdateEntry) return;
    setIsSaving(true);
    
    await onUpdateEntry(entry.id, {
      interpretation: aiData.interpretation,
      tags: aiData.tags
    });
    
    setIsSaving(false);
    alert("Saved!");
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this entry? This action cannot be undone."
    );
    
    if (!confirmDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    const result = await onDelete(entry.id);
    
    if (!result.success && result.error) {
      setDeleteError(result.error.message);
      setIsDeleting(false);
    }
    // If successful, component will unmount so no need to reset loading state
  };

  // Format date for display
  const formattedDate = new Date(entry.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const textPreview = entry.text.length > 100 && !expandedText
    ? entry.text.slice(0, 100) + "…"
    : entry.text;

  const commentCount = entry.comments?.length ?? 0;

  return (
    <li className="border-b border-neutral-700 p-4 mb-4 shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          {/* User Info */}
          <div className="flex items-center gap-3 mb-2">
            <img 
              src="https://jeggqdlnxakucuwlbchz.supabase.co/storage/v1/object/public/user-images/level2.jpeg" 
              alt={`${entry.username}'s profile`}
              className="w-12 h-12 rounded-full object-cover" 
            /> 
            <div>
              <span className="font-bold text-white-500">{entry.username}</span>
              <div className="text-sm text-gray-400">{formattedDate}</div>
            </div>
          </div>

          {/* Title */}
          <div
            className="font-bold text-lg cursor-pointer hover:text-blue-100 transition-colors"
            onClick={() => setExpandedText((v) => !v)}
          > 
            {/* Title Section (Edit vs View) */}
          {isEditing ? (
            <div className="font-bold text-lg text-white">{entry.title}
            <input 
              className="w-full bg-neutral-800 border border-blue-500 rounded p-2 text-white font-bold mb-2 outline-none"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            /> </div>
          ) : (
            <div className="font-bold text-lg text-white">{entry.title}</div>
          )}
          </div>
        </div>

        {/* Action Buttons (Edit/Delete) */}

        
      {userId === entry.user_id && (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
            >
              {isEditing ? "Close Edit View" : "Edit"}
            </button>
            {!isEditing && onDelete && (
              <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-xs text-gray-400 hover:text-red-400">
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Error Message */}
      {deleteError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-3">
          {deleteError}
        </div>
      )}

      {/* Image */}
      {entry.image_url && (
        <img
          src={entry.image_url}
          alt={`Image for ${entry.title}`}
          className="my-3 rounded-md max-w-full hover:opacity-95 transition-opacity"
        />
      )}

      {/* Entry Text */}
      <p className="mb-2 whitespace-pre-wrap">{textPreview}</p>
      {/* Read more / show less */}
      {entry.text.length > 100 && !isEditing && (
        <button
          type="button"
          onClick={() => setExpandedText((v) => !v)}
          className="text-blue-500 text-sm mb-3 hover:text-blue-400 transition-colors"
        >
          {expandedText ? "Show Less" : "Read More"}
        </button>
      )}

      {/* Edit mode */}
      {isEditing && (
        <div className="space-y-3 mt-3">
          <textarea
            className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-sm text-gray-200 min-h-[150px] outline-none focus:border-blue-500"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isSavingEdit}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded font-bold transition-all disabled:opacity-50"
          >
            {isSavingEdit ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Reactions */}
      <EntryActions 
        entry={entry} 
        userId={userId}
        onToggleReaction={onToggleReaction}
      />

      {/* Toggle Comments Button */}
      <button
        onClick={() => setShowComments((v) => !v)}
        className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors mt-3 mb-2 text-sm"
      >
        {showComments 
          ? "Hide Comments" 
          : `${commentCount === 0 ? "Comment" : `View Comments (${commentCount})`}`
        }
      </button>

      {/* Comments List */}
      {showComments && (
        <CommentList 
          entry={entry} 
          userId={userId} 
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
        />
      )}

{/* AI INSIGHTS SECTION */}
<div className="mt-4 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800/30">
      
      {/* HEADER / TOGGLE BAR */}
      <div 
        className="flex justify-between items-center p-3 cursor-pointer hover:bg-neutral-800/50 transition-colors"
        onClick={() => setIsAiVisible(!isAiVisible)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h4 className="text-xs font-bold text-blue-400 tracking-widest">
            Dream Interpretation
          </h4>
        </div>
        
        <div className="flex items-center gap-3">
          {!aiData && !isAnalyzing && (
            <button 
              onClick={(e) => {
                e.stopPropagation(); // Don't toggle when clicking generate
                handleGenerateAI(); 
                setIsAiVisible(!isAiVisible);
              }}
              className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded shadow-lg transition-all"
            >
              Generate
            </button>
          )}
          {isAnalyzing && <span className="text-[10px] text-blue-400 animate-pulse">Analyzing...</span>}
          <span className={`text-gray-500 transition-transform duration-200 ${isAiVisible ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {/* COLLAPSIBLE CONTENT */}
      {isAiVisible && (
        <div className="p-3 pt-0 border-t border-neutral-800/50 animate-in slide-in-from-top-2 duration-200">
          {!aiData && !isAnalyzing ? (
            <p className="text-xs text-gray-500 italic py-2">
              No analysis generated yet. Click generate to analyze this entry.
            </p>
          ) : aiData ? (
            <div className="space-y-3 mt-3">
              <textarea
                className="w-full bg-neutral-900/50 border border-neutral-700 rounded-md p-2 text-sm text-gray-300 focus:border-blue-500 outline-none"
                value={aiData.interpretation}
                onChange={(e) => setAiData({ ...aiData, interpretation: e.target.value })}
                rows={3}
              />
              
              <div className="flex flex-wrap gap-2">
                {aiData.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] bg-blue-900/20 text-blue-300 px-2 py-0.5 rounded border border-blue-800/50">
                    #{tag}
                  </span>
                ))}
              </div>

              {userId === entry.user_id && (
                <div className="flex justify-end">
                  <button 
                    onClick={handleSaveAI}
                    disabled={isSaving}
                    className="text-[11px] text-green-400 hover:text-green-300 font-medium flex items-center gap-1"
                  >
                    {isSaving ? "Saving..." : "✓ Save to Database"}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
    </li>
  );
}