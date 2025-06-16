
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { LayoutDashboard, Loader2, AlertTriangle, SearchSlash } from 'lucide-react';
import { useLeaks } from '@/hooks/useLeaks';
import type { LeakedKey, FilterOptions, ApiKeySource, LeakStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/shared/PageHeader';
import LeakStatusBadge from '@/components/dashboard/LeakStatusBadge';
import ApiKeyIcon from '@/components/dashboard/ApiKeyIcon';
import LeakDetailModal from '@/components/dashboard/LeakDetailModal';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";


const ITEMS_PER_PAGE = 10;

export default function DashboardPage() {
  const { leaks, isLoading, error, updateLeakStatus, enhanceContext, validateKey } = useLeaks();
  const [selectedLeak, setSelectedLeak] = useState<LeakedKey | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    sourceType: 'all',
    keyType: 'all',
    searchTerm: '',
  });

  const uniqueKeyTypes = useMemo(() => {
    const types = new Set(leaks.map(leak => leak.keyType));
    return Array.from(types).sort();
  }, [leaks]);

  const uniqueSourceTypes = useMemo(() => {
    const types = new Set(leaks.map(leak => leak.sourceType));
    return Array.from(types).sort() as ApiKeySource[];
  }, [leaks]);

  const filteredLeaks = useMemo(() => {
    return leaks
      .filter(leak => {
        const searchTermLower = filters.searchTerm.toLowerCase();
        return (
          (filters.status === 'all' || leak.status === filters.status) &&
          (filters.sourceType === 'all' || leak.sourceType === filters.sourceType) &&
          (filters.keyType === 'all' || leak.keyType === filters.keyType) &&
          (filters.searchTerm === '' ||
            leak.apiKeyPreview.toLowerCase().includes(searchTermLower) ||
            leak.keyHash.toLowerCase().includes(searchTermLower) ||
            leak.sourceUrl.toLowerCase().includes(searchTermLower) ||
            (leak.repository && leak.repository.toLowerCase().includes(searchTermLower)) ||
            (leak.filePath && leak.filePath.toLowerCase().includes(searchTermLower)) ||
            leak.contextSnippet.toLowerCase().includes(searchTermLower) ||
            leak.keyType.toLowerCase().includes(searchTermLower)
          )
        );
      })
      .sort((a, b) => new Date(b.detectionTimestamp).getTime() - new Date(a.detectionTimestamp).getTime());
  }, [leaks, filters]);

  const paginatedLeaks = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLeaks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLeaks, currentPage]);

  const totalPages = Math.ceil(filteredLeaks.length / ITEMS_PER_PAGE);

  const handleViewDetails = (leak: LeakedKey) => {
    setSelectedLeak(leak);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLeak(null);
  };

  const handleUpdateStatus = (id: string, status: LeakStatus) => {
    updateLeakStatus(id, status);
    // No toast here, handled in useLeaks if desired
  };

  const handleEnhanceContext = async (id: string) => {
    await enhanceContext(id);
    // selectedLeak will be updated by the useEffect below
  };

  const handleValidateKey = async (id: string) => {
    await validateKey(id);
     // selectedLeak will be updated by the useEffect below
  };
  
  // Update selectedLeak when the main leaks array changes (e.g. after AI enhancement/validation)
  useEffect(() => {
    if (selectedLeak) {
      const updatedLeakFromList = leaks.find(l => l.id === selectedLeak.id);
      if (updatedLeakFromList && JSON.stringify(updatedLeakFromList) !== JSON.stringify(selectedLeak)) {
        setSelectedLeak(updatedLeakFromList);
      }
    }
  }, [leaks, selectedLeak]);


  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxPagesToShow = 5; 
    const halfPagesToShow = Math.floor(maxPagesToShow / 2);

    let startPage = Math.max(1, currentPage - halfPagesToShow);
    let endPage = Math.min(totalPages, currentPage + halfPagesToShow);

    if (currentPage - halfPagesToShow <= 1) {
        endPage = Math.min(totalPages, maxPagesToShow);
    }
    if (currentPage + halfPagesToShow >= totalPages) {
        startPage = Math.max(1, totalPages - maxPagesToShow + 1);
    }
    
    if (startPage > 1) {
        pageNumbers.push(
            <PaginationItem key="page-1">
              <PaginationLink onClick={() => setCurrentPage(1)} isActive={1 === currentPage}>1</PaginationLink>
            </PaginationItem>
        );
        if (startPage > 2) {
            pageNumbers.push(<PaginationItem key="startEllipsisDot"><PaginationEllipsis /></PaginationItem>);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(
            <PaginationItem key={`page-${i}`}>
                <PaginationLink isActive={i === currentPage} onClick={() => setCurrentPage(i)}>
                    {i}
                </PaginationLink>
            </PaginationItem>
        );
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageNumbers.push(<PaginationItem key="endEllipsisDot"><PaginationEllipsis /></PaginationItem>);
        }
        pageNumbers.push(
             <PaginationItem key={`page-${totalPages}`}>
                <PaginationLink onClick={() => setCurrentPage(totalPages)} isActive={totalPages === currentPage}>{totalPages}</PaginationLink>
            </PaginationItem>
        );
    }


    return (
      <Pagination className="mt-6">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(prev => Math.max(1, prev - 1))}} className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined} />
          </PaginationItem>
          {pageNumbers}
          <PaginationItem>
            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(prev => Math.min(totalPages, prev + 1))}} className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  const summaryStats = useMemo(() => {
    const total = leaks.length;
    const newLeaks = leaks.filter(l => l.status === 'new').length;
    const investigating = leaks.filter(l => l.status === 'investigating').length;
    return { total, newLeaks, investigating };
  }, [leaks]);


  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertTriangle className="h-16 w-16 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Leaks</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leak Dashboard" icon={LayoutDashboard} description="Monitor and manage detected API key leaks." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leaks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.total}</div>
            <p className="text-xs text-muted-foreground">Overall detected leaks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Leaks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.newLeaks}</div>
            <p className="text-xs text-muted-foreground">Leaks awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Under Investigation</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.investigating}</div>
            <p className="text-xs text-muted-foreground">Currently being investigated</p>
          </CardContent>
        </Card>
      </div>

      <DashboardFilters 
        filters={filters}
        onFiltersChange={(changedFilters) => {
          setFilters(prev => ({ ...prev, ...changedFilters }));
          setCurrentPage(1); 
        }}
        keyTypes={uniqueKeyTypes}
        sourceTypes={uniqueSourceTypes}
      />

      <Card>
        <CardHeader>
          <CardTitle>Detected Leaks</CardTitle>
          <CardDescription>
            Showing {paginatedLeaks.length} of {filteredLeaks.length} leaks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredLeaks.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 text-center">
                <SearchSlash className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-1">No Leaks Found</h3>
                <p className="text-muted-foreground">
                  {filters.searchTerm || filters.status !== 'all' || filters.keyType !== 'all' || filters.sourceType !== 'all' 
                   ? "No leaks match your current filters. Try adjusting them."
                   : "Great news! No leaks detected currently."}
                </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key Type</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeaks.map(leak => (
                    <TableRow key={leak.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ApiKeyIcon type={leak.keyType} />
                          <span className="font-medium">{leak.keyType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{leak.apiKeyPreview}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ApiKeyIcon type={leak.sourceType} isSourceType />
                          <a href={leak.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary capitalize truncate max-w-xs" title={leak.sourceUrl}>
                            {leak.sourceType} {leak.repository ? `(${leak.repository})` : ''}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>{format(parseISO(leak.detectionTimestamp), "MMM d, yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <LeakStatusBadge status={leak.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(leak)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {renderPagination()}
        </CardContent>
      </Card>
      
      <LeakDetailModal
        leak={selectedLeak}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUpdateStatus={handleUpdateStatus}
        onEnhanceContext={handleEnhanceContext}
        onValidateKey={handleValidateKey}
      />
    </div>
  );
}
