import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3'

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
    const { applicationId } = await req.json();
    
    if (!applicationId) {
      throw new Error('Application ID is required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get application with candidate and job details
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select(`
        *,
        candidates (
          first_name,
          last_name,
          skills,
          experience_years,
          resume_text,
          ai_summary
        ),
        jobs (
          title,
          description,
          skills_required,
          experience_level,
          requirements,
          min_assessment_score
        )
      `)
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      throw new Error('Application not found');
    }

    // Use AI to assess the application against the job
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert recruitment AI that assesses job applications. 
            
            Analyze the candidate against the job requirements and provide:
            1. A compatibility score (0-100)
            2. A detailed justification explaining strengths, weaknesses, and fit
            
            Return only a JSON object with this structure:
            {
              "score": number,
              "justification": "detailed assessment explaining the score"
            }
            
            Consider:
            - Skills match (technical and soft skills)
            - Experience level alignment
            - Requirements fulfillment
            - Overall profile strength
            - Potential for growth in the role`
          },
          {
            role: 'user',
            content: `Job Details:
            Title: ${application.jobs.title}
            Description: ${application.jobs.description || 'Not specified'}
            Required Skills: ${application.jobs.skills_required?.join(', ') || 'Not specified'}
            Experience Level: ${application.jobs.experience_level || 'Not specified'}
            Requirements: ${application.jobs.requirements?.join(', ') || 'Not specified'}
            
            Candidate Profile:
            Name: ${application.candidates.first_name} ${application.candidates.last_name}
            Skills: ${application.candidates.skills?.join(', ') || 'Not specified'}
            Experience: ${application.candidates.experience_years || 0} years
            AI Summary: ${application.candidates.ai_summary || 'Not available'}
            Cover Letter: ${application.cover_letter || 'Not provided'}
            
            Please assess this candidate's fit for the position.`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const assessmentText = data.choices[0].message.content;
    
    try {
      const assessment = JSON.parse(assessmentText);
      const minScore = application.jobs.min_assessment_score || 70;
      
      // Determine status based on score vs minimum criteria
      let newStatus = application.status; // Keep current status as default
      if (assessment.score >= minScore) {
        // Score meets minimum criteria - shortlist for interview
        if (application.status === 'applied') {
          newStatus = 'screening';
        }
      } else {
        // Score below minimum criteria - reject
        if (application.status === 'applied') {
          newStatus = 'rejected';
        }
      }
      
      // Update the application with AI assessment and new status
      const { error: updateError } = await supabase
        .from('job_applications')
        .update({
          ai_screening_score: assessment.score,
          ai_screening_notes: assessment.justification,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (updateError) {
        throw new Error(`Failed to update application: ${updateError.message}`);
      }

      return new Response(JSON.stringify({
        score: assessment.score,
        justification: assessment.justification
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', assessmentText);
      // Return a fallback assessment
      const fallbackScore = 50;
      const fallbackJustification = "Application received and under review. Automated assessment temporarily unavailable.";
      
      await supabase
        .from('job_applications')
        .update({
          ai_screening_score: fallbackScore,
          ai_screening_notes: fallbackJustification,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      return new Response(JSON.stringify({
        score: fallbackScore,
        justification: fallbackJustification
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in assess-application function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});