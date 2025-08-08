// src/components/dashboards/InterviewerDashboard.tsx

import { InterviewCalendar } from '@/components/interviewer/InterviewCalendar';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { List, Calendar } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { InterviewListItem } from '@/components/interviewer/InterviewListItem'; // Import our new component
import { InterviewDetailModal } from '@/components/modals/InterviewDetailModal';
import { ViewJobModal } from '@/components/modals/ViewJobModal';
// Define the types for our data
interface Interview {
  id: string;
  scheduled_at: string;
  status: string;
  job_title: string;
  candidate_name: string;
  round_type: string; // Add this
  meeting_url: string | null; // Add this (can be null)
   raw_scheduled_at: string; // Add this for calendar
   isPast?: boolean; // Optional flag to identify past interviews

}
const InterviewerDashboard = () => {
  const { profile } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
// At the top of the InterviewerDashboard component
const [pastInterviews, setPastInterviews] = useState<Interview[]>([]);

const [calendarInterviews, setCalendarInterviews] = useState<Interview[]>([]);
  // We add state to manage which interview detail modal is open
  const [viewingInterviewId, setViewingInterviewId] = useState<string | null>(null);

const [viewingJobId, setViewingJobId] = useState<string | null>(null); // <-- Add this line
// Inside the InterviewerDashboard component
const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');


  // useEffect(() => {
  //   const fetchInterviews = async () => {
  //     if (!profile) return;
  //     setLoading(true);

  //     // We fetch ALL interviews for this user in one query
  //     const { data, error } = await supabase
  //       .from('interview_participants')
  //       .select(`
  //         id,
  //         scheduled_at,
  //         status,
  //         meeting_url, 
  //         interview_rounds ( round_type ),
  //         job_applications (
  //           jobs ( title ),
  //           candidates ( first_name, last_name )
  //         )
  //       `)
  //       .eq('interviewer_id', profile.user_id)
  //       .order('scheduled_at', { ascending: false }); // Order by most recent first

  //     if (error) {
  //       console.error("Error fetching interviews:", error);
  //       setLoading(false);
  //       return;
  //     }

  //     // Format all the data first
  //     const allFormattedInterviews = data.map(item => ({
  //       id: item.id,
  //       scheduled_at: new Date(item.scheduled_at).toLocaleString('en-US', {
  //           dateStyle: 'full',
  //           timeStyle: 'short',
  //       }),
  //       status: item.status,
  //       meeting_url: item.meeting_url,
  //       round_type: item.interview_rounds?.round_type || 'General',
  //       job_title: item.job_applications?.jobs?.title || 'N/A',
  //       candidate_name: `${item.job_applications?.candidates?.first_name || ''} ${item.job_applications?.candidates?.last_name || ''}`.trim()
  //     }));

  //     // Now, filter the formatted data into two separate lists
  //     const upcoming = allFormattedInterviews.filter(interview => interview.status === 'scheduled');
  //     const past = allFormattedInterviews.filter(interview => interview.status !== 'scheduled');

  //     setInterviews(upcoming);
  //     setPastInterviews(past);
  //     setLoading(false);
  //   };

  //   fetchInterviews();
  // }, [profile]); // This useEffect still only runs once
  
  //   useEffect(() => {
  //   const fetchInterviews = async () => {
  //     if (!profile) return;
  //     setLoading(true);

  //     const { data, error } = await supabase
  //       .from('interview_participants')
  //       .select(`
  //         id,
  //         scheduled_at,
  //         status,
  //         meeting_url, 
  //         interview_rounds ( round_type ),
  //         job_applications (
  //           jobs ( title ),
  //           candidates ( first_name, last_name )
  //         )
  //       `)
  //       .eq('interviewer_id', profile.user_id)
  //       .order('scheduled_at', { ascending: true });

  //     if (error) {
  //       console.error("Error fetching interviews:", error);
  //       setLoading(false);
  //       return;
  //     }
  //     const now = new Date();

  //     // --- THIS IS THE FIX ---
  //     // We add safety checks to prevent crashes from incomplete data
  //     const allFormattedInterviews = data.map(item => {
  //       // If the core nested data is missing, we skip this record.
  //       if (!item.job_applications?.jobs || !item.job_applications?.candidates) {
  //         console.warn("Skipping an interview record with incomplete data:", item.id);
  //         return null; // This will be filtered out later
  //       }

  //       return {
  //         id: item.id,
  //         scheduled_at: item.scheduled_at ? new Date(item.scheduled_at).toLocaleString('en-US', {
  //             dateStyle: 'full',
  //             timeStyle: 'short',
  //         }) : 'Not Scheduled',
  //         status: item.status,
  //         meeting_url: item.meeting_url,
  //         round_type: item.interview_rounds?.round_type || 'General',
  //         job_title: item.job_applications.jobs.title || 'N/A',
  //         candidate_name: `${item.job_applications.candidates.first_name || ''} ${item.job_applications.candidates.last_name || ''}`.trim(),
  //          raw_scheduled_at: item.scheduled_at
  //       };
  //     }).filter(Boolean); // This cleanly removes any null entries from the list

  //     // const upcoming = allFormattedInterviews.filter(interview => interview!.status === 'scheduled');
  //     // const past = allFormattedInterviews.filter(interview => interview!.status !== 'scheduled');
  //     const past = allFormattedInterviews.filter(interview => 
  //       interview.status !== 'scheduled' || new Date(interview.raw_scheduled_at) < now
  //     );
      
  //     // An 'Upcoming' interview is ONLY those that are scheduled AND in the future
  //     const upcoming = allFormattedInterviews.filter(interview => 
  //       interview.status === 'scheduled' && new Date(interview.raw_scheduled_at) >= now
  //     );

  //     setInterviews(upcoming);
  //     // setPastInterviews(past);
  //      setPastInterviews(past.sort((a, b) => new Date(b.raw_scheduled_at) - new Date(a.raw_scheduled_at)));

  //     setLoading(false);
  //   };

  //   fetchInterviews();
  // }, [profile]);

  useEffect(() => {
    const fetchInterviews = async () => {
      if (!profile) return;
      setLoading(true);

      // --- THIS IS THE CORRECTED, SAFE QUERY ---
      // We are NOT doing the 'has_passed' comparison here anymore.
      const { data, error } = await supabase
        .from('interview_participants')
        .select(`
          id,
          scheduled_at,
          status,
          meeting_url, 
          interview_rounds ( round_type ),
          job_applications (
            jobs ( title ),
            candidates ( first_name, last_name )
          )
        `)
        .eq('interviewer_id', profile.id)
        .order('scheduled_at', { ascending: true }); // Back to ascending for upcoming

      if (error) {
        console.error("Error fetching interviews:", error);
        setLoading(false);
        return;
      }
  
      const now = new Date();

      const allFormattedInterviews = data.map(item => {
        if (!item.job_applications?.jobs || !item.job_applications?.candidates) {
          return null;
        }

        return {
          id: item.id,
          raw_scheduled_at: item.scheduled_at, // We need the raw date string for comparison
          scheduled_at: new Date(item.scheduled_at).toLocaleString('en-US', {
              dateStyle: 'full',
              timeStyle: 'short',
          }),
          status: item.status,
          meeting_url: item.meeting_url,
          round_type: item.interview_rounds?.round_type || 'General',
          job_title: item.job_applications.jobs.title || 'N/A',
          candidate_name: `${item.job_applications.candidates.first_name || ''} ${item.job_applications.candidates.last_name || ''}`.trim()
        };
      }).filter(Boolean);

      // Use the reliable JavaScript date comparison
      const upcoming = allFormattedInterviews.filter(interview => 
        interview!.status === 'scheduled' && new Date(interview!.raw_scheduled_at) >= now
      );
      const past = allFormattedInterviews.filter(interview => 
        interview!.status !== 'scheduled' || new Date(interview!.raw_scheduled_at) < now
      );

      setInterviews(upcoming);
      // Sort past interviews to show the most recent ones first
      setPastInterviews(past.sort((a, b) => new Date(b.raw_scheduled_at).getTime() - new Date(a.raw_scheduled_at).getTime()));

      const allCalendarEvents = [
        ...upcoming.map(i => ({ ...i, isPast: false })),
        ...past.map(i => ({ ...i, isPast: true })),
      ];
      setCalendarInterviews(allCalendarEvents);

      setLoading(false);
    };

    fetchInterviews();
  }, [profile]);


  const handleViewDetails = (interviewId: string) => {
    setViewingInterviewId(interviewId);
    console.log("Should open modal for interview ID:", interviewId); // For testing
  };

  return (
    <>
      <DashboardLayout title="Interviewer Dashboard">
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-8 text-white">
            <h1 className="text-3xl font-bold">My Upcoming Interviews</h1>
            <p className="text-white/80">Here are the interviews you are scheduled to conduct.</p>
          </div>

         <Tabs defaultValue="upcoming" className="w-full">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="upcoming">Upcoming Interviews</TabsTrigger>
    <TabsTrigger value="past">Past Interviews</TabsTrigger>
  </TabsList>

  {/* Tab 1: Upcoming Interviews */}
  <TabsContent value="upcoming">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
  <CardTitle>Interview Schedule</CardTitle>
  <ToggleGroup 
    type="single" 
    defaultValue="list" 
    value={viewMode}
    onValueChange={(value) => {
      if (value) setViewMode(value as 'list' | 'calendar');
    }}
    aria-label="View mode"
  >
    <ToggleGroupItem value="list" aria-label="List view">
      <List className="h-4 w-4" />
    </ToggleGroupItem>
    <ToggleGroupItem value="calendar" aria-label="Calendar view">
      <Calendar className="h-4 w-4" />
    </ToggleGroupItem>
  </ToggleGroup>
</CardHeader>
      <CardContent>
  {loading ? (
    <p>Loading interviews...</p>
  ) : (
    // --- THIS IS THE NEW CONDITIONAL LOGIC ---
    viewMode === 'list' ? (
      // If viewMode is 'list', show our existing list component
      interviews.length > 0 ? (
        <div className="space-y-4">
          {interviews.map(interview => (
            <InterviewListItem 
              key={interview.id} // <-- THIS IS THE FIX for the warning
              interview={interview}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">You have no upcoming interviews scheduled.</p>
        </div>
      )
    ) : (
      // If viewMode is 'calendar', show our new calendar component
      <InterviewCalendar 
        interviews={calendarInterviews}
        onEventClick={handleViewDetails}
      />
    )
  )}
</CardContent>
    </Card>
  </TabsContent>

  {/* Tab 2: Past Interviews (Placeholder for now) */}
 <TabsContent value="past">
  <Card>
    <CardHeader>
      <CardTitle>Completed Interview History</CardTitle>
    </CardHeader>
    <CardContent>
      {/* We use the new 'pastInterviews' state here */}
      {loading ? (
        <p>Loading interviews...</p>
      ) : pastInterviews.length > 0 ? (
        <div className="space-y-4">
          {pastInterviews.map(interview => (
            <InterviewListItem 
              key={interview.id}
              interview={interview}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">You have no past interviews.</p>
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>
</Tabs>
        </div>
      </DashboardLayout>

      {/* --- Placeholder for our next component --- */}
      
            <InterviewDetailModal
      interviewId={viewingInterviewId}
      open={!!viewingInterviewId}
      onOpenChange={(isOpen) => !isOpen && setViewingInterviewId(null)}
      onViewJob={(jobId) => setViewingJobId(jobId)} // <-- Pass the handler
    />

        <ViewJobModal
    jobId={viewingJobId}
    open={!!viewingJobId}
    onOpenChange={(isOpen) => !isOpen && setViewingJobId(null)}
/>
     
    </>
  );
};

export default InterviewerDashboard;