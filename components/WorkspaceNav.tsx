"use client";
import Link from "next/link"; import {usePathname} from "next/navigation"; import {Activity,Users,Layers,Repeat,ReceiptText,CreditCard} from "lucide-react";
const items=[ ["/dashboard","Overview",Activity],["/dashboard/subscriptions","Subscriptions",Repeat],["/dashboard/customers","Customers",Users],["/dashboard/plans","Plans",Layers],["/dashboard/invoices","Invoices",ReceiptText],["/dashboard/payments","Payments",CreditCard] ] as const;
export function WorkspaceNav(){const path=usePathname(); return <nav className="side-nav">{items.map(([href,label,Icon])=><Link key={href} href={href} className={`nav-item ${path===href||href!=="/dashboard"&&path.startsWith(href)?"active":""}`}><Icon size={18}/>{label}</Link>)}</nav>}
