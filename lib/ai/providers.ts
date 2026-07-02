import { customProvider, gateway } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";
import {
  chatModel as mockChatModel,
  titleModel as mockTitleModel,
} from "./models.mock";

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        "chat-model": mockChatModel,
        "title-model": mockTitleModel,
      },
    })
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  return gateway.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return gateway.languageModel(titleModel.id);
}
