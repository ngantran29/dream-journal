// src/hooks/useEntries.ts
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../integrations/supabase/client";

// ============================================================================
// TYPES
// ============================================================================

export type Comment = {
  id: string;
  entry_id: string;
  text: string;
  username: string;
  created_at: string;
  user_id: string;
};

export type Entry = {
  id: string;
  title: string;
  text: string;
  date: string;
  username: string;
  created_at: string;
  image_url?: string;
  love_count: number;
  hate_count: number;
  comments: Comment[];
  user_id: string;
  userReaction?: "love" | "hate" | null;
};

type FetchError = {
  message: string;
  code?: string;
};

// Supabase response types - Fixed to match actual response structure
type SupabaseEntryResponse = {
  id: string;
  title: string;
  text: string;
  date: string;
  created_at: string;
  image_url?: string;
  user_id: string;
  users_public: {
    username: string;
  } | null;
  entry_actions: Array<{
    love_count: number | null;
    hate_count: number | null;
    user_id: string;
  }> | null;
  comments: Array<{
    id: string;
    text: string;
    created_at: string;
    user_id: string;
    users_public: {
      username: string;
    } | null;
  }> | null;
};

// ============================================================================
// HOOK
// ============================================================================

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);

  // ==========================================================================
  // FETCH ENTRIES
  // ==========================================================================
  
  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Single optimized query with joins
      const { data: entriesData, error: entriesError } = await supabase
        .from("entries")
        .select(`
          id,
          date,
          title,
          text,
          image_url,
          created_at,
          user_id,
          users_public!inner(username),
          entry_actions(love_count, hate_count),
          comments(
            id,
            text,
            created_at,
            user_id,
            users_public!inner(username)
          )
        `)
        .order("created_at", { ascending: false });

      if (entriesError) throw entriesError;

      // Transform the data with proper typing
      const transformed: Entry[] = (entriesData || []).map((entry: any) => {
        const typedEntry = entry as SupabaseEntryResponse;
        const currentUserId = entry.userId;

        const userAction = typedEntry.entry_actions?.find(
          a => a.user_id === currentUserId
        );

        const userReaction =
          userAction?.love_count === 1
            ? "love"
            : userAction?.hate_count === 1
            ? "hate"
            : null;

        // Aggregate love/hate counts
        const love_count = typedEntry.entry_actions?.reduce(
          (sum, action) => sum + (action.love_count || 0), 
          0
        ) || 0;
        
        const hate_count = typedEntry.entry_actions?.reduce(
          (sum, action) => sum + (action.hate_count || 0), 
          0
        ) || 0;

        // Format comments
        const comments: Comment[] = (typedEntry.comments || [])
          .map(comment => ({
            id: comment.id,
            entry_id: typedEntry.id,
            text: comment.text,
            username: comment.users_public?.username || "Anonymous",
            created_at: comment.created_at,
            user_id: comment.user_id,
          }))
          .sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

        return {
          id: typedEntry.id,
          title: typedEntry.title,
          text: typedEntry.text,
          date: typedEntry.date,
          username: typedEntry.users_public?.username || "Anonymous",
          created_at: typedEntry.created_at,
          image_url: typedEntry.image_url,
          love_count,
          hate_count,
          comments,
          user_id: typedEntry.user_id,
          userReaction,
        };
      });

      setEntries(transformed);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch entries";
      setError({ message: errorMessage });
      console.error("Fetch entries error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ==========================================================================
  // CREATE ENTRY
  // ==========================================================================
  
  const createEntry = useCallback(async (
    entryData: Omit<Entry, "id" | "username" | "created_at" | "love_count" | "hate_count" | "comments">
  ) => {
    try {
      const { data, error } = await supabase
        .from("entries")
        .insert({
          title: entryData.title,
          text: entryData.text,
          date: entryData.date,
          image_url: entryData.image_url,
          user_id: entryData.user_id,
        })
        .select(`
          id,
          date,
          title,
          text,
          image_url,
          created_at,
          user_id,
          users_public!inner(username)
        `)
        .single();

      if (error) throw error;
      if (!data) throw new Error("No data returned from insert");

      // Type the response properly
      const typedData = data as unknown as {
        id: string;
        title: string;
        text: string;
        date: string;
        created_at: string;
        image_url?: string;
        user_id: string;
        users_public: { username: string } | null;
      };

      const newEntry: Entry = {
        id: typedData.id,
        title: typedData.title,
        text: typedData.text,
        date: typedData.date,
        username: typedData.users_public?.username || "Anonymous",
        created_at: typedData.created_at,
        image_url: typedData.image_url,
        love_count: 0,
        hate_count: 0,
        comments: [],
        user_id: typedData.user_id,
      };

      // Optimistic update
      setEntries(prev => [newEntry, ...prev]);
      
      return { data: newEntry, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create entry";
      console.error("Create entry error:", err);
      return { data: null, error: { message: errorMessage } };
    }
  }, []);

  // ==========================================================================
  // UPDATE ENTRY
  // ==========================================================================
  
  const updateEntry = useCallback(async (
    id: string, 
    updates: Partial<Pick<Entry, "title" | "text" | "date" | "image_url">>
  ) => {
    try {
      const { data, error } = await supabase
        .from("entries")
        .update(updates)
        .eq("id", id)
        .select(`
          id,
          date,
          title,
          text,
          image_url,
          created_at,
          user_id,
          users_public!inner(username)
        `)
        .single();

      if (error) throw error;
      if (!data) throw new Error("No data returned from update");

      const typedData = data as unknown as {
        users_public: { username: string } | null;
      };

      // Update local state
      setEntries(prev => prev.map(entry => {
        if (entry.id === id) {
          return {
            ...entry,
            ...updates,
            username: typedData.users_public?.username || entry.username,
          };
        }
        return entry;
      }));

      return { data, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update entry";
      console.error("Update entry error:", err);
      return { data: null, error: { message: errorMessage } };
    }
  }, []);

  // ==========================================================================
  // DELETE ENTRY
  // ==========================================================================
  
  const deleteEntry = useCallback(async (id: string) => {
    // Store for potential rollback
    const previousEntries = [...entries];
    
    // Optimistic delete
    setEntries(prev => prev.filter(e => e.id !== id));

    try {
      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      return { success: true, error: null };
    } catch (err) {
      // Rollback on error
      setEntries(previousEntries);
      
      const errorMessage = err instanceof Error ? err.message : "Failed to delete entry";
      console.error("Delete entry error:", err);
      return { success: false, error: { message: errorMessage } };
    }
  }, [entries]);

  // ==========================================================================
  // REACTION HANDLERS
  // ==========================================================================
  
  const toggleReaction = useCallback(async (
    entryId: string,
    reactionType: "love" | "hate",
    userId: string
  ) => {
    // Snapshot for rollback
    const previousEntries = entries;
  
    // 🔥 OPTIMISTIC UI UPDATE
    setEntries(prev =>
      prev.map(entry => {
        if (entry.id !== entryId) return entry;
    
        const otherType = reactionType === "love" ? "hate" : "love";
    
        // Remove same reaction
        if (entry.userReaction === reactionType) {
          return {
            ...entry,
            [`${reactionType}_count`]: Math.max(
              0,
              entry[`${reactionType}_count`] - 1
            ),
            userReaction: null,
          };
        }
    
        // Switch reaction
        if (entry.userReaction === otherType) {
          return {
            ...entry,
            [`${otherType}_count`]: Math.max(
              0,
              entry[`${otherType}_count`] - 1
            ),
            [`${reactionType}_count`]:
              entry[`${reactionType}_count`] + 1,
            userReaction: reactionType,
          };
        }
    
        // New reaction
        return {
          ...entry,
          [`${reactionType}_count`]:
            entry[`${reactionType}_count`] + 1,
          userReaction: reactionType,
        };
      })
    );
  
    try {
      // Check existing action
      const { data: existingAction, error: fetchError } = await supabase
        .from("entry_actions")
        .select("*")
        .eq("entry_id", entryId)
        .eq("user_id", userId)
        .maybeSingle();
  
      if (fetchError) throw fetchError;
  
      if (existingAction) {
        const otherType = reactionType === "love" ? "hate" : "love";
        const currentCount = existingAction[`${reactionType}_count`] || 0;
  
        const updates = {
          [`${reactionType}_count`]: currentCount > 0 ? 0 : 1,
          [`${otherType}_count`]: 0,
        };
  
        const { error } = await supabase
          .from("entry_actions")
          .update(updates)
          .eq("id", existingAction.id);
  
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("entry_actions")
          .insert({
            entry_id: entryId,
            user_id: userId,
            [`${reactionType}_count`]: 1,
          });
  
        if (error) throw error;
      }
  
      return { success: true, error: null };
    } catch (err) {
      // ❌ ROLLBACK ON FAILURE
      setEntries(previousEntries);
  
      const errorMessage =
        err instanceof Error ? err.message : "Failed to toggle reaction";
  
      console.error("Toggle reaction error:", err);
  
      return { success: false, error: { message: errorMessage } };
    }
  }, [entries]);

  // ==========================================================================
  // COMMENT HANDLERS
  // ==========================================================================
  
  const addComment = useCallback(async (
    entryId: string,
    text: string,
    userId: string
  ) => {
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          entry_id: entryId,
          text,
          user_id: userId,
        })
        .select(`
          id,
          text,
          created_at,
          user_id,
          users_public!inner(username)
        `)
        .single();

      if (error) throw error;
      if (!data) throw new Error("No data returned from insert");

      const typedData = data as unknown as {
        id: string;
        text: string;
        created_at: string;
        user_id: string;
        users_public: { username: string } | null;
      };

      const newComment: Comment = {
        id: typedData.id,
        entry_id: entryId,
        text: typedData.text,
        username: typedData.users_public?.username || "Anonymous",
        created_at: typedData.created_at,
        user_id: typedData.user_id,
      };

      // Update local state
      setEntries(prev => prev.map(entry => {
        if (entry.id === entryId) {
          return {
            ...entry,
            comments: [newComment, ...entry.comments],
          };
        }
        return entry;
      }));

      return { data: newComment, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add comment";
      console.error("Add comment error:", err);
      return { data: null, error: { message: errorMessage } };
    }
  }, []);

  const deleteComment = useCallback(async (entryId: string, commentId: string) => {
    const previousEntries = [...entries];
    
    // Optimistic delete
    setEntries(prev => prev.map(entry => {
      if (entry.id === entryId) {
        return {
          ...entry,
          comments: entry.comments.filter(c => c.id !== commentId),
        };
      }
      return entry;
    }));

    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      
      return { success: true, error: null };
    } catch (err) {
      // Rollback
      setEntries(previousEntries);
      
      const errorMessage = err instanceof Error ? err.message : "Failed to delete comment";
      console.error("Delete comment error:", err);
      return { success: false, error: { message: errorMessage } };
    }
  }, [entries]);

  // ==========================================================================
  // RETURN
  // ==========================================================================
  
  return {
    // State
    entries,
    loading,
    error,
    
    // Entry operations
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    
    // Reaction operations
    toggleReaction,
    
    // Comment operations
    addComment,
    deleteComment,
    
    // Manual state setter (use sparingly)
    setEntries,
  };
}