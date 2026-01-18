import { supabase } from "./client";

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    console.error("Google sign-in failed:", error);
    alert(error.message);
  };
};

export const signOut = async () => {
  await supabase.auth.signOut();
};
