import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatbotError } from "../errors";
import { generateUUID } from "../utils";
import {
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  vote,
  userMessageQuota,
  guestMessageQuota,
} from "./schema";
import { generateHashedPassword } from "./utils";
import { getClientIpString } from "../ip/utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

const MAX_MESSAGES = 5


export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update title for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}


// TODO implement messages and file uploads limit for both guests and users


// Message quota functions
export async function getGuestMessageQuota(userId: string): Promise<{ messagesUsed: number; maxMessages: number }> {
  try {
    const [quota] = await db
      .select()
      .from(guestMessageQuota)
      .where(eq(guestMessageQuota.userId, userId));

    if (!quota) {
      // Create quota record for new guest
      await db.insert(guestMessageQuota).values({
        userId,
        messagesUsed: 0,
        // ipAddress is optional, don't include it here
      });
      return { messagesUsed: 0, maxMessages: MAX_MESSAGES };
    }

    return { messagesUsed: quota.messagesUsed || 0, maxMessages: MAX_MESSAGES };
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get guest message quota");
  }
}

export async function incrementGuestMessageCount(userId: string): Promise<void> {
  try {
    await db
      .insert(guestMessageQuota)
      .values({
        userId,
        messagesUsed: 1,
      })
      .onConflictDoUpdate({
        target: guestMessageQuota.userId,
        set: {
          messagesUsed: sql`${guestMessageQuota.messagesUsed} + 1`,
          updatedAt: new Date(),
        },
      });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to increment guest message count");
  }
}

export async function getUserMessageQuota(userId: string): Promise<{ messagesUsed: number; maxMessages: number; remaining: number }> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    const [quota] = await db
      .select()
      .from(userMessageQuota)
      .where(and(
        eq(userMessageQuota.userId, userId),
        eq(userMessageQuota.date, today)
      ));

    if (!quota) {
      // Create daily quota record for user
      await db.insert(userMessageQuota).values({
        userId,
        messagesUsed: 0,
        date: today,
      });
      return { messagesUsed: 0, maxMessages: MAX_MESSAGES, remaining: MAX_MESSAGES };
    }

    const remaining = Math.max(0, MAX_MESSAGES - quota.messagesUsed);
    return { messagesUsed: quota.messagesUsed, maxMessages: MAX_MESSAGES, remaining };
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get user message quota");
  }
}

export async function incrementUserMessageCount(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    await db
      .insert(userMessageQuota)
      .values({
        userId,
        messagesUsed: 1,
        date: today,
      })
      .onConflictDoUpdate({
        target: [userMessageQuota.userId, userMessageQuota.date],
        set: {
          messagesUsed: sql`${userMessageQuota.messagesUsed} + 1`,
          updatedAt: new Date(),
        },
      });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to increment user message count");
  }
}


// hamza

export async function getUserImageUsage(userId: string, days: number = 1): Promise<number> {
  try {
    const isGuest = userId.startsWith('guest-');

    if (isGuest) {
      // For guests, check GuestMessageQuota table
      const [quota] = await db
        .select()
        .from(guestMessageQuota)
        .where(eq(guestMessageQuota.userId, userId));

      return quota?.imagesUsed || 0;
    } else {
      // For logged-in users - TODO: add imagesUsed field to UserMessageQuota schema
      // For now, return 0 as we don't track user image usage yet
      console.log("getUserImageUsage called for user:", { userId, days });
      const [quota] = await db
        .select()
        .from(userMessageQuota)
        .where(eq(userMessageQuota.userId, userId));

      return quota?.imagesUsed || 0;
    }
  } catch (error) {
    console.error("Failed to get user image usage:", error);
    return 0;
  }
}

export async function recordImageUsage(userId: string, isGuest: boolean, chatId?: string | null) {
  try {
    if (chatId) {
      // console.error('No chat ID provided for image usage recording');
      const chat = await getChatById({ id: chatId });
      if (!chat) {
        console.error('Chat not found for image usage recording');
        return;
      }
    }

    // For logged-in users, update UserMessageQuota with date constraint
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    if (isGuest) {
      // For guests, update GuestMessageQuota with image usage by IP address
      const guestIpAddress = await getClientIpString();
      await db
        .insert(guestMessageQuota)
        .values({
          // imagesUsed: 1,
          imagesUsed: sql`${guestMessageQuota.imagesUsed} + 1`,
          ipAddress: guestIpAddress,
          date: today
        })
        .onConflictDoUpdate({
          target: [guestMessageQuota.ipAddress, guestMessageQuota.date], // Composite target
          set: {
            imagesUsed: sql`${guestMessageQuota.imagesUsed} + 1`,
            updatedAt: new Date(),
          },
        });
    } else {
      await db
        .insert(userMessageQuota)
        .values({
          userId,
          imagesUsed: sql`${userMessageQuota.imagesUsed} + 1`,
          date: today,
        })
        .onConflictDoUpdate({
          target: [userMessageQuota.userId, userMessageQuota.date],
          set: {
            imagesUsed: sql`${userMessageQuota.imagesUsed} + 1`,
            updatedAt: new Date(),
          },
        });
    }
  } catch (error) {
    console.error('Failed to record image usage:', error);
  }
}

