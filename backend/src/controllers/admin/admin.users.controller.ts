import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB, saveTable } from '../../db/database';
import { emitToUser, emitToAdmin } from '../../services/socket.service';
import { createAuditLog } from '../../services/audit.service';
import { documentUpload } from '../profile.controller';
import multer from 'multer';

interface UserRow { id:string; email:string; password_hash:string; role:string; is_active:boolean; email_verified:boolean; last_login:string|null; login_attempts:number; provider:string|null; created_at:string; updated_at:string; [key:string]:unknown; }
interface ProfileRow { id:string; user_id:string; first_name:string; last_name:string; gender:string; date_of_birth:string; phone:string|null; profile_complete:boolean; is_verified:boolean; caste?:string; city?:string; state?:string; religion?:string; [key:string]:unknown; }
interface CreditRow { id:string; user_id:string; balance:number; updated_at:string; }
interface CreditHistoryRow { id:string; user_id:string; type:'credit'|'debit'; amount:number; reason:string; reference_id:string|null; balance_after:number; created_at:string; }
interface PurchaseRow { id:string; user_id:string; type:string; plan_id:string|null; amount:number; currency:string; status:string; expires_at:string|null; created_at:string; updated_at:string; [key:string]:unknown; }
interface DocumentRow { id:string; user_id:string; type:string; filename:string; url:string; status:string; rejection_reason?:string|null; reviewed_by?:string|null; reviewed_at?:string|null; created_at:string; updated_at?:string; }
interface MessageRow { id:string; sender_id:string; receiver_id:string; conversation_id:string; content:string; is_read:boolean; created_at:string; }
interface ConversationRow { id:string; participant_ids:string[]; last_message:string|null; last_message_at:string|null; created_at:string; updated_at:string; }

function safeUser(u: UserRow) {
  const { password_hash, email_verify_token, password_reset_token, ...safe } = u as UserRow & Record<string,unknown>;
  return safe;
}
function calcAge(dob: string): number {
  const b = new Date(dob); const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth()===b.getMonth() && t.getDate()<b.getDate())) a--;
  return a;
}

