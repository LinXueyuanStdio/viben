import { Composition } from "remotion"
import { CinematicFinanceShowcase } from "./cinematic"

export function RemotionRoot() {
  return (
    <Composition
      id="CinematicFinanceShowcase"
      component={CinematicFinanceShowcase}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  )
}
