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
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get candidate profile
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (candidateError || !candidate) {
      throw new Error('Candidate profile not found');
    }

    // Get all published jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        *,
        companies (name, industry)
      `)
      .eq('status', 'published')
      .limit(20);

    if (jobsError) {
      throw new Error('Failed to fetch jobs');
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use AI to score and recommend jobs
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
            content: `You are a job recommendation engine. Based on the candidate profile and available jobs, score each job for compatibility (0-100) and return the top 6 recommendations.

            Return a JSON array of job IDs with scores, ordered by score (highest first):
            [
              {"job_id": "uuid", "score": 95, "reason": "Perfect match for skills"},
              {"job_id": "uuid", "score": 87, "reason": "Good experience level match"},
              ...
            ]
            
            Consider:
            - Skills match
            - Experience level
            - Location preferences
            - Salary expectations
            - Industry fit
            
            Return only valid JSON, no markdown.`
          },
          {
            role: 'user',
            content: `Candidate Profile:
            Skills: ${candidate.skills || []}
            Experience: ${candidate.experience_years || 0} years
            Location: ${candidate.current_location || 'Any'}
            Expected Salary: ${candidate.expected_salary || 'Not specified'} ${candidate.currency || 'IDR'}
            
            Available Jobs:
            ${jobs.map(job => `
            ID: ${job.id}
            Title: ${job.title}
            Company: ${job.companies?.name}
            Skills Required: ${job.skills_required || []}
            Experience Level: ${job.experience_level}
            Location: ${job.location}
            Salary: ${job.salary_min}-${job.salary_max} ${job.currency}
            `).join('\n')}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const recommendationsText = data.choices[0].message.content;
    
    try {
      const recommendations = JSON.parse(recommendationsText);
      
      // Get the recommended jobs with full details
      const recommendedJobIds = recommendations.slice(0, 6).map((r: any) => r.job_id);
      const recommendedJobs = jobs.filter(job => recommendedJobIds.includes(job.id));
      
      // Add AI scores to the jobs
      const jobsWithScores = recommendedJobs.map(job => {
        const recommendation = recommendations.find((r: any) => r.job_id === job.id);
        return {
          ...job,
          ai_score: recommendation?.score || 50,
          ai_reason: recommendation?.reason || 'Good match'
        };
      });

      return new Response(JSON.stringify(jobsWithScores), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', recommendationsText);
      // Return fallback recommendations (first 6 jobs)
      return new Response(JSON.stringify(jobs.slice(0, 6)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in recommend-jobs function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});