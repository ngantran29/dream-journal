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

  if (!entry) return <p>Loading...</p>;

  return (
    <div>
      <h2>{title}</h2>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
      />

      <div>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={saveEntry} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default Entry;