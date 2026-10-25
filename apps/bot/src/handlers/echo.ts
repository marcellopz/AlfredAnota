import { Composer } from "grammy";

export const echo = new Composer();

echo.on("message:text", (ctx) => {
  // TEMPORÁRIO: remover (log de depuração do texto recebido)
  console.log(`[msg] chat ${ctx.chat.id}: ${ctx.message.text}`);
  return ctx.reply(`Recebi: ${ctx.message.text}`);
});
