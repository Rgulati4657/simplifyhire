import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Interview scheduler chat function called');

    // Check if OpenAI API key is available
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured. Please contact the administrator.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
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

    const { message, jobId, applicationId, context } = await req.json();
    console.log('Processing message:', message);

    // Get job and application details
    const { data: jobData } = await supabase
      .from('jobs')
      .select(`
        *,
        companies (name, industry),
        interview_rounds (*)
      `)
      .eq('id', jobId)
      .single();

    const { data: applicationData } = await supabase
      .from('job_applications')
      .select(`
        *,
        candidates (first_name, last_name, email, phone)
      `)
      .eq('id', applicationId)
      .single();

    if (!jobData || !applicationData) {
      throw new Error('Job or application data not found');
    }

    // Get existing interviews
    const { data: interviews } = await supabase
      .from('interviews')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    // Create system prompt with context
    const systemPrompt = `You are an AI interview scheduler assistant for ${jobData?.companies?.name || 'the company'}. You help coordinate interview scheduling between candidates, hiring managers, and interviewers.

Context:
- Job: ${jobData?.title} at ${jobData?.companies?.name}
- Candidate: ${applicationData?.candidates?.first_name} ${applicationData?.candidates?.last_name}
- Email: ${applicationData?.candidates?.email}
- Phone: ${applicationData?.candidates?.phone}
- Interview Rounds: ${JSON.stringify(jobData?.interview_rounds || [])}
- Existing Interviews: ${JSON.stringify(interviews || [])}

Your capabilities:
1. Schedule interviews for any round (AI, Human, or AI+Human)
2. Suggest available time slots
3. Send calendar invites
4. Handle rescheduling requests
5. Provide interview preparation information
6. Answer questions about the interview process

Guidelines:
- Be professional and helpful
- Always confirm details before scheduling
- Ask for preferred time slots if not provided
- Explain the interview format (AI, Human, or AI+Human)
- Provide preparation tips when appropriate
- Use the candidate's name when addressing them

Current conversation context: ${context || 'Initial conversation'}`;

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
        max_tokens: 1000,
        functions: [
          {
            name: 'schedule_interview',
            description: 'Schedule an interview for a candidate',
            parameters: {
              type: 'object',
              properties: {
                round_number: { type: 'integer', description: 'Interview round number' },
                interview_type: { type: 'string', enum: ['ai', 'human', 'ai_human'], description: 'Type of interview' },
                scheduled_date: { type: 'string', description: 'Scheduled date and time (ISO format)' },
                duration_minutes: { type: 'integer', description: 'Interview duration in minutes' },
                interviewer_notes: { type: 'string', description: 'Additional notes or instructions' }
              },
              required: ['round_number', 'interview_type', 'scheduled_date']
            }
          },
          {
            name: 'get_availability',
            description: 'Check availability for interview scheduling',
            parameters: {
              type: 'object',
              properties: {
                date_range: { type: 'string', description: 'Date range to check (e.g., "next week", "this week")' },
                preferred_times: { type: 'array', items: { type: 'string' }, description: 'Preferred time slots' }
              }
            }
          },
          {
            name: 'send_calendar_invite',
            description: 'Send calendar invitation to candidate',
            parameters: {
              type: 'object',
              properties: {
                interview_id: { type: 'string', description: 'Interview ID' },
                include_preparation_info: { type: 'boolean', description: 'Include interview preparation information' }
              },
              required: ['interview_id']
            }
          }
        ],
        function_call: 'auto'
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message;

    // Handle function calls
    if (assistantMessage.function_call) {
      const functionName = assistantMessage.function_call.name;
      const functionArgs = JSON.parse(assistantMessage.function_call.arguments);

      let functionResult = null;

      switch (functionName) {
        case 'schedule_interview':
          // Create interview record
          const { data: newInterview, error: interviewError } = await supabase
            .from('interviews')
            .insert({
              application_id: applicationId,
              type: functionArgs.interview_type,
              scheduled_at: functionArgs.scheduled_date,
              duration_minutes: functionArgs.duration_minutes || 60,
              notes: functionArgs.interviewer_notes || '',
              status: 'scheduled'
            })
            .select()
            .single();

          if (interviewError) {
            functionResult = `Error scheduling interview: ${interviewError.message}`;
          } else {
            functionResult = `Interview scheduled successfully for ${functionArgs.scheduled_date}. Interview ID: ${newInterview.id}`;
          }
          break;

        case 'get_availability':
          // In a real implementation, this would check actual calendar availability
          functionResult = `Available time slots for ${functionArgs.date_range}: 
          - Monday 9:00 AM - 11:00 AM
          - Tuesday 2:00 PM - 4:00 PM  
          - Wednesday 10:00 AM - 12:00 PM
          - Thursday 1:00 PM - 3:00 PM
          - Friday 9:00 AM - 11:00 AM`;
          break;

        case 'send_calendar_invite':
          // In a real implementation, this would send actual calendar invites
          functionResult = `Calendar invitation sent to ${applicationData?.candidates?.email} for interview ${functionArgs.interview_id}`;
          break;

        default:
          functionResult = 'Unknown function called';
      }

      return new Response(JSON.stringify({ 
        reply: assistantMessage.content || `I've executed the ${functionName} function.`,
        functionCall: {
          name: functionName,
          arguments: functionArgs,
          result: functionResult
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      reply: assistantMessage.content 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in interview-scheduler-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});