export async function getAllUsers(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string,string>;
    const page  = Math.max(1, parseInt(q['page']  ?? '1',  10));
    const limit = Math.min(100, parseInt(q['limit'] ?? '20', 10));
    const db = await getDB();
    const users    = db.users    as UserRow[];
    const profiles = db.profiles as ProfileRow[];
    const purchases = db.purchases as PurchaseRow[];
    const blocks = db.user_blocks as Array<{blocker_id:string;blocked_id:string}>;

    let list = users.filter(u => u.role !== 'admin').map(u => {
      const p = profiles.find(pr => pr.user_id === u.id);
      const hasPremium = purchases.some(pu => pu.user_id===u.id && pu.type==='membership' && pu.status==='completed' && pu.expires_at && new Date(pu.expires_at)>new Date());
      const isBlocked  = blocks.some(b => b.blocked_id === u.id);
      return { ...safeUser(u), profile: p ?? null, is_premium: hasPremium, is_blocked: isBlocked };
    });

    if (q['search']?.trim()) {
      const s = q['search'].toLowerCase();
      const field = q['search_field'] ?? 'all';
      list = list.filter(u => {
        const p = u.profile as ProfileRow|null;
        if (field==='email'||field==='all') if ((u.email as string).includes(s)) return true;
        if (field==='name' ||field==='all') if (p && (`${p.first_name} ${p.last_name}`).toLowerCase().includes(s)) return true;
        if (field==='phone'||field==='all') if (p?.phone && p.phone.includes(s)) return true;
        return false;
      });
    }
    if (q['gender'])         list = list.filter(u => (u.profile as ProfileRow|null)?.gender?.toLowerCase()===q['gender']!.toLowerCase());
    if (q['verified'])       list = list.filter(u => String((u.profile as ProfileRow|null)?.is_verified)===q['verified']);
    if (q['active'])         list = list.filter(u => String(u.is_active)===q['active']);
    if (q['premium'])        list = list.filter(u => String(u.is_premium)===q['premium']);
    if (q['blocked'])        list = list.filter(u => String(u.is_blocked)===q['blocked']);
    if (q['email_verified']) list = list.filter(u => String(u.email_verified)===q['email_verified']);
    if (q['caste'])          list = list.filter(u => (u.profile as ProfileRow|null)?.caste?.toLowerCase()===q['caste']!.toLowerCase());
    if (q['city'])           list = list.filter(u => (u.profile as ProfileRow|null)?.city?.toLowerCase()===q['city']!.toLowerCase());
    if (q['age_min']) { const min=parseInt(q['age_min']!,10); list=list.filter(u=>{const p=u.profile as ProfileRow|null;return p?.date_of_birth?calcAge(p.date_of_birth)>=min:false;}); }
    if (q['age_max']) { const max=parseInt(q['age_max']!,10); list=list.filter(u=>{const p=u.profile as ProfileRow|null;return p?.date_of_birth?calcAge(p.date_of_birth)<=max:false;}); }
    if (q['doc_verified']) {
      const docs = db.documents as DocumentRow[];
      list = list.filter(u => { const ud=docs.filter(d=>d.user_id===(u.id as string)); return String(ud.length>0&&ud.every(d=>d.status==='approved'))===q['doc_verified']; });
    }

    list.sort((a,b)=>new Date(b.created_at as string).getTime()-new Date(a.created_at as string).getTime());
    const total=list.length; const totalPages=Math.ceil(total/limit);
    const data=list.slice((page-1)*limit,page*limit);
    res.status(200).json({ success:true, users:data, totalCount:total, page, limit, totalPages });
  } catch(err) { console.error('[AdminUsers] getAllUsers error:',err); res.status(500).json({success:false,error:'Could not fetch users.'}); }
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const db = await getDB();
    const user = (db.users as UserRow[]).find(u=>u.id===userId);
    if (!user) { res.status(404).json({success:false,error:'User not found.'}); return; }
    const profile   = (db.profiles  as ProfileRow[]).find(p=>p.user_id===userId)??null;
    const credits   = (db.credits   as CreditRow[]).find(c=>c.user_id===userId)??null;
    const documents = (db.documents as DocumentRow[]).filter(d=>d.user_id===userId);
    const purchases = (db.purchases as PurchaseRow[]).filter(p=>p.user_id===userId).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
    const interests_received=(db.interests as Array<{receiver_id:string}>).filter(i=>i.receiver_id===userId).length;
    const interests_sent    =(db.interests as Array<{sender_id:string}>).filter(i=>i.sender_id===userId).length;
    const profile_views     =(db.profile_views as Array<{viewed_id:string}>).filter(v=>v.viewed_id===userId).length;
    const is_blocked        =(db.user_blocks as Array<{blocked_id:string}>).some(b=>b.blocked_id===userId);
    const is_premium        = purchases.some(p=>p.type==='membership'&&p.status==='completed'&&p.expires_at&&new Date(p.expires_at)>new Date());
    res.status(200).json({ success:true, user:safeUser(user), profile, credits:credits?{balance:credits.balance}:{balance:0}, documents, purchases, stats:{interests_received,interests_sent,profile_views,is_blocked,is_premium} });
  } catch(err) { console.error('[AdminUsers] getUserById error:',err); res.status(500).json({success:false,error:'Could not fetch user.'}); }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params; const adminId = req.user!.id;
    const db = await getDB(); const users = db.users as UserRow[];
    const idx = users.findIndex(u=>u.id===userId);
    if (idx===-1) { res.status(404).json({success:false,error:'User not found.'}); return; }
    const FORBIDDEN = new Set(['id','password_hash','email_verify_token','password_reset_token','created_at']);
    const updates: Record<string,unknown> = {};
    for (const [k,v] of Object.entries(req.body as Record<string,unknown>)) { if (!FORBIDDEN.has(k)) updates[k]=v; }
    const wasActive = users[idx]!.is_active;
    const wasVerified = (db.profiles as ProfileRow[]).find(p => p.user_id === userId)?.is_verified ?? false;
    users[idx] = { ...users[idx]!, ...updates, updated_at: new Date().toISOString() };
    await saveTable('users', db.users as any[]);
    await saveTable('profiles', db.profiles as any[]);
    // Emit status-changed when active flag changes
    if (updates['is_active']!==undefined && updates['is_active']!==wasActive) {
      emitToUser(userId,'account:status-changed',{is_active:users[idx]!.is_active});
      emitToAdmin('admin:user-status-changed',{user_id:userId,is_active:users[idx]!.is_active});
      // Blocked specifically
      if (updates['is_active'] === false) {
        emitToUser(userId,'account:blocked',{reason:'Admin action'});
      }
    }
    // Emit verified when is_verified changes to true
    if (updates['is_verified'] === true && !wasVerified) {
      emitToUser(userId,'account:verified',{is_verified:true});
      emitToAdmin('admin:user-verified',{user_id:userId});
      try {
        const updatedProfile = (db.profiles as any[])
          .find((p: any) => p.user_id === userId);
        if (updatedProfile) {
          emitToUser(userId, 'profile:updated', {
            ...updatedProfile,
            is_verified: true,
          });
        }
      } catch {}
    }

    // Emit general profile updates
    emitToAdmin('admin:profile-updated', { user_id: userId, profile: users[idx] });
    emitToUser(userId, 'profile:updated', { ...users[idx] });

    createAuditLog({action:'profile_updated',actor_id:adminId,resource_type:'user',resource_id:userId,details:{updated_fields:Object.keys(updates)},severity:'info'});
    res.status(200).json({ success:true, user:safeUser(users[idx]!) });
  } catch(err) { console.error('[AdminUsers] updateUser error:',err); res.status(500).json({success:false,error:'Could not update user.'}); }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params; const adminId = req.user!.id;
    const db = await getDB(); const users = db.users as UserRow[];
    const idx = users.findIndex(u=>u.id===userId);
    if (idx===-1) { res.status(404).json({success:false,error:'User not found.'}); return; }
    const now = new Date().toISOString();
    users[idx] = { ...users[idx]!, is_active:false, email:`deleted_${userId}@deleted.invalid`, password_hash:'', email_verify_token:null, password_reset_token:null, provider_id:null, updated_at:now };
    const profiles = db.profiles as ProfileRow[];
    const pIdx = profiles.findIndex(p=>p.user_id===userId);
    if (pIdx!==-1) profiles[pIdx] = { ...profiles[pIdx]!, first_name:'Deleted', last_name:'User', phone:null, updated_at:now };
    await saveTable('users', db.users as any[]);
    createAuditLog({action:'account_deleted',actor_id:adminId,resource_type:'user',resource_id:userId,severity:'critical'});
    emitToUser(userId,'account:deleted',{});
    emitToAdmin('admin:user-deleted', { user_id: userId });
    res.status(200).json({ success:true, message:'User soft-deleted and anonymised (GDPR).' });
  } catch(err) { console.error('[AdminUsers] deleteUser error:',err); res.status(500).json({success:false,error:'Could not delete user.'}); }
}

