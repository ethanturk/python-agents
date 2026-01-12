import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { DocumentSetProvider } from "./contexts/DocumentSetContext";
import ErrorBoundary from "./components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <DocumentSetProvider>
          <App />
        </DocumentSetProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
