import { OverlayProvider } from "./overlay-provider";
import { OverlayCanvas } from "./overlay-canvas";
import { DanmakuLayer } from "./layers/danmaku-layer";
import { SubtitleLayer } from "./layers/subtitle-layer";
import { ClickIndicatorLayer } from "./layers/click-indicator-layer";
import { KeystrokeLayer } from "./layers/keystroke-layer";
import { WaveLayer } from "./layers/wave-layer";
import { DesktopPresentationLayer } from "./layers/presentation-layer";

export function OverlayRoot() {
  return (
    <OverlayProvider>
      <DesktopPresentationLayer />
      <OverlayCanvas />
      <DanmakuLayer />
      <WaveLayer />
      <SubtitleLayer />
      <ClickIndicatorLayer />
      <KeystrokeLayer />
    </OverlayProvider>
  );
}
