"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";

import { cn } from "./utils";

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const { onOpenChange, ...rest } = props as any;
  // debug: si l'URL contient debugDropdownForceOpen=1 on forcera defaultOpen
  let debugForceOpen = false;
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      debugForceOpen = params.get('debugDropdownForceOpen') === '1';
      if (debugForceOpen) console.debug('[DropdownMenu] debugForceOpen enabled');
    } catch (e) {}
  }

  const handleOpenChange = (open: boolean) => {
    try {
      console.debug('[DropdownMenu] onOpenChange ->', open);
    } catch (e) {}
    if (typeof onOpenChange === 'function') onOpenChange(open);
  };

  return (
    <DropdownMenuPrimitive.Root
      data-slot="dropdown-menu"
      onOpenChange={handleOpenChange}
      {...(debugForceOpen ? { defaultOpen: true } : {})}
      {...rest}
    />
  );
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  const p = props as any;
  const { children, asChild, onClick, ...rest } = p;

  const elRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const now = () => new Date().toISOString();
    const onPointer = (e: any) => { try { console.debug('[Trigger DOM] pointerdown', now(), (e.target as any)?.outerHTML?.slice?.(0,120)); } catch (err) {} };
    const onClickDom = (e: any) => { try { console.debug('[Trigger DOM] click', now(), (e.target as any)?.outerHTML?.slice?.(0,120)); } catch (err) {} };
    const onFocus = (e: any) => { try { console.debug('[Trigger DOM] focus', now(), (e.target as any)?.outerHTML?.slice?.(0,120)); } catch (err) {} };
    el.addEventListener('pointerdown', onPointer, true);
    el.addEventListener('click', onClickDom, true);
    el.addEventListener('focus', onFocus, true);
    return () => {
      try { el.removeEventListener('pointerdown', onPointer, true); } catch (e) {}
      try { el.removeEventListener('click', onClickDom, true); } catch (e) {}
      try { el.removeEventListener('focus', onFocus, true); } catch (e) {}
    };
  }, []);

  const handleClick = (e: any) => {
    try {
      console.debug('[DropdownMenuTrigger] clicked', { asChild: !!asChild });
    } catch (err) {}
    try {
      if (typeof onClick === 'function') onClick(e);
    } catch (err) {}
  };

  if (asChild && React.isValidElement(children)) {
    const child = React.cloneElement(children as any, {
      ref: (node: any) => { elRef.current = node; try { const r = (children as any).ref; if (typeof r === 'function') r(node); else if (r && typeof r === 'object') r.current = node; } catch (e) {} },
      onClick: (e: any) => {
        try { console.debug('[DropdownMenuTrigger] child clicked (cloned)'); } catch (err) {}
        try { if (typeof (children as any).props?.onClick === 'function') (children as any).props.onClick(e); } catch (err) {}
        handleClick(e);
      },
    } as any);

    return (
      <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" asChild {...rest}>
        {child}
      </DropdownMenuPrimitive.Trigger>
    );
  }

  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...rest}
      onClick={handleClick}
      ref={elRef as any}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
          className,
        )}
        
      >
        {/* render children and mount detector */}
        {props.children}
        <div
          data-debug="dropdown-mounted"
          ref={(el) => {
            try {
              if (el) console.debug('[DropdownMenuContent] mounted wrapper', el.parentElement);
            } catch (err) {}
          }}
        />
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

// If user visits app with ?debugDropdown=1 we add a CSS override to make menu visible
// This code is intentionally non-invasive and only adds a visible border/background when the debug flag is present.
const __DROPDOWN_DEBUG__ = typeof window !== 'undefined' && (() => {
  try { return new URLSearchParams(window.location.search).get('debugDropdown') === '1'; } catch (e) { return false; }
})();

if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugDropdown') === '1') {
      // install lightweight event tracers to debug open/close sequences
      try {
        const installTracer = () => {
          const now = () => new Date().toISOString();
          window.addEventListener('pointerdown', (e) => {
            try { console.log('[DropdownDebug] pointerdown', now(), (e.target as any)?.outerHTML?.slice?.(0,200)); } catch (err) {}
          }, true);
              window.addEventListener('click', (e) => {
                try { console.log('[DropdownDebug] click', now(), (e.target as any)?.outerHTML?.slice?.(0,200)); } catch (err) {}
              }, true);
          window.addEventListener('focusout', (e) => {
                try { console.log('[DropdownDebug] focusout', now(), (e.target as any)?.outerHTML?.slice?.(0,200)); } catch (err) {}
          }, true);
        };
        installTracer();
      } catch (err) {}

      const style = document.createElement('style');
      style.id = 'debug-dropdown-style';
      style.innerHTML = `
        [data-slot="dropdown-menu-content"] { position: fixed !important; top: 64px !important; right: 24px !important; z-index: 99999 !important; max-height: 60vh !important; }
        [data-slot="dropdown-menu-content"] { outline: 2px solid rgba(59,130,246,0.6) !important; }
      `;
      document.head.appendChild(style);
      console.debug('[DropdownMenu] debug override enabled via URL param debugDropdown=1');
    }
  } catch (e) {}
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-hidden rounded-md border p-1 shadow-lg",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