export async function canUserUploadImage(userId: string, currentChatImages: number): Promise<{
  canUpload: boolean;
  reason?: string;
  remainingDaily?: number;
  remainingChat?: number;
}> {
  const isGuest = userId.startsWith('guest-');
  const maxDailyUploads = isGuest ? 1 : 2;
  const maxChatImages = isGuest ? 1 : 2;

  // Check daily limit
  const dailyUsage = await getUserImageUsage(userId, 1);
  const remainingDaily = maxDailyUploads - dailyUsage;

  if (process.env.NODE_ENV === "production" && dailyUsage >= maxDailyUploads) {
    return {
      canUpload: false,
      reason: `Daily image limit reached (${maxDailyUploads} images per day)`,
      remainingDaily: 0,
      remainingChat: maxChatImages - currentChatImages,
    };
  }

  // Check per-chat limit
  const remainingChat = maxChatImages - currentChatImages;
  if (process.env.NODE_ENV === "production" && currentChatImages >= maxChatImages) {
    return {
      canUpload: false,
      reason: `Chat image limit reached (${maxChatImages} images per chat)`,
      remainingDaily,
      remainingChat: 0,
    };
  }

  return {
    canUpload: true,
    remainingDaily,
    remainingChat,
  };
}

// Guest IP quota functions - now using GuestMessageQuota table
export async function getGuestQuotaByIP(ipAddress?: string): Promise<{
  messagesUsed: number;
  imagesUsed: number;
  maxMessages: number;
  maxImages: number;
}> {
  if (!ipAddress) {
    throw new ChatbotError("bad_request:database", "Failed to get guest IP quota");
  }

  try {
    const [quota] = await db
      .select()
      .from(guestMessageQuota)
      .where(eq(guestMessageQuota.ipAddress, ipAddress));

    if (!quota) {
      // Create quota record for new IP
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      await db.insert(guestMessageQuota).values({
        ipAddress,
        messagesUsed: 0,
        imagesUsed: 0,
        date: today, // Add date field
      });

      return {
        messagesUsed: 0,
        imagesUsed: 0,
        maxMessages: MAX_MESSAGES,
        maxImages: 1,
      };
    }

    // const remainingMessages = Math.max(0, 3 - (quota.messagesUsed || 0));
    // const remainingImages = Math.max(0, 1 - (quota.imagesUsed || 0));

    return {
      messagesUsed: quota.messagesUsed || 0,
      imagesUsed: quota.imagesUsed || 0,
      maxMessages: MAX_MESSAGES,
      maxImages: 1,
    };
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get guest IP quota");
  }
}

export async function incrementGuestMessageUsageByIP(ipAddress?: string): Promise<void> {
  if (!ipAddress) {
    throw new ChatbotError("bad_request:database", "Failed to increment guest IP message count");
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log('🔍 GUEST QUOTA DEBUG:', { ipAddress, today });

    // Use onConflictDoUpdate to handle existing records properly
    const result = await db
      .insert(guestMessageQuota)
      .values({
        ipAddress,
        messagesUsed: 1,
        imagesUsed: 0,
        date: today,
      })
      .onConflictDoUpdate({
        target: [guestMessageQuota.ipAddress, guestMessageQuota.date],
        set: {
          messagesUsed: sql`${guestMessageQuota.messagesUsed} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log('🔍 GUEST QUOTA RESULT:', result);
  } catch (error) {
    console.error('🔍 GUEST QUOTA ERROR:', {
      error,
      ipAddress,
      today: new Date().toISOString().split('T')[0],
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    throw new ChatbotError("bad_request:database", "Failed to increment guest IP message count");
  }
}

export async function incrementGuestImageUsageByIP(ipAddress: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    await db
      .insert(guestMessageQuota)
      .values({
        ipAddress,
        messagesUsed: 0,
        imagesUsed: 1,
        date: today, // Add date field
      })
      .onConflictDoUpdate({
        target: [guestMessageQuota.ipAddress, guestMessageQuota.date], // Composite target
        set: {
          imagesUsed: sql`${guestMessageQuota.imagesUsed} + 1`,
          updatedAt: new Date(),
        },
      });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to increment guest IP image count");
  }
}

export async function getGuestIpImageUsage(ipAddress: string): Promise<number> {
  try {
    const [quota] = await db
      .select()
      .from(guestMessageQuota)
      .where(eq(guestMessageQuota.ipAddress, ipAddress));

    return quota?.imagesUsed || 0;
  } catch (error) {
    console.error('Failed to get guest IP image usage:', error);
    return 0;
  }
}