export async function adjustCredits(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params; const adminId = req.user!.id;
    const { amount, reason, type } = req.body as { amount:number; reason:string; type:'credit'|'debit' };
    if (!amount||!reason||!['credit','debit'].includes(type)) { res.status(400).json({success:false,error:'amount, reason, and type (credit|debit) are required.'}); return; }
    const db = await getDB(); const credits = db.credits as CreditRow[]; const history = db.credits_history as CreditHistoryRow[];
    let row = credits.find(c=>c.user_id===userId);
    if (!row) { row={id:uuidv4(),user_id:userId,balance:0,updated_at:new Date().toISOString()}; credits.push(row); }
    if (type==='debit'&&row.balance<amount) { res.status(400).json({success:false,error:`Insufficient balance. Current: ${row.balance}, Requested: ${amount}`}); return; }
    row.balance = type==='credit' ? row.balance+amount : row.balance-amount;
    row.updated_at = new Date().toISOString();
    history.push({id:uuidv4(),user_id:userId,type,amount,reason,reference_id:adminId,balance_after:row.balance,created_at:new Date().toISOString()});
    await saveTable('credits', db.credits as any[]);
    await saveTable('credits_history', db.credits_history as any[]);
    createAuditLog({action:'credits_adjusted',actor_id:adminId,resource_type:'user',resource_id:userId,details:{type,amount,reason,new_balance:row.balance},severity:'warning'});
    try {
      emitToUser(userId,'credits:updated',{balance:row.balance,type,amount,reason});
    } catch {}
    res.status(200).json({ success:true, newBalance:row.balance, adjustment:{type,amount,reason} });
  } catch(err) { console.error('[AdminUsers] adjustCredits error:',err); res.status(500).json({success:false,error:'Could not adjust credits.'}); }
}

