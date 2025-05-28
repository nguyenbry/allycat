import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="grid min-h-screen place-content-center">
      <div className="flex flex-col items-center">
        <span>Hello</span>
        <ThemeToggle />
      </div>
    </main>
  );
}
