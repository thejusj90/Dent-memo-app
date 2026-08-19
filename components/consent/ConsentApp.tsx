"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import SignaturePad from "./SignaturePad";
import { downloadPdf } from "@/lib/consent/pdf";
import {
  approveTemplateForClinic,
  consentDemoMode,
  createConsentClinic,
  currentSession,
  demoContext,
  downloadStoredConsent,
  loadConsentContext,
  resendConsentEmail,
  saveDoctor,
  saveSignedConsent,
  signInConsent,
  signOutConsent,
  signUpConsent,
  voidSignedConsent,
} from "@/lib/consent/repository";
import type { ClinicContext, ConsentRecord, ConsentTemplate, SignatureStroke } from "@/lib/consent/types";

type View = "dashboard" | "new" | "records" | "templates" | "settings";
type NewStep = "details" | "review" | "sign" | "success";

const ACKS = [
  "I have read and understood the information above.",
  "I have had an opportunity to ask questions about the proposed treatment.",
];

function Logo() {
  return <a className="dc-logo" href="./" aria-label="DentMemo Consent home"><span>♡</span><strong>DentMemo <small>Consent</small></strong></a>;
}

function AuthPanel({ onUser }: { onUser: (user: User) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = mode === "signin" ? await signInConsent(email, password) : await signUpConsent(email, password, fullName);
      if (result.error) throw result.error;
      if (result.data.user && result.data.session) onUser(result.data.user);
      else setMessage("Check your email to confirm the account, then sign in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dc-auth-page"><section className="dc-auth-card"><Logo />
      <p className="dc-kicker">DIGITAL DENTAL CONSENT</p><h1>Dental consent. Signed in under a minute.</h1>
      <p className="dc-muted">Create treatment-specific forms, hand over the tablet, and keep every signed record organized.</p>
      <form onSubmit={submit} className="dc-form">
        {mode === "signup" && <label>Your name<input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>}
        <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {message && <div className="dc-alert">{message}</div>}
        <button className="dc-primary dc-wide" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
      </form>
      <button type="button" className="dc-link" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "New clinic? Create an account" : "Already have an account? Sign in"}</button>
    </section></main>
  );
}

function ClinicSetup({ user, onDone }: { user: User; onDone: () => Promise<void> }) {
  const [clinicName, setClinicName] = useState("");
  const [city, setCity] = useState("Goa");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createConsentClinic(user, clinicName, city);
      await onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create clinic.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="dc-auth-page"><section className="dc-auth-card"><Logo /><p className="dc-kicker">ONE-TIME SETUP</p><h1>Create your clinic workspace.</h1><form onSubmit={submit} className="dc-form"><label>Clinic name<input required value={clinicName} onChange={(e) => setClinicName(e.target.value)} /></label><label>City<input value={city} onChange={(e) => setCity(e.target.value)} /></label>{error && <div className="dc-alert">{error}</div>}<button className="dc-primary dc-wide" disabled={busy}>{busy ? "Creating…" : "Continue"}</button></form></section></main>;
}