export async function setPremium(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params; const adminId = req.user!.id;
    const { duration_days=30, plan_id } = req.body as { duration_days?:number; plan_id?:string };
    const db = await getDB();
    if (!(db.users as UserRow[]).find(u=>u.id===userId)) { res.status(404).json({success:false,error:'User not found.'}); return; }
    const expiresAt = new Date(Date.now()+duration_days*24*60*60*1000).toISOString();
    const purchase = { id:uuidv4(), user_id:userId, type:'membership', plan_id:plan_id??null, amount:0, currency:'INR', credits_added:0, gateway_id:'admin', gateway_order_id:null, gateway_payment_id:null, gateway_signature:null, status:'completed', expires_at:expiresAt, created_at:new Date().toISOString(), updated_at:new Date().toISOString() };
    (db.purchases as unknown[]).push(purchase);
    await saveTable('purchases', db.purchases as any[]);
    createAuditLog({action:'profile_updated',actor_id:adminId,resource_type:'user',resource_id:userId,details:{action:'set_premium',expires_at:expiresAt},severity:'info'});
    emitToUser(userId,'membership:activated',{expires_at:expiresAt});
    res.status(200).json({ success:true, message:'Premium activated.', expires_at:expiresAt });
  } catch(err) { console.error('[AdminUsers] setPremium error:',err); res.status(500).json({success:false,error:'Could not set premium.'}); }
}

export async function removePremium(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params; const adminId = req.user!.id;
    const db = await getDB();
    const purchases = db.purchases as Array<{user_id:string;type:string;status:string;expires_at:string|null;updated_at:string}>;
    let changed = false;
    purchases.forEach(p => { if (p.user_id===userId&&p.type==='membership'&&p.status==='completed') { p.status='refunded'; p.expires_at=null; p.updated_at=new Date().toISOString(); changed=true; } });
    if (changed) {
      await saveTable('purchases', db.purchases as any[]);
    }
    createAuditLog({action:'profile_updated',actor_id:adminId,resource_type:'user',resource_id:userId,details:{action:'remove_premium'},severity:'warning'});
    emitToUser(userId,'membership:deactivated',{});
    res.status(200).json({ success:true, message:'Premium removed.' });
  } catch(err) { console.error('[AdminUsers] removePremium error:',err); res.status(500).json({success:false,error:'Could not remove premium.'}); }
}

export async function approveAllDocuments(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params; const adminId = req.user!.id;
    const db = await getDB(); const docs = db.documents as DocumentRow[]; const now = new Date().toISOString(); let count = 0;
    docs.forEach(d => { if (d.user_id===userId&&d.status==='pending') { d.status='approved'; d.reviewed_by=adminId; d.reviewed_at=now; d.updated_at=now; count++; } });
    const profiles = db.profiles as ProfileRow[];
    const p = profiles.find(pr=>pr.user_id===userId);
    if (p) p.is_verified = true;
    await saveTable('documents', db.documents as any[]);
    await saveTable('profiles', db.profiles as any[]);
    createAuditLog({action:'document_approved',actor_id:adminId,resource_type:'user',resource_id:userId,details:{count},severity:'info'});
    emitToUser(userId,'documents:all-approved',{count});
    try {
      const db2 = await getDB();
      const approvedProfile = (db2.profiles as any[])
        .find((p: any) => p.user_id === userId);
      if (approvedProfile) {
        emitToUser(userId, 'profile:updated', {
          ...approvedProfile,
          is_verified: true,
        });
      }
      emitToUser(userId, 'document:status-changed', {
        userId,
        status: 'approved',
        isVerified: true,
      });
      emitToAdmin('admin:doc-status-changed', {
        userId,
        status: 'approved',
        isVerified: true,
      });
    } catch {}
    res.status(200).json({ success:true, message:`${count} document(s) approved. Profile verified.`, count });
  } catch(err) { console.error('[AdminUsers] approveAllDocuments error:',err); res.status(500).json({success:false,error:'Could not approve documents.'}); }
}

