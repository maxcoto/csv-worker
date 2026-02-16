"use client";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Placeholder left panel. Layout matches the original course sidebar for consistency.
 */
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-40 h-full w-96 transform border-r border-border bg-background pt-16 transition-transform duration-200 md:relative md:z-auto md:pt-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:hidden"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sidebar
          </h2>
          <p className="text-sm text-muted-foreground">
            Placeholder. Add your own content or navigation here.
          </p>
        </div>
      </aside>
    </>
  );
}
