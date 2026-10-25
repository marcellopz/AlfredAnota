import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import type { NextConfig } from "next";

// Lê o .env da raiz, mas repassa ao site SOMENTE variáveis NEXT_PUBLIC_*.
// Nunca carregue o arquivo inteiro: ele contém a service_role.
function loadPublicEnv(): Record<string, string> {
  const file = resolve(import.meta.dirname, "../../.env");
  if (!existsSync(file)) return {}; // ex: Vercel, onde as variáveis vêm do painel

  const all = parseEnv(readFileSync(file, "utf8"));
  const expand = (value: string) => value.replace(/\$\{(\w+)\}/g, (_, name: string) => all[name] ?? "");

  return Object.fromEntries(
    Object.entries(all)
      .filter(([key]) => key.startsWith("NEXT_PUBLIC_"))
      .map(([key, value]) => [key, expand(value ?? "")]),
  );
}

const nextConfig: NextConfig = {
  env: loadPublicEnv(),
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
