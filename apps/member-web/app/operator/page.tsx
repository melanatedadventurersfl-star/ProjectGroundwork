"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessStatus, readWaitlist, updateAccessStatus, WaitlistRegistrant } from "@/lib/waitlist";

const statuses: AccessStatus[] = ["waitlisted", "under_review", "approved", "invited", "activated", "paused", "declined"];

export default function OperatorPage() {
  const [people, setPeople] = useState<WaitlistRegistrant[]>([]);
  const [filter, setFilter] = useState<AccessStatus | "all">("all");

  useEffect(() => setPeople(readWaitlist()), []);

  const visible = useMemo(
    () => filter === "all" ? people : people.filter((person) => person.accessStatus === filter),
    [filter, people],
  );

  function changeStatus(id: string, status: AccessStatus) {
    setPeople(updateAccessStatus(id, status, status === "approved" || status === "invited" ? "Cohort 1" : undefined));
  }

  const counts = statuses.reduce<Record<string, number>>((result, status) => {
    result[status] = people.filter((person) => person.accessStatus === status).length;
    return result;
  }, {});

  return (
    <main>
      <section className="section">
        <p className="eyebrow">Operator preview</p>
        <h1>Early-access queue</h1>
        <p className="lede">Review prospective members, control invitation cohorts, and keep access status separate from an eventual member role.</p>
        <div className="grid">
          <article className="card"><div className="stat">{people.length}</div><p>Total prospective members</p></article>
          <article className="card"><div className="stat">{counts.waitlisted ?? 0}</div><p>Awaiting review</p></article>
          <article className="card"><div className="stat">{(counts.invited ?? 0) + (counts.activated ?? 0)}</div><p>Invited or activated</p></article>
        </div>
      </section>

      <section className="section">
        <div className="actions" aria-label="Filter waitlist">
          <button type="button" className="button secondary" onClick={() => setFilter("all")}>All</button>
          {statuses.map((status) => <button type="button" className="button ghost" key={status} onClick={() => setFilter(status)}>{status.replaceAll("_", " ")}</button>)}
        </div>
        <div className="tableWrap panel">
          <table>
            <thead><tr><th>Prospective member</th><th>Signals</th><th>Joined</th><th>Access status</th></tr></thead>
            <tbody>
              {visible.map((person) => (
                <tr key={person.id}>
                  <td><strong>{person.firstName} {person.lastName}</strong><br /><span className="muted">{person.email}</span></td>
                  <td>{person.experienceLevel}<br />{person.attendingSolo ? "Often attends solo" : ""}<br /><span className="muted">{person.interests.join(", ")}</span></td>
                  <td>{new Date(person.createdAt).toLocaleDateString()}</td>
                  <td>
                    <label><span className="badge">{person.accessStatus.replaceAll("_", " ")}</span>
                      <select value={person.accessStatus} onChange={(event) => changeStatus(person.id, event.target.value as AccessStatus)}>
                        {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                      </select>
                    </label>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={4}>No prospective members match this view yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
