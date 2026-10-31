"use server";
import {redirect} from "next/navigation";import {createClient} from "@/lib/supabase/server";
export async function startSubscription(f:FormData){const s=await createClient();const {error}=await s.rpc("customer_start_subscription",{p_plan_id:String(f.get("plan_id")||"")});if(error)redirect(`/portal?error=${encodeURIComponent(error.message)}`);redirect("/portal?success=Subscription%20started.%20Your%20invoice%20is%20ready.");}
export async function manageSubscription(f:FormData){const s=await createClient();const {error}=await s.rpc("customer_manage_subscription",{p_subscription_id:String(f.get("id")||""),p_action:String(f.get("action")||"")});if(error)redirect(`/portal?error=${encodeURIComponent(error.message)}`);redirect("/portal?success=Subscription%20updated");}
