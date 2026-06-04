'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api';
import { StatusFilterPills } from '@/components/visitors/logs/StatusFilterPills';
import { VisitorList } from '@/app/dashboard/security/logs/VisitorList';
import { LogsRefreshControl } from './logs-refresh-control';
import { VisitorDetailsModal, ActionResult } from '@/components/visitors/security/VisitorDetailsModal';
import { VisitorService } from '@/lib/services/visitorService';
import { approveVisit } from '@/services/visit.service';
import type {
  StatusFilter,
  StatusFilterConfig,
  VisitorCounts,
  VisitorProfile,
  VisitorCountsResponse,
  VisitorListResponse,
} from '@/types/visitor';
import { VisitStatus } from '@/types/visitor';

export interface LogsTabProps {
  branchId: string;
  authToken: string;
  className?: string;
}

/**
 * Status Filter Configuration
 */
const STATUS_FILTER_CONFIGS: StatusFilterConfig[] = [
  {
    id: 'PENDING',
    label: 'Pending',
    visitStatuses: [VisitStatus.PENDING, VisitStatus.REQUEST_SENT],
    color: 'blue',
  },
  {
    id: 'APPROVED',
    label: 'Approved',
    visitStatuses: [VisitStatus.APPROVED],
    color: 'emerald',
  },
  {
    id: 'IN',
    label: 'In',
    visitStatuses: [VisitStatus.CHECKED_IN],
    color: 'purple',
  },
  {
    id: 'OUT',
    label: 'Out',
    visitStatuses: [VisitStatus.CHECKED_OUT],
    color: 'gray',
  },
];

/**
 * Fetch visitor counts from API
 */
