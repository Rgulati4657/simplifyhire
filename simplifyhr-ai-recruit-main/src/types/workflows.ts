export interface OfferWorkflow {
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

export interface WorkflowStep {
  id: number;
  name: string;
  icon: any;
}

export interface WorkflowStepData {
  background_check_status?: string;
  background_check_result?: any;
  generated_offer_content?: string;
  offer_details?: any;
  hr_comments?: string;
  offer_letter_url?: string;
}