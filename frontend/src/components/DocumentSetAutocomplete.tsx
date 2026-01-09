import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DocumentSetAutocompleteProps {
  documentSets: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

export function DocumentSetAutocomplete({
  documentSets,
  value,
  onChange,
  loading = false,
}: DocumentSetAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleSelect = (currentValue: string) => {
    onChange(currentValue === value ? "" : currentValue);
    setOpen(false);
  };

  const handleInputChange = (search: string) => {
    setInputValue(search);
    // Allow creating new document set by typing
    if (!documentSets.includes(search) && search.trim() !== "") {
      onChange(search);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading}
        >
          {value || "Select or create document set..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type to create..."
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandEmpty>
            <div className="p-2 text-sm">
              Press Enter to create{" "}
              <strong className="text-primary">{inputValue}</strong>
            </div>
          </CommandEmpty>
          <CommandGroup>
            {documentSets.map((set) => (
              <CommandItem
                key={set}
                value={set}
                onSelect={() => handleSelect(set)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === set ? "opacity-100" : "opacity-0",
                  )}
                />
                {set}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
