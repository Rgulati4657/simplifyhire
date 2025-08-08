import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DataType } from '../types';
import { getSearchFields, applyStatusFilter } from '../utils';

export const useDetailedViewData = (type: DataType, open: boolean) => {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValue, setFilterValue] = useState('all');
  const { toast } = useToast();

  const buildQuery = useCallback(() => {
    switch (type) {
      case 'users':
        return supabase
          .from('profiles')
          .select('*, created_at')
          .order('created_at', { ascending: false });
          
      case 'companies':
        return supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });
          
      case 'vendors':
        return supabase
          .from('vendors')
          .select(`
            *,
            companies (name)
          `)
          .order('created_at', { ascending: false });
          
      case 'jobs':
        return supabase
          .from('jobs')
          .select(`
            *,
            companies (name),
            profiles!jobs_created_by_fkey (first_name, last_name),
            job_applications (id, status)
          `)
          .order('created_at', { ascending: false });
          
      case 'activeJobs':
        return supabase
          .from('jobs')
          .select(`
            *,
            companies (name),
            profiles!jobs_created_by_fkey (first_name, last_name),
            job_applications (id, status)
          `)
          .eq('status', 'published')
          .order('created_at', { ascending: false });
          
      case 'applications':
        return supabase
          .from('job_applications')
          .select(`
      *,
      jobs!inner(title, companies!inner(name)),
      candidates!inner(
        profiles!inner(
          first_name,
          last_name,
          email
        )
      )
    `)
    .order('applied_at', { ascending: false });
          // .select(`
          //   *,
          //   jobs (title, companies (name)),
          //   candidates (first_name, last_name, email)
          // `)
          // .order('applied_at', { ascending: false });
          
      case 'monthlyHires':
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        return supabase
          .from('job_applications')
          .select(`
            *,
            jobs (title, companies (name)),
            candidates (first_name, last_name, email)
          `)
          .eq('status', 'hired')
          .gte('updated_at', monthAgo.toISOString())
          .order('updated_at', { ascending: false });
          
      default:
        return null;
    }
  }, [type]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = buildQuery();
      if (!query) return;

      const { data: result, error } = await query;
      
      if (error) throw error;
      setData(result || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [buildQuery, toast]);

  const filterData = useCallback(() => {
    let filtered = data;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((item) => {
        const searchFields = getSearchFields(item, type);
        return searchFields.some(field => 
          field?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Apply dropdown filter
    filtered = filtered.filter((item) => applyStatusFilter(item, type, filterValue));

    setFilteredData(filtered);
  }, [data, searchTerm, filterValue, type]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  useEffect(() => {
    filterData();
  }, [filterData]);

  return {
    data,
    filteredData,
    loading,
    searchTerm,
    filterValue,
    setSearchTerm,
    setFilterValue,
    refetchData: fetchData
  };
};