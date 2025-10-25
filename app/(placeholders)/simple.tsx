export default function Simple({ title }: { title: string }) {
  return (
    <main className="min-h-[100svh] grid place-items-center bg-violet-50">
      <div className="bg-white rounded-xl shadow p-8 text-violet-800 font-semibold">
        {title}
      </div>
    </main>
  );
}