async function fetchVisitorCounts(
  branchId: string,
  authToken: string
): Promise<VisitorCountsResponse> {
  const response = await apiClient.get<VisitorCountsResponse>(
    `/api/security/visitors/counts?branchId=${encodeURIComponent(branchId)}`,
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  return response.data;
}

/**
 * Fetch visitors by status from API
 */
async function fetchVisitorsByStatus(
  branchId: string,
  statuses: VisitStatus[],
  authToken: string
): Promise<VisitorListResponse> {
  const statusParams = statuses.map((s) => `status=${encodeURIComponent(s)}`).join('&');
  const url = `/api/security/visitors?branchId=${encodeURIComponent(branchId)}&${statusParams}`;

  const response = await apiClient.get<VisitorListResponse>(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  return response.data;
}

/**
 * Get filter label for display
 */
function getFilterLabel(filter: StatusFilter): string {
  const config = STATUS_FILTER_CONFIGS.find((c) => c.id === filter);
  return config?.label || filter;
}

/**
 * LogsTab Component
 *
 * Main component for the Security Dashboard Logs tab.
 * Displays visitor filters and list with polling support.
 */
export function LogsTab({ branchId, authToken, className }: LogsTabProps): React.ReactElement {
  const [selectedFilter, setSelectedFilter] = React.useState<StatusFilter>('PENDING');
  const [counts, setCounts] = React.useState<VisitorCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = React.useState(true);
  const [countsError, setCountsError] = React.useState<string | null>(null);
  const [visitors, setVisitors] = React.useState<VisitorProfile[] | null>(null);
  const [isLoadingVisitors, setIsLoadingVisitors] = React.useState(false);
  const [visitorsError, setVisitorsError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  // State for visitor details modal
  const [visitorToViewDetails, setVisitorToViewDetails] = React.useState<VisitorProfile | null>(
    null
  );
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false);

  // Callback functions for visitor actions (non-polling dependent)
  const handleVerifyOtp = React.useCallback((visitorId: string) => {
    console.log('Verify OTP for visitor:', visitorId);
    // TODO: Implement OTP verification flow
    // This will open OTP verification modal/dialog
  }, []);

  const handleCheckOut = React.useCallback((visitorId: string) => {
    console.log('Check out visitor:', visitorId);
    // TODO: Implement check-out API call
    // This will be replaced with actual API call to /visits/:visitId/checkout
  }, []);

  const handleViewDetails = React.useCallback((visitorId: string) => {
    const visitor = visitors?.find((v) => v.id === visitorId);
    if (visitor) {
      setVisitorToViewDetails(visitor);
      setIsDetailsModalOpen(true);
    }
  }, [visitors]);

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Extract counts fetch into a separate function that can be called on mount AND when visitors are fetched
  const loadCounts = React.useCallback(async () => {
    setIsLoadingCounts(true);
    setCountsError(null);

    try {
      const response = await fetchVisitorCounts(branchId, authToken);
      if (response.success) {
        setCounts(response.data);
      } else {
        setCountsError('Unable to load visitor counts');
      }
    } catch (error) {
      console.error('Failed to fetch counts:', error);
      setCountsError('Network error. Please check connection.');
    } finally {
      setIsLoadingCounts(false);
    }
  }, [branchId, authToken]);

  // Fetch counts on mount
  React.useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // Fetch visitors when filter changes
  React.useEffect(() => {
    const fetchVisitors = async (): Promise<void> => {
      setIsLoadingVisitors(true);
      setVisitorsError(null);

      try {
        const filterConfig = STATUS_FILTER_CONFIGS.find((c) => c.id === selectedFilter);
        if (!filterConfig) {
          throw new Error('Invalid filter');
        }

        const response = await fetchVisitorsByStatus(
          branchId,
          filterConfig.visitStatuses,
          authToken
        );

        if (response.success) {
          setVisitors(response.data.visitors);

          // Refresh counts so they're always in sync
          await loadCounts();
        } else {
          throw new Error('Failed to load visitors');
        }
      } catch (error) {
        console.error('Failed to fetch visitors:', error);
        setVisitorsError('Network error. Please check connection.');
      } finally {
        setIsLoadingVisitors(false);
      }
    };

    fetchVisitors();
  }, [selectedFilter, branchId, authToken, loadCounts]);

  // Polling state and refs
  const [isPollingActive, setIsPollingActive] = React.useState(true);
  const [lastRefreshTime, setLastRefreshTime] = React.useState<Date | null>(null);
  const pollingTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Set up polling interval
  React.useEffect(() => {
    const performPoll = async (): Promise<void> => {
      if (!isPollingActive) return;

      try {
        const filterConfig = STATUS_FILTER_CONFIGS.find((c) => c.id === selectedFilter);
        if (!filterConfig) return;

        const response = await fetchVisitorsByStatus(
          branchId,
          filterConfig.visitStatuses,
          authToken
        );

        if (response.success) {
          setVisitors(response.data.visitors);
          setLastRefreshTime(new Date());

          // Refresh counts so they stay in sync with polled data
          await loadCounts();
        }
      } catch (error) {
        // Silently fail on polling errors - don't disrupt user
        console.error('Polling error:', error);
      }
    };

    // Clear existing timer
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    // Set up new polling interval
    if (isPollingActive) {
      pollingTimerRef.current = setInterval(performPoll, 30000);
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [selectedFilter, branchId, authToken, isPollingActive, loadCounts]);

  // Manual refresh
  const handleManualRefresh = React.useCallback(async (): Promise<void> => {
    setIsLoadingVisitors(true);
    setVisitorsError(null);

    try {
      const filterConfig = STATUS_FILTER_CONFIGS.find((c) => c.id === selectedFilter);
      if (!filterConfig) {
        throw new Error('Invalid filter');
      }

      const response = await fetchVisitorsByStatus(
        branchId,
        filterConfig.visitStatuses,
        authToken
      );

      if (response.success) {
        setVisitors(response.data.visitors);
        setLastRefreshTime(new Date());

        // Refresh counts so they're always in sync after manual refresh
        await loadCounts();
      } else {
        throw new Error('Failed to load visitors');
      }
    } catch (error) {
      console.error('Failed to fetch visitors:', error);
      setVisitorsError('Network error. Please check connection.');
    } finally {
      setIsLoadingVisitors(false);
    }
  }, [selectedFilter, branchId, authToken, loadCounts]);

  // Toggle polling
  const handleTogglePolling = React.useCallback((): void => {
    setIsPollingActive((prev) => !prev);
  }, []);

  // Callback for visitor actions - refresh the list
  const handleActionComplete = React.useCallback(
    (visitId: string, newStatus: VisitStatus) => {
      console.log('Action completed:', visitId, 'New status:', newStatus);
      handleManualRefresh();
    },
    [handleManualRefresh]
  );

  // Handle modal actions (approve, check-in, check-out)
  const handleModalAction = React.useCallback(async (visitId: string): Promise<ActionResult> => {
    const visitor = visitors?.find((v) => v.id === visitId);
    if (!visitor) {
      return { success: false, error: 'Visitor not found' };
    }

    try {
      if (visitor.status === VisitStatus.PENDING || visitor.status === VisitStatus.REQUEST_SENT) {
        // Approve the visit
        await approveVisit(visitId);
      } else if (visitor.status === VisitStatus.APPROVED) {
        // Check in the visitor
        await VisitorService.checkInVisit(visitId);
      } else if (visitor.status === VisitStatus.CHECKED_IN) {
        // Check out the visitor
        await VisitorService.checkOut(visitId);
      } else {
        return { success: false, error: 'Invalid status for action' };
      }
      
      // Refresh the list
      handleManualRefresh();
      
      // Close modal
      setIsDetailsModalOpen(false);
      
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed';
      console.error('Action failed:', message);
      return { success: false, error: message };
    }
  }, [visitors, handleManualRefresh]);

  // Handle filter change
  const handleFilterChange = (newFilter: StatusFilter) => {
    setSelectedFilter(newFilter);
  };

  const handleRetry = () => {
    handleManualRefresh();
  };

  return (
    <div
      id="logs-tab-content"
      role="tabpanel"
      aria-labelledby="tab-logs"
      className={cn('p-4', className)}
      data-testid="logs-tab"
    >
      <div className="space-y-6">
        {/* Status Filter Pills */}
        <StatusFilterPills
          selectedFilter={selectedFilter}
          counts={counts}
          onFilterChange={handleFilterChange}
          disabled={isLoadingCounts}
        />

        {/* Counts Error Banner */}
        {countsError && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"
            data-testid="counts-error"
          >
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">{countsError}</p>
          </div>
        )}

        {/* Refresh Control */}
        <LogsRefreshControl
          isLoading={isLoadingVisitors}
          lastRefreshTime={lastRefreshTime}
          onManualRefresh={handleManualRefresh}
          onTogglePolling={handleTogglePolling}
          isPollingActive={isPollingActive}
        />

        {/* Visitor List Region */}
        <div
          role="region"
          aria-live="polite"
          aria-busy={isLoadingVisitors}
          aria-label={`${getFilterLabel(selectedFilter)} visitors`}
        >
          <VisitorList
            visitors={visitors || []}
            isLoading={isLoadingVisitors}
            error={visitorsError ? new Error(visitorsError) : null}
            searchQuery={searchQuery}
            selectedFilter={selectedFilter}
            onSearch={handleSearch}
            onActionComplete={handleActionComplete}
            onVerifyOtp={handleVerifyOtp}
            onCheckOut={handleCheckOut}
            onViewDetails={handleViewDetails}
            onRetry={handleRetry}
          />
        </div>
      </div>

      {/* Visitor Details Modal */}
      {visitorToViewDetails && (
        <VisitorDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          visitId={visitorToViewDetails.id}
          onAction={handleModalAction}
        />
      )}
    </div>
  );
}
