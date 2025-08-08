import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Briefcase, 
  Users, 
  Calendar, 
  TrendingUp,
  UserCheck,
  Plus,
  Filter,
  Eye,
  Edit,
  MoreHorizontal,
  Bot
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AddVendorModal from '@/components/forms/AddVendorModal';
import AddUserModal from '@/components/forms/AddUserModal';
import DetailedViewModal from '@/components/modals/DetailedViewModal';
import CreateJobModal from '@/components/forms/CreateJobModal';
import InterviewSchedulerChat from '@/components/InterviewSchedulerChat';
import MeetingIntegration from '@/components/MeetingIntegration';
import OfferTemplateManager from '@/components/forms/OfferTemplateManager';
import { SelectedCandidatesManager } from '@/components/SelectedCandidatesManager';
import { OfferWorkflowManager } from '@/components/OfferWorkflowManager';
import AdvancedAnalyticsDashboard from '@/components/analytics/AdvancedAnalyticsDashboard';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ClientDashboard = () => {

const [applications, setApplications] = useState([]);

  const { profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalApplications: 0,
    shortlistedCandidates: 0,
    selectedCandidates: 0,
    scheduledInterviews: 0
  });
  
  const [activeTab, setActiveTab] = useState('jobs');
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<{
    type: 'users' | 'companies' | 'jobs' | 'applications' | 'activeJobs' | 'monthlyHires';
    open: boolean;
    title: string;
  }>({
    type: 'jobs',
    open: false,
    title: ''
  });
  const [globalFilter, setGlobalFilter] = useState('');

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardData();
      // fetchApplicationsDirectly();
    }
  }, [profile]);

  // const fetchDashboardData = async () => {
  //   try {
  //     console.log('Fetching dashboard data for user:', profile?.id);
      
  //     // Get jobs created by this user with explicit error handling
  //     const { data: jobsData, error } = await supabase
  //       .from('jobs')
  //       .select(`
  //         *,
  //         companies (name),
  //         job_applications (
  //           id,
  //           status,
  //           ai_screening_score,
  //           ai_screening_notes,
  //           candidates (first_name, last_name, email),
  //           interviews (id, status, scheduled_at, type)
  //         )
  //       `)
  //       .eq('created_by', profile?.id)
  //       .order('created_at', { ascending: false });

  //     console.log('Jobs query result:', { jobsData, error, userCreatedBy: profile?.id });

  //     console.log('Jobs data fetched:', jobsData?.length, 'jobs');
      
  //     if (error) {
  //       console.error('Error fetching jobs:', error);
  //       throw error;
  //     }

  //     if (jobsData) {
  //       const activeJobs = jobsData.filter(job => job.status === 'published').length;
  //       const totalApplications = jobsData.reduce((acc, job) => acc + (job.job_applications?.length || 0), 0);
  //       const shortlistedCandidates = jobsData.reduce((acc, job) => 
  //         acc + (job.job_applications?.filter((app: any) => app.status === 'screening').length || 0), 0
  //       );
  //       const selectedCandidates = jobsData.reduce((acc, job) => 
  //         acc + (job.job_applications?.filter((app: any) => app.status === 'selected').length || 0), 0
  //       );

  //       console.log('Dashboard stats calculated:', { activeJobs, totalApplications, shortlistedCandidates, selectedCandidates });

  //       setStats({
  //         activeJobs,
  //         totalApplications,
  //         shortlistedCandidates,
  //         selectedCandidates,
  //         scheduledInterviews: 0 // TODO: Count scheduled interviews
  //       });

  //       setRecentJobs(jobsData.slice(0, 10));
  //     }
  //   } catch (error) {
  //     console.error('Error fetching dashboard data:', error);
  //     toast({
  //       title: "Failed to load dashboard data",
  //       description: "Could not fetch your jobs and statistics.",
  //       variant: "destructive",
  //     });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // In ClientDashboard.tsx

// const fetchDashboardData = async () => {
//   if (!profile?.id) {
//     setLoading(false);
//     return;
//   }
//   setLoading(true);
//   try {
//     // This query will now use the new RLS policy and helper function.
//     // We can simplify it by removing the manual company_id fetch.
//     const { data: jobsData, error: jobsError } = await supabase
//       .from('jobs')
//       .select(`
//         *,
//         companies (name),
//         job_applications (id, status, candidates(profiles(first_name, last_name, email)))
//       `); // No more .eq('company_id', ...) needed here, RLS handles it automatically!

