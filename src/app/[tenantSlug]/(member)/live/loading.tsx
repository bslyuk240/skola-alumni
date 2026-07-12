export default function LiveLoading() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
      <div className="h-5 w-16 animate-pulse rounded bg-neutral-200" />
      <div
        className="mx-auto w-full max-w-[min(390px,100%)] animate-pulse rounded-2xl bg-neutral-200"
        style={{ aspectRatio: "9 / 16", maxHeight: "min(72dvh, calc(100dvh - 11rem))" }}
      />
    </main>
  );
}
