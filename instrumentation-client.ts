import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
      method: "POST",
    },
  ],
});
