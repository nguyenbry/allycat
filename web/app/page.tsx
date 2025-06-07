import { TSPForm } from "@/components/places-search/tsp-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-4 gap-4">
      <div className="grow grid self-stretch place-content-center grid-cols-1 items-stretch grid-rows-1 lg:p-24 2xl:py-36 2xl:px-72">
        <div className="rounded-lg border bg-card">
          <TSPForm />
        </div>
      </div>

      <ThemeToggle className="mt-auto" />
    </main>
  );
}
