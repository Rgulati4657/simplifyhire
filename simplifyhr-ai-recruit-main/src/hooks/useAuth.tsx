import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for userId:', userId);
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error, 'for userId:', userId);
        setProfile(null);
      } else {
        console.log('Profile fetched successfully:', profileData);
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, userData: any) => {
    // Ensure required fields for profile creation
    let { first_name, last_name, role, ...rest } = userData;
    if (!first_name || !last_name || !role) {
      return { error: new Error('First name, last name, and role are required') };
    }
    // Map 'client' to 'admin' for DB
    if (role === 'client') role = 'admin';
    const redirectUrl = `${window.location.origin}/`;
    // Send profile fields as user metadata for DB trigger
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name,
          last_name,
          role,
          ...rest
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: any) => {
    if (!user) return { error: new Error('No user logged in') };
    // Check if role is being updated
    const roleChanged = updates.role && updates.role !== profile?.role;
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
    if (!error) {
      setProfile({ ...profile, ...updates });
      // If role changed and not candidate/super_admin, call edge function to create role-specific record
      if (roleChanged && !['candidate', 'super_admin'].includes(updates.role)) {
        try {
          // Example: call an edge function to create role-specific record
          await supabase.functions.invoke('create-role-record', {
            body: { profile_id: user.id, role: updates.role }
          });
        } catch (e) {
          // Log but don't block profile update
          console.error('Role-specific record creation failed:', e);
        }
      }
    }
    return { error };
  };

  const updateRoleSpecificProfile = async (updates: any) => {
    if (!user || !profile?.role) {
      return { error: new Error('User or role not available') };
    }

    // Determine the correct table name based on the user's role.
    const tableName = profile.role === 'admin' ? 'admin' 
                    : profile.role.endsWith('s') ? profile.role 
                    : `${profile.role}s`;

    console.log(`Upserting role-specific profile in table: ${tableName} for user: ${user.id}`);

    // const { error } = await supabase
    //   .from(tableName)
    //   .update(updates)
    //   .eq('profile_id', user.id); // The foreign key in all role tables must be 'profile_id'

    const { error } = await supabase
    .from(tableName)
    .upsert({
      profile_id: user.id, // Ensure the profile_id is always part of the object
      ...updates // Spread the rest of the updates (e.g., resume_url)
    });

    if (error) {
      console.error(`Error updating ${tableName} profile:`, error);
    }

    return { error };
  };


  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      updateProfile,
      updateRoleSpecificProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};