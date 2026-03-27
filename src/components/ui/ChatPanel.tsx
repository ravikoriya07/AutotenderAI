"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  placeholder?: string;
  onSubmit?: (message: string) => void;
  actions?: React.ReactNode;
  className?: string;
}

export function ChatPanel({
  placeholder = "Ask anything",
  onSubmit,
  actions,
  className,
}: ChatPanelProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit?.(value);
      setValue("");
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[120px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actions}
          <Button size="sm" className="ml-auto" onClick={handleSubmit}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