//     if (jobsError) {
//       console.error('Error fetching jobs:', jobsError);
//       throw jobsError;
//     }

//     console.log('Jobs data fetched for company:', jobsData?.length, 'jobs');

//     if (jobsData) {
//       // ... (rest of the function is the same)
//       const activeJobs = jobsData.filter(job => job.status === 'published').length;
//       const totalApplications = jobsData.reduce((acc, job) => acc + (job.job_applications?.length || 0), 0);
//       const shortlistedCandidates = jobsData.reduce((acc, job) =>
//           acc + (job.job_applications?.filter((app: any) => app.status === 'screening').length || 0), 0
//       );
//       const selectedCandidates = jobsData.reduce((acc, job) =>
//           acc + (job.job_applications?.filter((app: any) => app.status === 'selected').length || 0), 0
//       );
//       setStats({
//           activeJobs,
//           totalApplications,
//           shortlistedCandidates,
//           selectedCandidates,
//           scheduledInterviews: 0
//       });
//       setRecentJobs(jobsData.slice(0, 10));
//     }

//   } catch (error: any) {
//     console.error('Error fetching dashboard data:', error);
//     toast({
//       title: "Failed to load dashboard data",
//       description: error.message || "Could not fetch your company's jobs and statistics.",
//       variant: "destructive",
//     });
//   } finally {
//     setLoading(false);
//   }
// };

// In ClientDashboard.tsx
// working but not applications
// const fetchDashboardData = async () => {
//   // We need the profile to be loaded so RLS can work.
//   if (!profile?.id) {
//     console.log("Profile not yet loaded. Aborting fetch.");
//     setLoading(false);
//     return;
//   }

//   setLoading(true);
//   console.log(`--- STARTING DASHBOARD FETCH for admin: ${profile.id} ---`);
//   try {
//     console.log(`Fetching all company data for user: ${profile.id}`);

//     // --- THIS IS THE CORRECTED, SIMPLIFIED QUERY ---
//     // We just ask for the jobs. The RLS policy we created will automatically
//     // and securely filter them to only the ones for the admin's company.
//     const { data: jobsData, error: jobsError } = await supabase
//       .from('jobs')
//       .select(`
//         *,
//         companies (name),
//         job_applications (
//           id,
//           status,
//           candidates!inner(profiles!inner(first_name, last_name, email)),
//           interview_schedules (id, status)
//         )
//       `)
//       .order('created_at', { ascending: false });

//     if (jobsError) {
//       console.error("Error fetching jobs:", jobsError);
//       throw jobsError;
//     }

//     console.log('Successfully fetched jobs for company:', jobsData);

//     // The rest of your function to calculate stats will now work correctly,
//     // even if 'jobsData' is an empty array [].
//     // if (jobsData) {
//     //   const activeJobs = jobsData.filter(job => job.status === 'published').length;
//     //   const totalApplications = jobsData.reduce((acc, job) => acc + (job.job_applications?.length || 0), 0);
//     //   const shortlistedCandidates = jobsData.reduce((acc, job) =>
//     //       acc + (job.job_applications?.filter((app: any) => app.status === 'screening').length || 0), 0
//     //   );
//     //   const selectedCandidates = jobsData.reduce((acc, job) =>
//     //       acc + (job.job_applications?.filter((app: any) => app.status === 'selected').length || 0), 0
//     //   );
//     //   const scheduledInterviews = jobsData.reduce((acc, job) =>
//     //       acc + (job.job_applications?.reduce((appAcc: any, app: any) => appAcc + (app.interview_schedules?.length || 0), 0) || 0), 0
//     //   );

//      if (jobsData) {
//       const activeJobs = jobsData.filter(job => job.status === 'published').length;
      
//       const totalApplications = jobsData.reduce((acc, job) => 
//         acc + (job.job_applications?.length || 0), 0);
      
//       const shortlistedCandidates = jobsData.reduce((acc, job) =>
//         acc + (job.job_applications?.filter((app: any) => app.status === 'screening').length || 0), 0);
        
//       const selectedCandidates = jobsData.reduce((acc, job) =>
//         acc + (job.job_applications?.filter((app: any) => app.status === 'selected').length || 0), 0);
        
