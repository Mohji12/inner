import React from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Search, X } from "lucide-react";

export interface MentorSearchParams {
  q?: string;
  languages?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: string;
}

interface MentorSearchFiltersProps {
  filters: MentorSearchParams;
  onChange: (filters: MentorSearchParams) => void;
  onClear: () => void;
}

const LANGUAGE_OPTIONS = ["English", "Spanish", "French", "German", "Hindi", "Mandarin"];

export function MentorSearchFilters({ filters, onChange, onClear }: MentorSearchFiltersProps) {
  const handleLanguageChange = (lang: string, checked: boolean) => {
    const current = filters.languages || [];
    const next = checked ? [...current, lang] : current.filter((l) => l !== lang);
    onChange({ ...filters, languages: next.length > 0 ? next : undefined });
  };

  return (
    <div className="space-y-6 rounded-xl border border-border/60 bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl">Filters</h3>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 px-2 text-muted-foreground">
          <X className="mr-2 h-4 w-4" />
          Clear All
        </Button>
      </div>

      {/* Search */}
      <div className="space-y-3">
        <Label htmlFor="search">Search</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Name, role, company..."
            className="pl-9"
            value={filters.q || ""}
            onChange={(e) => onChange({ ...filters, q: e.target.value || undefined })}
          />
        </div>
      </div>

      {/* Sort */}
      <div className="space-y-3">
        <Label>Sort By</Label>
        <Select
          value={filters.sortBy || "relevance"}
          onValueChange={(val) => onChange({ ...filters, sortBy: val })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="rating_desc">Highest Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Price Range */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Max Price (10 min)</Label>
          <span className="text-sm text-muted-foreground">
            {filters.maxPrice ? `€${filters.maxPrice}` : "Any"}
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[filters.maxPrice || 100]}
          onValueChange={(vals) => onChange({ ...filters, maxPrice: vals[0] < 100 ? vals[0] : undefined })}
        />
      </div>

      {/* Rating */}
      <div className="space-y-3">
        <Label>Minimum Rating</Label>
        <Select
          value={filters.minRating?.toString() || "0"}
          onValueChange={(val) => onChange({ ...filters, minRating: Number(val) || undefined })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any Rating</SelectItem>
            <SelectItem value="4">4.0 & up</SelectItem>
            <SelectItem value="4.5">4.5 & up</SelectItem>
            <SelectItem value="4.8">4.8 & up</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Languages */}
      <div className="space-y-3">
        <Label>Languages</Label>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGE_OPTIONS.map((lang) => (
            <div key={lang} className="flex items-center space-x-2">
              <Checkbox
                id={`lang-${lang}`}
                checked={(filters.languages || []).includes(lang)}
                onCheckedChange={(c) => handleLanguageChange(lang, c as boolean)}
              />
              <label
                htmlFor={`lang-${lang}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {lang}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
