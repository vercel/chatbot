export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";

export type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "vote"
  | "document"
  | "suggestions"
  | "activate_gateway";

export type ErrorCode = `${ErrorType}:${Surface}`;

export type ErrorVisibility = "response" | "log" | "none";

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  database: "log",
  chat: "response",
  auth: "response",
  stream: "response",
  api: "response",
  history: "response",
  vote: "response",
  document: "response",
  suggestions: "response",
  activate_gateway: "response",
};

export class ChatbotError extends Error {
  type: ErrorType;
  surface: Surface;
  statusCode: number;

  constructor(errorCode: ErrorCode, cause?: string) {
    super();

    const [type, surface] = errorCode.split(":");

    this.type = type as ErrorType;
    this.cause = cause;
    this.surface = surface as Surface;
    this.message = getMessageByErrorCode(errorCode);
    this.statusCode = getStatusCodeByType(this.type);
  }

  toResponse() {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    if (visibility === "log") {
      console.error({
        code,
        message,
        cause,
      });

      return Response.json(
        { code: "", message: "Something went wrong. Please try again later." },
        { status: statusCode }
      );
    }

    return Response.json({ code, message, cause }, { status: statusCode });
  }
}

export function getMessageByErrorCode(errorCode: ErrorCode): string {
  if (errorCode.includes("database")) {
    return "An error occurred while executing a database query.";
  }

  switch (errorCode) {
    case "bad_request:api":
      return "The request couldn't be processed. Please check your input and try again.";

    case "bad_request:activate_gateway":
      return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";

    case "unauthorized:auth":
      return "You need to sign in before continuing.";
    case "forbidden:auth":
      return "Your account does not have access to this feature.";

    case "rate_limit:chat":
      return "You have exceeded your maximum number of messages for the day. Please try again later.";
    case "not_found:chat":
      return "The requested chat was not found. Please check the chat ID and try again.";
    case "forbidden:chat":
      return "This chat belongs to another user. Please check the chat ID and try again.";
    case "unauthorized:chat":
      return "You need to sign in to view this chat. Please sign in and try again.";
    case "offline:chat":
      return "We're having trouble sending your message. Please check your internet connection and try again.";

    case "not_found:document":
      return "The requested document was not found. Please check the document ID and try again.";
    case "forbidden:document":
      return "This document belongs to another user. Please check the document ID and try again.";
    case "unauthorized:document":
      return "You need to sign in to view this document. Please sign in and try again.";
    case "bad_request:document":
      return "The request to create or update the document was invalid. Please check your input and try again.";

    default:
      return "Something went wrong. Please try again later.";
  }
}

function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "offline":
      return 503;
    default:
      return 500;
  }
}
