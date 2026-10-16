import { MapView } from "@/components/MapView";

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""} />
      <h1 className="pointer-events-none absolute top-[max(0.5rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-neutral-900 shadow">
        俺についてこい
      </h1>
    </main>
  );
}
