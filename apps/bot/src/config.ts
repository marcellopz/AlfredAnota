import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z
    .string({ error: "obrigatória (obtenha no @BotFather)" })
    .regex(/^\d+:[A-Za-z0-9_-]+$/, "formato esperado: <número>:<código>, como o @BotFather entrega"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Variáveis de ambiente inválidas no .env da raiz:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const config = parsed.data;
