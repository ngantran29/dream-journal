import { useState } from "react";
import type { Entry } from "../../hooks/useEntries";

type Props = {
  entry: Entry;
  userId: string | null;
  onToggleReaction?: (
    entryId: string, 
    reactionType: "love" | "hate", 
    userId: string
  ) => Promise<{ success: boolean; error: { message: string } | null }>;
};

export default function EntryActions({ entry, userId, onToggleReaction }: Props) {
  const [isReacting, setIsReacting] = useState<"love" | "hate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReaction(type: "love" | "hate") {
    if (!userId) {
      setError("Sign in to react");
      return;
    }

    if (!onToggleReaction) {
      setError("Reaction feature not available");
      return;
    }

    setIsReacting(type);
    setError(null);

    const result = await onToggleReaction(entry.id, type, userId);

    setIsReacting(null);

    if (result.error) {
      setError(result.error.message);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleReaction("love")}
          disabled={isReacting !== null}
          className="flex items-center gap-2 px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={userId ? "Love this entry" : "Sign in to react"}
        >
          <span className="text-xl">🤍</span>
          <span className="font-semibold">{entry.love_count}</span>
          {isReacting === "love" && (
            <span className="text-xs text-gray-400 ml-1">...</span>
          )}
        </button>

        <button
          onClick={() => handleReaction("hate")}
          disabled={isReacting !== null}
          className="flex items-center gap-2 px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={userId ? "Dislike this entry" : "Sign in to react"}
        >
          <span className="text-xl">👎</span>
          <span className="font-semibold">{entry.hate_count}</span>
          {isReacting === "hate" && (
            <span className="text-xs text-gray-400 ml-1">...</span>
          )}
        </button>
      </div>

      {/* Helper text for non-logged-in users */}
      {!userId && (
        <p className="text-xs text-gray-500 italic">
          Sign in to react to entries
        </p>
      )}
    </div>
  );
}