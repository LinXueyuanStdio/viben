import {
  Group,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
} from "three";
import type { Texture } from "three";

export interface AppSnapshot {
  id: string;
  texture: Texture;
}

export interface MultitaskViewConfig {
  screenWidth: number;
  screenHeight: number;
  cardWidth?: number;
  cardHeight?: number;
  cardGap?: number;
}

interface CardEntry {
  id: string;
  mesh: Mesh;
  material: MeshBasicMaterial;
}

type SelectHandler = (appId: string) => void;
type DismissHandler = (appId: string) => void;

const _unitPlane = new PlaneGeometry(1, 1);

export class MultitaskView {
  readonly root = new Group();

  private screenWidth: number;
  private screenHeight: number;
  private cardWidth: number;
  private cardHeight: number;
  private cardGap: number;
  private scrollOffset = 0;

  private cards: CardEntry[] = [];
  private selectHandlers: Set<SelectHandler> = new Set();
  private dismissHandlers: Set<DismissHandler> = new Set();

  constructor(config: MultitaskViewConfig) {
    this.screenWidth = config.screenWidth;
    this.screenHeight = config.screenHeight;
    this.cardWidth = config.cardWidth ?? Math.floor(config.screenWidth * 0.6);
    this.cardHeight = config.cardHeight ?? Math.floor(config.screenHeight * 0.6);
    this.cardGap = config.cardGap ?? 20;
  }

  setCards(snapshots: AppSnapshot[]): void {
    this.clearCards();

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];

      const material = new MeshBasicMaterial({
        map: snapshot.texture,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      });

      const mesh = new Mesh(_unitPlane, material);
      mesh.scale.set(this.cardWidth, this.cardHeight, 1);
      mesh.userData.interactive = true;

      this.positionCard(mesh, i);
      this.root.add(mesh);

      this.cards.push({ id: snapshot.id, mesh, material });
    }
  }

  get scrollOffsetValue(): number {
    return this.scrollOffset;
  }

  scrollTo(offset: number): void {
    this.scrollOffset = Math.max(0, offset);
    this.repositionAllCards();
  }

  scrollBy(delta: number): void {
    this.scrollOffset = Math.max(0, this.scrollOffset + delta);
    this.repositionAllCards();
  }

  selectCard(index: number): void {
    if (index < 0 || index >= this.cards.length) return;
    const id = this.cards[index].id;
    for (const handler of this.selectHandlers) {
      handler(id);
    }
  }

  dismissCard(index: number): void {
    if (index < 0 || index >= this.cards.length) return;
    const entry = this.cards[index];
    entry.mesh.removeFromParent();
    entry.material.dispose();
    this.cards.splice(index, 1);

    for (const handler of this.dismissHandlers) {
      handler(entry.id);
    }

    this.repositionAllCards();
  }

  onSelectApp(handler: SelectHandler): void {
    this.selectHandlers.add(handler);
  }

  offSelectApp(handler: SelectHandler): void {
    this.selectHandlers.delete(handler);
  }

  onDismissApp(handler: DismissHandler): void {
    this.dismissHandlers.add(handler);
  }

  offDismissApp(handler: DismissHandler): void {
    this.dismissHandlers.delete(handler);
  }

  resize(w: number, h: number): void {
    this.screenWidth = w;
    this.screenHeight = h;
    this.cardWidth = Math.floor(w * 0.6);
    this.cardHeight = Math.floor(h * 0.6);

    for (const entry of this.cards) {
      entry.mesh.scale.set(this.cardWidth, this.cardHeight, 1);
    }

    this.repositionAllCards();
  }

  dispose(): void {
    this.clearCards();
    this.selectHandlers.clear();
    this.dismissHandlers.clear();
  }

  private clearCards(): void {
    for (const entry of this.cards) {
      entry.mesh.removeFromParent();
      entry.material.dispose();
    }
    this.cards = [];
  }

  private positionCard(mesh: Mesh, index: number): void {
    const startY = Math.floor(this.screenHeight * 0.2);
    const cardX =
      Math.floor(this.screenWidth * 0.2) +
      index * (this.cardWidth + this.cardGap) -
      this.scrollOffset;

    mesh.position.set(
      cardX + this.cardWidth / 2,
      -(startY + this.cardHeight / 2),
      5,
    );
  }

  private repositionAllCards(): void {
    for (let i = 0; i < this.cards.length; i++) {
      this.positionCard(this.cards[i].mesh, i);
    }
  }
}
