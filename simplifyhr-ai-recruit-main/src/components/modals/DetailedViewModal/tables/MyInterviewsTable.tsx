import { Badge } from '@/components/ui/badge';
import { TableBaseProps } from '../types';

export const MyInterviewsTable = ({ data }: TableBaseProps) => (
  <table className="min-w-full divide-y divide-border">
    <thead className="bg-muted/50">
      <tr>
        <th className="table-header">Job Title</th>
        <th className="table-header">Company</th>
        <th className="table-header">Status</th>
        <th className="table-header">Scheduled For</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border">
      {data.map((interview: any) => (
        <tr key={interview.id}>
          <td className="table-cell">{interview.job_applications.jobs.title}</td>
          <td className="table-cell">{interview.job_applications.jobs.companies.name}</td>
          <td className="table-cell"><Badge>{interview.status}</Badge></td>
          <td className="table-cell">{new Date(interview.scheduled_at).toLocaleString()}</td>
        </tr>
      ))}
    </tbody>
  </table>
);