declare module "troika-three-text" {
  import { Mesh } from "three";
  export class Text extends Mesh {
    text: string;
    fontSize: number;
    color: string | number;
    font: string | null;
    anchorX: string;
    anchorY: string;
    maxWidth: number;
    textAlign: string;
    lineHeight: number;
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
