import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  type: 'offer_generated' | 'offer_sent' | 'offer_approved';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, type }: EmailRequest = await req.json();

    console.log(`🔔 DUMMY EMAIL NOTIFICATION`);
    console.log(`Type: ${type}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${html}`);

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate successful email sending
    const dummyResponse = {
      id: `dummy_email_${Date.now()}`,
      from: "hr@company.com",
      to: [to],
      subject,
      html,
      status: "sent",
      created_at: new Date().toISOString(),
      message: "✅ Email sent successfully (dummy implementation)"
    };

    console.log(`✅ Dummy email sent successfully to ${to}`);

    return new Response(JSON.stringify(dummyResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in dummy email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);