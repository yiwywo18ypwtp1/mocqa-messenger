import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { AlertProvider } from "./context/AlertContext";

function App() {
  return (
    <BrowserRouter>
      <AlertProvider>
        <AppRoutes />
      </AlertProvider>
    </BrowserRouter>
  );
}

export default App;
