import EntryCard from "./EntryCard";
import type { Entry, Comment } from "../../hooks/useEntries";

type EntryListProps = {
  entries: Entry[];
  userId: string | null;
  loading?: boolean;
  error?: { message: string } | null;
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

export default function EntryList({ 
  entries, 
  userId, 
  loading,
  error,
  onUpdateEntry,
  onDelete,
  onToggleReaction,
  onAddComment,
  onDeleteComment
}: EntryListProps) {
  // Loading state
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="text-gray-500 mt-4">Loading entries...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <p className="font-bold">Error loading entries</p>
        <p>{error.message}</p>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✨</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No entries yet
        </h3>
        <p className="text-gray-500">
          {userId 
            ? "Share your first dream with the world!" 
            : "Sign in to create and share your dreams"
          }
        </p>
      </div>
    );
  }

  // List of entries
  return (
    <ul className="space-y-0">
      {entries.map((entry: Entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          userId={userId}
          onDelete={onDelete}
          onToggleReaction={onToggleReaction}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          onUpdateEntry={onUpdateEntry}
        />
      ))}
    </ul>
  );
}