//       const scheduledInterviews = jobsData.reduce((acc, job) =>
//         acc + (job.job_applications?.reduce((appAcc: any, app: any) => appAcc + (app.interview_schedules?.length || 0), 0) || 0), 0);

//       setStats({
//           activeJobs,
//           totalApplications,
//           shortlistedCandidates,
//           selectedCandidates,
//           scheduledInterviews
//       });

//       setRecentJobs(jobsData.slice(0, 10));
//     }

//   } catch (error: any) {
//     console.error('A critical error occurred in fetchDashboardData:', error);
//     toast({
//       title: "Failed to load dashboard data",
//       description: error.message || "Could not fetch your company's jobs and statistics.",
//       variant: "destructive",
//     });
//   } finally {
//     setLoading(false);
//   }
// };


// In ClientDashboard.tsx
// under review 
// const fetchDashboardData = async () => {
//   if (!profile?.id) {
//     setLoading(false);
//     return;
//   }
//   setLoading(true);
//   try {
//     console.log(`--- STARTING DASHBOARD FETCH for user: ${profile.id} ---`);

//     // --- STEP 1: THE QUERY ---
//     const { data: jobsData, error: jobsError, status } = await supabase
//       .from('jobs')
//       .select(`
//         *,
//         companies (name),
//         job_applications (
//           id,
//           status,
//           candidates!inner(profiles!inner(first_name, last_name, email))
//         )
//       `);
//       // NOTE: I am temporarily removing .order() to simplify the query for debugging.

//     // --- STEP 2: DIAGNOSE THE RESPONSE ---
//     console.log("Query Status Code:", status);
//     if (jobsError) {
//       console.error("!!! QUERY FAILED. Supabase Error:", jobsError);
//       throw jobsError;
//     }
//     console.log("Query Succeeded. Raw data received:", jobsData);

//     // --- STEP 3: INSPECT THE DATA ---
//     if (jobsData && jobsData.length > 0) {
//       console.log(`Found ${jobsData.length} job(s).`);
//       // Let's inspect the first job to see if it has the applications array
//       const firstJob = jobsData[0];
//       console.log("Inspecting first job:", firstJob);
      
//       if (firstJob.job_applications) {
//         console.log("✅ SUCCESS: The 'job_applications' array EXISTS on the job object.");
//         console.log(`It contains ${firstJob.job_applications.length} application(s).`);
//       } else {
//         console.error("❌ FAILURE: The 'job_applications' array is MISSING from the job object.");
//         console.error("This is likely an RLS or a query syntax issue.");
//       }
//     } else {
//       console.log("No jobs found for this user's company.");
//     }

//     // --- STEP 4: CALCULATE STATS (This will only run if data is correct) ---
//     if (jobsData) {
//       const totalApplications = jobsData.reduce((acc, job) => acc + (job.job_applications?.length || 0), 0);
//       console.log("Calculated Total Applications:", totalApplications);
      
//       // ... (rest of your setStats logic)
//       setStats(prevStats => ({...prevStats, totalApplications}));
//       setRecentJobs(jobsData);
//     }

//   } catch (error: any) {
//     console.error('--- FETCH FAILED in catch block ---', error);
//     toast({
//       title: "Failed to load dashboard data",
//       description: error.message,
//       variant: "destructive",
//     });
//   } finally {
//     setLoading(false);
//   }
// };

// const fetchDashboardData = async () => {
//   // Ensure profile is loaded so its data can be used by RLS.
//   if (!profile?.id) {
//     setLoading(false);
//     return;
//   }

//   setLoading(true);
//   try {
//     // This single query fetches everything needed for the dashboard.
//     // It is now guaranteed to work because the backend data and RLS policies are correct.
//     const { data: jobsData, error: jobsError } = await supabase
//       .from('jobs')
//       .select(`
//         *,
//         companies (name),
//         job_applications (
//           id,
//           status,
//           candidates!inner(profiles!inner(first_name, last_name, email)),
//           interview_schedules (id, status)
//         )
//       `)
//       // Sort by the creation date of the jobs themselves.
//       .order('created_at', { ascending: false });

//     if (jobsError) {
//       console.error("Error fetching dashboard data:", jobsError);
//       throw jobsError;
//     }

