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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

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

    // Create readable stream for streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Generate job description with streaming
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

Create a professional job description using PLAIN TEXT FORMAT (no markdown symbols like *, #, -, etc.). Use the following structure:

COMPANY OVERVIEW
Write 2-3 sentences about the company.

ROLE SUMMARY  
Write 3-4 sentences describing the role.

KEY RESPONSIBILITIES
• List 5-8 key responsibilities using bullet points
• Each responsibility should be clear and actionable
• Focus on day-to-day tasks and key outcomes

REQUIRED QUALIFICATIONS
• List 5-7 required qualifications
• Include education, experience, and technical skills
• Be specific about years of experience needed

PREFERRED QUALIFICATIONS
• List 3-5 preferred qualifications
• Include nice-to-have skills and experience
• Additional certifications or knowledge areas

WHAT WE OFFER
• List 4-6 benefits and perks
• Include salary range, benefits, work environment
• Highlight unique value propositions

Make it engaging, professional, and tailored to the Indonesian market. Use plain text formatting only - no asterisks, hashes, or other markdown symbols.
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
              stream: true
            }),
          });

          if (!jdResponse.ok) {
            throw new Error(`HTTP error! status: ${jdResponse.status}`);
          }

          const reader = jdResponse.body?.getReader();
          if (!reader) {
            throw new Error('No reader available');
          }

          let fullDescription = '';
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullDescription += content;
                    // Send streaming chunk
                    controller.enqueue(new TextEncoder().encode(
                      `data: ${JSON.stringify({ type: 'content', content })}\n\n`
                    ));
                  }
                } catch (e) {
                  // Skip malformed JSON
                }
              }
            }
          }

          // Generate budget recommendation
          const budgetPrompt = `
Based on the following job details, suggest a salary range in ${currency} for the Indonesian market:

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
          const scoringPrompt = `
Based on the job title "${jobTitle}" and experience level "${experienceLevel || 'Mid-level'}", generate 5-7 specific scoring criteria for evaluating candidates during interviews. Make them measurable and relevant to the role.

Format as JSON array: ["criteria1", "criteria2", ...]
`;

          const scoringResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are an HR expert. Always respond with valid JSON arrays.' },
                { role: 'user', content: scoringPrompt }
              ],
              temperature: 0.7,
            }),
          });

          let scoringCriteria = [];
          if (scoringResponse.ok) {
            const scoringData = await scoringResponse.json();
            try {
              scoringCriteria = JSON.parse(scoringData.choices[0].message.content);
            } catch (e) {
              console.log('Failed to parse scoring criteria:', e);
            }
          }

          // Generate skills and requirements
          const skillsPrompt = `
Based on the job title "${jobTitle}" and experience level "${experienceLevel || 'Mid-level'}", provide required skills and job requirements.

Respond with valid JSON:
{
  "skills": ["skill1", "skill2", ...],
  "requirements": ["requirement1", "requirement2", ...]
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

          let skillsData = { skills: [], requirements: [] };
          if (skillsResponse.ok) {
            const skillsJson = await skillsResponse.json();
            try {
              skillsData = JSON.parse(skillsJson.choices[0].message.content);
            } catch (e) {
              console.log('Failed to parse skills data:', e);
            }
          }

          // Send final data
          controller.enqueue(new TextEncoder().encode(
            `data: ${JSON.stringify({ 
              type: 'complete', 
              fullDescription,
              budgetRecommendation,
              scoringCriteria,
              suggestedSkills: skillsData.skills,
              suggestedRequirements: skillsData.requirements
            })}\n\n`
          ));

          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(new TextEncoder().encode(
            `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`
          ));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in generate-job-description-stream function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});