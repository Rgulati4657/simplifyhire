import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { action, interviewId, platform, jobDescription, resumeText } = await req.json();

    switch (action) {
      case 'create_meeting':
        return await createMeeting(supabase, interviewId, platform);
      case 'start_ai_interview':
        return await startAIInterview(supabase, interviewId, jobDescription, resumeText);
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in meeting-integration function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createMeeting(supabase: any, interviewId: string, platform: string) {
  console.log('Creating meeting for interviewId:', interviewId, 'platform:', platform);
  
  // Try to get interview details first
  let { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select(`
      *,
      job_applications!inner(
        candidates!inner(first_name, last_name, email),
        jobs!inner(title, companies!inner(name))
      )
    `)
    .eq('id', interviewId)
    .single();

  console.log('Interview query result:', { interview, interviewError });

  // If no interview found, check if interviewId is actually an application ID
  if (!interview) {
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select(`
        id,
        candidates!inner(first_name, last_name, email),
        jobs!inner(title, companies!inner(name)),
        interviews(*)
      `)
      .eq('id', interviewId)
      .maybeSingle();

    if (application && application.interviews && application.interviews.length > 0) {
      // Use the first interview for this application
      const interviewData = application.interviews[0];
      interview = {
        ...interviewData,
        job_applications: {
          candidates: application.candidates,
          jobs: application.jobs
        }
      };
    } else if (application) {
      // Create a new interview for this application
      const { data: newInterview, error: createError } = await supabase
        .from('interviews')
        .insert({
          application_id: application.id,
          type: 'Video Interview',
          status: 'scheduled',
          scheduled_at: new Date().toISOString(),
          duration_minutes: 60
        })
        .select()
        .single();

      if (createError) throw new Error(`Failed to create interview: ${createError.message}`);
      
      interview = {
        ...newInterview,
        job_applications: {
          candidates: application.candidates,
          jobs: application.jobs
        }
      };
    }
  }

  if (interviewError || !interview) {
    throw new Error(`Interview not found: ${interviewError?.message || 'Interview does not exist'}`);
  }

  const candidate = interview.job_applications.candidates;
  const job = interview.job_applications.jobs;
  
  // Generate meeting details based on platform
  let meetingUrl = '';
  let meetingInfo = {};

  switch (platform.toLowerCase()) {
    case 'teams':
      meetingUrl = generateTeamsMeeting(interview);
      meetingInfo = {
        platform: 'Microsoft Teams',
        instructions: 'Click the link to join the Microsoft Teams meeting',
        preparation: 'Please ensure you have the Teams app installed or use the web version'
      };
      break;
    case 'zoom':
      meetingUrl = generateZoomMeeting(interview);
      meetingInfo = {
        platform: 'Zoom',
        instructions: 'Click the link to join the Zoom meeting',
        preparation: 'Please ensure you have the Zoom app installed or use the web version'
      };
      break;
    case 'googlemeet':
      meetingUrl = generateGoogleMeetMeeting(interview);
      meetingInfo = {
        platform: 'Google Meet',
        instructions: 'Click the link to join the Google Meet',
        preparation: 'You can join directly from your browser'
      };
      break;
    default:
      throw new Error('Unsupported platform');
  }

  // Update interview with meeting URL
  const { error } = await supabase
    .from('interviews')
    .update({ meeting_url: meetingUrl })
    .eq('id', interview.id);

  if (error) {
    throw new Error(`Failed to update interview: ${error.message}`);
  }

  return new Response(JSON.stringify({
    success: true,
    meetingUrl,
    meetingInfo,
    interviewDetails: {
      candidate: `${candidate.first_name} ${candidate.last_name}`,
      position: job.title,
      company: job.companies.name,
      scheduledAt: interview.scheduled_at,
      duration: interview.duration_minutes
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function startAIInterview(supabase: any, interviewId: string, jobDescription?: string, resumeText?: string) {
  // Try to get interview details first
  let { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .select(`
      *,
      job_applications!inner(
        id,
        candidates!inner(first_name, last_name, email, resume_text),
        jobs!inner(title, description, ai_generated_description, companies!inner(name))
      )
    `)
    .eq('id', interviewId)
    .maybeSingle();

  // If no interview found, check if interviewId is actually an application ID
  if (!interview) {
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select(`
        id,
        candidates!inner(first_name, last_name, email, resume_text),
        jobs!inner(title, description, ai_generated_description, companies!inner(name)),
        interviews(*)
      `)
      .eq('id', interviewId)
      .maybeSingle();

    if (application && application.interviews && application.interviews.length > 0) {
      // Use the first interview for this application
      const interviewData = application.interviews[0];
      interview = {
        ...interviewData,
        job_applications: {
          candidates: application.candidates,
          jobs: application.jobs
        }
      };
    } else if (application) {
      // Create a new interview for this application
      const { data: newInterview, error: createError } = await supabase
        .from('interviews')
        .insert({
          application_id: application.id,
          type: 'AI Interview',
          status: 'scheduled',
          scheduled_at: new Date().toISOString(),
          duration_minutes: 60,
          ai_interview_enabled: true
        })
        .select()
        .single();

      if (createError) throw new Error(`Failed to create interview: ${createError.message}`);
      
      interview = {
        ...newInterview,
        job_applications: {
          candidates: application.candidates,
          jobs: application.jobs
        }
      };
    }
  }

  if (interviewError || !interview) {
    throw new Error(`Interview not found: ${interviewError?.message || 'Interview does not exist'}`);
  }

  const candidate = interview.job_applications.candidates;
  const job = interview.job_applications.jobs;
  
  // Use provided or database job description and resume
  const finalJobDescription = jobDescription || job.description || job.ai_generated_description || 'No job description available';
  const finalResumeText = resumeText || candidate.resume_text || 'No resume available';

  // Start the comprehensive AI interview using the new edge function
  const aiInterviewResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-interviewer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'start_interview',
      interviewId: interview.id
    }),
  });

  if (!aiInterviewResponse.ok) {
    throw new Error(`Failed to start AI interview: ${aiInterviewResponse.status}`);
  }

  const aiInterviewData = await aiInterviewResponse.json();

  return new Response(JSON.stringify({
    success: true,
    aiGreeting: aiInterviewData.aiGreeting,
    sessionId: aiInterviewData.sessionId,
    interviewContext: aiInterviewData.interviewContext,
    message: 'Advanced AI interviewer is ready! The AI will conduct a comprehensive interview with structured questions and real-time evaluation.'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateTeamsMeeting(interview: any): string {
  // In production, integrate with Microsoft Graph API
  const meetingId = `teams-${interview.id}-${Date.now()}`;
  return `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${meetingId}%40thread.v2/0?context=%7b%22Tid%22%3a%22demo%22%2c%22Oid%22%3a%22demo%22%7d`;
}

function generateZoomMeeting(interview: any): string {
  // In production, integrate with Zoom API
  const meetingId = Math.floor(Math.random() * 1000000000);
  return `https://zoom.us/j/${meetingId}?pwd=demo`;
}

function generateGoogleMeetMeeting(interview: any): string {
  // In production, integrate with Google Calendar API
  const meetingCode = `demo-${interview.id.substring(0, 8)}`;
  return `https://meet.google.com/${meetingCode}`;
}