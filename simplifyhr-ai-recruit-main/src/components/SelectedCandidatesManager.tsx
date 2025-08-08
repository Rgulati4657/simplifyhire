import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clock, AlertCircle, FileText, Star, MapPin, DollarSign, Calendar } from 'lucide-react';

interface SelectedCandidate {
  id: string;
  candidate_id: string;
  job_id: string;
  status: string;
  ai_screening_score: number;
  candidates: {
    first_name: string;
    last_name: string;
    email: string;
    experience_years: number;
    expected_salary: number;
    current_location: string;
    skills: string[];
  };
  jobs: {
    title: string;
    location: string;
    salary_min: number;
    salary_max: number;
    currency: string;
  };
  offer_workflow?: {
    id: string;
    status: string;
    current_step: number;
  }[];
}

export function SelectedCandidatesManager() {
  const [selectedCandidates, setSelectedCandidates] = useState<SelectedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [initiatingWorkflow, setInitiatingWorkflow] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSelectedCandidates();
  }, []);

  const fetchSelectedCandidates = async () => {
    try {
      // Get job applications with status 'selected' for jobs created by current user
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          candidates (
            first_name,
            last_name, 
            email,
            experience_years,
            expected_salary,
            current_location,
            skills
          ),
          jobs!inner (
            title,
            location,
            salary_min,
            salary_max,
            currency,
            created_by
          ),
          offer_workflow (
            id,
            status,
            current_step
          )
        `)
        .eq('status', 'selected')
        .eq('jobs.created_by', (await supabase.auth.getUser()).data.user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSelectedCandidates((data || []) as any);
    } catch (error) {
      console.error('Error fetching selected candidates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch selected candidates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const initiateOfferWorkflow = async (applicationId: string) => {
    setInitiatingWorkflow(applicationId);
    try {
      const { data, error } = await supabase
        .from('offer_workflow')
        .insert({
          application_id: applicationId,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          current_step: 1,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Offer workflow initiated",
        description: "Background check process has started",
      });

      await fetchSelectedCandidates();
    } catch (error) {
      console.error('Error initiating workflow:', error);
      toast({
        title: "Error",
        description: "Failed to initiate offer workflow",
        variant: "destructive",
      });
    } finally {
      setInitiatingWorkflow(null);
    }
  };

  const getWorkflowStatus = (candidate: SelectedCandidate) => {
    if (!candidate.offer_workflow || candidate.offer_workflow.length === 0) {
      return { status: 'not_started', label: 'Not Started', color: 'bg-gray-100 text-gray-800' };
    }

    const workflow = candidate.offer_workflow[0];
    switch (workflow.status) {
      case 'pending':
        return { status: 'in_progress', label: `Step ${workflow.current_step}/5`, color: 'bg-blue-100 text-blue-800' };
      case 'completed':
        return { status: 'completed', label: 'Offer Accepted', color: 'bg-green-100 text-green-800' };
      case 'rejected':
        return { status: 'rejected', label: 'Offer Rejected', color: 'bg-red-100 text-red-800' };
      default:
        return { status: 'pending', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Selected Candidates</h2>
        </div>
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-48"></div>
                <div className="h-4 bg-muted rounded w-32"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Selected Candidates</h2>
          <p className="text-muted-foreground">Candidates ready for offer workflow</p>
        </div>
        <Button variant="outline" onClick={fetchSelectedCandidates}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-6">
        {selectedCandidates.map((candidate) => {
          const workflowStatus = getWorkflowStatus(candidate);
          const hasActiveWorkflow = candidate.offer_workflow && candidate.offer_workflow.length > 0;

          return (
            <Card key={candidate.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src="" />
                      <AvatarFallback>
                        {candidate.candidates.first_name[0]}{candidate.candidates.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {candidate.candidates.first_name} {candidate.candidates.last_name}
                      </CardTitle>
                      <CardDescription>
                        Applied for {candidate.jobs.title}
                      </CardDescription>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>{candidate.candidates.current_location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{candidate.candidates.experience_years}y exp</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-3 h-3" />
                          <span>{candidate.candidates.expected_salary?.toLocaleString()} {candidate.jobs.currency}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <div className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className={`font-medium ${getScoreColor(candidate.ai_screening_score)}`}>
                        {candidate.ai_screening_score}/100
                      </span>
                    </div>
                    <Badge className={workflowStatus.color}>
                      {workflowStatus.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Skills */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {candidate.candidates.skills?.slice(0, 5).map((skill, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {candidate.candidates.skills?.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{candidate.candidates.skills.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Job Match */}
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium">{candidate.jobs.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {candidate.jobs.salary_min?.toLocaleString()} - {candidate.jobs.salary_max?.toLocaleString()} {candidate.jobs.currency}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Job Location</div>
                        <div className="text-sm font-medium">{candidate.jobs.location}</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center space-x-2">
                      {hasActiveWorkflow ? (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <CheckCircle className="w-4 h-4" />
                          <span>Workflow in progress</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>Ready for offer workflow</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      {!hasActiveWorkflow ? (
                        <Button 
                          onClick={() => initiateOfferWorkflow(candidate.id)}
                          disabled={initiatingWorkflow === candidate.id}
                          size="sm"
                        >
                          {initiatingWorkflow === candidate.id ? (
                            'Starting...'
                          ) : (
                            <>
                              <FileText className="w-4 h-4 mr-2" />
                              Start Offer Process
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm">
                          <FileText className="w-4 h-4 mr-2" />
                          View Workflow
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {selectedCandidates.length === 0 && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No selected candidates yet</p>
                <p className="text-sm">Candidates will appear here when their application status is set to "selected"</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}