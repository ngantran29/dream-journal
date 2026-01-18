import { useState } from "react";
import type { Entry, Comment } from "../../hooks/useEntries";
import EntryActions from "./EntryActions";
import CommentList from "../comments/CommentList";

type Props = {
  entry: Entry;
  userId: string | null;
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
  onToggleReaction,
  onAddComment,
  onDeleteComment
}: Props) {
  const [expandedText, setExpandedText] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const textPreview = entry.text.length > 150 && !expandedText
    ? entry.text.slice(0, 150) + "…"
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
            {entry.title}
          </div>
        </div>

        {/* Delete Button */}
        {onDelete && userId === entry.user_id && (
          <button
            className="danger ml-4"
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
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
      {entry.text.length > 150 && (
        <button
          onClick={() => setExpandedText((v) => !v)}
          className="text-blue-500 text-sm mb-3 hover:text-blue-400 transition-colors"
        >
          {expandedText ? "Show Less" : "Read More"}
        </button>
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
    </li>
  );
}