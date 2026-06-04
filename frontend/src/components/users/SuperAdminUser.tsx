'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import useSWR from 'swr';
import { z } from 'zod';

// API Services
import { BranchService } from '@/lib/services/branchService';
import { HospitalChainService } from '@/lib/services/hospitalChainService';
import { UserService } from '@/lib/services/userService';

// Schemas and Types
import {
  User,
  Branch,
  HospitalChain,
  UserFormSchema,
  UserUpdateSchema,
  Departments,
  UserTypes,
} from '@/lib/schema/schema';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowRight, MoreHorizontal, Plus, UserPlus, Users } from 'lucide-react';

const formatEnumValue = (value: string) => {
  if (!value) return '';
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

//================================================================//
// CHILD COMPONENT: Dialog to Add or Edit a User                  //
//================================================================//
const AddEditUserDialog = ({
  open,
  onOpenChange,
  userToEdit,
  onUserSaved,
  branches,
  hospitalChains,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userToEdit: User | null;
  onUserSaved: () => void;
  branches: Branch[] | undefined;
  hospitalChains: HospitalChain[] | undefined;
}) => {
  const form = useForm<z.infer<typeof UserFormSchema>>({
    resolver: zodResolver(UserFormSchema),
  });

  const watchRole = form.watch('role');
  const watchChain = form.watch('hospitalChainId');
  const isEditMode = !!userToEdit;

  const filteredBranches = useMemo(() => {
    if (!branches || !watchChain) return [];
    return branches.filter((b) => b.hospitalChainId === watchChain);
  }, [branches, watchChain]);

  useEffect(() => {
    if (userToEdit && open) {
      // Properly transform the user object to match the form's expected shape
      switch (userToEdit.role) {
        case 'SUPER_ADMIN':
          form.reset({
            name: userToEdit.name,
            email: userToEdit.email,
            phone: userToEdit.phone,
            role: 'SUPER_ADMIN',
          });
          break;
        case 'CHAIN_ADMIN':
          form.reset({
            name: userToEdit.name,
            email: userToEdit.email,
            phone: userToEdit.phone,
            role: 'CHAIN_ADMIN',
            hospitalChainId: userToEdit.hospitalChainId!,
          });
          break;
        case 'BRANCH_ADMIN':
          form.reset({
            name: userToEdit.name,
            email: userToEdit.email,
            phone: userToEdit.phone,
            role: 'BRANCH_ADMIN',
            hospitalChainId: userToEdit.hospitalChainId!,
            branchId: userToEdit.branchId!,
          });
          break;
        case 'STAFF':
          form.reset({
            role: 'STAFF',
            name: userToEdit.name,
            email: userToEdit.email,
            phone: userToEdit.phone,
            hospitalChainId: userToEdit.hospitalChainId!,
            branchId: userToEdit.branchId!,
            department: userToEdit.department ?? undefined,
            userType: userToEdit.userType ?? undefined,
            location: userToEdit.location ?? '',
          });
          break;
        case 'SECURITY':
          form.reset({
            name: userToEdit.name,
            email: userToEdit.email,
            phone: userToEdit.phone,
            role: 'SECURITY',
            hospitalChainId: userToEdit.hospitalChainId!,
            branchId: userToEdit.branchId!,
            location: userToEdit.location ?? '',
          });
          break;
        case 'SECURITY_SUPERVISOR':
          form.reset({
            name: userToEdit.name,
            email: userToEdit.email,
            phone: userToEdit.phone,
            role: 'SECURITY_SUPERVISOR',
            hospitalChainId: userToEdit.hospitalChainId!,
            branchId: userToEdit.branchId!,
            location: userToEdit.location ?? '',
          });
          break;
        default:
          const baseValues = {
            name: userToEdit.name,
            email: userToEdit.email,
            phone: userToEdit.phone,
            role: userToEdit.role,
          };
          form.reset(baseValues);
      }
    } else if (!isEditMode && open) {
      form.reset({
        name: '',
        email: '',
        phone: '',
        role: undefined,
        hospitalChainId: undefined,
        branchId: undefined,
        userType: undefined,
        department: undefined,
        location: undefined,
      });
    }
  }, [userToEdit, open, form, isEditMode]);

  const onSubmit = async (data: z.infer<typeof UserFormSchema>) => {
    toast.promise(
      async () => {
        if (isEditMode) {
          const { ...updateData } = data;
          await UserService.update(
            userToEdit.id,
            updateData as z.infer<typeof UserUpdateSchema>,
          );
        } else {
          await UserService.create(data);
        }
        onUserSaved();
        onOpenChange(false);
      },
      {
        loading: isEditMode ? 'Updating user...' : 'Creating user...',
        success: `User ${isEditMode ? 'updated' : 'created'} successfully!`,
        error: (err: Error) => {
          return (
            err.message || `Failed to ${isEditMode ? 'update' : 'create'} user.`
          );
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit User' : 'Add New User'}</DialogTitle>
          <DialogDescription>
            Fill in the details below. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[48vh] overflow-y-auto -mr-6 pr-6 mt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isEditMode}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CHAIN_ADMIN">
                            Chain Admin
                          </SelectItem>
                          <SelectItem value="BRANCH_ADMIN">
                            Branch Admin
                          </SelectItem>
                          <SelectItem value="STAFF">Staff</SelectItem>
                          <SelectItem value="SECURITY_SUPERVISOR">
                            Security Supervisor
                          </SelectItem>
                          <SelectItem value="SECURITY">Security</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hospitalChainId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hospital Chain</FormLabel>
                      <Select
                        onValueChange={field.onChange} // <-- FIX: Remove Number()
                        value={String(field.value ?? '')}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a chain" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hospitalChains?.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {watchRole && watchRole !== 'CHAIN_ADMIN' && (
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={String(field.value ?? '')}
                        disabled={!watchChain}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                !watchChain
                                  ? 'Select a chain first'
                                  : 'Select a branch'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredBranches?.map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {(watchRole === 'STAFF' ||
                watchRole === 'SECURITY' ||
                watchRole === 'SECURITY_SUPERVISOR') && (
                <div className="space-y-4 pt-2 border-t mt-4">
                  {watchRole === 'STAFF' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Departments.map((dept) => (
                                  <SelectItem key={dept} value={dept}>
                                    {formatEnumValue(dept)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="userType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>User Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a user type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {UserTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {formatEnumValue(type)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location / Post</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <DialogFooter className="pt-4 sticky bottom-0 bg-background py-4 -mx-1 px-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    onOpenChange(false);
                  }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="cursor-pointer"
                >
                  {form.formState.isSubmitting ? 'Saving...' : 'Save User'}{' '}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

//================================================================//
// CHILD COMPONENT: A reusable table/card list to display users   //
//================================================================//
// Updated UsersList component with new table structure
const UsersList = ({
  users,
  isLoading,
  onEdit,
  onDeactivate,
  tab,
  branches,
  chains,
}: {
  users: User[];
  isLoading: boolean;
  onEdit: (user: User) => void;
  onDeactivate: (user: User) => void;
  tab: 'chainAdmins' | 'branchAdmins' | 'staff';
  branches?: Branch[];
  chains?: HospitalChain[];
}) => {
  const colSpan = tab === 'chainAdmins' ? 5 : 6;
  return (
    <div>
      {/* Desktop Table View (hidden on mobile) */}
      <div className="border rounded-lg hidden md:block w-full overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {tab === 'chainAdmins' ? (
                <>
                  <TableHead className="min-w-[150px]">Name</TableHead>
                  <TableHead className="min-w-[180px]">Contact</TableHead>
                </>
              ) : (
                <TableHead className="min-w-[180px]">User Details</TableHead>
              )}
              {tab !== 'chainAdmins' && (
                <TableHead className="min-w-[100px]">Assigned Branch</TableHead>
              )}
              <TableHead className="min-w-[130px]">Assigned Chain</TableHead>
              {tab === 'staff' && (
                <TableHead className="min-w-[80px]">Role</TableHead>
              )}
              <TableHead className="min-w-[70px]">Status</TableHead>
              <TableHead className="w-[50px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colSpan}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user.id}>
                  {tab === 'chainAdmins' ? (
                    <>
                      <TableCell className="font-medium truncate max-w-[150px]">
                        {user.name}
                      </TableCell>
                      <TableCell className="truncate max-w-[180px]">
                        <div className="text-sm truncate">{user.email}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {user.phone}
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <TableCell className="truncate max-w-[250px]">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {user.phone}
                      </div>
                    </TableCell>
                  )}
                  {tab !== 'chainAdmins' && (
                    <TableCell className="truncate max-w-[150px]">
                      {branches?.find(
                        (b) => String(b.id) === String(user.branchId),
                      )?.name || 'N/A'}
                    </TableCell>
                  )}
                  <TableCell className="truncate max-w-[150px]">
                    {chains?.find((c) => c.id === user.hospitalChainId)?.name ||
                      'N/A'}
                  </TableCell>
                  {tab === 'staff' && (
                    <TableCell className="truncate max-w-[120px]">
                      <Badge variant="outline" className="truncate">
                        {user.role}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="truncate max-w-[100px]">
                    <Badge variant={user.isActive ? 'default' : 'destructive'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onEdit(user)}
                          className="cursor-pointer"
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeactivate(user)}
                          className="text-destructive cursor-pointer"
                        >
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-24 text-center">
                  <div className="border rounded-lg h-64 flex flex-col items-center justify-center gap-4 text-center">
                    <UserPlus className="h-12 w-12 text-muted-foreground/50" />
                    <div>
                      <p className="font-semibold">
                        No users found for the selected filters.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Click the &apos;+ Add User&apos; button to assign a
                        user.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View (visible only on mobile) */}
      <div className="space-y-4 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-20 w-full" />
            </div>
          ))
        ) : users.length > 0 ? (
          users.map((user) => (
            <div key={user.id} className="border rounded-lg p-4 text-sm">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.phone}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(user)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeactivate(user)}
                      className="text-destructive"
                    >
                      Deactivate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="border-t my-2"></div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chain:</span>
                  <span className="font-medium text-right">
                    {chains?.find((c) => c.id === user.hospitalChainId)?.name ||
                      'N/A'}
                  </span>
                </div>
                {tab !== 'chainAdmins' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch:</span>
                    <span className="font-medium text-right">
                      {branches?.find(
                        (b) => String(b.id) === String(user.branchId),
                      )?.name || 'N/A'}
                    </span>
                  </div>
                )}
                {tab === 'staff' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium text-right">{user.role}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge
                    variant={user.isActive ? 'default' : 'destructive'}
                    className="h-5"
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="border rounded-lg h-64 flex flex-col items-center justify-center gap-4 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-semibold">
                No users found for the selected filters.
              </p>
              <p className="text-sm text-muted-foreground">
                Click the &apos;+ Add User&apos; button to assign a user.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

//================================================================//
// Deactivation Dialog Component                                  //
//================================================================//
const DeactivateUserDialog = ({
  user,
  onConfirm,
  onCancel,
  open,
}: {
  user: User | null;
  onConfirm: () => void;
  onCancel: () => void;
  open: boolean;
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  useEffect(() => {
    if (!open) setConfirmationText('');
  }, [open]);
  if (!user) return null;
  const isConfirmationMatch = confirmationText === user.name;

  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will deactivate{' '}
            <span className="font-bold text-primary">{user.name}</span>. They
            will lose all access.
            <br />
            <br />
            To confirm, please type the user&apos;s full name below.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirmationText}
          onChange={(e) => setConfirmationText(e.target.value)}
          placeholder={`Type "${user.name}" to confirm`}
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} className="cursor-pointer">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!isConfirmationMatch}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
          >
            Deactivate User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

//================================================================//
// MAIN PAGE COMPONENT                                            //
//================================================================//
export default function SuperAdminUser() {
  const [activeTab, setActiveTab] = useState('chainAdmins');
  const [searchQuery, setSearchQuery] = useState('');
  const [chainFilter, setChainFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);

  const {
    data: users,
    isLoading: isLoadingUsers,
    mutate: mutateUsers,
  } = useSWR<User[]>('/api/users', () => UserService.getAll());
  const { data: chains } = useSWR<HospitalChain[]>(
    '/api/hospital-chains',
    HospitalChainService.getAll,
  );
  const { data: branches, isLoading: isLoadingBranches } = useSWR<Branch[]>(
    '/api/branches/all-branches',
    BranchService.getAllBranches,
  );

  const handleEdit = (user: User) => {
    setUserToEdit(user);
    setDialogOpen(true);
  };
  const handleAddNew = () => {
    setUserToEdit(null);
    setDialogOpen(true);
  };
  const handleDeactivateRequest = (user: User) => {
    setUserToDeactivate(user);
  };
  const handleDeactivateConfirm = () => {
    if (!userToDeactivate) return;
    toast.promise(UserService.delete(userToDeactivate.id), {
      loading: 'Deactivating user...',
      success: () => {
        mutateUsers();
        setUserToDeactivate(null);
        return `User ${userToDeactivate.name} deactivated.`;
      },
      error: 'Failed to deactivate user.',
    });
  };

  const filteredData = useMemo(() => {
    if (!users) return { chainAdmins: [], branchAdmins: [], otherUsers: [] };

    let filtered = users;
    if (searchQuery) {
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.phone.includes(searchQuery),
      );
    }
    if (chainFilter !== 'all') {
      filtered = filtered.filter(
        (u) => u.hospitalChainId === String(chainFilter),
      );
    }
    if (branchFilter !== 'all') {
      filtered = filtered.filter((u) => u.branchId === String(branchFilter));
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }

    const chainAdmins = filtered.filter((u) => u.role === 'CHAIN_ADMIN');
    const branchAdmins = filtered.filter((u) => u.role === 'BRANCH_ADMIN');
    const otherUsers = filtered.filter(
      (u) => !['SUPER_ADMIN', 'CHAIN_ADMIN', 'BRANCH_ADMIN'].includes(u.role),
    );

    return { chainAdmins, branchAdmins, otherUsers };
  }, [users, searchQuery, chainFilter, branchFilter, roleFilter]);

  const branchesForFilter = useMemo(() => {
    if (!branches) return [];
    if (chainFilter === 'all') return branches;
    return branches.filter((b) => b.hospitalChainId === String(chainFilter));
  }, [branches, chainFilter]);

  const tabOptions = [
    { value: 'chainAdmins', label: 'Manage Chain Admins' },
    { value: 'branchAdmins', label: 'Manage Branch Admins' },
    { value: 'staff', label: 'Manage Staff & Security' },
  ];

  return (
    <>
      {/* ✨ MOBILE UI FIX: Added padding-bottom to prevent content being hidden by a bottom nav bar */}
      <div className="space-y-6 p-4 md:p-6 lg:p-8 pb-4 lg:pb-8 min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                <Users className="h-6 w-6 text-white" />
              </div>
              Global User Management
            </h1>
            <p className="text-slate-600 text-base md:text-lg">
              Manage all users across all hospital chains and branches
            </p>
          </div>
          <Button
            onClick={handleAddNew}
            className="w-full md:w-auto cursor-pointer"
          >
            <Plus className="mr-2 h-4 w-4" /> Add New User
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            value={chainFilter}
            onValueChange={(value) => {
              setChainFilter(value);
              setBranchFilter('all');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by chain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chains</SelectItem>
              {chains?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={branchFilter}
            onValueChange={setBranchFilter}
            disabled={isLoadingBranches || chainFilter === 'all'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branchesForFilter?.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="CHAIN_ADMIN">Chain Admin</SelectItem>
              <SelectItem value="BRANCH_ADMIN">Branch Admin</SelectItem>
              <SelectItem value="STAFF">Staff</SelectItem>
              <SelectItem value="SECURITY_SUPERVISOR">
                Security Supervisor
              </SelectItem>
              <SelectItem value="SECURITY">Security</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          defaultValue="chainAdmins"
        >
          {/* ✨ MOBILE UI FIX: Tabs are replaced by a dropdown on small screens */}
          <div className="sm:hidden mb-4">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger>
                <SelectValue placeholder="Select a view..." />
              </SelectTrigger>
              <SelectContent>
                {tabOptions.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TabsList className="hidden sm:grid w-full grid-cols-3">
            <TabsTrigger value="chainAdmins" className="cursor-pointer">
              Manage Chain Admins
            </TabsTrigger>
            <TabsTrigger value="branchAdmins" className="cursor-pointer">
              Manage Branch Admins
            </TabsTrigger>
            <TabsTrigger value="staff" className="cursor-pointer">
              Manage Staff & Security
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chainAdmins" className="mt-4">
            <UsersList
              users={filteredData.chainAdmins}
              isLoading={isLoadingUsers}
              onEdit={handleEdit}
              onDeactivate={handleDeactivateRequest}
              tab="chainAdmins"
              chains={chains}
              branches={branches}
            />
          </TabsContent>
          <TabsContent value="branchAdmins" className="mt-4">
            <UsersList
              users={filteredData.branchAdmins}
              isLoading={isLoadingUsers}
              onEdit={handleEdit}
              onDeactivate={handleDeactivateRequest}
              tab="branchAdmins"
              branches={branches}
              chains={chains}
            />
          </TabsContent>
          <TabsContent value="staff" className="mt-4">
            <UsersList
              users={filteredData.otherUsers}
              isLoading={isLoadingUsers}
              onEdit={handleEdit}
              onDeactivate={handleDeactivateRequest}
              tab="staff"
              branches={branches}
              chains={chains}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AddEditUserDialog
        open={isDialogOpen}
        onOpenChange={setDialogOpen}
        userToEdit={userToEdit}
        onUserSaved={mutateUsers}
        branches={branches}
        hospitalChains={chains}
      />
      <DeactivateUserDialog
        open={!!userToDeactivate}
        user={userToDeactivate}
        onConfirm={handleDeactivateConfirm}
        onCancel={() => setUserToDeactivate(null)}
      />
    </>
  );
}
