import type { DanmakuItem } from "@/types/overlay";
import { PERFORMANCE_LIMITS } from "./constants";

interface TrackOccupancy {
  endTime: number;
  itemId: string;
}

export class GreedyTrackAllocator {
  private tracks: Map<number, TrackOccupancy> = new Map();
  private maxTracks: number;

  constructor(maxTracks: number = 8) {
    this.maxTracks = maxTracks;
  }

  allocate(item: DanmakuItem, duration: number): number {
    const now = Date.now();
    const endTime = now + duration;

    for (let i = 0; i < this.maxTracks; i++) {
      const occupancy = this.tracks.get(i);
      if (!occupancy || occupancy.endTime < now) {
        this.tracks.set(i, { endTime, itemId: item.id });
        return i;
      }
    }

    let minEndTime = Infinity;
    let bestTrack = 0;
    for (let i = 0; i < this.maxTracks; i++) {
      const occupancy = this.tracks.get(i)!;
      if (occupancy.endTime < minEndTime) {
        minEndTime = occupancy.endTime;
        bestTrack = i;
      }
    }

    if (minEndTime - now < PERFORMANCE_LIMITS.trackOverlapTolerance) {
      this.tracks.set(bestTrack, { endTime, itemId: item.id });
      return bestTrack;
    }

    return -1;
  }

  release(trackIndex: number, itemId: string): void {
    const occupancy = this.tracks.get(trackIndex);
    if (occupancy?.itemId === itemId) {
      this.tracks.delete(trackIndex);
    }
  }

  setMaxTracks(maxTracks: number): void {
    this.maxTracks = maxTracks;
    for (const [track] of this.tracks) {
      if (track >= maxTracks) {
        this.tracks.delete(track);
      }
    }
  }

  clear(): void {
    this.tracks.clear();
  }
}
