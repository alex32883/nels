import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

const git = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" });
const revision = git.stdout?.trim() || crypto.randomUUID();

const pages = ["/", "/notes", "/tasks", "/calendar", "/planner", "/settings", "/offline"];

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: pages.map((url) => ({ url, revision })),
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  });
