"use client";

import { useMemo, useState } from "react";
import { Search, UsersRound } from "lucide-react";
import styles from "./customers.module.css";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  created_at: string;
  addedDate: string;
  user_id: string | null;
  subscriptionCount: number | null;
};

export default function CustomerList({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [portalFilter, setPortalFilter] = useState("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState("all");

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery = !normalizedQuery || [customer.name, customer.email, customer.phone, customer.company]
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
      const matchesPortal = portalFilter === "all" || (portalFilter === "linked" ? Boolean(customer.user_id) : !customer.user_id);
      const matchesSubscription = subscriptionFilter === "all" || (customer.subscriptionCount !== null && (subscriptionFilter === "subscribed" ? customer.subscriptionCount > 0 : customer.subscriptionCount === 0));
      return matchesQuery && matchesPortal && matchesSubscription;
    });
  }, [customers, portalFilter, query, subscriptionFilter]);

  const filtersActive = Boolean(query.trim()) || portalFilter !== "all" || subscriptionFilter !== "all";

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <span className={styles.visuallyHidden}>Search customers</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone or company" />
        </label>
        <label className={styles.filter}>
          <span>Portal</span>
          <select value={portalFilter} onChange={(event) => setPortalFilter(event.target.value)} aria-label="Filter by portal status">
            <option value="all">All statuses</option>
            <option value="linked">Linked</option>
            <option value="unlinked">Invite by signup</option>
          </select>
        </label>
        <label className={styles.filter}>
          <span>Subscriptions</span>
          <select value={subscriptionFilter} onChange={(event) => setSubscriptionFilter(event.target.value)} aria-label="Filter by subscription count">
            <option value="all">All customers</option>
            <option value="subscribed">Has subscriptions</option>
            <option value="none">No subscriptions</option>
          </select>
        </label>
        <span className={styles.resultCount} aria-live="polite">
          Showing <strong>{filteredCustomers.length}</strong> of {customers.length}
        </span>
      </div>

      {filteredCustomers.length ? (
        <div className={styles.customerList}>
          {filteredCustomers.map((customer) => (
            <article className={styles.customerCard} key={customer.id}>
              <div className={styles.customerIdentity}>
                <h3 title={customer.name}>{customer.name}</h3>
                <p className={styles.contactDetails}>
                  <a href={`mailto:${customer.email}`} title={customer.email}>{customer.email}</a>
                  {customer.phone && <a href={`tel:${customer.phone}`} title={customer.phone}>{customer.phone}</a>}
                </p>
              </div>
              <div className={styles.customerFact}>
                <span className={styles.factLabel}>Company</span>
                <span className={styles.factValue} title={customer.company || undefined}>{customer.company || "—"}</span>
              </div>
              <div className={styles.customerFact}>
                <span className={styles.factLabel}>Subscriptions</span>
                <span className={styles.factValue}>
                  {customer.subscriptionCount === null ? "Unavailable" : `${customer.subscriptionCount} ${customer.subscriptionCount === 1 ? "subscription" : "subscriptions"}`}
                </span>
              </div>
              <div className={styles.customerFact}>
                <span className={styles.factLabel}>Portal</span>
                <span className={`status ${customer.user_id ? "active" : "paused"}`}>{customer.user_id ? "Linked" : "Invite by signup"}</span>
              </div>
              <div className={styles.customerFact}>
                <span className={styles.factLabel}>Added</span>
                <span className={styles.factValue}>{customer.addedDate}</span>
              </div>
            </article>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className={styles.stateMessage}>
          <span className={styles.emptyIcon}><UsersRound size={20} aria-hidden="true" /></span>
          <strong>No customers yet</strong>
          <span>Add your first customer using the form above.</span>
        </div>
      ) : (
        <div className={styles.stateMessage}>
          <strong>{filtersActive ? "No customers match these filters" : "No customers yet"}</strong>
          <span>Try a different search or filter to see more results.</span>
          {filtersActive && <button className="small-button" type="button" onClick={() => { setQuery(""); setPortalFilter("all"); setSubscriptionFilter("all"); }}>Clear filters</button>}
        </div>
      )}
    </>
  );
}
