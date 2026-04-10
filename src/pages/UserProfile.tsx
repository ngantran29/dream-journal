import React, { useMemo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useEntries } from "../hooks/useEntries";
import EntryList from "../components/entries/EntryList";
import { supabase } from "../integrations/supabase/client";

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    entries: userEntries,
    loading,
    error,
    hasMore,
    fetchEntries,
    fetchMore,
    deleteEntry,
    toggleReaction,
    addComment,
    deleteComment,
    updateEntry,
  } = useEntries();

  useEffect(() => {
    if (userId) {
      fetchEntries(true, { filterBy: "all", selectedDate: "", selectedTag: "", userId });
    }
  }, [userId]);

  const [stats, setStats] = useState({ entryCount: 0, likes: 0, comments: 0 });
  const [entryDates, setEntryDates] = useState<string[]>([]);
  const [totalTagCount, setTotalTagCount] = useState(0);
  const [allTagsList, setAllTagsList] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function fetchTotals() {
      const [{ count: entryCount }, { count: comments }, entriesForLikes, entriesForMeta] =
        await Promise.all([
          supabase.from("entries").select("*", { count: "exact", head: true }).eq("user_id", userId!),
          supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId!),
          supabase.from("entry_actions").select("love_count").eq("user_id", userId!),
          supabase.from("entries").select("date, tags").eq("user_id", userId!),
        ]);

      const likes = (entriesForLikes.data || []).reduce((sum, r) => sum + (r.love_count || 0), 0);
      setStats({ entryCount: entryCount ?? 0, likes, comments: comments ?? 0 });

      const rows = entriesForMeta.data || [];
      setEntryDates(rows.map((r) => r.date).filter(Boolean));
      const allTags = rows.flatMap((r) => r.tags || []);
      setAllTagsList(allTags);
      setTotalTagCount(new Set(allTags).size);
    }
    fetchTotals();
  }, [userId]);

  // ── Summary tab state ──────────────────────────────────────────────────────
  const [summaryTab, setSummaryTab] = useState<"tags" | "calendar" | "latest">("tags");

  function handleSummaryTab(tab: "tags" | "calendar" | "latest") {
    setSummaryTab(tab);
    if (tab === "latest") {
      setActiveTag(null);
      fetchEntries(true, { filterBy: "all", selectedDate: "", selectedTag: "", userId: userId! });
    }
  }

  // ── Tag bubble state ───────────────────────────────────────────────────────
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [showAllTags, setShowAllTags] = React.useState(false);
  const TOP_TAGS = 10;

  const tagStats = useMemo(() => {
    const map: Record<string, number> = {};
    allTagsList.forEach((tag) => {
      map[tag] = (map[tag] || 0) + 1;
    });
    return Object.entries(map)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [allTagsList]);


  // ── Calendar state ─────────────────────────────────────────────────────────
  const [calMonth, setCalMonth] = useState(() => new Date());

  const entryDateSet = useMemo(() => new Set(entryDates), [entryDates]);

  function prevMonth() {
    setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return { year, month, days };
  }, [calMonth]);

  function toDateStr(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // ── Misc ───────────────────────────────────────────────────────────────────
  const handleBack = () => navigate("/");
  const avatarUrl = userEntries[0]?.avatar_url;
  const username = userEntries[0]?.username || "User";

  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="text-center mb-6 w-full">
        <button onClick={handleBack} className="mb-4 text-sm text-blue-500 hover:underline">
          ← Back to Home
        </button>

        <div className="flex flex-col items-center gap-4">
          <img
            src={avatarUrl || "https://jeggqdlnxakucuwlbchz.supabase.co/storage/v1/object/public/user-images/level1.jpeg"}
            alt="Avatar"
            className="w-40 h-40 rounded-full object-cover"
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

        {/* ── Profile Summary Box ── */}
        <div className="mt-6 rounded-xl border border-neutral-700 overflow-hidden text-left w-full">
          {/* Tab bar */}
          <div className="flex border-b border-neutral-700">
            {(["tags", "calendar", "latest"] as const).map((tab) => (
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

          {/* ── Tab panels (fixed height) ── */}
          <div className="p-4">

          {/* ── Tab: Tags ── */}
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
                              fetchEntries(true, { filterBy: "tags", selectedTag: next, selectedDate: "", userId: userId! });
                            } else {
                              fetchEntries(true, { filterBy: "all", selectedTag: "", selectedDate: "", userId: userId! });
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
                          <span
                            className="text-center leading-tight whitespace-nowrap"
                            style={{ fontSize, fontWeight: 600 }}
                          >
                            {tag}
                          </span>
                          <span className="text-[9px] opacity-60">{count}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                  {tagStats.length > TOP_TAGS && (
                    <div className="mt-3 text-center">
                      <button
                        onClick={() => setShowAllTags((v) => !v)}
                        className="text-sm text-blue-400 hover:underline"
                      >
                        {showAllTags ? "Show less" : `Show all ${tagStats.length} tags`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Tab: Calendar ── */}
          {summaryTab === "calendar" && (
            <div className="p-5">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4 w-full">
                <button onClick={prevMonth} className="text-gray-400 hover:text-white px-4 text-xl">‹</button>
                <span className="text-base font-semibold">
                  {MONTH_NAMES[calendarDays.month]} {calendarDays.year}
                </span>
                <button onClick={nextMonth} className="text-gray-400 hover:text-white px-4 text-xl">›</button>
              </div>

              {/* Day labels */}
              <div className="grid grid-cols-7 mb-2 w-full">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-2 w-full">
                {calendarDays.days.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const dateStr = toDateStr(calendarDays.year, calendarDays.month, day);
                  const hasEntry = entryDateSet.has(dateStr);
                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        if (!hasEntry) return;
                        fetchEntries(true, { filterBy: "date", selectedDate: dateStr, selectedTag: "", userId: userId! });
                      }}
                      className={`text-center text-sm rounded-full flex items-center justify-center aspect-square w-full transition-colors
                        ${hasEntry
                          ? "bg-blue-500 text-white font-bold cursor-pointer hover:bg-blue-400"
                          : "text-gray-400"
                        }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>

              {entryDates.length === 0 && (
                <p className="text-center text-gray-500 text-sm mt-4">No entries yet.</p>
              )}
            </div>
          )}

          </div>{/* end fixed-height tab panels */}
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
