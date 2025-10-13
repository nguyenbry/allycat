import { TSPForm } from "@/components/places-search/tsp-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-4 px-1 py-4">
      <div className="grid grow grid-cols-1 grid-rows-1 place-content-center items-stretch self-stretch lg:p-24 2xl:px-72 2xl:py-36">
        <div className="bg-card rounded-lg border">
          <TSPForm />
        </div>
      </div>

      <ThemeToggle className="mt-auto" />
    </main>
  );
}
