import EntriesView from "./pages/EntriesView";
import Entry from "./pages/Entry";
import { Route, Routes } from "react-router-dom";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<EntriesView />} />
        <Route path="/Entry/:id" element={<Entry />} />
      </Routes>
    </>
  );
}

export default App;