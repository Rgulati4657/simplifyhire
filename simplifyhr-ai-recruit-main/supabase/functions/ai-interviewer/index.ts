import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
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
    console.log('AI Interviewer function called');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    // Use service role key for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user authentication with anon key
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await userSupabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      throw new Error('User not authenticated');
    }

    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
    
    const { action, interviewId } = requestBody;

    if (action === 'start_interview') {
      console.log('Starting AI interview for ID:', interviewId);

      // First try to get interview details
      let { data: interview } = await supabase
        .from('interviews')
        .select(`
          *,
          job_applications!inner(
            *,
            candidates!inner(first_name, last_name, email),
            jobs!inner(title, companies!inner(name))
          )
        `)
        .eq('id', interviewId)
        .single();

      let application;
      if (interview) {
        application = interview.job_applications;
        console.log('Found interview with application:', application.id);
      } else {
        // Fallback: check if interviewId is actually an application ID
        const { data: appData } = await supabase
          .from('job_applications')
          .select(`
            *,
            candidates (first_name, last_name, email),
            jobs (title, companies (name))
          `)
          .eq('id', interviewId)
          .single();
        
        application = appData;
        console.log('Found job application directly:', application?.id);
      }

      if (!application) {
        throw new Error(`Interview or application not found: ${interviewId}`);
      }

      console.log('Found job application:', application.id);

      // Generate session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create AI greeting
      const candidateName = application.candidates?.first_name || 'Candidate';
      const jobTitle = application.jobs?.title || 'this position';
      const companyName = application.jobs?.companies?.name || 'our company';

      const aiGreeting = `Hello ${candidateName}! Welcome to your AI interview for the ${jobTitle} position at ${companyName}. I'm your AI interviewer today, and I'll be conducting a comprehensive interview to assess your qualifications and fit for this role.

I'll ask you a series of questions covering your background, technical skills, experience, and cultural fit. Please take your time to provide thoughtful and detailed answers. 

Let's begin: Can you please introduce yourself and tell me about your background and what interests you about this position?`;

      return new Response(JSON.stringify({
        sessionId,
        aiGreeting
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'send_message') {
      const { sessionId, message, interviewId: msgInterviewId } = requestBody;
      const currentInterviewId = msgInterviewId || interviewId;
      console.log('Processing message for session:', sessionId, 'Interview ID:', currentInterviewId);

      if (!openAIApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // First try to get interview details, then fallback to application
      let { data: interview } = await supabase
        .from('interviews')
        .select(`
          *,
          job_applications!inner(
            *,
            candidates!inner(first_name, last_name, email),
            jobs!inner(title, description, requirements, companies!inner(name))
          )
        `)
        .eq('id', currentInterviewId)
        .single();

      let application;
      if (interview) {
        application = interview.job_applications;
      } else {
        // Fallback: check if it's an application ID
        const { data: appData } = await supabase
          .from('job_applications')
          .select(`
            *,
            candidates (first_name, last_name, email),
            jobs (title, description, requirements, companies (name))
          `)
          .eq('id', currentInterviewId)
          .single();
        
        application = appData;
      }

      if (!application) {
        throw new Error('Application not found');
      }

      // Create interview context
      const systemPrompt = `You are an AI interviewer conducting a professional interview for the ${application.jobs?.title} position at ${application.jobs?.companies?.name}.

Job Description: ${application.jobs?.description || 'No description available'}
Requirements: ${application.jobs?.requirements || 'No specific requirements listed'}

You should:
1. Ask thoughtful, relevant questions about the candidate's experience and qualifications
2. Follow up on their answers with probing questions
3. Cover technical skills, problem-solving abilities, and cultural fit
4. Be professional but conversational
5. Ask one question at a time
6. Progress through different topics (background, technical skills, experience, scenarios, etc.)

The candidate just responded: "${message}"

Provide your next interview question or follow-up. Keep responses focused and professional.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        console.error('OpenAI API error:', response.status, await response.text());
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      // Simulate progress (in a real app, you'd track this properly)
      const questionNumber = Math.floor(Math.random() * 12) + 1;
      const progress = Math.min((questionNumber / 12) * 100, 90);

      return new Response(JSON.stringify({
        aiResponse,
        questionNumber,
        progress
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'end_interview') {
      const { sessionId } = requestBody;
      console.log('Ending interview session:', sessionId);

      // In a real implementation, you'd save the interview results
      const sessionSummary = {
        duration: '25',
        questionsAsked: 12,
        completionStatus: 'completed'
      };

      return new Response(JSON.stringify({
        sessionSummary
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in ai-interviewer function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});