import Image from "next/image";

/** ElaBela logo on a pulsing nude-pink badge — the one warm accent in the noir UI. */
export function LogoBadge({ size = 44 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 animate-pulse-nude"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: "linear-gradient(150deg, #ecd4c8 0%, #d6ab99 55%, #c39682 100%)",
      }}
    >
      <Image
        src="/logo.png"
        alt="ElaBela Glow"
        width={size}
        height={size}
        priority
        className="h-full w-full object-contain p-[15%]"
      />
    </div>
  );
}
