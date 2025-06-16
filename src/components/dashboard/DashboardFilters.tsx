"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FilterX, Search } from 'lucide-react';
import type { FilterOptions, LeakStatus, ApiKeySource } from '@/lib/types';

interface DashboardFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: Partial<FilterOptions>) => void;
  keyTypes: string[];
  sourceTypes: ApiKeySource[];
}

const leakStatuses: LeakStatus[] = ['new', 'investigating', 'remediated', 'false_positive', 'validating', 'error_enhancing'];

export default function DashboardFilters({ filters, onFiltersChange, keyTypes, sourceTypes }: DashboardFiltersProps) {
  const handleResetFilters = () => {
    onFiltersChange({
      status: 'all',
      sourceType: 'all',
      keyType: 'all',
      searchTerm: '',
    });
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <Label htmlFor="searchTerm" className="text-sm font-medium">Search</Label>
            <div className="relative">
              <Input
                id="searchTerm"
                type="text"
                placeholder="Search by URL, hash, snippet..."
                value={filters.searchTerm}
                onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          
          <div>
            <Label htmlFor="statusFilter" className="text-sm font-medium">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => onFiltersChange({ status: value as LeakStatus | 'all' })}
            >
              <SelectTrigger id="statusFilter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {leakStatuses.map(status => (
                  <SelectItem key={status} value={status} className="capitalize">
                    {status.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="keyTypeFilter" className="text-sm font-medium">Key Type</Label>
            <Select
              value={filters.keyType}
              onValueChange={(value) => onFiltersChange({ keyType: value })}
            >
              <SelectTrigger id="keyTypeFilter">
                <SelectValue placeholder="Filter by key type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Key Types</SelectItem>
                {keyTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="sourceTypeFilter" className="text-sm font-medium">Source Type</Label>
            <Select
              value={filters.sourceType}
              onValueChange={(value) => onFiltersChange({ sourceType: value as ApiKeySource | 'all'})}
            >
              <SelectTrigger id="sourceTypeFilter">
                <SelectValue placeholder="Filter by source type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Source Types</SelectItem>
                {sourceTypes.map(type => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reset Button - uncomment if needed, but individual select clear might be better.
              For simplicity now, it's a global reset.
          */}
          <div className="lg:col-start-4">
            <Button onClick={handleResetFilters} variant="outline" className="w-full">
              <FilterX className="mr-2 h-4 w-4" /> Reset Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Added Card and Label to imports, assuming they are available in ui folder
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
