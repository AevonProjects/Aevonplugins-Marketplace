import type { SupabaseClient, User } from '@supabase/supabase-js';

export type DiscountSnapshot = {
  subtotal: number;
  discountCodeId: string | null;
  discountCode: string | null;
  discountPercent: number;
  discountAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  amount: number;
};

function money(v:number){ return Math.round((v + Number.EPSILON) * 100) / 100; }

export async function priceWithDiscount(admin:SupabaseClient,user:User,subtotal:number,rawCode:unknown):Promise<DiscountSnapshot>{
  const code=String(rawCode||'').trim().toUpperCase();
  const base:DiscountSnapshot={subtotal:money(subtotal),discountCodeId:null,discountCode:null,discountPercent:0,discountAmount:0,commissionPercent:0,commissionAmount:0,amount:money(subtotal)};
  if(!code)return base;
  const {data,error}=await admin.from('aevonsmp_discount_codes').select('id,code,owner_user_id,discount_percent,commission_percent,status').ilike('code',code).eq('status','active').maybeSingle();
  if(error)throw new Error(error.message);
  if(!data)throw new Error('Discount code is invalid or disabled.');
  if(data.owner_user_id===user.id)throw new Error('You cannot use your own discount code.');
  const discountPercent=Math.max(0,Math.min(100,Number(data.discount_percent||0)));
  const commissionPercent=Math.max(0,Math.min(100,Number(data.commission_percent||0)));
  const discountAmount=money(subtotal*(discountPercent/100));
  const amount=money(Math.max(0,subtotal-discountAmount));
  // Commission is based on the actual paid amount after discount.
  const commissionAmount=money(amount*(commissionPercent/100));
  return {subtotal:money(subtotal),discountCodeId:data.id,discountCode:data.code,discountPercent,discountAmount,commissionPercent,commissionAmount,amount};
}
