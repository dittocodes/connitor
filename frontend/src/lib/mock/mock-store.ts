import { DEFAULT_DEMO_USER_ID } from '@/lib/demo-config';
import {
  buildSeedNotifications,
  buildSeedVisits,
  MockBranch,
  MockChain,
  MockNotification,
  MockUser,
  MockVisit,
  MockVisitor,
  seedBranches,
  seedChains,
  seedUsers,
  seedVisitors,
  visitorFullName,
} from './seed-data';
import { USER_IDS } from './ids';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class MockStore {
  chains: MockChain[] = clone(seedChains);
  branches: MockBranch[] = clone(seedBranches);
  users: MockUser[] = clone(seedUsers);
  visitors: MockVisitor[] = clone(seedVisitors);
  visits: MockVisit[] = buildSeedVisits();
  notifications: MockNotification[] = buildSeedNotifications();

  reset() {
    this.chains = clone(seedChains);
    this.branches = clone(seedBranches);
    this.users = clone(seedUsers);
    this.visitors = clone(seedVisitors);
    this.visits = buildSeedVisits();
    this.notifications = buildSeedNotifications();
  }

  getUserById(id: string): MockUser | undefined {
    return this.users.find((user) => user.id === id);
  }

  getCurrentUser(headerUserId?: string): MockUser {
    const id = headerUserId || DEFAULT_DEMO_USER_ID;
    return this.getUserById(id) ?? this.users[0];
  }

  getVisitorById(id: string): MockVisitor | undefined {
    return this.visitors.find((visitor) => visitor.id === id);
  }

  getBranchById(id: string): MockBranch | undefined {
    return this.branches.find((branch) => branch.id === id);
  }

  getChainById(id: string): MockChain | undefined {
    return this.chains.find((chain) => chain.id === id);
  }

  getVisitById(id: string): MockVisit | undefined {
    return this.visits.find((visit) => visit.id === id);
  }

  filterUsers(params: Record<string, string | undefined>): MockUser[] {
    let result = [...this.users];

    if (params.role) {
      result = result.filter((user) => user.role === params.role);
    }
    if (params.branchId) {
      result = result.filter((user) => user.branchId === params.branchId);
    }
    if (params.chainId) {
      result = result.filter((user) => user.hospitalChainId === params.chainId);
    }
    if (params.isActive === 'true') {
      result = result.filter((user) => user.isActive);
    }
    if (params.isActive === 'false') {
      result = result.filter((user) => !user.isActive);
    }

    return result;
  }

  visitsForBranch(branchId: string): MockVisit[] {
    return this.visits.filter((visit) => visit.branchId === branchId);
  }

  visitsForChain(chainId: string): MockVisit[] {
    const branchIds = this.branches
      .filter((branch) => branch.hospitalChainId === chainId)
      .map((branch) => branch.id);
    return this.visits.filter((visit) => branchIds.includes(visit.branchId));
  }

  toSummaryRow(visit: MockVisit) {
    const visitor = this.getVisitorById(visit.visitorId);
    return {
      id: visit.id,
      visitorName: visitor ? visitorFullName(visitor) : 'Unknown Visitor',
      visitorPhone: visitor?.phone ?? '',
      visitorPhoto: null,
      personToMeet: visit.staffName ?? 'N/A',
      purpose: visit.purpose ?? visit.deliveryPlatform ?? 'Visit',
      status: visit.status,
      checkInTime: visit.checkInTime ?? null,
      checkOutTime: visit.checkOutTime ?? null,
      visitorEmail: visitor?.email ?? null,
      checkedInLocation: visit.checkedInLocation ?? null,
      rejectionReason: visit.rejectionReason ?? null,
      visitCode: visit.visitCode ?? null,
      department: visit.department ?? null,
      createdAt: visit.createdAt,
    };
  }

  toVisitorProfile(visit: MockVisit) {
    const visitor = this.getVisitorById(visit.visitorId);
    return {
      id: visit.id,
      visitorName: visitor ? visitorFullName(visitor) : 'Unknown Visitor',
      visitorPhone: visitor?.phone ?? '',
      visitorEmail: visitor?.email ?? null,
      visitorPhoto: null,
      visitType: visit.visitCategory,
      status: visit.status,
      personToMeet: visit.staffName,
      purpose: visit.purpose ?? visit.deliveryPlatform,
      checkInTime: visit.checkInTime ?? null,
      checkOutTime: visit.checkOutTime ?? null,
    };
  }

  toStaffVisit(visit: MockVisit) {
    const visitor = this.getVisitorById(visit.visitorId);
    return {
      id: visit.id,
      purpose: visit.purpose ?? visit.deliveryPlatform ?? 'Visit',
      status: visit.status,
      rejectionReason: visit.rejectionReason ?? null,
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
      durationMinutes: visit.durationMinutes ?? null,
      checkInTime: visit.checkInTime ?? null,
      checkOutTime: visit.checkOutTime ?? null,
      visitCode: visit.visitCode ?? null,
      visitQRCode: null,
      visitor: {
        firstName: visitor?.firstName ?? 'Unknown',
        middleName: visitor?.middleName ?? null,
        lastName: visitor?.lastName ?? 'Visitor',
        phone: visitor?.phone ?? '',
      },
    };
  }

  getSecurityCounts(branchId: string) {
    const visits = this.visitsForBranch(branchId);
    return {
      pending: visits.filter((v) =>
        ['PENDING', 'REQUEST_SENT'].includes(v.status),
      ).length,
      approved: visits.filter((v) => v.status === 'APPROVED').length,
      checkedIn: visits.filter((v) => v.status === 'CHECKED_IN').length,
      checkedOut: visits.filter((v) => v.status === 'CHECKED_OUT').length,
      rejected: visits.filter((v) => v.status === 'REJECTED').length,
    };
  }

  getStaffPendingVisits(userId: string) {
    const user = this.getUserById(userId);
    if (!user) return [];

    return this.visits
      .filter(
        (visit) =>
          visit.staffId === userId &&
          ['PENDING', 'REQUEST_SENT'].includes(visit.status),
      )
      .map((visit) => this.toStaffVisit(visit));
  }

  getStaffHistory(userId: string) {
    const user = this.getUserById(userId);
    if (!user) return [];

    return this.visits
      .filter(
        (visit) =>
          visit.staffId === userId &&
          !['PENDING', 'REQUEST_SENT'].includes(visit.status),
      )
      .map((visit) => this.toStaffVisit(visit));
  }

  getUnreadNotifications(userId: string) {
    return this.notifications.filter(
      (notification) => notification.recipientId === userId && !notification.read,
    );
  }

  markNotificationRead(id: string) {
    const notification = this.notifications.find((item) => item.id === id);
    if (notification) notification.read = true;
  }

  approveVisit(visitId: string) {
    const visit = this.getVisitById(visitId);
    if (!visit) return null;
    visit.status = 'APPROVED';
    visit.visitCode = visit.visitCode ?? String(Math.floor(100000 + Math.random() * 900000));
    visit.checkInOtp = visit.checkInOtp ?? '123456';
    visit.checkInOtpExpiry = new Date(Date.now() + 3600000).toISOString();
    visit.gatePassGeneratedAt = new Date().toISOString();
    visit.updatedAt = new Date().toISOString();
    return visit;
  }

  rejectVisit(visitId: string, reason?: string) {
    const visit = this.getVisitById(visitId);
    if (!visit) return null;
    visit.status = 'REJECTED';
    visit.rejectionReason = reason ?? 'Rejected';
    visit.updatedAt = new Date().toISOString();
    return visit;
  }

  checkInVisit(visitId: string) {
    const visit = this.getVisitById(visitId);
    if (!visit) return null;
    visit.status = 'CHECKED_IN';
    visit.checkInTime = new Date().toISOString();
    visit.updatedAt = visit.checkInTime;
    return visit;
  }

  checkOutVisit(visitId: string) {
    const visit = this.getVisitById(visitId);
    if (!visit) return null;
    visit.status = 'CHECKED_OUT';
    visit.checkOutTime = new Date().toISOString();
    visit.updatedAt = visit.checkOutTime;
    return visit;
  }

  getBranchInfo(branchId: string) {
    const branch = this.getBranchById(branchId);
    if (!branch) return null;

    const staff = this.users.filter(
      (user) => user.branchId === branchId && user.role === 'STAFF' && user.isActive,
    );

    return {
      id: branch.id,
      name: branch.name,
      users: staff.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        department: user.department ?? 'GENERAL_MEDICINE',
      })),
    };
  }

  getVisitStatusPayload(visitId: string) {
    const visit = this.getVisitById(visitId);
    const visitor = visit ? this.getVisitorById(visit.visitorId) : undefined;
    const branch = visit ? this.getBranchById(visit.branchId) : undefined;

    if (!visit || !visitor || !branch) {
      return {
        success: false,
        data: null,
        error: { code: 'VISIT_NOT_FOUND', message: 'Visit not found' },
      };
    }

    const data: Record<string, unknown> = {
      visitId: visit.id,
      status: visit.status,
      visitor: {
        id: visitor.id,
        firstName: visitor.firstName,
        lastName: visitor.lastName,
        fullName: visitorFullName(visitor),
        phone: visitor.phone,
      },
      visitCategory: visit.visitCategory,
      submittedAt: visit.createdAt,
      branch: {
        id: branch.id,
        name: branch.name,
        phone: branch.phone,
      },
    };

    if (visit.visitCategory === 'MEETING') {
      data.meetingDetails = {
        purpose: visit.purpose,
        department: visit.department,
        staffName: visit.staffName,
      };
    }

    if (visit.visitCategory === 'DELIVERY') {
      data.deliveryDetails = {
        platform: visit.deliveryPlatform,
        recipient: visit.deliveryRecipient,
        orderReference: visit.orderReference,
      };
    }

    if (visit.status === 'APPROVED' && visit.checkInOtp) {
      data.approvedAt = visit.gatePassGeneratedAt ?? visit.updatedAt;
      data.gatePass = {
        checkInOtp: visit.checkInOtp,
        validUntil: visit.checkInOtpExpiry ?? new Date(Date.now() + 3600000).toISOString(),
        generatedAt: visit.gatePassGeneratedAt ?? new Date().toISOString(),
        sentViaWhatsApp: true,
      };
    }

    if (visit.status === 'REJECTED') {
      data.rejectedAt = visit.updatedAt;
      data.rejectionReason = visit.rejectionReason;
    }

    return { success: true, data };
  }

  getAnalyticsOverview() {
    const staffCount = this.users.filter((user) => user.role === 'STAFF').length;
    const activeVisits = this.visits.filter((visit) => visit.status === 'CHECKED_IN').length;
    const today = new Date().toISOString().slice(0, 10);
    const todayVisits = this.visits.filter((visit) =>
      visit.createdAt.startsWith(today),
    ).length;

    return {
      totalChains: this.chains.length,
      totalBranches: this.branches.length,
      totalStaff: staffCount,
      totalVisitors: this.visitors.length,
      activeVisits,
      todayVisits: todayVisits || this.visits.length,
    };
  }

  getTrendData(period = 'weekly') {
    const labels =
      period === 'hourly'
        ? ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM']
        : period === 'daily'
          ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          : period === 'monthly'
            ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            : period === 'yearly'
              ? ['2021', '2022', '2023', '2024', '2025', '2026']
              : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

    return {
      period,
      data: labels.map((label, index) => ({
        label,
        visits: 8 + index * 3 + (index % 2),
        checkIns: 5 + index * 2,
        checkOuts: 4 + index * 2,
      })),
    };
  }

  getStatusDistribution() {
    const statuses = ['PENDING', 'REQUEST_SENT', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'REJECTED'];
    return statuses.map((status) => ({
      status,
      count: this.visits.filter((visit) => visit.status === status).length,
    }));
  }

  getCategoryDistribution() {
    return ['MEETING', 'DELIVERY'].map((category) => ({
      category,
      count: this.visits.filter((visit) => visit.visitCategory === category).length,
    }));
  }

  getRoleDistribution() {
    const roles = ['SUPER_ADMIN', 'CHAIN_ADMIN', 'BRANCH_ADMIN', 'STAFF', 'SECURITY'];
    return roles.map((role) => ({
      role,
      count: this.users.filter((user) => user.role === role).length,
    }));
  }

  getChainStats(chainId: string) {
    const chain = this.getChainById(chainId);
    const branches = this.branches.filter((branch) => branch.hospitalChainId === chainId);
    const visits = this.visitsForChain(chainId);
    const staff = this.users.filter(
      (user) => user.hospitalChainId === chainId && user.role === 'STAFF',
    );

    return {
      chainId,
      chainName: chain?.name ?? 'Hospital Chain',
      totalBranches: branches.length,
      totalStaff: staff.length,
      totalVisitors: this.visitors.filter((visitor) =>
        branches.some((branch) => branch.id === visitor.branchId),
      ).length,
      activeVisits: visits.filter((visit) => visit.status === 'CHECKED_IN').length,
      todayVisits: visits.length,
    };
  }

  getBranchStats(branchId: string) {
    const branch = this.getBranchById(branchId);
    const visits = this.visitsForBranch(branchId);
    const staff = this.users.filter(
      (user) => user.branchId === branchId && user.role === 'STAFF',
    );

    return {
      branchId,
      branchName: branch?.name ?? 'Branch',
      totalStaff: staff.length,
      totalVisitors: this.visitors.filter((visitor) => visitor.branchId === branchId).length,
      activeVisits: visits.filter((visit) => visit.status === 'CHECKED_IN').length,
      todayVisits: visits.length,
    };
  }

  getGrowthData(type: 'chains' | 'branches') {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const base = type === 'chains' ? this.chains.length : this.branches.length;
    return {
      period: 'monthly',
      data: labels.map((label, index) => ({
        label,
        count: Math.max(1, base - (labels.length - index - 1)),
      })),
    };
  }

  createUser(data: Record<string, unknown>) {
    const user: MockUser = {
      id: crypto.randomUUID(),
      name: String(data.name ?? 'New User'),
      phone: String(data.phone ?? '9999999999'),
      email: String(data.email ?? 'user@example.com'),
      role: String(data.role ?? 'STAFF'),
      isActive: true,
      hospitalChainId: (data.hospitalChainId as string) ?? null,
      branchId: (data.branchId as string) ?? null,
      userType: (data.userType as string) ?? null,
      department: (data.department as string) ?? null,
      location: (data.location as string) ?? null,
      createdAt: new Date().toISOString(),
    };
    this.users.push(user);
    return user;
  }

  updateUser(id: string, data: Record<string, unknown>) {
    const user = this.getUserById(id);
    if (!user) return null;
    Object.assign(user, data);
    return user;
  }

  deactivateUser(id: string) {
    const user = this.getUserById(id);
    if (!user) return null;
    user.isActive = false;
    return user;
  }

  getStaffByBranch(branchId: string) {
    return this.users.filter(
      (user) =>
        user.branchId === branchId && user.role === 'STAFF' && user.isActive,
    );
  }

  getDepartmentsByBranch(branchId: string) {
    const departments = new Set(
      this.users
        .filter((user) => user.branchId === branchId && user.department)
        .map((user) => user.department as string),
    );
    return Array.from(departments);
  }

  getStaffByDepartment(branchId: string, department: string) {
    return this.users.filter(
      (user) =>
        user.branchId === branchId &&
        user.role === 'STAFF' &&
        user.department === department &&
        user.isActive,
    );
  }

  verifyPhone(phone: string, branchId: string, otp: string) {
    const visitor = this.visitors.find(
      (item) => item.phone === phone && item.branchId === branchId,
    );

    if (otp !== '123456' && otp !== '000000') {
      throw new Error('Invalid OTP');
    }

    if (visitor) {
      return {
        verified: true,
        isExistingVisitor: true,
        visitorData: {
          id: visitor.id,
          firstName: visitor.firstName,
          middleName: visitor.middleName ?? null,
          lastName: visitor.lastName,
          phone: visitor.phone,
          email: visitor.email ?? null,
          company: visitor.company ?? null,
          designation: visitor.designation ?? null,
          phoneVerified: true,
        },
      };
    }

    return {
      verified: true,
      isExistingVisitor: false,
      visitorData: {
        id: crypto.randomUUID(),
        firstName: 'Guest',
        middleName: null,
        lastName: 'Visitor',
        phone,
        email: null,
        company: null,
        designation: null,
        phoneVerified: true,
      },
    };
  }

  sendOtp(phone: string, branchId: string) {
    const existing = this.visitors.some(
      (visitor) => visitor.phone === phone && visitor.branchId === branchId,
    );
    return {
      success: true,
      message: 'OTP sent successfully',
      isNewVisitor: !existing,
      testOtp: '123456',
    };
  }
}

export const mockStore = new MockStore();

export { USER_IDS };
