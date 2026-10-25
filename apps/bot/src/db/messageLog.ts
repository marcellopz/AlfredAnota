import { supabase } from "./client";

type IncomingMessage = {
  userId: string | null;
  chatId: number;
  messageId: number;
  text: string;
};

/** Devolve false se a mensagem já estava registrada (update reentregue pelo Telegram). */
export async function logIncomingMessage(msg: IncomingMessage): Promise<boolean> {
  const { data, error } = await supabase
    .from("message_log")
    .upsert(
      {
        user_id: msg.userId,
        external_chat_id: String(msg.chatId),
        external_message_id: msg.messageId,
        text: msg.text,
      },
      { onConflict: "channel_type,external_chat_id,external_message_id", ignoreDuplicates: true },
    )
    .select("id");

  if (error) throw new Error(`Falha ao gravar em message_log: ${error.message}`);
  return data.length > 0;
}
