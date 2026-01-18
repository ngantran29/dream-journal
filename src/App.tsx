import EntriesView from "./pages/EntriesView";
import Entry from "./pages/Entry";
import { Route, Routes } from "react-router-dom";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<EntriesView />} />
        <Route path="/Entry/:id" element={<Entry />} />
        <Route path="/entries" element={<EntriesView />} />
        <Route path="*" element={<EntriesView />} />
      </Routes>
    </>
  );
}

export default App;