function Shell({ context, view, setView, children, onSignOut }: { context: ClinicContext; view: View; setView: (view: View) => void; children: React.ReactNode; onSignOut: () => void }) {
  const items: Array<[View, string, string]> = [["dashboard", "⌂", "Overview"], ["new", "+", "New consent"], ["records", "▤", "Records"], ["templates", "□", "Templates"], ["settings", "⚙", "Settings"]];
  return <div className="dc-app"><aside className="dc-sidebar"><Logo /><div className="dc-clinic"><span>{context.clinicName.slice(0,1).toUpperCase()}</span><div><b>{context.clinicName}</b><small>{context.city || "Clinic workspace"}</small></div></div><nav>{items.map(([id,icon,label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><i>{icon}</i>{label}</button>)}</nav><div className="dc-sidebar-bottom"><small className="dc-muted">Consent workspace</small><button className="dc-link" onClick={onSignOut}>Sign out</button></div></aside><header className="dc-mobile-head"><Logo /><button className="dc-primary" onClick={() => setView("new")}>+ Consent</button></header><main className="dc-workspace">{children}</main><nav className="dc-mobile-nav">{items.slice(0,4).map(([id,icon,label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><i>{icon}</i><span>{label}</span></button>)}</nav></div>;
}

function SimpleRecordList({ records }: { records: ConsentRecord[] }) {
  if (!records.length) return <div className="dc-empty"><span>✎</span><b>No signed consents yet</b><p>Your first completed consent will appear here.</p></div>;
  return <div className="dc-record-list">{records.map((record) => <article key={record.id}><div className="dc-record-icon">{record.status === "voided" ? "×" : "✓"}</div><div><b>{record.patient_name_snapshot}</b><span>{record.procedure_name_snapshot}{record.tooth_numbers ? ` · Tooth ${record.tooth_numbers}` : ""}</span></div><div className="dc-record-meta"><b>{record.consent_number}</b><small>{record.signed_at ? new Date(record.signed_at).toLocaleString("en-IN") : "Not signed"}</small></div><em className={record.status === "voided" ? "void" : ""}>{record.status === "voided" ? "Voided" : "Signed"}</em></article>)}</div>;
}

function Dashboard({ context, onNew, onRecords }: { context: ClinicContext; onNew: () => void; onRecords: () => void }) {
  const today = new Date().toDateString();
  const now = new Date();
  const signedToday = context.records.filter((r) => r.signed_at && new Date(r.signed_at).toDateString() === today && r.status === "signed").length;
  const signedMonth = context.records.filter((r) => { if (!r.signed_at || r.status !== "signed") return false; const d = new Date(r.signed_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  return <><div className="dc-title-row"><div><p className="dc-kicker">DENTMEMO CONSENT</p><h1>Good to see you, {context.displayName}.</h1><p className="dc-muted">Consent records for {context.clinicName}.</p></div><button className="dc-primary" onClick={onNew}>+ New Consent</button></div><section className="dc-metrics"><article><small>Signed today</small><strong>{signedToday}</strong></article><article><small>Signed this month</small><strong>{signedMonth}</strong></article><article><small>Templates ready</small><strong>{context.templates.filter((t) => t.approval_status === "approved").length}</strong></article></section><section className="dc-panel"><div className="dc-panel-head"><div><h2>Recent consents</h2><p>Signed forms stay searchable here.</p></div><button className="dc-link" onClick={onRecords}>View all</button></div><SimpleRecordList records={context.records.slice(0,6)} /></section></>;
}

function Records({ context, onRecordChanged, onRefresh }: { context: ClinicContext; onRecordChanged: (record: ConsentRecord) => void; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ConsentRecord | null>(null);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const filtered = context.records.filter((r) => `${r.patient_name_snapshot} ${r.patient_mobile_snapshot || ""} ${r.consent_number} ${r.procedure_name_snapshot}`.toLowerCase().includes(query.toLowerCase()));
  const canVoid = context.role === "owner" || context.role === "dentist" || context.role === "consultant";

  async function download(record: ConsentRecord) { setBusyId(record.id); setMessage(""); try { if (consentDemoMode()) throw new Error("Demo archive does not persist PDFs. Complete a demo consent and use Download PDF on the success screen."); const bytes = await downloadStoredConsent(record); downloadPdf(bytes, `${record.consent_number}.pdf`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not download PDF."); } finally { setBusyId(null); } }
  async function resend(record: ConsentRecord) { setBusyId(record.id); setMessage(""); try { await resendConsentEmail(record.id); setMessage(`Email sent for ${record.consent_number}.`); await onRefresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not resend email."); } finally { setBusyId(null); } }
  async function voidRecord(record: ConsentRecord) { const reason = window.prompt("Reason for voiding this signed consent?") || ""; if (!reason.trim()) return; setBusyId(record.id); setMessage(""); try { const updated = await voidSignedConsent(record, reason); onRecordChanged(updated); if (selected?.id === updated.id) setSelected(updated); setMessage(`${record.consent_number} was voided. The original record remains preserved.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not void consent."); } finally { setBusyId(null); } }

  return <><div className="dc-title-row"><div><p className="dc-kicker">ARCHIVE</p><h1>Consent records</h1><p className="dc-muted">Signed records are immutable. Corrections are handled by voiding and creating a new consent.</p></div></div><div className="dc-search"><span>⌕</span><input placeholder="Search patient, mobile, consent ID or procedure" value={query} onChange={(e) => setQuery(e.target.value)} /></div>{message && <div className="dc-alert dc-top-gap">{message}</div>}<section className="dc-panel">{!filtered.length && <div className="dc-empty"><span>✎</span><b>No matching consents</b></div>}<div className="dc-record-list">{filtered.map((record) => <article key={record.id}><div className="dc-record-icon">{record.status === "voided" ? "×" : "✓"}</div><div><b>{record.patient_name_snapshot}</b><span>{record.procedure_name_snapshot}{record.tooth_numbers ? ` · Tooth ${record.tooth_numbers}` : ""}</span></div><div className="dc-record-meta"><b>{record.consent_number}</b><small>{record.email_status === "sent" ? "Email sent" : record.email_status === "failed" ? "Email failed" : "Email pending"}</small></div><div className="dc-actions"><button className="dc-link" onClick={() => setSelected(record)}>View</button><button className="dc-link" disabled={busyId === record.id} onClick={() => void download(record)}>PDF</button>{record.status === "signed" && <button className="dc-link" disabled={busyId === record.id} onClick={() => void resend(record)}>Resend</button>}{record.status === "signed" && canVoid && <button className="dc-link" disabled={busyId === record.id} onClick={() => void voidRecord(record)}>Void</button>}</div></article>)}</div></section>{selected && <section className="dc-panel dc-top-gap"><div className="dc-panel-head"><div><small>{selected.consent_number}</small><h2>{selected.consent_title_snapshot || selected.procedure_name_snapshot}</h2></div><button className="dc-link" onClick={() => setSelected(null)}>Close</button></div><div className="dc-success-meta"><div><small>Patient</small><b>{selected.patient_name_snapshot}</b></div><div><small>Doctor</small><b>{selected.doctor_name_snapshot}</b></div><div><small>Status</small><b>{selected.status}</b></div></div>{selected.consent_text_snapshot && <div className="dc-consent-copy">{selected.consent_text_snapshot}</div>}<p><b>Signer:</b> {selected.signer_name || selected.patient_name_snapshot}{selected.signer_relationship ? ` · ${selected.signer_relationship}` : ""}</p>{selected.void_reason && <div className="dc-alert"><b>Voided:</b> {selected.void_reason}</div>}</section>}</>;
}

function Templates({ context, onRefresh }: { context: ClinicContext; onRefresh: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const isOwner = context.role === "owner";
  async function approve(template: ConsentTemplate) { setBusyId(template.id); setMessage(""); try { await approveTemplateForClinic(context.clinicId, template); setMessage(`${template.display_title} approved for clinic use.`); await onRefresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not approve template."); } finally { setBusyId(null); } }
  return <><div className="dc-title-row"><div><p className="dc-kicker">CLINIC FORMS</p><h1>Consent templates</h1><p className="dc-muted">Sample wording must be reviewed by your clinic before clinical use.</p></div></div>{message && <div className="dc-alert">{message}</div>}<div className="dc-template-grid">{context.templates.map((template) => <article className="dc-panel" key={template.id}><div className="dc-panel-head"><div><small>{template.procedure_key.replaceAll("_", " ").toUpperCase()}</small><h2>{template.display_title}</h2></div><em className={template.approval_status === "approved" ? "dc-approved" : "dc-review"}>{template.approval_status === "approved" ? "Approved" : "Needs review"}</em></div><p>{template.consent_text}</p><footer><span>Version {template.version}</span><span>{template.locale}</span></footer>{template.approval_status !== "approved" && isOwner && <button className="dc-secondary dc-wide" disabled={busyId === template.id} onClick={() => void approve(template)}>{busyId === template.id ? "Approving…" : "Approve for Clinic Use"}</button>}</article>)}</div></>;
}

function Settings({ context, onRefresh }: { context: ClinicContext; onRefresh: () => Promise<void> }) {
  const [doctorName, setDoctorName] = useState(""); const [registrationNumber, setRegistrationNumber] = useState(""); const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const isOwner = context.role === "owner";
  async function submit(event: FormEvent) { event.preventDefault(); setMessage(""); if (consentDemoMode()) return setMessage("Demo mode: connect Supabase to save clinic settings."); try { await saveDoctor(context.clinicId, { doctorName, registrationNumber, email }); setDoctorName(""); setRegistrationNumber(""); setEmail(""); setMessage("Doctor added."); await onRefresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save doctor."); } }
  return <><div className="dc-title-row"><div><p className="dc-kicker">SETTINGS</p><h1>Clinic & doctors</h1></div></div><div className="dc-settings-grid"><section className="dc-panel"><h2>Configured doctors</h2><div className="dc-doctors">{context.doctors.map((d) => <article key={d.id}><span>{d.doctor_name.slice(0,1)}</span><div><b>{d.doctor_name}</b><small>{d.registration_number || "Registration not added"} · {d.email}</small></div></article>)}</div></section>{isOwner && <section className="dc-panel"><h2>Add doctor</h2><form className="dc-form" onSubmit={submit}><label>Doctor name<input required value={doctorName} onChange={(e) => setDoctorName(e.target.value)} /></label><label>Dental registration number<input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} /></label><label>Email for signed PDFs<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>{message && <div className="dc-alert">{message}</div>}<button className="dc-primary">Add doctor</button></form></section>}</div></>;
}

function NewConsent({ context, onSaved, onCancel }: { context: ClinicContext; onSaved: (record: ConsentRecord) => Promise<void>; onCancel: () => void }) {
  const [step, setStep] = useState<NewStep>("details"); const [patientName, setPatientName] = useState(""); const [patientMobile, setPatientMobile] = useState(""); const [patientDob, setPatientDob] = useState(""); const [doctorId, setDoctorId] = useState(context.doctors[0]?.id || ""); const [templateId, setTemplateId] = useState(context.templates.find((t) => t.approval_status === "approved")?.id || ""); const [toothNumbers, setToothNumbers] = useState(""); const [procedureNotes, setProcedureNotes] = useState(""); const [guardian, setGuardian] = useState(false); const [guardianName, setGuardianName] = useState(""); const [relationship, setRelationship] = useState(""); const [acks, setAcks] = useState<string[]>([]); const [signature, setSignature] = useState<SignatureStroke[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState<{ record: ConsentRecord; pdf: Uint8Array; emailError?: string } | null>(null);
  const doctor = context.doctors.find((d) => d.id === doctorId); const template = context.templates.find((t) => t.id === templateId);
  function detailsSubmit(event: FormEvent) { event.preventDefault(); if (!doctor) return setError("Add or select a treating doctor."); if (!template || template.approval_status !== "approved") return setError("Select a consent template approved for clinic use."); setError(""); setStep("review"); }
  function toggleAck(ack: string) { setAcks((current) => current.includes(ack) ? current.filter((item) => item !== ack) : [...current, ack]); }
  async function submitSigned() { if (!doctor || !template) return; if (!signature.length) return setError("Please capture the signature."); if (guardian && (!guardianName.trim() || !relationship.trim())) return setError("Enter guardian name and relationship."); setBusy(true); setError(""); try { const result = await saveSignedConsent({ clinicId: context.clinicId, clinicName: context.clinicName, patientName, patientMobile, patientDob, doctor, template, procedureNotes, toothNumbers, acknowledgements: acks, signerType: guardian ? "guardian" : "patient", signerName: guardian ? guardianName : patientName, signerRelationship: guardian ? relationship : "", signature }); setSaved(result); setStep("success"); await onSaved(result.record); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not complete consent."); } finally { setBusy(false); } }
  if (step === "success" && saved) return <section className="dc-success"><span>✓</span><p className="dc-kicker">CONSENT COMPLETED</p><h1>{saved.record.consent_number}</h1><h2>{saved.record.patient_name_snapshot}</h2><p>{saved.record.procedure_name_snapshot}</p><div className="dc-success-meta"><div><small>Signed</small><b>{new Date(saved.record.signed_at || "").toLocaleString("en-IN")}</b></div><div><small>Doctor</small><b>{saved.record.doctor_name_snapshot}</b></div><div><small>Email</small><b>{saved.emailError ? "Delivery needs retry" : "Sent"}</b></div></div>{saved.emailError && <div className="dc-alert">Consent is signed safely, but email delivery failed: {saved.emailError}</div>}<div className="dc-actions"><button className="dc-primary" onClick={() => downloadPdf(saved.pdf, `${saved.record.consent_number}.pdf`)}>Download PDF</button><button className="dc-secondary" onClick={onCancel}>Done</button></div></section>;
  if (step === "sign" && doctor && template) { const allAcked = ACKS.every((ack) => acks.includes(ack)); return <section className="dc-patient-screen"><div className="dc-patient-top"><button className="dc-link" onClick={() => setStep("review")}>← Back</button><Logo /><span>Final step</span></div><div className="dc-sign-card"><p className="dc-kicker">PATIENT SIGNATURE</p><h1>{guardian ? "Parent / guardian signature" : "Please sign below"}</h1><p className="dc-muted">Use your finger or stylus inside the box.</p>{guardian && <div className="dc-two-col"><label>Guardian full name<input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></label><label>Relationship<input value={relationship} onChange={(e) => setRelationship(e.target.value)} /></label></div>}<SignaturePad value={signature} onChange={setSignature} /><p className="dc-privacy">Your information and signed consent will be stored by the clinic as part of its clinical records.</p>{error && <div className="dc-alert">{error}</div>}<button className="dc-primary dc-wide dc-submit" disabled={!allAcked || busy} onClick={() => void submitSigned()}>{busy ? "Completing consent…" : "Accept & Submit"}</button></div></section>; }
  if (step === "review" && doctor && template) return <section className="dc-patient-screen"><div className="dc-patient-top"><button className="dc-link" onClick={() => setStep("details")}>← Back</button><Logo /><span>Patient review</span></div><article className="dc-document"><div className="dc-document-head"><div><small>{context.clinicName}</small><h1>{template.display_title}</h1></div><span>Consent</span></div><dl><div><dt>Patient</dt><dd>{patientName}</dd></div><div><dt>Treating doctor</dt><dd>{doctor.doctor_name}</dd></div>{toothNumbers && <div><dt>Tooth / teeth</dt><dd>{toothNumbers}</dd></div>}</dl><div className="dc-consent-copy">{template.consent_text}</div><div className="dc-ack-list">{ACKS.map((ack) => <label key={ack}><input type="checkbox" checked={acks.includes(ack)} onChange={() => toggleAck(ack)} /><span>{ack}</span></label>)}</div><label className="dc-guardian-toggle"><input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} /><span>Patient is a minor / parent or guardian is signing</span></label><button className="dc-primary dc-wide" disabled={!ACKS.every((ack) => acks.includes(ack))} onClick={() => setStep("sign")}>Continue to Sign</button></article></section>;
  return <><div className="dc-title-row"><div><p className="dc-kicker">NEW CONSENT</p><h1>Patient & treatment</h1><p className="dc-muted">Enter the essentials, then hand the tablet to the patient.</p></div><button className="dc-link" onClick={onCancel}>Cancel</button></div><section className="dc-panel dc-form-panel"><form className="dc-form" onSubmit={detailsSubmit}><h2>Patient</h2><div className="dc-two-col"><label>Patient name<input required value={patientName} onChange={(e) => setPatientName(e.target.value)} /></label><label>Mobile<input inputMode="tel" value={patientMobile} onChange={(e) => setPatientMobile(e.target.value)} /></label></div><label>Date of birth<input type="date" value={patientDob} onChange={(e) => setPatientDob(e.target.value)} /></label><hr/><h2>Treatment</h2><div className="dc-two-col"><label>Treating doctor<select required value={doctorId} onChange={(e) => setDoctorId(e.target.value)}><option value="">Select doctor</option>{context.doctors.map((d) => <option key={d.id} value={d.id}>{d.doctor_name}</option>)}</select></label><label>Consent template<select required value={templateId} onChange={(e) => setTemplateId(e.target.value)}><option value="">Select procedure</option>{context.templates.filter((t) => t.approval_status === "approved").map((t) => <option key={t.id} value={t.id}>{t.display_title}</option>)}</select></label></div><div className="dc-two-col"><label>Tooth number(s)<input placeholder="e.g. 16, 17" value={toothNumbers} onChange={(e) => setToothNumbers(e.target.value)} /></label><label>Procedure notes<input placeholder="Optional" value={procedureNotes} onChange={(e) => setProcedureNotes(e.target.value)} /></label></div>{!context.doctors.length && <div className="dc-alert">Add a doctor in Settings before creating a live consent.</div>}{!context.templates.some((t) => t.approval_status === "approved") && <div className="dc-alert">Approve at least one template in Templates before creating a live consent.</div>}{error && <div className="dc-alert">{error}</div>}<button className="dc-primary">Review Consent →</button></form></section></>;
}

export default function ConsentApp() {
  const [user, setUser] = useState<User | null>(null); const [context, setContext] = useState<ClinicContext | null>(null); const [view, setView] = useState<View>("dashboard"); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const isDemo = useMemo(() => consentDemoMode(), []);
  async function refresh(targetUser = user) { if (isDemo) { setContext((existing) => existing || demoContext()); setLoading(false); return; } if (!targetUser) { setContext(null); setLoading(false); return; } try { setContext(await loadConsentContext(targetUser)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load Consent."); } finally { setLoading(false); } }
  useEffect(() => { let cancelled = false; void (async () => { if (isDemo) { if (!cancelled) { setContext(demoContext()); setLoading(false); } return; } const session = await currentSession(); if (!cancelled) { setUser(session?.user ?? null); await refresh(session?.user ?? null); } })(); return () => { cancelled = true; }; }, [isDemo]);
  async function signed(record: ConsentRecord) { setContext((current) => current ? { ...current, records: [record, ...current.records.filter((item) => item.id !== record.id)] } : current); }
  function changed(record: ConsentRecord) { setContext((current) => current ? { ...current, records: current.records.map((item) => item.id === record.id ? record : item) } : current); }
  async function logout() { if (!isDemo) await signOutConsent(); setUser(null); setContext(isDemo ? demoContext() : null); }
  if (loading) return <div className="dc-loading">Loading DentMemo Consent…</div>;
  if (error && !context) return <div className="dc-loading">{error}</div>;
  if (!isDemo && !user) return <AuthPanel onUser={(next) => { setUser(next); setLoading(true); void refresh(next); }} />;
  if (!context && user) return <ClinicSetup user={user} onDone={() => refresh(user)} />;
  if (!context) return null;
  return <Shell context={context} view={view} setView={setView} onSignOut={() => void logout()}>{isDemo && <div className="dc-demo-banner">Demo mode · use sample data only. Connect Supabase for clinic records.</div>}{view === "dashboard" && <Dashboard context={context} onNew={() => setView("new")} onRecords={() => setView("records")} />}{view === "records" && <Records context={context} onRecordChanged={changed} onRefresh={() => refresh(user)} />}{view === "templates" && <Templates context={context} onRefresh={() => refresh(user)} />}{view === "settings" && <Settings context={context} onRefresh={() => refresh(user)} />}{view === "new" && <NewConsent context={context} onSaved={signed} onCancel={() => setView("dashboard")} />}</Shell>;
}