//     // This logic will now receive jobs with populated `job_applications` arrays.
//     if (jobsData) {
//       const activeJobs = jobsData.filter(job => job.status === 'published').length;
//       const totalApplications = jobsData.reduce((acc, job) => acc + (job.job_applications?.length || 0), 0);
//       const shortlistedCandidates = jobsData.reduce((acc, job) =>
//           acc + (job.job_applications?.filter((app: any) => app.status === 'screening').length || 0), 0
//       );
//       const selectedCandidates = jobsData.reduce((acc, job) =>
//           acc + (job.job_applications?.filter((app: any) => app.status === 'selected').length || 0), 0
//       );
//       const scheduledInterviews = jobsData.reduce((acc, job) =>
//           acc + (job.job_applications?.reduce((appAcc: any, app: any) => appAcc + (app.interview_schedules?.length || 0), 0) || 0), 0
//       );

//       setStats({
//           activeJobs,
//           totalApplications,
//           shortlistedCandidates,
//           selectedCandidates,
//           scheduledInterviews
//       });

//       setRecentJobs(jobsData.slice(0, 10));
//     }

//   } catch (error: any) {
//     console.error('Error in fetchDashboardData:', error);
//     toast({
//       title: "Failed to load dashboard data",
//       description: error.message || "Could not fetch your company's jobs and statistics.",
//       variant: "destructive",
//     });
//   } finally {
//     setLoading(false);
//   }
// };


// Place this in your AdminDashboard.tsx component or a related hook.

// const fetchDashboardData = async () => {
//   // Ensure the admin's profile is loaded so their JWT is active and has the correct claims.
//   if (!profile?.id) {
//     setLoading(false);
//     return;
//   }

//   setLoading(true);
//   try {
//     // This query is now fully secured by our new RLS policy.
//     // When an admin runs this, the database will automatically only return
//     // applications where `company_id` matches the admin's company.
//     const { data: jobsData, error: jobsError } = await supabase
//       .from('jobs')
//       .select(`
//         *,
//         job_applications ( id, status ) 
//       `)
//       .order('created_at', { ascending: false });

//     if (jobsError) throw jobsError;

//     // This logic will now work correctly as `job_applications` will be populated.
//     if (jobsData) {
//       const totalApplications = jobsData.reduce((acc, job) => acc + (job.job_applications?.length || 0), 0);
      
//       console.log("SUCCESS: Fetched jobs. Total applications found:", totalApplications);

//       setStats({
//           totalApplications: totalApplications,
//           ... calculate any other stats you need
//       });
//     }

//   } catch (error: any) {
//     console.error('Error fetching admin dashboard data:', error);
//     toast({
//       title: "Failed to load dashboard data",
//       description: error.message,
//       variant: "destructive",
//     });
//   } finally {
//     setLoading(false);
//   }
// };



// Find this function in your ClientDashboard.tsx and replace it entirely with this version.

// const fetchApplicationsDirectly = async () => {
//   if (!profile || profile.role !== 'admin') {
//     setLoading(false);
//     return;
//   }
//   setLoading(true);
//   try {
//     // THIS IS THE QUERY. It starts from `job_applications` as you said.
//     // The RLS policy we just created makes this query secure.
//     const { data, error } = await supabase
//       .from('job_applications')
//       .select(`
//         *,
//         jobs!inner(title, companies!inner(name)),
//         candidates!inner(
//           profiles!inner(
//             first_name,
//             last_name,
//             email
//           )
//         )
//       `)
//       .order('applied_at', { ascending: false });

//     if (error) throw error;

//     console.log("SUCCESS: Directly fetched all application data:", data);
    
//     // Update state with the results
//     setApplications(data || []);
//     // You can still update your stats from this data
//     setStats(prevStats => ({ ...prevStats, totalApplications: data?.length || 0 }));

//   } catch (error: any) {
//     console.error('Error fetching applications directly:', error);
//     toast({
//       title: "Failed to load application data",
//       description: error.message,
//       variant: "destructive",
//     });
//   } finally {
//     setLoading(false);
//   }
// };


