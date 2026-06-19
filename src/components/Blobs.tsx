// Soft gradient blobs that sit behind the whole app so the frosted-glass
// surfaces (header, bottom bar, chips) have color to refract.
export default function Blobs() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      <div
        className="absolute rounded-full"
        style={{
          width: 380,
          height: 380,
          background: "#F4C89A",
          filter: "blur(64px)",
          opacity: 0.38,
          top: -120,
          right: -80,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 340,
          height: 340,
          background: "#A8D5C2",
          filter: "blur(64px)",
          opacity: 0.34,
          top: "32%",
          left: -120,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          background: "#C8B4E8",
          filter: "blur(64px)",
          opacity: 0.30,
          bottom: "8%",
          right: -100,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 300,
          height: 300,
          background: "#F9B8B8",
          filter: "blur(64px)",
          opacity: 0.26,
          bottom: -120,
          left: "12%",
        }}
      />
    </div>
  );
}
