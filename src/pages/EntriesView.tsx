import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabaseClient from "../supabase";

function EntriesView() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  type Entry = {
    id: string;
    title: string;
    text: string;
    date: string;
    created_at: string;
  };
  
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    async function fetchEntries() {
      const { data, error } = await supabaseClient
        .from("entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) setEntries(data);
    }
    fetchEntries();
  }, []);

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

  async function deleteNote(id: string) {
    await supabaseClient.from("entries").delete().eq("id", id);
    setEntries((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div>
      {entries.length === 0 && <p>No Entries..</p>}
      <ul>
        {entries.map((note) => (
          <li key={note.id}>
            <span>
                <strong  onClick={() => navigate(`/Entry/${note.id}`)}>{note.title }</strong>
                <p>{note.text}</p>
                <small>{note.date}</small>
            </span>
            <button type="button" onClick={() => deleteNote(note.id)}>
              Delete
            </button>
            <button type="button" onClick={() => navigate(`/Entry/${note.id}`)}>
              Edit
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={createNote}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title..."
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Content"
        />
        <button type="submit">Create Entry</button>
      </form>
    </div>
  );
}

export default EntriesView;
