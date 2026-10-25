import { Bot } from "grammy";
import { config } from "./config";
import { echo } from "./handlers/echo";

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

bot.chatType("private").use(echo);

bot.catch((err) => {
  console.error(`Erro ao processar o update ${err.ctx.update.update_id}:`, err.error);
});

const stop = () => {
  void bot.stop();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

await bot.start({
  onStart: (me) => console.log(`Bot @${me.username} rodando em long polling. Ctrl+C para parar.`),
});
