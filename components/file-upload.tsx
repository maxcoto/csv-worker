"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPT = ".csv,.txt,text/csv,text/plain";

interface FileUploadProps {
  fileContent: string | null;
  fileName: string | null;
  onClear: () => void;
  onFileRead: (content: string, fileName: string) => void;
}

/**
 * File input for CSV or text. Reads file as text and passes to parent.
 */
export function FileUpload({
  fileContent,
  fileName,
  onClear,
  onFileRead,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        toast.error("File too large (max 5 MB)");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result;
        if (typeof text === "string") {
          onFileRead(text, file.name);
        }
      };
      reader.readAsText(file, "utf-8");

      e.target.value = "";
    },
    [onFileRead]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        accept={ACCEPT}
        className="hidden"
        onChange={handleChange}
        type="file"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        Upload CSV / file
      </Button>
      {fileName ? (
        <>
          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
            {fileName}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
          >
            Clear
          </Button>
        </>
      ) : null}
    </div>
  );
}
