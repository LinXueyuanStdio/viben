import { useEffect, useState } from "react";
import { PetContainer, type PetConfig, type PetPosition } from "@viben/pet";
import { loadPetFromPublic } from "@/lib/pet-loader";

export default function PetWindowPage() {
  const [pet, setPet] = useState<PetConfig | null>(null);
  const [position, setPosition] = useState<PetPosition>({ right: 4, bottom: 4 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPetFromPublic("tux")
      .then(setPet)
      .catch((err) => {
        console.error("Failed to load pet:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div style={{ fontSize: "12px", color: "#999" }}>Loading...</div>
      </div>
    );
  }

  if (error || !pet) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div style={{ fontSize: "12px", color: "#f00" }}>
          {error ?? "Pet not found"}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "transparent",
        overflow: "hidden",
      }}
    >
      <PetContainer
        pet={pet}
        position={position}
        onPositionChange={setPosition}
        showBubble={false}
      />
    </div>
  );
}
