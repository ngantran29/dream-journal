import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabaseClient from "../supabase";

type EntryType = {
  id: string;
  title: string;
  text: string;
  image_url: string | null;
  date: string;
  created_at: string;
};

function Entry(){
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [entry, setEntry] = useState<EntryType | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [image_url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchEntry() {
      if (!id) return;
    
      const { data, error } = await supabaseClient
        .from("entries")
        .select("*")
        .eq("id", id)
        .maybeSingle();
    
      if (error) {
        console.error(error);
        return;
      }
    
      if (!data) {
        navigate("/");
        return;
      }
    
      setEntry(data);
      setTitle(data.title);
      setText(data.text);
      setUrl(data.image_url);
    }
    

    fetchEntry();
  }, [id]);

  async function saveEntry() {
    if (!id) return;

    setSaving(true);

    const { error } = await supabaseClient
      .from("entries")
      .update({ text })
      .eq("id", id);

    if (error) console.error(error);
    setSaving(false);
  }
  async function deleteNote(id: string) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this entry? This action cannot be undone."
    );
    if (!confirmDelete) return;

    await supabaseClient.from("entries").delete().eq("id", id);
  }
  if (!entry) return <p>Loading...</p>;

  return (
    <div className="entry-edit">
      <h1><textarea
        value={title}
        onChange={(e) => setText(e.target.value)}
        rows={1}
      /></h1>

      <div className="entry-image" style={{ marginBottom: "10px" }}>
                <img 
                  src={image_url} 
                  alt={""} 
                  style={{ maxWidth: "100%", borderRadius: "8px", display: "block" }} 
                />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
      />

      <div>
        <button onClick={() => navigate(-1)}>Back</button>
        <button type="button" onClick={() => deleteNote(id!)}>Delete</button>
        <button onClick={saveEntry} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default Entry;