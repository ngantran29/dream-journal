import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import EntriesView from "./pages/EntriesView";
import UserProfile from "./pages/UserProfile";

function App() {
  return (
    <>
    <Toaster richColors position="top-center" />
    <Routes>
      <Route path="/" element={<EntriesView />} />
      <Route path="/entries" element={<EntriesView />} />
      <Route path="/profile/:userId" element={<UserProfile />} />
      <Route path="*" element={<EntriesView />} />
    </Routes>
    </>
  );
}

export default App;
