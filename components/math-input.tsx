"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MathInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  currentPhase: string;
  placeholderByPhase: Record<string, string>;
}

/**
 * Math input with calculator-style buttons for common operations.
 * Uses textarea for natural text input with live preview of rendered math.
 */
export function MathInput({
  input,
  setInput,
  isLoading,
  handleSubmit,
  currentPhase,
  placeholderByPhase,
}: MathInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    // Minimum 2 lines, cap at ~6 lines (roughly 150px)
    const minHeight = 60; // ~2 lines
    const maxHeight = 150; // ~6 lines
    textarea.style.height = `${Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight))}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  }, [isLoading, input, handleSubmit]);

  // Insert LaTeX wrapped in $ delimiters at cursor position
  const insertAtCursor = useCallback((latex: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    // Wrap LaTeX in $ delimiters for inline math
    const wrappedLatex = `$${latex}$`;
    const newValue =
      input.slice(0, start) + wrappedLatex + input.slice(end);
    setInput(newValue);

    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + wrappedLatex.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      adjustHeight();
    }, 0);
  }, [input, setInput, adjustHeight]);

  // Calculator button actions - wrap LaTeX in $ delimiters
  const buttonActions = {
    square: () => insertAtCursor("x^2"),
    cube: () => insertAtCursor("x^3"),
    power: () => insertAtCursor("x^{}"),
    sqrt: () => insertAtCursor("\\sqrt{}"),
    fraction: () => insertAtCursor("\\frac{}{}"),
    pi: () => insertAtCursor("\\pi"),
    e: () => insertAtCursor("e"),
    plus: () => insertAtCursor("+"),
    minus: () => insertAtCursor("-"),
    multiply: () => insertAtCursor("\\cdot"),
    divide: () => insertAtCursor("\\div"),
    leftParen: () => insertAtCursor("("),
    rightParen: () => insertAtCursor(")"),
  };

  // Parse input and prepare for preview rendering
  // This ensures LaTeX expressions are properly formatted for KaTeX
  const previewContent = useMemo(() => {
    // The input already contains LaTeX in $ delimiters
    // KaTeX will render them via remark-math and rehype-katex
    return input;
  }, [input]);

  return (
    <div className="flex-none border-t border-border bg-background p-4">
      <form
        className="mx-auto flex max-w-[1344px] flex-col gap-2"
        onSubmit={handleSubmit}
      >
        {/* Calculator buttons */}
        <div className="flex flex-wrap gap-1.5">
          {/* Exponents */}
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.square();
            }}
            type="button"
          >
            x²
          </button>
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.cube();
            }}
            type="button"
          >
            x³
          </button>
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.power();
            }}
            type="button"
          >
            xⁿ
          </button>

          {/* Roots and fractions */}
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.sqrt();
            }}
            type="button"
          >
            √
          </button>
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.fraction();
            }}
            type="button"
          >
            ⁄
          </button>

          {/* Operations */}
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.plus();
            }}
            type="button"
          >
            +
          </button>
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.minus();
            }}
            type="button"
          >
            −
          </button>
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.multiply();
            }}
            type="button"
          >
            ×
          </button>
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.divide();
            }}
            type="button"
          >
            ÷
          </button>

          {/* Parentheses */}
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.leftParen();
            }}
            type="button"
          >
            (
          </button>
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.rightParen();
            }}
            type="button"
          >
            )
          </button>

          {/* Special constants */}
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.pi();
            }}
            type="button"
          >
            π
          </button>
          <button
            className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              buttonActions.e();
            }}
            type="button"
          >
            e
          </button>
        </div>

        {/* Live preview area */}
        {input.trim() && (
          <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm min-h-[60px]">
            <div className="prose-chat max-w-none text-foreground">
              <Markdown
                rehypePlugins={[rehypeKatex]}
                remarkPlugins={[remarkMath]}
              >
                {previewContent}
              </Markdown>
            </div>
          </div>
        )}

        {/* Input field and submit button */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            autoComplete="off"
            className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-matrix-green-500 focus:outline-none focus:ring-1 focus:ring-matrix-green-500"
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderByPhase[currentPhase] ?? "Escribe aquí..."}
            rows={2}
            value={input}
          />
          <button
            className="flex h-[64px] min-h-[64px] cursor-pointer items-center justify-center rounded-xl bg-matrix-green-subtle px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-matrix-green-subtle-hover disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || !input.trim()}
            type="submit"
          >
            {isLoading ? (
              <svg
                className="size-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <title>Cargando</title>
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <title>Enviar</title>
                <path
                  d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
