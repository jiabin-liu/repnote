"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type CustomSelectOption = { value: string; label: string; disabled?: boolean };

type CustomSelectProps = {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
};

export default function CustomSelect({ value, options, onChange, ariaLabel, placeholder = "Select", className = "" }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const firstEnabledIndex = () => Math.max(0, options.findIndex((option) => !option.disabled));
  const nextEnabledIndex = (from: number, direction: 1 | -1) => {
    if (!options.length) return 0;
    for (let step = 1; step <= options.length; step += 1) {
      const index = (from + direction * step + options.length) % options.length;
      if (!options[index].disabled) return index;
    }
    return from;
  };
  const openMenu = (preferredIndex = selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabledIndex()) => {
    setActiveIndex(preferredIndex);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus());
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open, activeIndex]);

  const choose = (option: CustomSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      const preferred = event.key === "ArrowUp" ? nextEnabledIndex(selectedIndex >= 0 ? selectedIndex : 0, -1) : undefined;
      openMenu(preferred);
    }
  };
  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = nextEnabledIndex(index, event.key === "ArrowDown" ? 1 : -1);
      setActiveIndex(next);
      optionRefs.current[next]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const enabled = options.map((option, optionIndex) => ({ option, optionIndex })).filter(({ option }) => !option.disabled);
      const next = event.key === "Home" ? enabled[0]?.optionIndex : enabled.at(-1)?.optionIndex;
      if (next != null) {
        setActiveIndex(next);
        optionRefs.current[next]?.focus();
      }
    }
  };

  return (
    <div ref={rootRef} className={`custom-select ${open ? "open" : ""} ${value ? "has-value" : ""} ${className}`.trim()}>
      <button ref={triggerRef} type="button" className="custom-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listboxId} onClick={() => open ? setOpen(false) : openMenu()} onKeyDown={handleTriggerKeyDown}>
        <span>{selectedOption?.label ?? placeholder}</span><ChevronDown aria-hidden="true" />
      </button>
      {open && <div className="custom-select-menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
        {options.map((option, index) => <button ref={(node) => { optionRefs.current[index] = node; }} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} className={option.value === value ? "selected" : ""} key={option.value} onClick={() => choose(option)} onKeyDown={(event) => handleOptionKeyDown(event, index)} onFocus={() => setActiveIndex(index)}><span>{option.label}</span>{option.value === value && <Check aria-hidden="true" />}</button>)}
      </div>}
    </div>
  );
}