export async function getUserDocumentByType(req: Request, res: Response): Promise<void> {
  try {
    const { userId, docType } = req.params;
    const db = await getDB();
    const docs = (db.documents as DocumentRow[]).filter(d=>d.user_id===userId&&d.type===docType);
    res.status(200).json({ success:true, documents:docs });
  } catch(err) { res.status(500).json({success:false,error:'Could not fetch document.'}); }
}

export async function updateDocumentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { userId, docType } = req.params; const adminId = req.user!.id;
    const { status, reason } = req.body as { status:string; reason?:string };
    if (!['pending','approved','rejected'].includes(status)) { res.status(400).json({success:false,error:'Invalid status.'}); return; }
    const db = await getDB(); const docs = db.documents as DocumentRow[]; const now = new Date().toISOString(); let count = 0;
    docs.forEach(d => { if (d.user_id===userId&&d.type===docType) { d.status=status as DocumentRow['status']; d.reviewed_by=adminId; d.reviewed_at=now; d.updated_at=now; if (status==='rejected'&&reason) d.rejection_reason=reason; else d.rejection_reason=null; count++; } });
    await saveTable('documents', db.documents as any[]);
    
    emitToAdmin('admin:doc-status-changed', { user_id: userId, type: docType, status });
    emitToUser(userId, 'document:status-changed', { userId, status });

    res.status(200).json({ success:true, message:`${count} document(s) updated to ${status}.` });
  } catch(err) { res.status(500).json({success:false,error:'Could not update document status.'}); }
}

export async function uploadDocumentForUser(req: Request, res: Response): Promise<void> {
  documentUpload(req, res, async (err) => {
    if (err instanceof multer.MulterError || err) { res.status(400).json({success:false,error:(err as Error).message}); return; }
    if (!req.file) { res.status(400).json({success:false,error:'No file provided.'}); return; }
    try {
      const { userId } = req.params;
      const docType = (req.body as {doc_type?:string}).doc_type ?? 'other';
      const db = await getDB();
      const doc = { id:uuidv4(), user_id:userId, type:docType, filename:req.file.filename, url:`/uploads/documents/${req.file.filename}`, status:'pending', created_at:new Date().toISOString() };
      (db.documents as unknown[]).push(doc);
      await saveTable('documents', db.documents as any[]);
      res.status(201).json({ success:true, document:doc });
    } catch(e) { res.status(500).json({success:false,error:'Could not save document.'}); }
  });
}

export async function getUserChats(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params; const db = await getDB();
    const conversations = (db.conversations as ConversationRow[]).filter(c=>c.participant_ids.includes(userId)).sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());
    const profiles = db.profiles as ProfileRow[];
    const enriched = conversations.map(c => { const otherId=c.participant_ids.find(id=>id!==userId); const other=otherId?profiles.find(p=>p.user_id===otherId):null; return {...c,other_user:other?{user_id:other.user_id,first_name:other.first_name,last_name:other.last_name}:null}; });
    res.status(200).json({ success:true, conversations:enriched, total:enriched.length });
  } catch(err) { res.status(500).json({success:false,error:'Could not fetch chats.'}); }
}

export async function getUserChatMessages(req: Request, res: Response): Promise<void> {
  try {
    const { userId, otherUserId } = req.params;
    const page=Math.max(1,parseInt((req.query['page'] as string)?? '1',10));
    const limit=Math.min(100,parseInt((req.query['limit'] as string)?? '50',10));
    const db = await getDB();
    const messages = (db.messages as MessageRow[]).filter(m=>(m.sender_id===userId&&m.receiver_id===otherUserId)||(m.sender_id===otherUserId&&m.receiver_id===userId)).sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
    const total=messages.length; const data=messages.slice((page-1)*limit,page*limit);
    res.status(200).json({ success:true, data, total, page, limit, totalPages:Math.ceil(total/limit) });
  } catch(err) { res.status(500).json({success:false,error:'Could not fetch messages.'}); }
}

