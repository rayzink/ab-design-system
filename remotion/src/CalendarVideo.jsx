import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  staticFile,
  Sequence,
} from "remotion";

const FONT = "'Inter', -apple-system, 'Helvetica Neue', sans-serif";

/* ── Dark callout bubble (matches the annotated screenshot style) ── */
function Callout({ text, x, y, delay = 0, arrow = "bottom" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 13, mass: 0.5, stiffness: 120 },
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.85, 1]);
  const translateY = interpolate(progress, [0, 1], [6, 0]);

  // Arrow nub positioning
  const arrowStyle = {
    position: "absolute",
    width: 12,
    height: 12,
    background: "#1a1a1a",
    transform: "rotate(45deg)",
    ...(arrow === "bottom" && { bottom: -5, left: "50%", marginLeft: -6 }),
    ...(arrow === "top" && { top: -5, left: "50%", marginLeft: -6 }),
    ...(arrow === "left" && { left: -5, top: "50%", marginTop: -6 }),
    ...(arrow === "right" && { right: -5, top: "50%", marginTop: -6 }),
    ...(arrow === "none" && { display: "none" }),
  };

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        transformOrigin: "center center",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#1a1a1a",
          color: "#fff",
          fontFamily: FONT,
          fontSize: 15,
          fontWeight: 600,
          padding: "10px 20px",
          borderRadius: 10,
          whiteSpace: "nowrap",
          boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
        }}
      >
        {text}
        <div style={arrowStyle} />
      </div>
    </div>
  );
}

/* ── Orange tag label (like "7 OPEN QUESTIONS") ── */
function OpenQuestion({ title, subtitle, x, y, delay = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 13, mass: 0.5, stiffness: 120 },
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [10, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: "#FFF7ED",
          border: "1.5px solid #F59E0B",
          borderRadius: 10,
          padding: "14px 20px",
          minWidth: 200,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#D97706",
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 500,
            color: "#1a1a1a",
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

/* ── Main composition ── */
export const CalendarVideo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene timing (in frames at 30fps)
  // 0-75: Empty calendar (2.5s)
  // 75-90: Crossfade to populated (0.5s transition)
  // 90-150: Populated calendar settles (2s)
  // 150+: Callouts animate in one by one
  // Total: 300 frames = 10s

  const crossfadeStart = 75;
  const crossfadeDuration = 20;
  const populatedOpacity = interpolate(
    frame,
    [crossfadeStart, crossfadeStart + crossfadeDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Subtle zoom from 0.88 → 0.85 as we settle in
  const scaleProgress = spring({
    frame,
    fps,
    config: { damping: 200, mass: 2 },
  });
  const imgScale = interpolate(scaleProgress, [0, 1], [0.88, 0.85]);

  // Callout timing (staggered, starting at frame 140)
  const calloutStart = 140;
  const stagger = 18;

  return (
    <AbsoluteFill style={{ backgroundColor: "#f0f0f0" }}>
      {/* Screenshot container */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            transform: `scale(${imgScale})`,
            transformOrigin: "center center",
            position: "relative",
            borderRadius: 12,
            overflow: "visible",
          }}
        >
          {/* Screenshot with shadow frame */}
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.05)",
              position: "relative",
            }}
          >
            {/* Empty calendar (base layer) */}
            <Img
              src={staticFile("calendar-empty.png")}
              style={{ width: 1920, display: "block" }}
            />
            {/* Populated calendar (fades in on top) */}
            <Img
              src={staticFile("calendar-populated.png")}
              style={{
                width: 1920,
                display: "block",
                position: "absolute",
                top: 0,
                left: 0,
                opacity: populatedOpacity,
              }}
            />
          </div>

          {/* ── Callouts (animate in after populated view settles) ── */}
          <Sequence from={calloutStart}>
            <Callout
              text="Make date easier to read"
              x={170}
              y={-48}
              delay={0}
              arrow="bottom"
            />
          </Sequence>

          <Sequence from={calloutStart + stagger}>
            <Callout
              text="Allow Multi-Select"
              x={1340}
              y={-48}
              delay={0}
              arrow="bottom"
            />
          </Sequence>

          <Sequence from={calloutStart + stagger * 2}>
            <OpenQuestion
              title="7 open questions"
              subtitle="Display users that haven't synced calendar"
              x={820}
              y={180}
              delay={0}
            />
          </Sequence>

          <Sequence from={calloutStart + stagger * 3}>
            <OpenQuestion
              title="7 open questions"
              subtitle="Was meeting a success?"
              x={130}
              y={290}
              delay={0}
            />
          </Sequence>

          <Sequence from={calloutStart + stagger * 4}>
            <Callout
              text="Display notes on hover"
              x={780}
              y={410}
              delay={0}
              arrow="none"
            />
          </Sequence>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
