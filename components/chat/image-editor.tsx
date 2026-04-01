import cn from "classnames";
import Image from "next/image";
import { LoaderIcon } from "./icons";

type ImageEditorProps = {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
};

export function ImageEditor({
  title,
  content,
  status,
  isInline,
}: ImageEditorProps) {
  return (
    <div
      className={cn("flex w-full flex-row items-center justify-center", {
        "h-[calc(100dvh-60px)]": !isInline,
        "h-[200px]": isInline,
      })}
    >
      {status === "streaming" ? (
        <div className="flex flex-row items-center gap-4">
          {!isInline && (
            <div className="animate-spin">
              <LoaderIcon />
            </div>
          )}
          <div>Generating Image...</div>
        </div>
      ) : (
        <Image
          alt={title}
          className={cn("h-auto w-full max-w-[800px]", {
            "p-0 md:p-20": !isInline,
          })}
          height={800}
          src={`data:image/png;base64,${content}`}
          unoptimized
          width={800}
        />
      )}
    </div>
  );
}
