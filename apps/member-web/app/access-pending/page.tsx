import Link from "next/link";

export default function AccessPendingPage() {
  return <main><section className="section"><div className="panel"><p className="eyebrow">Access not open yet</p><h1>Your place is saved.</h1><p className="lede">You are part of the prospective-member list, but your cohort has not been granted app access yet. MA will email you when your invitation is ready.</p><div className="actions"><Link className="button ghost" href="/">Return home</Link><Link className="button" href="/castaway">View the Castaway pilot</Link></div></div></section></main>;
}
