import { supabaseAdmin } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export async function storeOTP(userId: string, email: string, otp: string, type: string) {
  await supabaseAdmin.from("otps").upsert({
    id: uuidv4(),
    user_id: userId,
    email,
    otp,
    type,
    expires_at: new Date(Date.now() + 600000).toISOString(),
    created_at: new Date().toISOString()
  }, { onConflict: "user_id,type" });
}

export async function verifyOTP(userId: string, otp: string, type: string) {
  const { data } = await supabaseAdmin.from("otps")
    .select("*")
    .eq("user_id", userId)
    .eq("otp", otp)
    .eq("type", type)
    .single();
    
  if (!data || new Date() > new Date(data.expires_at)) return false;
  await supabaseAdmin.from("otps").delete().eq("id", data.id);
  return true;
}
