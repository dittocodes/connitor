'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VisitorDetailsCard } from './VisitorDetailsCard';
import {
  verifyCheckInOtp,
  mapErrorCodeToMessage,
  ApiError,
  type VerifyCheckInOtpResponse,
  type OtpVerificationState,
  type TabViewMode,
  type VisitorSearchData,
} from '@/lib/api/visitors-api';
import { ClipboardCheck, Phone, AlertCircle, Loader2 } from 'lucide-react';
import { PhoneLookupFlow } from './PhoneLookupFlow';
import { VisitorService } from '@/lib/services/visitorService';
import { toast } from 'sonner';

export interface CheckInTabProps {
  /** Branch ID for the check-in operation */
  branchId: string;
  /** Callback when check-in is successful */
  onCheckInSuccess?: (visitId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * CheckInTab - OTP Verification component for visitor check-in
 *
 * Features:
 * - 6-digit OTP input with auto-focus and paste support
 * - OTP verification via API
 * - Visitor details display after successful verification
 * - Error handling with user-friendly messages
 * - Phone lookup alternative (placeholder for Task 6.4)
 * - Accessible with proper ARIA attributes and keyboard navigation
 * - Focus management for screen readers
 */
export function CheckInTab({
  branchId,
  onCheckInSuccess,
  className,
}: CheckInTabProps): React.ReactElement {
  // View mode state
  const [viewMode, setViewMode] = React.useState<TabViewMode>('otp');

  // OTP state
  const [otpValue, setOtpValue] = React.useState('');
  const [otpState, setOtpState] = React.useState<OtpVerificationState>('idle');
  const [otpError, setOtpError] = React.useState<string | undefined>(undefined);

  // Visitor data state
  const [visitorData, setVisitorData] =
    React.useState<VerifyCheckInOtpResponse | null>(null);

  // Check-in state
  const [isCheckingIn, setIsCheckingIn] = React.useState(false);

  // Refs for focus management
  const otpInputRef = React.useRef<HTMLInputElement>(null);
  const visitorCardRef = React.useRef<HTMLDivElement>(null);
  const errorAlertRef = React.useRef<HTMLDivElement>(null);

  // Focus OTP input on mount
  React.useEffect(() => {
    if (viewMode === 'otp' && otpState === 'idle') {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [viewMode, otpState]);

  // Focus visitor card on successful verification
  React.useEffect(() => {
    if (viewMode === 'visitor_details' && visitorData) {
      const timer = setTimeout(() => {
        visitorCardRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [viewMode, visitorData]);

  // Focus error alert when error occurs
  React.useEffect(() => {
    if (otpError && otpState === 'error') {
      const timer = setTimeout(() => {
        errorAlertRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [otpError, otpState]);

  /**
   * Announces status to screen readers
   */
  const announceStatus = React.useCallback((message: string): void => {
    // Create a live region for screen reader announcements
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  /**
   * Handles OTP completion and triggers verification
   */
  const handleOtpComplete = React.useCallback(
    async (otp: string): Promise<void> => {
      if (otp.length !== 6) return;

      setOtpState('loading');
      setOtpError(undefined);

      try {
        const response = await verifyCheckInOtp({ otp, branchId });

        if (response.success) {
          setVisitorData(response);
          setOtpState('success');
          setViewMode('visitor_details');
          announceStatus('OTP Verified! Ready to check in.');
        }
      } catch (error) {
        setOtpState('error');
        if (error instanceof ApiError) {
          setOtpError(mapErrorCodeToMessage(error.code));
        } else {
          setOtpError(mapErrorCodeToMessage('UNKNOWN_ERROR'));
        }
        // Focus back to OTP input for retry
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 100);
      }
    },
    [branchId, announceStatus],
  );

  /**
   * Handles OTP value changes
   */
  const handleOtpChange = React.useCallback(
    (value: string): void => {
      setOtpValue(value);
      // Clear error when user starts typing again
      if (otpError) {
        setOtpError(undefined);
        setOtpState('idle');
      }
    },
    [otpError],
  );

  /**
   * Handles manual verify button click
   */
  const handleVerifyClick = React.useCallback((): void => {
    if (otpValue.length === 6) {
      void handleOtpComplete(otpValue);
    }
  }, [otpValue, handleOtpComplete]);

  /**
   * Handles cancel action - resets to OTP view
   */
  const handleCancel = React.useCallback((): void => {
    setViewMode('otp');
    setOtpValue('');
    setOtpState('idle');
    setOtpError(undefined);
    setVisitorData(null);
    setIsCheckingIn(false);
    // Focus back to OTP input
    setTimeout(() => {
      otpInputRef.current?.focus();
    }, 100);
  }, []);

  /**
   * Handles check-in action
   * Calls check-in API with visitId from verified OTP response.
   * Shows success toast on completion, transitions back to OTP input.
   */
  const handleCheckIn = React.useCallback(async (): Promise<void> => {
    if (!visitorData) return;

    setIsCheckingIn(true);
    try {
      const response = await VisitorService.checkInVisit(visitorData.visitId);

      // Show success toast with visitor name
      toast.success('Check-In Successful', {
        description: `${response.visitor.firstName} ${response.visitor.lastName} is now checked in.`,
      });

      // Announce to screen readers
      announceStatus('Check-in completed successfully.');

      // Call parent callback if provided
      onCheckInSuccess?.(response.visitId);

      // Reset to fresh OTP input state
      handleCancel();
    } catch (error) {
      // Map error codes to user-friendly messages
      let errorMessage = 'Check-in failed. Please try again.';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { response?: { data?: { error?: string } } };
        const errorCode = apiError.response?.data?.error;
        
        if (errorCode) {
          switch (errorCode) {
            case 'VISIT_NOT_APPROVED':
              errorMessage = 'Visit is not approved for check-in.';
              break;
            case 'ALREADY_CHECKED_IN':
              errorMessage = 'Visitor is already checked in.';
              break;
            case 'VISIT_ALREADY_COMPLETED':
              errorMessage = 'This visit has already been completed.';
              break;
            case 'VISIT_NOT_FOUND':
              errorMessage = 'Visit not found. Please verify again.';
              break;
            case 'FORBIDDEN_BRANCH':
              errorMessage = 'You do not have access to this visit.';
              break;
          }
        }
      }

      toast.error('Check-In Failed', {
        description: errorMessage,
      });

      announceStatus(`Check-in failed. ${errorMessage}`);
    } finally {
      setIsCheckingIn(false);
    }
  }, [visitorData, onCheckInSuccess, handleCancel, announceStatus]);

  /**
   * Handles phone lookup button click
   */
  const handlePhoneLookupClick = React.useCallback((): void => {
    setViewMode('phone');
  }, []);

  /**
   * Handles visitor found from phone lookup
   */
  const handleVisitorFound = React.useCallback((visitor: VisitorSearchData): void => {
    // For now, we'll create a mock VerifyCheckInOtpResponse from the visitor data
    // In Task 6.5, this will be replaced with actual check-in logic
    const mockResponse: VerifyCheckInOtpResponse = {
      success: true,
      visitId: 'mock-visit-id', // This will be generated in Task 6.5
      visitorId: visitor.id,
      visitor: {
        id: visitor.id,
        firstName: visitor.firstName,
        lastName: visitor.lastName,
        phone: visitor.phone,
        email: visitor.email,
        photo: visitor.photo,
        company: visitor.company,
      },
      visit: {
        id: 'mock-visit-id',
        visitCategory: 'MEETING', // Default, will be determined in Task 6.5
        visitSubType: null,
        status: 'APPROVED',
        checkInOtp: '000000', // Not applicable for phone lookup
        checkInOtpExpiry: new Date().toISOString(),
        purpose: null,
        department: null,
        deliveryPlatform: null,
        deliveryRecipient: null,
        orderReference: null,
        staffName: null,
        staffPhone: null,
      },
      canCheckIn: true,
    };

    setVisitorData(mockResponse);
    setViewMode('visitor_details');
    announceStatus('Visitor selected. Ready to check in.');
  }, [announceStatus]);

  // Determine if verify button should be disabled
  const isVerifyDisabled = otpValue.length !== 6 || otpState === 'loading';

  return (
    <div
      id="check-in-tab-content"
      role="tabpanel"
      aria-labelledby="tab-check-in"
      className={cn('p-4', className)}
      data-testid="check-in-tab"
    >
      {/* Screen reader announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {otpState === 'loading' && 'Verifying OTP...'}
        {otpState === 'success' && 'OTP Verified! Ready to check in.'}
        {otpState === 'error' && otpError}
      </div>

      {viewMode === 'visitor_details' && visitorData ? (
        <div ref={visitorCardRef} tabIndex={-1}>
          <VisitorDetailsCard
            visitorData={visitorData}
            onCheckIn={handleCheckIn}
            onCancel={handleCancel}
            isCheckingIn={isCheckingIn}
          />
        </div>
      ) : viewMode === 'phone' ? (
        <PhoneLookupFlow
          branchId={branchId}
          onVisitorFound={handleVisitorFound}
          onBack={() => setViewMode('otp')}
        />
      ) : (
        // OTP Verification View
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">
              Quick Check-In
            </h2>
            <p className="text-sm text-gray-500">
              Enter the 6-digit OTP from the visitor&apos;s gate pass
            </p>
          </div>

          {/* OTP Input Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="otp-input"
                className="block text-sm font-medium text-gray-700"
              >
                Visitor OTP
              </label>
              <div className="flex justify-center">
                <InputOTP
                  id="otp-input"
                  ref={otpInputRef}
                  maxLength={6}
                  value={otpValue}
                  onChange={handleOtpChange}
                  onComplete={handleOtpComplete}
                  disabled={otpState === 'loading'}
                  aria-label="Visitor Check-In OTP"
                  aria-describedby={otpError ? 'otp-error' : undefined}
                  aria-invalid={otpState === 'error'}
                  data-testid="otp-input"
                  className={cn(
                    otpState === 'error' &&
                      '[&_div[data-slot="input-otp-slot"]]:border-red-500 [&_div[data-slot="input-otp-slot"]]:ring-red-200',
                  )}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            {/* Error Message */}
            {otpError && (
              <Alert
                ref={errorAlertRef}
                variant="destructive"
                className="text-sm"
                role="alert"
                aria-live="polite"
                id="otp-error"
                tabIndex={-1}
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{otpError}</AlertDescription>
              </Alert>
            )}

            {/* Verify Button */}
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleVerifyClick}
              disabled={isVerifyDisabled}
              aria-label="Verify visitor OTP"
              aria-busy={otpState === 'loading'}
              data-testid="verify-otp-button"
            >
              {otpState === 'loading' ? (
                <>
                  <Loader2
                    className="h-4 w-4 mr-2 animate-spin"
                    aria-hidden="true"
                  />
                  Verifying...
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4 mr-2" aria-hidden="true" />
                  Verify OTP
                </>
              )}
            </Button>
          </div>

          {/* Alternative: Phone Lookup */}
          <div className="text-center">
            <Button
              variant="outline"
              className="w-full"
              onClick={handlePhoneLookupClick}
              aria-label="Check visitor by phone number"
              data-testid="phone-lookup-button"
            >
              <Phone className="h-4 w-4 mr-2" aria-hidden="true" />
              Check Visitor
            </Button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Instructions
            </h3>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Ask the visitor for their 6-digit OTP from the gate pass</li>
              <li>Enter the OTP above and click Verify</li>
              <li>Verify visitor identity matches the displayed details</li>
              <li>Click Check In to complete the process</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
