import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// AuthProvider is mounted inside App.jsx (inside BrowserRouter) so that
// useNavigate is available within AuthProvider if needed.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
