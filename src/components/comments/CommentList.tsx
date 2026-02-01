import React, { useState, useRef, useEffect } from "react";
import { EmojiPicker } from "@ferrucc-io/emoji-picker";
import type { Entry, Comment } from "../../hooks/useEntries";

type Props = {
  entry: Entry;
  userId: string | null;
  onAddComment?: (entryId: string, text: string, userId: string) => Promise<{ data: Comment | null; error: { message: string } | null }>;
  onDeleteComment?: (entryId: string, commentId: string) => Promise<{ success: boolean; error: { message: string } | null }>;
};

export default function CommentList({ entry, userId, onAddComment, onDeleteComment }: Props) {
  const [commentText, setCommentText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // --- Add comment handler
  const handleAddComment = async () => {
    if (!commentText.trim()) {
      setError("Comment cannot be empty");
      return;
    }

    if (!userId) {
      setError("You must be logged in to comment");
      return;
    }

    if (!onAddComment) {
      setError("Comment feature not available");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Prefix with @mention if replying
    const finalText = replyingTo 
      ? `@${replyingTo.username} ${commentText}` 
      : commentText;

    const result = await onAddComment(entry.id, finalText, userId);

    setIsSubmitting(false);

    if (result.data) {
      // Success - reset form
      setCommentText("");
      setShowEmojiPicker(false);
      setReplyingTo(null);
    } else if (result.error) {
      setError(result.error.message);
    }
  };

  // --- Delete comment handler
  const handleDeleteComment = async (commentId: string) => {
    if (!onDeleteComment) return;

    const confirmDelete = window.confirm("Are you sure you want to delete this comment?");
    if (!confirmDelete) return;

    const result = await onDeleteComment(entry.id, commentId);

    if (result.error) {
      setError(result.error.message);
    }
  };

  // --- Insert emoji
  const insertEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // --- Handle Enter key to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAddComment();
    }
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

  // Sort comments by date (oldest first)
  const sortedComments = [...entry.comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div ref={containerRef} className="flex flex-col gap-3 w-full relative mt-4">
      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Existing Comments */}
      <div className="space-y-3">
        {sortedComments.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No comments yet. Be the first to comment!</p>
        ) : (
          sortedComments.map((comment) => {
            const commentDate = new Date(comment.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            const isOwner = userId === comment.user_id;

            return (
              <div 
                key={comment.id} 
                className="border-b border-neutral-800 pb-2 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">{comment.username}</span>
                      <span className="text-xs text-gray-500">{commentDate}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
                  </div>

                  {isOwner && onDeleteComment && (
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                      title="Delete comment"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Reply button */}
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(comment);
                    setError(null);
                  }}
                  className="text-blue-500 hover:underline text-xs mt-1"
                >
                  Reply
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* New Comment Input */}
      <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-neutral-700">
        {/* Show replying info if replying */}
        {replyingTo && (
          <div className="text-sm text-gray-400 flex items-center gap-2 bg-neutral-800 px-3 py-2 rounded">
            <span>Replying to <span className="font-bold">{replyingTo.username}</span></span>
            <button
              type="button"
              onClick={() => {
                setReplyingTo(null);
                setError(null);
              }}
              className="ml-auto text-red-400 hover:text-red-300 text-xs"
            >
              Cancel
            </button>
          </div>
        )}

        <textarea
          value={commentText}
          onChange={(e) => {
            setCommentText(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={userId ? "Add a comment... (Ctrl+Enter to post)" : "Sign in to comment"}
          className="w-full p-3 border border-neutral-600 bg-neutral-900 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
          disabled={!userId || isSubmitting}
        />

        {/* Buttons */}
        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!userId || isSubmitting}
            title="Add emoji"
          >
            😊
          </button>

          <button
            onClick={handleAddComment}
            disabled={!userId || isSubmitting || !commentText.trim()}
            className="px-4 py-2 rounded font-bold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Posting..." : "Post Comment"}
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
        </div>

        {!userId && (
          <p className="text-xs text-gray-500 italic">
            You must be signed in to comment
          </p>
        )}
      </div>
    </div>
  );
}