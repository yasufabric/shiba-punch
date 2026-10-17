import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/shiba-punch/",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
