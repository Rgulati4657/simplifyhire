import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade, connection',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  console.log('Realtime chat function called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgradeHeader = req.headers.get("upgrade");
  console.log('Upgrade header:', upgradeHeader);
  
  if (upgradeHeader !== "websocket") {
    console.log('Not a WebSocket request');
    return new Response("Expected websocket", { status: 400 });
  }

  try {
    console.log('WebSocket connection request received');
    
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      return new Response("OpenAI API key not configured", { status: 500 });
    }

    const url = new URL(req.url);
    const interviewId = url.searchParams.get('interviewId');
    
    if (!interviewId) {
      return new Response("Missing interviewId parameter", { status: 400 });
    }

    console.log('Setting up interview for ID:', interviewId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get interview details for context
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
          return new Response("Failed to create interview record", { status: 500 });
        }

        interview = newInterview;
      } else {
        return new Response("Interview or job application not found", { status: 404 });
      }
    }

    // Prepare interview context
    const candidateName = `${interview.application.candidate.first_name} ${interview.application.candidate.last_name}`;
    const jobTitle = interview.application.job.title;
    const jobDesc = interview.application.job.description;

    const systemPrompt = `You are an expert AI interviewer conducting a comprehensive video interview for the position of ${jobTitle}. 

CANDIDATE INFORMATION:
- Name: ${candidateName}
- Job Title: ${jobTitle}

JOB DESCRIPTION:
${jobDesc || 'Not provided'}

INTERVIEW GUIDELINES:
1. You are conducting a professional video interview - the candidate can see and hear you
2. Ask 8-12 structured questions covering technical skills, experience, and behavioral aspects
3. Follow up on answers to dig deeper into candidate responses
4. Be professional, friendly, and encouraging
5. Maintain natural conversation flow while ensuring comprehensive coverage
6. At the end, provide constructive feedback and next steps

Start by greeting the candidate warmly and introducing yourself as their AI interviewer for the ${jobTitle} position.`;

    const { socket, response } = Deno.upgradeWebSocket(req);

    let openAIWs: WebSocket | null = null;
    let sessionReady = false;

    socket.onopen = async () => {
      console.log("Client WebSocket connected, connecting to OpenAI...");
      
      try {
        // Connect to OpenAI Realtime API via WebSocket
        openAIWs = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
          headers: {
            "Authorization": `Bearer ${openAIApiKey}`,
            "OpenAI-Beta": "realtime=v1"
          }
        });

        openAIWs.onopen = () => {
          console.log("Connected to OpenAI Realtime API");
          
          // Send session configuration
          const sessionUpdate = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: systemPrompt,
              voice: 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000
              },
              temperature: 0.7,
              max_response_output_tokens: 4000
            }
          };
          
          openAIWs?.send(JSON.stringify(sessionUpdate));
          sessionReady = true;
        };

        openAIWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('OpenAI message:', data.type);
            
            // Forward all messages to client
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(event.data);
            }
          } catch (error) {
            console.error('Error parsing OpenAI message:', error);
          }
        };

        openAIWs.onerror = (error) => {
          console.error('OpenAI WebSocket error:', error);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'OpenAI connection error'
            }));
          }
        };

        openAIWs.onclose = () => {
          console.log('OpenAI WebSocket closed');
          if (socket.readyState === WebSocket.OPEN) {
            socket.close();
          }
        };

      } catch (error) {
        console.error('Error connecting to OpenAI:', error);
        socket.close();
      }
    };

    socket.onmessage = (event) => {
      try {
        if (openAIWs && openAIWs.readyState === WebSocket.OPEN && sessionReady) {
          // Forward client messages to OpenAI
          openAIWs.send(event.data);
        }
      } catch (error) {
        console.error('Error forwarding message to OpenAI:', error);
      }
    };

    socket.onclose = () => {
      console.log("Client WebSocket disconnected");
      if (openAIWs) {
        openAIWs.close();
      }
    };

    socket.onerror = (error) => {
      console.error("Client WebSocket error:", error);
      if (openAIWs) {
        openAIWs.close();
      }
    };

    return response;

  } catch (error) {
    console.error('Error in realtime-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});