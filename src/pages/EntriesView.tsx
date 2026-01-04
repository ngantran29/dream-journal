import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabaseClient from "../supabase";

function EntriesView() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [username, setUsername] = useState("");
  const [commentingEntryId, setCommentingEntryId] = useState<string | null>(null); // <-- track which entry user is commenting on


  type Entry = {
    id: string;
    title: string;
    text: string;
    date: string;
    created_at: string;
    love_count?: number;
    hate_count?: number;
    comments: Comment[];
  };
  
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    async function fetchEntries() {
      const { data: entriesData } = await supabaseClient
        .from("entries")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: actionsData } = await supabaseClient
        .from("entry_actions")
        .select("*");

      const { data: commentsData } = await supabaseClient
        .from("comments")
        .select("*");

      const merged = (entriesData || []).map((note) => {
        const action = actionsData?.find((a) => a.entry_id === note.id);
        const comments = commentsData
          ?.filter((c) => c.entry_id === note.id)
            .map((c) => ({
              ...c,
              reactions: commentsData?.find((r) => r.id === c.id) || {
                love_count: 0,
                hate_count: 0,
              },
            })) || [];
  
          return {
            ...note,
            love_count: action?.love_count || 0,
            hate_count: action?.hate_count || 0,
            comments: comments || [],            
          };
        });
  
        setEntries(merged);
    }
    fetchEntries();
  }, []);

  function getPreview(text: string, wordLimit = 100) {
    const words = text.split(/\s+/);
    if (words.length <= wordLimit) return text;
    return words.slice(0, wordLimit).join(" ") + "…";
  }

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const { data } = await supabaseClient
      .from("entries")
      .insert([
          {
            title: title.trim(),
            text: text.trim(),
            date: new Date().toISOString().split("T")[0] // YYYY-MM-DD
          }
      ])
      .select()
      .single();

    if (data) {
      setEntries((prev) => [data, ...prev]);
      navigate(`/Entry/${data.id}`);
    }
  }

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    username: string;
  } | null>(null);

  async function addComment(entryId: string) {
    if (!commentText.trim() || !username.trim()) return;

    const { data } = await supabaseClient
      .from("comments")
      .insert([{ entry_id: entryId, text: commentText, username, comment_id: replyingTo?.commentId || "Original", }])
      .select()
      .single();

    if (data) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, comments: [...e.comments, data] }
            : e
        )
      );
      setCommentText(""); // clear input
    }
  }
  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

    // Increment reactions on entries
  async function incrementCount(id: string, type: "love" | "hate") {
    const { data: existing } = await supabaseClient
      .from("entry_actions")
      .select("*")
      .eq("entry_id", id)
      .single();

    if (!existing) {
      await supabaseClient.from("entry_actions").insert({
        entry_id: id,
        love_count: type === "love" ? 1 : 0,
        hate_count: type === "hate" ? 1 : 0,
      });
    } else {
      const newCount =
        type === "love" ? existing.love_count + 1 : existing.hate_count + 1;
      await supabaseClient
        .from("entry_actions")
        .update({ [type + "_count"]: newCount })
        .eq("entry_id", id);
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              love_count: type === "love" ? (e.love_count || 0) + 1 : (e.love_count || 0),
              hate_count: type === "hate" ? (e.hate_count || 0) + 1 : (e.hate_count || 0),
            }
          : e
      )
    );
  }
  async function incrementCommentReaction(commentId: string, type: "love" | "hate" ) {
    // Check if reactions row exists

    const { data: existing } = await supabaseClient
    .from("comments")
    .select("*")
    .eq("id", commentId)
    .single();
    
    if (!existing) {
      // Create row if it doesn't exist
      await supabaseClient.from("comments").insert({
        id: commentId,
        love_count: type === "love" ? 1 : 0,
        hate_count: type === "hate" ? 1 : 0,
      });
    } else {
      const newCount =
        type === "love" ? existing.love_count + 1 : existing.hate_count + 1;
  
      await supabaseClient
        .from("comments")
        .update({ [type + "_count"]: newCount })
        .eq("id", commentId);
    }
  
    // Update local state
    setEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        comments: entry.comments.map((c: any) =>
          c.id === commentId
            ? {
                ...c,
                love_count: type === "love" ? (c.love_count || 0) + 1 : c.love_count,
                hate_count: type === "hate" ? (c.hate_count || 0) + 1 : c.hate_count,
              }
            : c
        ),
      }))
    );
    
  }




  return (
    <div>
      <div className="page-header">
        <h1>DreamThreads</h1>
        <p className="catchphrase">Where my nightly adventures regenerate</p>
      </div>

      {entries.length === 0 && <p>No Entries..</p>}
      <ul>
        {entries.map((note) => (
          <li key={note.id}>
            <span>
                <strong  onClick={() => navigate(`/Entry/${note.id}`)}>{note.title }</strong> 
                <small>{note.date}</small>
                <button className="collapse-btn" type="button" onClick={() => toggleExpanded(note.id)}>
                {expandedIds.has(note.id) ? "Collapse" : "Expand"}
                </button>
              
              <button type="button" onClick={() => navigate(`/Entry/${note.id}`)}>
              Edit
              </button>
                <p>{expandedIds.has(note.id)
                ? note.text
                : getPreview(note.text)}</p>
            <div className="entry-actions">
            <button onClick={() => incrementCount(note.id, "love")}>
                🤍 {note.love_count}
              </button>
              <button onClick={() => incrementCount(note.id, "hate")}>
                👎 {note.hate_count}
              </button>
              <button onClick={() => setCommentingEntryId(note.id)}>
                Comment ({note.comments.length})
              </button>
            
              {/* Show comment form only when this entry is selected */}
              {commentingEntryId === note.id && (
                <div className="comment-container">
                  {/* Display existing comments */}
                  <div style={{ marginTop: "10px" }}>
                    {note.comments.map((c: any) => (
                      <div key={c.id}>
                        <strong>{c.username + " "}</strong>
                        <small>{new Date(c.created_at).toISOString().slice(0, 16).replace("T", " ") + " " }</small>
                        <p>{c.text}</p>
                        <div>
                          <button onClick={() => incrementCommentReaction(c.id, "love")}>
                            🤍 {c.love_count || 0}
                          </button>
                          <button onClick={() => incrementCommentReaction(c.id, "hate")}>
                            👎 {c.hate_count || 0}
                          </button>
                          <button
                            className="reply-btn"
                            onClick={() => {
                              setCommentingEntryId(note.id);
                              setReplyingTo({
                                commentId: c.id,
                                username: c.username,
                              });
                              setCommentText(`@${c.username} `);
                            }}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <input
                    placeholder="Your name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ display: "block", marginBottom: "5px" }}
                  />
                  <textarea
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    style={{ display: "block", marginBottom: "5px" }}
                  />
                  <button onClick={() => addComment(note.id)}>Post</button>
                  <button onClick={() => setCommentingEntryId(null)}>Cancel</button>
                  
                </div>
            )}           
              
              
            </div>
            </span>
          </li>
        ))}
        <div className="entry-creation">
          <form onSubmit={createNote}>
          <p><strong>Create New Entry</strong></p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title..."
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Content"
          />
          <button type="submit">Post</button>
          </form>
        </div>

      
      </ul>

      
    </div>
  );
}

export default EntriesView;
