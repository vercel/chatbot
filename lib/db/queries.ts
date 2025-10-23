import 'server-only';

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
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  type Chat,
  stream,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';
import { generateUUID } from '../utils';
import { generateHashedPassword } from './utils';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../errors';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function getUserById({ id }: { id: string }): Promise<User | null> {
  try {
    const result = await db.select().from(user).where(eq(user.id, id));
    return result[0] || null;
  } catch (error) {
    return null;
  }
}

export async function ensureUserExists({ id, email }: { id: string; email?: string }): Promise<User> {
  const existingUser = await getUserById({ id });
  if (existingUser) {
    return existingUser;
  }

  const userEmail = email || `guest-recovery-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    const result = await db.insert(user).values({
      id,
      email: userEmail,
      password
    }).returning();
    return result[0];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create user',
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
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
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function upsertOAuthUser({
  email,
  name,
  image,
}: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  try {
    const [existingUser] = await getUser(email);

    if (existingUser) {
      // Update existing user profile with OAuth data
      const [updatedUser] = await db
        .update(user)
        .set({
          name: name ?? existingUser.name,
          image: image ?? existingUser.image,
          emailVerified: new Date()
        })
        .where(eq(user.email, email))
        .returning();
      return updatedUser;
    }

    // Create new OAuth user (no password)
    const [newUser] = await db.insert(user).values({
      email,
      name,
      image,
      password: null, // OAuth users don't have passwords
      emailVerified: new Date(),
    }).returning();

    return newUser;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to upsert OAuth user'
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
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
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
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
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
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
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
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
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
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));

    // If not found in Chat table, check Mastra threads
    if (!selectedChat) {
      const mastraThread = await getMastraThreadById({ id });
      return mastraThread;
    }

    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

async function getMastraThreadById({ id }: { id: string }) {
  try {
    const threads = await client.unsafe(`
      SELECT
        id,
        "createdAt",
        "updatedAt",
        title,
        "resourceId"
      FROM mastra_threads
      WHERE id = $1
      LIMIT 1
    `, [id]);

    if (threads.length === 0) {
      return null;
    }

    const thread = threads[0];
    return {
      id: thread.id,
      createdAt: thread.createdAt,
      title: thread.title || 'Web Automation',
      userId: thread.resourceId,
      visibility: 'public' as const,
      mastraThreadId: thread.id,
    };
  } catch (error) {
    console.error('Failed to get Mastra thread by id:', error);
    return null;
  }
}

export async function getMastraThreadsByUserId({
  id,
  limit = 20,
}: {
  id: string;
  limit?: number;
}) {
  try {
    // Query Mastra's threads table using raw SQL since we don't have a Drizzle schema for it
    const threads = await client.unsafe(`
      SELECT
        id,
        "createdAt",
        "updatedAt",
        title,
        "resourceId"
      FROM mastra_threads
      WHERE "resourceId" = $1
      ORDER BY "updatedAt" DESC
      LIMIT $2
    `, [id, limit]);

    return threads.map((thread: any) => ({
      id: thread.id,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      title: thread.title || 'Web Automation',
      userId: thread.resourceId,
      visibility: 'public' as const, // Mastra threads don't have visibility, default to public
    }));
  } catch (error) {
    console.error('Failed to get Mastra threads:', error);
    // Don't throw, just return empty array to gracefully degrade
    return [];
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    const clientMessages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));

    // If no messages found, check if this is a Mastra thread
    if (clientMessages.length === 0) {
      const mastraMessages = await getMastraMessagesByThreadId({ threadId: id });
      return mastraMessages;
    }

    return clientMessages;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

async function getMastraMessagesByThreadId({ threadId }: { threadId: string }) {
  try {
    const messages = await client.unsafe(`
      SELECT
        id,
        thread_id as "chatId",
        role,
        content,
        "createdAt"
      FROM mastra_messages
      WHERE thread_id = $1
      ORDER BY "createdAt" ASC
    `, [threadId]);

    // Convert Mastra messages to client message format
    return messages.map((msg: any) => {
      const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;

      // Transform Mastra's tool-invocation format to client's tool-* format
      const transformedParts = (content.parts || []).map((part: any) => {
        // Mastra uses: { type: "tool-invocation", toolInvocation: { state, toolName, args, result } }
        // Client expects: { type: "tool-{toolName}", toolCallId, state: "output-available", input, output }
        if (part.type === 'tool-invocation' && part.toolInvocation) {
          const { toolInvocation } = part;
          const { toolName, toolCallId, args, result, state } = toolInvocation;

          return {
            type: `tool-${toolName}`,
            toolCallId: toolCallId,
            // Convert Mastra's "result" state to client's "output-available"
            state: state === 'result' ? 'output-available' : 'input-available',
            input: args,
            output: result,
          };
        }

        // Pass through other part types unchanged
        return part;
      });

      return {
        id: msg.id,
        chatId: msg.chatId,
        role: msg.role,
        parts: transformedParts,
        attachments: content.experimental_attachments || [],
        createdAt: msg.createdAt,
      };
    });
  } catch (error) {
    console.error('Failed to get Mastra messages:', error);
    return [];
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
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
  } catch (error) {
    console.error('Database error saving document:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw new ChatSDKError('bad_request:database', `Failed to save document: ${error instanceof Error ? error.message : String(error)}`);
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
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
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
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
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
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
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
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
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
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
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
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
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
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}