const fetchDashboardData = async () => {
  if (!profile?.id) {
    setLoading(false);
    return;
  }
  console.log("--- STARTING ISOLATION TEST: APPLICATIONS TABLE ---");

  setLoading(true);
  try {
    // This is the single, powerful query that fetches everything.
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs') // We start from 'jobs' to build the main dashboard view.
      .select(`
        *,
        companies (name),
        job_applications (
          *,
          candidates!inner (
            profiles!inner (
              first_name,
              last_name,
              email
            )
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (jobsError) throw jobsError;

    // The data is now correctly shaped. `jobsData` is an array of jobs,
    // and each job has a `job_applications` array.
    // Each application within that array now has a `candidates.profiles` object.
    if (jobsData) {
      // Your existing statistics logic will now work perfectly.
      const activeJobs = jobsData.filter(job => job.status === 'published').length;
      const totalApplications = jobsData.reduce((acc, job) => acc + (job.job_applications?.length || 0), 0);
      const shortlistedCandidates = jobsData.reduce((acc, job) =>
          acc + (job.job_applications?.filter((app: any) => app.status === 'screening').length || 0), 0
      );
      const selectedCandidates = jobsData.reduce((acc, job) =>
          acc + (job.job_applications?.filter((app: any) => app.status === 'selected').length || 0), 0
      );
      // Note: `interview_schedules` is not in this query for simplicity.
      // We can add it if needed, but this solves the current error.

      console.log("SUCCESS: Fetched all data. Total applications found:", totalApplications);
      
      setStats({
          activeJobs,
          totalApplications,
          shortlistedCandidates,
          selectedCandidates,
          scheduledInterviews: stats.scheduledInterviews // Keep old value for now
      });

      // This also correctly populates your list of jobs.
      setRecentJobs(jobsData);
    }

  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    toast({
      title: "Failed to load dashboard data",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const openDetailModal = (type: 'users' | 'companies' | 'jobs' | 'applications' | 'activeJobs' | 'monthlyHires', title: string) => {
    setDetailModal({ type, open: true, title });
  };

  const handleGlobalFilter = (value: string) => {
    setGlobalFilter(value);
  };

  const assessApplication = async (applicationId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('assess-application', {
        body: { applicationId }
      });

      if (error) throw error;

      toast({
        title: "Assessment complete",
        description: `Application scored ${data.score}/100`,
      });

      // Refresh data to show updated scores
      fetchDashboardData();
    } catch (error) {
      console.error('Error assessing application:', error);
      toast({
        title: "Assessment failed",
        description: "Could not assess the application automatically.",
        variant: "destructive",
      });
    }
  };

  const assessAllApplications = async (jobId: string, applications: any[]) => {
    try {
      const unassessedApps = applications.filter(app => !app.ai_screening_score);
      
      if (unassessedApps.length === 0) {
        toast({
          title: "All applications assessed",
          description: "All applications for this job have already been assessed.",
        });
        return;
      }

      toast({
        title: "Assessing applications",
        description: `Processing ${unassessedApps.length} applications...`,
      });

      // Assess applications in parallel
      await Promise.all(
        unassessedApps.map(app => assessApplication(app.id))
      );

    } catch (error) {
      console.error('Error assessing applications:', error);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const markCandidateAsSelected = async (applicationId: string) => {
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: 'selected' })
        .eq('id', applicationId);

      if (error) throw error;

      toast({
        title: "Candidate selected",
        description: "Candidate has been marked as selected and can now proceed to offer workflow.",
      });

      await fetchDashboardData();
    } catch (error) {
      console.error('Error selecting candidate:', error);
      toast({
        title: "Error",
        description: "Failed to select candidate",
        variant: "destructive",
      });
    }
  };

  const dashboardActions = (
    <div className="flex items-center space-x-2">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search dashboard..."
          value={globalFilter}
          onChange={(e) => handleGlobalFilter(e.target.value)}
          className="pl-10 w-64"
        />
      </div>
      <Button variant="outline" size="sm">
        <Filter className="w-4 h-4 mr-2" />
        Filter
      </Button>
      <Button 
        variant="outline" 
        size="sm"
        onClick={fetchDashboardData}
        title="Refresh dashboard data"
      >
        🔄 Refresh
      </Button>
      <AddUserModal onUserAdded={fetchDashboardData} />
      <AddVendorModal onVendorAdded={fetchDashboardData} />
      <OfferTemplateManager onTemplateUploaded={fetchDashboardData} />
      <CreateJobModal onJobCreated={fetchDashboardData} />
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout title="Client Dashboard">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-20"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-12"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Client Dashboard" actions={dashboardActions}>
      <div className="space-y-8 animate-fade-in">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-8 text-white">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold mb-2">Welcome to your Client Dashboard! 🚀</h1>
            <p className="text-white/80 text-lg">Manage your job postings and track candidate applications with ease.</p>
          </div>
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div 
            className="stat-card group animate-slide-up"
            onClick={() => openDetailModal('activeJobs', 'Active Jobs')}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Active Jobs
                </div>
                <div className="text-3xl font-bold text-gradient-primary mb-1">
                  {stats.activeJobs}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently published
                </p>
              </div>
              <div className="icon-wrapper text-blue-600 bg-gradient-primary">
                <Briefcase className="h-6 w-6 text-white relative z-10" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-primary opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
          </div>

          <div 
            className="stat-card group animate-slide-up"
            style={{ animationDelay: '100ms' }}
            onClick={() => openDetailModal('applications', 'Total Applications')}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Total Applications
                </div>
                <div className="text-3xl font-bold text-gradient-primary mb-1">
                  {stats.totalApplications}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all jobs
                </p>
              </div>
              <div className="icon-wrapper text-green-600 bg-gradient-primary">
                <Users className="h-6 w-6 text-white relative z-10" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-primary opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
          </div>

          <div 
            className="stat-card group animate-slide-up"
            style={{ animationDelay: '200ms' }}
            onClick={() => openDetailModal('applications', 'Shortlisted Candidates')}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Shortlisted
                </div>
                <div className="text-3xl font-bold text-gradient-primary mb-1">
                  {stats.shortlistedCandidates}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ready for interview
                </p>
              </div>
              <div className="icon-wrapper text-purple-600 bg-gradient-primary">
                <TrendingUp className="h-6 w-6 text-white relative z-10" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-primary opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
          </div>

          <div 
            className="stat-card group animate-slide-up"
            style={{ animationDelay: '300ms' }}
            onClick={() => openDetailModal('applications', 'Scheduled Interviews')}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Interviews
                </div>
                <div className="text-3xl font-bold text-gradient-primary mb-1">
                  {stats.scheduledInterviews}
                </div>
                <p className="text-xs text-muted-foreground">
                  This week
                </p>
              </div>
              <div className="icon-wrapper text-orange-600 bg-gradient-primary">
                <Calendar className="h-6 w-6 text-white relative z-10" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-primary opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
          </div>

          <div 
            className="stat-card group animate-slide-up"
            style={{ animationDelay: '400ms' }}
            onClick={() => setActiveTab('selected')}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Selected
                </div>
                <div className="text-3xl font-bold text-gradient-primary mb-1">
                  {stats.selectedCandidates}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ready for offers
                </p>
              </div>
              <div className="icon-wrapper text-emerald-600 bg-gradient-primary">
                <UserCheck className="h-6 w-6 text-white relative z-10" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-primary opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="jobs">Jobs & Applications</TabsTrigger>
            <TabsTrigger value="selected">Selected Candidates</TabsTrigger>
            <TabsTrigger value="offers">Offer Workflows</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-6">
            <div className="card-premium">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gradient-primary">Your Jobs</h3>
                    <p className="text-muted-foreground">Manage your job postings and applications</p>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-full">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  {recentJobs.length > 0 ? (
                    recentJobs.map((job: any) => (
                      <div key={job.id} className="table-row-hover p-4 rounded-lg border border-border/50">
                        <div className="flex flex-col space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div>
                                  <h3 className="font-medium text-foreground">{job.title}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {job.companies?.name} • {job.location || 'Remote'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Posted {new Date(job.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              <div className="text-center">
                                <div className="text-sm font-medium text-foreground">
                                  {job.job_applications?.length || 0}
                                </div>
                                <div className="text-xs text-muted-foreground">Applications</div>
                              </div>
                              
                              <Badge className={getJobStatusColor(job.status)}>
                                {job.status}
                              </Badge>
                              
                              <div className="flex items-center space-x-1">
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                {job.job_applications && job.job_applications.length > 0 && (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => assessAllApplications(job.id, job.job_applications)}
                                      title="Assess All Applications with AI"
                                    >
                                      <Bot className="w-4 h-4" />
                                    </Button>
                                    <InterviewSchedulerChat 
                                      jobId={job.id}
                                      applicationId={job.job_applications[0].id}
                                      trigger={
                                        <Button variant="ghost" size="sm" title="Schedule Interview">
                                          <Calendar className="w-4 h-4" />
                                        </Button>
                                      }
                                    />
                                    <MeetingIntegration 
                                      interviewId={job.job_applications[0].interviews?.[0]?.id || job.job_applications[0].id} 
                                      jobDescription={job.description || job.title}
                                      resumeText={job.job_applications[0].candidates?.resume_text || ""}
                                      trigger={
                                        <Button variant="ghost" size="sm" title="Setup Meeting & AI Interview">
                                          <Bot className="w-4 h-4" />
                                        </Button>
                                      }
                                    />
                                  </>
                                )}
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Applications List with AI Scores */}
                          {job.job_applications && job.job_applications.length > 0 && (
                            <div className="border-t pt-3">
                              <h4 className="text-sm font-medium text-muted-foreground mb-3">Applications ({job.job_applications.length})</h4>
                              <div className="space-y-2">
                                {job.job_applications.map((application: any) => (
                                  <div key={application.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-3">
                                        <div>
                                          <p className="text-sm font-medium">
                                            {application.candidates?.profiles?.first_name} {application.candidates?.profiles?.last_name}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {application.candidates?.profiles?.email}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                     <div className="flex items-center space-x-3">
                                       {application.ai_screening_score ? (
                                         <TooltipProvider>
                                           <Tooltip>
                                             <TooltipTrigger asChild>
                                               <div className="flex items-center space-x-2 cursor-help">
                                                 <Badge className={getScoreBadgeColor(application.ai_screening_score)}>
                                                   {application.ai_screening_score}%
                                                 </Badge>
                                                 <div className="w-16">
                                                   <Progress 
                                                     value={application.ai_screening_score} 
                                                     className="h-2"
                                                   />
                                                 </div>
                                               </div>
                                             </TooltipTrigger>
                                             <TooltipContent className="max-w-xs">
                                               <div className="space-y-2">
                                                 <p className="font-semibold">AI Assessment</p>
                                                 <p className="text-sm">{application.ai_screening_notes || 'No detailed assessment available'}</p>
                                               </div>
                                             </TooltipContent>
                                           </Tooltip>
                                         </TooltipProvider>
                                       ) : (
                                         <Button 
                                           variant="outline" 
                                           size="sm"
                                           onClick={() => assessApplication(application.id)}
                                         >
                                           <Bot className="w-3 h-3 mr-1" />
                                           Assess
                                         </Button>
                                       )}
                                      
                                       {application.status !== 'selected' && application.ai_screening_score && application.ai_screening_score >= 70 && (
                                         <Button 
                                           variant="outline" 
                                           size="sm"
                                           onClick={() => markCandidateAsSelected(application.id)}
                                           className="text-green-600 border-green-200 hover:bg-green-50"
                                         >
                                           Select
                                         </Button>
                                       )}
                                       
                                       <Badge variant="outline" className={
                                         application.status === 'selected' ? 'bg-green-100 text-green-800' : ''
                                       }>
                                         {application.status}
                                       </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                        <Briefcase className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-muted-foreground mb-4">No jobs posted yet</p>
                      <p className="text-sm text-muted-foreground mb-6">
                        Start by creating your first job posting or use our AI Job Generator
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <CreateJobModal onJobCreated={fetchDashboardData} />
                        <InterviewSchedulerChat 
                          jobId="demo"
                          applicationId="demo"
                          trigger={
                            <Button variant="outline" size="sm">
                              <Bot className="w-4 h-4 mr-2" />
                              Try AI Interview Scheduler
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="selected" className="space-y-6">
            <SelectedCandidatesManager />
          </TabsContent>

          <TabsContent value="offers" className="space-y-6">
            <OfferWorkflowManager />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AdvancedAnalyticsDashboard />
          </TabsContent>
        </Tabs>

        {/* Detailed View Modal */}
        <DetailedViewModal
          type={detailModal.type}
          open={detailModal.open}
          onOpenChange={(open) => setDetailModal({ ...detailModal, open })}
          title={detailModal.title}
        />
      </div>
    </DashboardLayout>
  );
};

export default ClientDashboard;