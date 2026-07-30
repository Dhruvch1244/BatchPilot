import { AppProvider } from "./context/AppContext";
import AppShell from "./components/Layout/AppShell";

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
