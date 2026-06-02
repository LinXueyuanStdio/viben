import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PetWindowPage from "@/pages/pet-window";
import "@viben/pet/styles/pet.css";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <PetWindowPage />
    </StrictMode>
  );
}
