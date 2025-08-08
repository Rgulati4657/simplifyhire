-- Fix the ai_screening_score column precision to allow values 0-100
ALTER TABLE job_applications 
ALTER COLUMN ai_screening_score TYPE NUMERIC(5,2);

-- Now update some candidates to be "selected" with good AI scores for demo purposes

-- Update candidate "agil" for Java engineer position
UPDATE job_applications 
SET 
  status = 'selected',
  ai_screening_score = 85.00,
  ai_screening_notes = 'Strong technical background with excellent Java experience. Recommended for offer workflow.',
  updated_at = now()
WHERE id = '599e8f8c-f621-4d62-b897-04d41a5f6126';

-- Update candidate "agil" for SR AI Engineer position  
UPDATE job_applications 
SET 
  status = 'selected',
  ai_screening_score = 78.00,
  ai_screening_notes = 'Good AI/ML experience with solid engineering fundamentals. Suitable candidate for senior role.',
  updated_at = now()
WHERE id = '7724e4e4-58b1-40ec-87f2-d1b5381d5b0b';

-- Update candidate "simple" for AI Engineer position
UPDATE job_applications 
SET 
  status = 'selected', 
  ai_screening_score = 92.00,
  ai_screening_notes = 'Exceptional candidate with outstanding AI expertise and proven track record. Highly recommended.',
  updated_at = now()
WHERE id = '04e3efda-b195-4aa2-a3e7-e87eb5815b8a';

-- Update one more candidate to "screening" status (shortlisted but not selected yet)
UPDATE job_applications 
SET 
  status = 'screening',
  ai_screening_score = 72.00,
  ai_screening_notes = 'Good candidate with potential. Requires interview assessment before selection.',
  updated_at = now()
WHERE id = '3f0792fe-01b2-4586-a318-f47e3b5ae645';