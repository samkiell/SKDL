/**
 * Bot factory — creates the grammY bot and registers handlers.
 * Registration order matters: the message catch-all MUST be last.
 */

import { Bot } from "grammy";
import type { UserFromGetMe } from "grammy/types";

import * as message from "./handlers/message";
import * as movie from "./handlers/movie";
import * as series from "./handlers/series";
import * as start from "./handlers/start";
import * as subtitle from "./handlers/subtitle";
import { errMsg } from "./util";

export function createBot(token: string, botInfo?: UserFromGetMe): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  bot.catch((err) => {
    console.error(`Unhandled error while processing update ${err.ctx.update.update_id}: ${errMsg(err.error)}`);
  });

  start.register(bot);
  movie.register(bot);
  series.register(bot);
  subtitle.register(bot);
  message.register(bot); // message handlers must be LAST

  return bot;
}
