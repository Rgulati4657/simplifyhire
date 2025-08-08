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

interface JobDescriptionRequest {
  jobTitle: string;
  companyName?: string;
  industry?: string;
  experienceLevel?: string;
  employmentType?: string;
  location?: string;
  skills?: string[];
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // Get the authorization header and extract the JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Set the auth token for this request
    await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    const { 
      jobTitle, 
      companyName, 
      industry, 
      experienceLevel, 
      employmentType, 
      location,
      skills,
      budgetMin,
      budgetMax,
      currency = 'IDR'
    }: JobDescriptionRequest = await req.json();

    if (!jobTitle) {
      throw new Error('Job title is required');
    }

    // Generate budget recommendation using AI
    const budgetPrompt = `
You are an HR compensation expert. Based on the following job details, suggest a salary range in ${currency}:

Job Title: ${jobTitle}
Experience Level: ${experienceLevel || 'Mid-level'}
Location: ${location || 'Indonesia'}
Employment Type: ${employmentType || 'Full-time'}
Industry: ${industry || 'Technology'}

Provide only a JSON response with min and max salary values:
{
  "min": <number>,
  "max": <number>,
  "reasoning": "<brief explanation>"
}
`;

    const budgetResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an HR compensation expert. Always respond with valid JSON.' },
          { role: 'user', content: budgetPrompt }
        ],
        temperature: 0.7,
      }),
    });

    let budgetRecommendation = null;
    if (budgetResponse.ok) {
      const budgetData = await budgetResponse.json();
      try {
        budgetRecommendation = JSON.parse(budgetData.choices[0].message.content);
      } catch (e) {
        console.log('Failed to parse budget recommendation:', e);
      }
    }

    // Generate comprehensive job description
    const jdPrompt = `
You are an expert HR professional. Create a comprehensive job description for the following position:

Job Title: ${jobTitle}
Company: ${companyName || 'Our Company'}
Industry: ${industry || 'Technology'}
Experience Level: ${experienceLevel || 'Mid-level'}
Employment Type: ${employmentType || 'Full-time'}
Location: ${location || 'Indonesia'}
Required Skills: ${skills?.join(', ') || 'Not specified'}
Salary Range: ${budgetMin && budgetMax ? `${budgetMin.toLocaleString()} - ${budgetMax.toLocaleString()} ${currency}` : 'Competitive'}

Create a professional job description with the following sections:
1. Company Overview (2-3 sentences)
2. Role Summary (3-4 sentences)
3. Key Responsibilities (5-8 bullet points)
4. Required Qualifications (5-7 bullet points)
5. Preferred Qualifications (3-5 bullet points)
6. What We Offer (4-6 bullet points)

Make it engaging, professional, and tailored to the Indonesian market. Include relevant skills and technologies for the role.
`;

    const jdResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert HR professional specializing in creating compelling job descriptions for the Indonesian market.' },
          { role: 'user', content: jdPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });

    if (!jdResponse.ok) {
      const error = await jdResponse.json();
      throw new Error(error.error?.message || 'Failed to generate job description');
    }

    const jdData = await jdResponse.json();
    const generatedDescription = jdData.choices[0].message.content;

    // Generate suggested skills and requirements
    const skillsPrompt = `
Based on the job title "${jobTitle}" and experience level "${experienceLevel || 'Mid-level'}", provide:

1. Required technical skills (as an array)
2. Key requirements (as an array)
3. Suggested interview scoring criteria (as an array)

Respond with valid JSON:
{
  "skills": ["skill1", "skill2", ...],
  "requirements": ["requirement1", "requirement2", ...],
  "scoringCriteria": ["criteria1", "criteria2", ...]
}
`;

    const skillsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an HR expert. Always respond with valid JSON.' },
          { role: 'user', content: skillsPrompt }
        ],
        temperature: 0.7,
      }),
    });

    let skillsData = null;
    if (skillsResponse.ok) {
      const skillsJson = await skillsResponse.json();
      try {
        skillsData = JSON.parse(skillsJson.choices[0].message.content);
      } catch (e) {
        console.log('Failed to parse skills data:', e);
      }
    }

    const response = {
      jobDescription: generatedDescription,
      budgetRecommendation,
      suggestedSkills: skillsData?.skills || [],
      suggestedRequirements: skillsData?.requirements || [],
      suggestedScoringCriteria: skillsData?.scoringCriteria || []
    };

    console.log('Generated job description successfully for:', jobTitle);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-job-description function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});