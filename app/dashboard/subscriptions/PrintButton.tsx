"use client";
import { Printer } from "lucide-react";
export function PrintButton(){return <button type="button" className="button secondary" onClick={()=>window.print()}><Printer size={15}/> Print</button>;}
