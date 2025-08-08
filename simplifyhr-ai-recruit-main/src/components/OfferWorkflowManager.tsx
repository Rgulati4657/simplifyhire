import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, FileText, Mail, UserCheck, AlertCircle } from 'lucide-react';

interface OfferWorkflow {
  id: string;
  application_id: string;
  current_step: number;
  status: string;
  background_check_status?: string;
  hr_approval_status?: string;
  candidate_response?: string;
  created_at: string;
  final_offer_amount?: number;
  jobs?: { title: string } | null;
  candidates?: { first_name: string; last_name: string; email: string } | null;
}

const WORKFLOW_STEPS = [
  { id: 1, name: 'Background Check', icon: UserCheck },
  { id: 2, name: 'Generate Offer', icon: FileText },
  { id: 3, name: 'HR Approval', icon: CheckCircle },
  { id: 4, name: 'Send to Candidate', icon: Mail },
  { id: 5, name: 'Track Response', icon: Clock },
];

export function OfferWorkflowManager() {
  const [workflows, setWorkflows] = useState<OfferWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<OfferWorkflow | null>(null);
  const [hrComments, setHrComments] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const { data, error } = await supabase
        .from('offer_workflow')
        .select(`
          *,
          job_applications!inner (
            id,
            jobs (title),
            candidates (first_name, last_name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to match the expected interface
      const transformedData = (data || []).map(workflow => ({
        ...workflow,
        jobs: workflow.job_applications?.jobs,
        candidates: workflow.job_applications?.candidates
      }));
      
      setWorkflows(transformedData as any);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast({
        title: "Error",
        description: "Failed to fetch offer workflows",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const advanceWorkflow = async (workflowId: string, stepData: any = {}) => {
    setActionLoading(workflowId);
    try {
      const { data, error } = await supabase.rpc('advance_offer_workflow_step', {
        workflow_id: workflowId,
        step_data: stepData
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string };
      if (result.success) {
        await fetchWorkflows();
        toast({
          title: "Success",
          description: "Workflow step completed successfully",
        });
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error advancing workflow:', error);
      toast({
        title: "Error",
        description: "Failed to advance workflow step",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const runBackgroundCheck = async (workflow: OfferWorkflow) => {
    try {
      const candidate = workflow.candidates;
      if (!candidate) throw new Error('Candidate not found');

      const { data, error } = await supabase.functions.invoke('background-check', {
        body: {
          candidateId: workflow.application_id,
          firstName: candidate.first_name,
          lastName: candidate.last_name,
          email: candidate.email
        }
      });

      if (error) throw error;

      await advanceWorkflow(workflow.id, {
        background_check_status: data.status,
        background_check_result: data.result
      });
    } catch (error) {
      console.error('Error running background check:', error);
      toast({
        title: "Error",
        description: "Failed to run background check",
        variant: "destructive",
      });
    }
  };

  const generateOffer = async (workflow: OfferWorkflow) => {
    const offerContent = `
      <h2>Job Offer - ${workflow.jobs?.title}</h2>
      <p>Dear ${workflow.candidates?.first_name} ${workflow.candidates?.last_name},</p>
      <p>We are pleased to offer you the position of ${workflow.jobs?.title}.</p>
      <p>Salary: $${offerAmount || '75,000'}</p>
      <p>Please review and respond within 5 business days.</p>
    `;

    await advanceWorkflow(workflow.id, {
      generated_offer_content: offerContent,
      offer_details: {
        position: workflow.jobs?.title,
        salary: offerAmount || '75000'
      }
    });
  };

  const approveOffer = async (workflow: OfferWorkflow) => {
    await advanceWorkflow(workflow.id, {
      hr_comments: hrComments
    });
  };

  const sendToCandidate = async (workflow: OfferWorkflow) => {
    try {
      const { error } = await supabase.functions.invoke('send-offer-email', {
        body: {
          to: workflow.candidates?.email,
          subject: `Job Offer - ${workflow.jobs?.title}`,
          html: `
            <h2>Job Offer</h2>
            <p>Dear ${workflow.candidates?.first_name},</p>
            <p>We are pleased to offer you the position of ${workflow.jobs?.title}.</p>
            <p>Please review the attached offer letter and respond within 5 business days.</p>
          `,
          type: 'offer_sent'
        }
      });

      if (error) throw error;

      await advanceWorkflow(workflow.id, {
        offer_letter_url: 'dummy-offer-letter-url.pdf'
      });
    } catch (error) {
      console.error('Error sending offer:', error);
      toast({
        title: "Error",
        description: "Failed to send offer to candidate",
        variant: "destructive",
      });
    }
  };

  const getStepAction = (workflow: OfferWorkflow) => {
    const step = workflow.current_step;
    const isLoading = actionLoading === workflow.id;

    switch (step) {
      case 1:
        return (
          <Button 
            onClick={() => runBackgroundCheck(workflow)}
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? 'Running...' : 'Run Background Check'}
          </Button>
        );
      case 2:
        return (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setSelectedWorkflow(workflow)}>
                Generate Offer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Offer</DialogTitle>
                <DialogDescription>
                  Create offer letter for {workflow.candidates?.first_name} {workflow.candidates?.last_name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="amount">Offer Amount ($)</Label>
                  <Input
                    id="amount"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="75000"
                  />
                </div>
                <Button 
                  onClick={() => generateOffer(workflow)}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Generating...' : 'Generate Offer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      case 3:
        return (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setSelectedWorkflow(workflow)}>
                Review & Approve
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>HR Approval</DialogTitle>
                <DialogDescription>
                  Review and approve offer for {workflow.candidates?.first_name} {workflow.candidates?.last_name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="comments">HR Comments</Label>
                  <Textarea
                    id="comments"
                    value={hrComments}
                    onChange={(e) => setHrComments(e.target.value)}
                    placeholder="Add any comments or notes..."
                  />
                </div>
                <Button 
                  onClick={() => approveOffer(workflow)}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Approving...' : 'Approve Offer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      case 4:
        return (
          <Button 
            onClick={() => sendToCandidate(workflow)}
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? 'Sending...' : 'Send to Candidate'}
          </Button>
        );
      case 5:
        return (
          <Badge variant="outline">
            {workflow.candidate_response || 'Awaiting Response'}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'negotiating': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  if (loading) {
    return <div className="p-6">Loading offer workflows...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Offer Management Workflow</h2>
      </div>

      <div className="grid gap-6">
        {workflows.map((workflow) => (
          <Card key={workflow.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {workflow.jobs?.title} - {workflow.candidates?.first_name} {workflow.candidates?.last_name}
                  </CardTitle>
                  <CardDescription>
                    Started {new Date(workflow.created_at).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(workflow.status)}>
                  {workflow.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>Step {workflow.current_step} of 5</span>
                  </div>
                  <Progress value={(workflow.current_step / 5) * 100} className="h-2" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex space-x-4">
                    {WORKFLOW_STEPS.map((step) => {
                      const Icon = step.icon;
                      const isCompleted = step.id < workflow.current_step;
                      const isCurrent = step.id === workflow.current_step;
                      
                      return (
                        <div key={step.id} className="flex items-center space-x-2">
                          <div className={`p-2 rounded-full ${
                            isCompleted ? 'bg-green-100 text-green-600' :
                            isCurrent ? 'bg-blue-100 text-blue-600' :
                            'bg-gray-100 text-gray-400'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-sm ${
                            isCompleted ? 'text-green-600' :
                            isCurrent ? 'text-blue-600' :
                            'text-gray-400'
                          }`}>
                            {step.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="ml-4">
                    {workflow.status !== 'completed' && workflow.status !== 'rejected' && (
                      getStepAction(workflow)
                    )}
                  </div>
                </div>

                {workflow.status === 'completed' && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Offer accepted by candidate</span>
                  </div>
                )}

                {workflow.status === 'rejected' && (
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">Offer rejected by candidate</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {workflows.length === 0 && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No offer workflows found</p>
                <p className="text-sm">Workflows will appear here when candidates are selected for offers</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}