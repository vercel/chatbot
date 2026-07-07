import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      method: "POST",
      path: "/api/chat",
    },
  ],
});
