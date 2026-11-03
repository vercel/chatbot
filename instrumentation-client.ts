import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      method: "POST",
      path: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
    },
  ],
});
