export type DataType = 'users' | 'companies' | 'vendors' | 'jobs' | 'applications' | 'activeJobs' | 'monthlyHires';

export interface DetailedViewModalProps {
  type: DataType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}

export interface EditModalState {
  open: boolean;
  id: string | null;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface TableBaseProps {
  data: any[];
  onEdit?: (id: string, type: string) => void;
}