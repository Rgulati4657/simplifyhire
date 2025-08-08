-- Manually confirm the email for the user deep@simplifyai.id
UPDATE auth.users 
SET email_confirmed_at = now()
WHERE email = 'deep@simplifyai.id' AND email_confirmed_at IS NULL;