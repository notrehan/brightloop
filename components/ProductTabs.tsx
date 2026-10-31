"use client";
import { useEffect, useState, type ReactNode } from "react";
export function ProductTabs({ tabs, children }: { tabs: string[]; children: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const [recurring, setRecurring] = useState(true);
  const pricingIndex = tabs.findIndex(tab => tab.toLowerCase().includes("time-based pricing"));
  useEffect(() => {
    const checkbox = document.querySelector<HTMLInputElement>('input[name="recurring"]');
    if (!checkbox) return;
    setRecurring(checkbox.checked);
    const sync = () => {
      setRecurring(checkbox.checked);
      if (checkbox.checked && pricingIndex >= 0) setActive(pricingIndex);
      else if (!checkbox.checked && active === pricingIndex) setActive(0);
    };
    checkbox.addEventListener("change", sync);
    return () => checkbox.removeEventListener("change", sync);
  }, [active, pricingIndex]);
  return <div className="product-tab-shell"><div className="product-tab-bar" role="tablist">{tabs.map((tab, index) => (index===pricingIndex&&!recurring)?null:<button key={tab} type="button" role="tab" aria-selected={active===index} className={active===index?"selected":""} onClick={()=>setActive(index)}>{tab}</button>)}</div>{children.map((child,index) => index===pricingIndex&&!recurring?null:<div key={tabs[index]} role="tabpanel" hidden={active!==index} className="product-tab-panel">{child}</div>)}</div>;
}
