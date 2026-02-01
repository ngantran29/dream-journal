import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useEntries } from "../hooks/useEntries";
import EntryList from "../components/entries/EntryList";

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    entries,
    loading,
    error,
    deleteEntry,
    toggleReaction,
    addComment,
    deleteComment,
    updateEntry,
  } = useEntries();

  const userEntries = useMemo(() => {
    if (!userId) return [];
    return entries
      .filter((e) => e.user_id === userId)
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
  }, [entries, userId]);

  const stats = useMemo(() => {
    const entryCount = userEntries.length;
    const likes = userEntries.reduce(
      (sum, e) => sum + (e.love_count || 0),
      0
    );
    const comments = userEntries.reduce(
      (sum, e) => sum + (e.comments?.length || 0),
      0
    );

    return { entryCount, likes, comments };
  }, [userEntries]);

  const handleBack = () => navigate("/");

  const avatarUrl = userEntries[0]?.avatar_url;
  const username = userEntries[0]?.username || "User";

  return (
    <div className="app-container">
      {/* Header */}
      <header className="text-center mb-6">
        <button
          onClick={handleBack}
          className="mb-4 text-sm text-blue-500 hover:underline"
        >
          ← Back to Home
        </button>

        <div className="flex flex-col items-center gap-4">
          <img
            src={
              avatarUrl ||
              "https://jeggqdlnxakucuwlbchz.supabase.co/storage/v1/object/public/user-images/level1.jpeg"
            }
            alt="Avatar"
            className="w-32 h-32 rounded-full object-cover"
          />
          <h1 className="text-xl font-bold">{username}</h1>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mt-4 text-sm">
          <div className="text-center">
            <div className="font-bold text-lg">{stats.entryCount}</div>
            <div className="text-gray-600">Entries</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{stats.likes}</div>
            <div className="text-gray-600">Likes</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{stats.comments}</div>
            <div className="text-gray-600">Comments</div>
          </div>
        </div>
      </header>

      {/* Entries */}
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

      {!loading && !error && userEntries.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">This user has no entries yet.</p>
        </div>
      )}

      <EntryList
        entries={userEntries}
        userId={user?.id || null}
        loading={loading}
        error={error}
        onDelete={deleteEntry}
        onToggleReaction={toggleReaction}
        onAddComment={addComment}
        onDeleteComment={deleteComment}
        onUpdateEntry={updateEntry}
        onViewUserProfile={() => {}}
      />
    </div>
  );
}
