import { Composer } from "grammy";
import { logIncomingMessage } from "../db/messageLog";

export const echo = new Composer();

echo.on("message:text", async (ctx) => {
  // TEMPORÁRIO: remover (log de depuração do texto recebido)
  console.log(`[msg] chat ${ctx.chat.id}: ${ctx.message.text}`);

  // Fase 0: ainda não há vínculo de conta, então userId é nulo e o texto é guardado.
  // A partir da Fase 1, chats não vinculados deixam de gravar o texto (LGPD).
  const isNew = await logIncomingMessage({
    userId: null,
    chatId: ctx.chat.id,
    messageId: ctx.message.message_id,
    text: ctx.message.text,
  });
  if (!isNew) return;

  await ctx.reply(`Recebi: ${ctx.message.text}`);
});
