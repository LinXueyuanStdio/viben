import React from "react";
import ReactDOM from "react-dom/client";
import PetWindowPage from "@/pages/pet-window";
import "@viben/pet/styles/pet.css";
import "./index.css";

const root = document.getElementById("root");

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <PetWindowPage />
    </React.StrictMode>
  );
}
