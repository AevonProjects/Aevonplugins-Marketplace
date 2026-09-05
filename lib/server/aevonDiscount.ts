import type { SupabaseClient, User } from '@supabase/supabase-js';

export type StoreKind = 'marketplace' | 'aevonsmp';

export type DiscountSnapshot = {
  subtotal: number;
  discountCodeId: string | null;
  discountCode: string | null;
  codeDiscountPercent: number;
  discountPercent: number;
  discountAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  verificationDiscountApplied: boolean;
  verificationDiscountPercent: number;
  verificationDiscountAmount: number;
  verificationPurchasesUsed: number;
  verificationPurchasesRemaining: number;
  amount: number;
};

function money(v:number){ return Math.round((v + Number.EPSILON) * 100) / 100; }

async function verificationBenefit(admin:SupabaseClient,user:User,kind:StoreKind,productId:string){
  const {data:profile}=await admin.from('profiles').select('verification_status').eq('id',user.id).maybeSingle();
  if(profile?.verification_status!=='verified') return {eligible:false,used:0,remaining:0};

  const table=kind==='aevonsmp'?'aevonsmp_orders':'marketplace_orders';
  const productColumn=kind==='aevonsmp'?'product_id':'plugin_id';
  let q=admin.from(table).select('id',{count:'exact',head:true}).eq('user_id',user.id).eq(productColumn,productId).eq('verification_discount_applied',true);
  if(kind==='aevonsmp') q=q.in('payment_status',['paid','approved']);
  else q=q.in('status',['paid','approved']);
  const {count,error}=await q;
  if(error) throw new Error(error.message);
  const used=Number(count||0);
  return {eligible:used<5,used,remaining:Math.max(0,5-used)};
}

export async function priceWithDiscount(admin:SupabaseClient,user:User,subtotal:number,rawCode:unknown,options?:{kind?:StoreKind;productId?:string}):Promise<DiscountSnapshot>{
  const code=String(rawCode||'').trim().toUpperCase();
  const baseSubtotal=money(subtotal);
  let discountCodeId:string|null=null,discountCode:string|null=null,codeDiscountPercent=0,commissionPercent=0;

  if(code){
    const {data,error}=await admin.from('aevonsmp_discount_codes').select('id,code,owner_user_id,discount_percent,commission_percent,status').ilike('code',code).eq('status','active').maybeSingle();
    if(error)throw new Error(error.message);
    if(!data)throw new Error('Discount code is invalid or disabled.');
    if(data.owner_user_id===user.id)throw new Error('You cannot use your own discount code.');
    discountCodeId=data.id;discountCode=data.code;
    codeDiscountPercent=Math.max(0,Math.min(100,Number(data.discount_percent||0)));
    commissionPercent=Math.max(0,Math.min(100,Number(data.commission_percent||0)));
  }

  let verificationDiscountApplied=false,verificationDiscountPercent=0,verificationPurchasesUsed=0,verificationPurchasesRemaining=0;
  if(options?.kind&&options?.productId){
    const benefit=await verificationBenefit(admin,user,options.kind,options.productId);
    verificationPurchasesUsed=benefit.used;verificationPurchasesRemaining=benefit.remaining;
    if(benefit.eligible){verificationDiscountApplied=true;verificationDiscountPercent=50;}
  }

  // Verification and affiliate discounts do not stack. The customer receives whichever percentage is larger.
  const effectivePercent=Math.max(codeDiscountPercent,verificationDiscountPercent);
  if(verificationDiscountApplied && codeDiscountPercent>=verificationDiscountPercent){
    // Do not consume a verified purchase when the affiliate code already provides an equal or better price.
    verificationDiscountApplied=false;
    verificationDiscountPercent=0;
  }
  const discountAmount=money(baseSubtotal*(effectivePercent/100));
  const amount=money(Math.max(0,baseSubtotal-discountAmount));
  const commissionAmount=discountCodeId?money(amount*(commissionPercent/100)):0;
  const verificationDiscountAmount=verificationDiscountApplied?discountAmount:0;

  return {
    subtotal:baseSubtotal,discountCodeId,discountCode,codeDiscountPercent,
    discountPercent:effectivePercent,discountAmount,commissionPercent,commissionAmount,
    verificationDiscountApplied,verificationDiscountPercent,verificationDiscountAmount,
    verificationPurchasesUsed,verificationPurchasesRemaining:verificationDiscountApplied?Math.max(0,verificationPurchasesRemaining-1):verificationPurchasesRemaining,
    amount
  };
}
