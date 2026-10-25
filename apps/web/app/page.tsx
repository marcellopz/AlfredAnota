import { APP_NAME } from "@alfred/shared";

export default function Home() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>Assistente pessoal no Telegram.</p>

      {/* TEMPORÁRIO (0.5): conferência do carregamento do .env da raiz; remover. */}
      <pre>
        NEXT_PUBLIC_SUPABASE_URL = {process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(ausente)"}
        {"\n"}
        service_role no servidor = {process.env.SUPABASE_SERVICE_ROLE_KEY ? "PRESENTE (erro!)" : "ausente (ok)"}
      </pre>
    </main>
  );
}
