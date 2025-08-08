import { DataType } from '../types';
import { UsersTable } from '../tables/UsersTable';
import { CompaniesTable } from '../tables/CompaniesTable';
import { VendorsTable } from '../tables/VendorsTable';
import { JobsTable } from '../tables/JobsTable';
import { ApplicationsTable } from '../tables/ApplicationsTable';

interface TableRendererProps {
  type: DataType;
  data: any[];
  onEdit: (id: string, entityType: string) => void;
}

export const TableRenderer = ({ type, data, onEdit }: TableRendererProps) => {
  switch (type) {
    case 'users':
      return <UsersTable data={data} onEdit={onEdit} />;
    
    case 'companies':
      return <CompaniesTable data={data} onEdit={onEdit} />;
    
    case 'vendors':
      return <VendorsTable data={data} onEdit={onEdit} />;
    
    case 'jobs':
    case 'activeJobs':
      return <JobsTable data={data} onEdit={onEdit} />;
    
    case 'applications':
    case 'monthlyHires':
      return <ApplicationsTable data={data} onEdit={onEdit} />;
    
    default:
      return null;
  }
};