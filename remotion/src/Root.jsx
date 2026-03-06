import { Composition } from "remotion";
import { CalendarVideo } from "./CalendarVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="CalendarVideo"
      component={CalendarVideo}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
