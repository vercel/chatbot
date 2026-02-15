"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { GlobeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CheckCircleFillIcon } from "./icons";

const languages = [
  { code: "en", name: "English" },
  { code: "fa", name: "فارسی" },
];

export function LanguageSwitcher({
  className,
}: React.ComponentProps<typeof Button>) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const currentLanguage = languages.find((lang) => lang.code === locale);

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    if (segments[1] === "en" || segments[1] === "fa") {
      segments[1] = newLocale;
    } else {
      segments.unshift("", newLocale);
    }
    router.push(segments.join("/"));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className={cn(
          "w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          className
        )}
      >
        <Button
          className="h-8 md:flex md:h-fit md:px-2"
          variant="outline"
        >
          <GlobeIcon size={16} />
          <span className="ml-2 hidden sm:inline">{currentLanguage?.name}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[120px]">
        {languages.map((lang) => (
          <DropdownMenuItem
            className="group/item flex flex-row items-center justify-between gap-4"
            data-active={lang.code === locale}
            key={lang.code}
            onClick={() => switchLocale(lang.code)}
          >
            {lang.name}
            <div className="text-foreground opacity-0 group-data-[active=true]/item:opacity-100 dark:text-foreground">
              <CheckCircleFillIcon />
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
