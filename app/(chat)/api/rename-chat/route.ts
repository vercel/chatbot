import { auth } from "@/app/(auth)/auth";
import { updateChatTitleById } from "@/lib/db/queries";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, title } = await request.json();

    if (!chatId || !title) {
      return NextResponse.json({ error: 'Missing chatId or title' }, { status: 400 });
    }

    await updateChatTitleById({ chatId, title });

    return NextResponse.json({ success: true, title });
  } catch (error) {
    console.error('Error renaming chat:', error);
    return NextResponse.json({ error: 'Failed to rename chat' }, { status: 500 });
  }
}
