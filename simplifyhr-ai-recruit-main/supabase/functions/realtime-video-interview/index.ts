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
    console.log('Realtime video interview function called');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { interviewId, jobDescription, resumeText } = await req.json();

    console.log('Creating ephemeral token for interview:', interviewId);

    // First try to find existing interview
    let { data: interview } = await supabase
      .from('interviews')
      .select(`
        *,
        application:job_applications!application_id(
          *,
          job:jobs(title, description, requirements),
          candidate:candidates(first_name, last_name, email, resume_text)
        )
      `)
      .eq('id', interviewId)
      .maybeSingle();

    // If no interview found, try to find by job application ID and create one
    if (!interview) {
      console.log('Interview not found, checking if interviewId is a job application ID...');
      
      const { data: application } = await supabase
        .from('job_applications')
        .select(`
          *,
          job:jobs(title, description, requirements),
          candidate:candidates(first_name, last_name, email, resume_text)
        `)
        .eq('id', interviewId)
        .maybeSingle();

      if (application) {
        console.log('Found job application, creating interview record...');
        
        // Create interview record
        const { data: newInterview, error: createError } = await supabase
          .from('interviews')
          .insert({
            application_id: application.id,
            scheduled_at: new Date().toISOString(),
            duration_minutes: 60,
            status: 'scheduled',
            ai_interview_enabled: true,
            type: 'AI Interview'
          })
          .select(`
            *,
            application:job_applications!application_id(
              *,
              job:jobs(title, description, requirements),
              candidate:candidates(first_name, last_name, email, resume_text)
            )
          `)
          .single();

        if (createError) {
          console.error('Error creating interview:', createError);
          throw new Error('Failed to create interview record');
        }

        interview = newInterview;
      } else {
        throw new Error('Interview or job application not found');
      }
    }

    // Prepare interview context
    const candidateName = `${interview.application.candidate.first_name} ${interview.application.candidate.last_name}`;
    const jobTitle = interview.application.job.title;
    const jobDesc = jobDescription || interview.application.job.description;
    const resume = resumeText || interview.application.candidate.resume_text;

    // Create system prompt for AI interviewer
    const systemPrompt = `You are an expert AI interviewer conducting a comprehensive video interview for the position of ${jobTitle}. 

CANDIDATE INFORMATION:
- Name: ${candidateName}
- Job Title: ${jobTitle}
- Resume: ${resume || 'Not provided'}

JOB DESCRIPTION:
${jobDesc || 'Not provided'}

INTERVIEW GUIDELINES:
1. You are conducting a professional video interview - the candidate can see and hear you
2. Ask 8-12 structured questions covering technical skills, experience, and behavioral aspects
3. Follow up on answers to dig deeper into candidate responses
4. Be professional, friendly, and encouraging
5. Maintain natural conversation flow while ensuring comprehensive coverage
6. Take notes on responses for final evaluation
7. At the end, provide constructive feedback and next steps

QUESTION AREAS TO COVER:
- Technical skills related to the job requirements
- Past experience and achievements
- Problem-solving scenarios
- Behavioral and cultural fit questions
- Career goals and motivation
- Specific examples of past work

Start by greeting the candidate warmly and introducing yourself as their AI interviewer for the ${jobTitle} position.`;

    // Request an ephemeral token from OpenAI using latest GPT-4o model
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: systemPrompt,
        modalities: ["text", "audio"],
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        temperature: 0.7,
        max_response_output_tokens: 4000
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to create session: ${error}`);
    }

    const data = await response.json();
    console.log("Session created successfully:", data.id);

    // Update interview record with AI session info
    await supabase
      .from('interviews')
      .update({
        ai_interview_enabled: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', interviewId);

    return new Response(JSON.stringify({
      success: true,
      sessionId: data.id,
      clientSecret: data.client_secret,
      interviewContext: {
        interviewId,
        candidate: candidateName,
        position: jobTitle,
        company: interview.application.job.company || 'Company'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in realtime-video-interview function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});