export async function deleteUserDocument(req: Request, res: Response): Promise<void> {
  try {
    const { userId, docType } = req.params; const db = await getDB();
    const docs = db.documents as DocumentRow[];
    const toDelete = docs.filter(d=>d.user_id===userId&&d.type===docType);
    toDelete.forEach(d => { const fp=path.resolve(__dirname,'../../../uploads/documents',d.filename); if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch {} });
    db.documents = docs.filter(d=>!(d.user_id===userId&&d.type===docType));
    await saveTable('documents', db.documents as any[]);
    res.status(200).json({ success:true, message:`${toDelete.length} document(s) deleted.` });
  } catch(err) { res.status(500).json({success:false,error:'Could not delete document.'}); }
}
// ─── getAdminStats ────────────────────────────────────────────────────────────

export async function getAdminStats(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDB();
    const profiles = (db.profiles as any[]) || [];
    const users = (db.users as any[]) || [];
    const interests = (db.interests as any[]) || [];
    const purchases = (db.purchases as any[]) || [];
    const documents = (db.documents as any[]) || [];

    const nonAdminUsers = users.filter((u: any) => u.role !== 'admin');
    const nonAdminProfiles = profiles.filter((p: any) => {
      const user = nonAdminUsers.find((u: any) => u.id === p.user_id);
      return !!user;
    });

    const totalUsers = nonAdminUsers.length;
    const activeUsers = nonAdminUsers.filter((u: any) => u.is_active).length;
    const inactiveUsers = nonAdminUsers.filter((u: any) => !u.is_active).length;
    const premiumUsers = nonAdminUsers.filter((u: any) => u.is_premium).length;
    const verifiedUsers = nonAdminProfiles.filter((p: any) => p.is_verified).length;
    const unverifiedUsers = nonAdminProfiles.filter((p: any) => !p.is_verified).length;
    const blockedUsers = nonAdminUsers.filter((u: any) => u.is_blocked).length;
    const maleUsers = nonAdminProfiles.filter((p: any) => p.gender === 'male' || p.gender === 'groom').length;
    const femaleUsers = nonAdminProfiles.filter((p: any) => p.gender === 'female' || p.gender === 'bride').length;

    const totalRevenue = purchases.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyRevenue = purchases
      .filter((p: any) => (p.created_at || '').slice(0, 7) === thisMonth)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
    const lastMonthRevenue = purchases
      .filter((p: any) => (p.created_at || '').slice(0, 7) === lastMonth)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const revenueGrowth = lastMonthRevenue > 0
      ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0;

    const pendingDocs = documents.filter((d: any) => d.status === 'pending').length;
    const totalInterests = interests.length;
    const acceptedInterests = interests.filter((i: any) => i.status === 'accepted').length;

    const ageGroups = { '18-25': 0, '26-35': 0, '36-45': 0, '46+': 0 };
    nonAdminProfiles.forEach((p: any) => {
      if (!p.date_of_birth) return;
      const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
      if (age >= 18 && age <= 25) ageGroups['18-25']++;
      else if (age >= 26 && age <= 35) ageGroups['26-35']++;
      else if (age >= 36 && age <= 45) ageGroups['36-45']++;
      else if (age >= 46) ageGroups['46+']++;
    });

    res.status(200).json({
      totalUsers, activeUsers, inactiveUsers, premiumUsers,
      verifiedUsers, unverifiedUsers, blockedUsers,
      maleUsers, femaleUsers,
      totalRevenue, monthlyRevenue, revenueGrowth,
      totalInterests, acceptedInterests,
      pendingDocs, ageGroups,
      totalTransactions: purchases.length,
      activeSubscriptions: purchases.filter((p: any) =>
        p.status === 'active' || p.status === 'completed'
      ).length,
    });
  } catch (err) {
    console.error('[Admin] getAdminStats error:', err);
    res.status(200).json({
      totalUsers: 0, activeUsers: 0, inactiveUsers: 0,
      premiumUsers: 0, verifiedUsers: 0, unverifiedUsers: 0,
      blockedUsers: 0, maleUsers: 0, femaleUsers: 0,
      totalRevenue: 0, monthlyRevenue: 0, revenueGrowth: 0,
      totalInterests: 0, acceptedInterests: 0,
      pendingDocs: 0, ageGroups: { '18-25':0,'26-35':0,'36-45':0,'46+':0 },
      totalTransactions: 0, activeSubscriptions: 0,
    });
  }
}
