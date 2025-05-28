"use client";
import { useEffect } from "react";

export function TestComponent() {
  useEffect(() => {
    const run = async () => {
      const res = await fetch("http://localhost:3001/");

      const text = await res.text();

      console.log(text);
    };

    run().catch((err) => {
      console.log("Fetch failed", err);

      throw err;
    });
  }, []);
  return <div></div>;
}
