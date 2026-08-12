// seed.js
//
// Generates synthetic clinics/patients/visits/etc. at configurable scale so
// we can run EXPLAIN ANALYZE against realistic volume before real clinics
// are on the system. See benchmarks/queries.sql for the queries to run
// before and after this, and before/after the index migration.
//
// SAFETY: this connects with the `postgres` role (bypasses RLS) and writes
// directly. Only ever point DATABASE_URL at a sandbox project (dentmemo-labs).
// Never run against Dr. Blessin's project or the live DentMemo Product project.
//
// Usage:
//   cp .env.example .env   # fill in DATABASE_URL
//   npm install
//   npm run seed

import 'dotenv/config';
import pg from 'pg';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'node:crypto';

const {
  DATABASE_URL,
  SEED_CLINICS = '200',
  SEED_PATIENTS_PER_CLINIC_MIN = '150',
  SEED_PATIENTS_PER_CLINIC_MAX = '600',
  SEED_YEARS_OF_HISTORY = '3',
  SEED_VISITS_PER_PATIENT_PER_YEAR = '3',
  SEED_RANDOM_SEED = 'dentmemo-loadtest',
  SEED_CONCURRENCY = '8',
} = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

faker.seed(hashStringToInt(SEED_RANDOM_SEED));

const CONFIG = {
  clinics: parseInt(SEED_CLINICS, 10),
  patientsMin: parseInt(SEED_PATIENTS_PER_CLINIC_MIN, 10),
  patientsMax: parseInt(SEED_PATIENTS_PER_CLINIC_MAX, 10),
  years: parseInt(SEED_YEARS_OF_HISTORY, 10),
  visitsPerPatientPerYear: parseInt(SEED_VISITS_PER_PATIENT_PER_YEAR, 10),
  concurrency: parseInt(SEED_CONCURRENCY, 10),
};

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: CONFIG.concurrency + 2,
});

const TREATMENT_NAMES = [
  'Scaling & polishing', 'Composite filling', 'Root canal treatment',
  'Crown placement', 'Tooth extraction', 'Braces adjustment',
  'Whitening session', 'Implant consultation', 'Denture fitting', 'Fluoride application',
];
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer'];
const APPT_STATUSES_PAST = ['completed', 'completed', 'completed', 'cancelled', 'no_show'];
const APPT_STATUSES_FUTURE = ['scheduled', 'confirmed'];

function hashStringToInt(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function toothNumber() {
  // FDI notation, quadrant 1-4, tooth 1-8
  return `${faker.number.int({ min: 1, max: 4 })}${faker.number.int({ min: 1, max: 8 })}`;
}

// Parameterized multi-row insert, chunked to stay well under Postgres's
// 65535-parameter limit and keep individual statements fast.
async function bulkInsert(client, table, columns, rows, chunkSize = 500) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = [];
    const placeholders = chunk.map((row, rowIdx) => {
      const base = rowIdx * columns.length;
      values.push(...row);
      const ph = columns.map((_, colIdx) => `$${base + colIdx + 1}`);
      return `(${ph.join(',')})`;
    });
    const sql = `insert into ${table} (${columns.join(',')}) values ${placeholders.join(',')}`;
    await client.query(sql, values);
  }
}

// Stub auth.users row -- enough for FK integrity and for RLS functions to
// find a matching id, NOT a real account (unusable password, no login).
async function createStubAuthUsers(client, count) {
  const columns = [
    'instance_id', 'id', 'aud', 'role', 'email', 'encrypted_password',
    'email_confirmed_at', 'created_at', 'updated_at',
    'raw_app_meta_data', 'raw_user_meta_data', 'is_super_admin',
  ];
  const ids = [];
  const rows = [];
  for (let i = 0; i < count; i++) {
    const id = randomUUID();
    ids.push(id);
    rows.push([
      '00000000-0000-0000-0000-000000000000',
      id,
      'authenticated',
      'authenticated',
      `loadtest+${id}@dentmemo.invalid`,
      'not-a-real-password-hash',
      new Date(),
      new Date(),
      new Date(),
      JSON.stringify({ provider: 'email', providers: ['email'] }),
      JSON.stringify({ synthetic: true }),
      false,
    ]);
  }
  await bulkInsert(client, 'auth.users', columns, rows);
  return ids;
}

async function seedClinic(clinicIndex) {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const staffCount = faker.number.int({ min: 1, max: 3 }); // in addition to owner
    const userIds = await createStubAuthUsers(client, 1 + staffCount);
    const [ownerId, ...staffIds] = userIds;

    const clinicId = randomUUID();
    const clinicName = `${faker.person.lastName()} Dental ${faker.helpers.arrayElement(['Clinic', 'Studio', 'Care', 'Centre'])}`;
    await client.query(
      `insert into public.clinics (id, name, city, owner_user_id, created_at) values ($1,$2,$3,$4,$5)`,
      [clinicId, clinicName, faker.location.city(), ownerId, faker.date.past({ years: CONFIG.years })]
    );

    const memberRows = [[
      clinicId, ownerId, 'owner', faker.person.fullName(), `DEN-${faker.number.int({ min: 10000, max: 99999 })}`, true, new Date(),
    ]];
    staffIds.forEach((id) => {
      const role = faker.helpers.arrayElement(['dentist', 'assistant', 'consultant']);
      memberRows.push([
        clinicId, id, role, faker.person.fullName(),
        role === 'assistant' ? null : `DEN-${faker.number.int({ min: 10000, max: 99999 })}`,
        true, new Date(),
      ]);
    });
    await bulkInsert(
      client, 'public.clinic_members',
      ['clinic_id', 'user_id', 'role', 'full_name', 'registration_number', 'active', 'created_at'],
      memberRows
    );
    const practitionerIds = [ownerId, ...staffIds]; // any of these can see patients/appointments

    // ---- Patients ----
    const patientCount = faker.number.int({ min: CONFIG.patientsMin, max: CONFIG.patientsMax });
    const patientRows = [];
    const patientIds = [];
    for (let p = 0; p < patientCount; p++) {
      const id = randomUUID();
      patientIds.push(id);
      patientRows.push([
        id, clinicId, `P-${clinicIndex}-${p + 1}`, faker.person.fullName(),
        faker.phone.number({ style: 'international' }),
        faker.date.birthdate({ min: 5, max: 85, mode: 'age' }),
        faker.helpers.arrayElement(['male', 'female', 'other']),
        faker.helpers.maybe(() => faker.helpers.arrayElement(['Penicillin', 'Latex', 'None known']), { probability: 0.15 }),
        null, // archived_at
        faker.date.past({ years: CONFIG.years }),
        new Date(),
      ]);
    }
    await bulkInsert(
      client, 'public.patients',
      ['id', 'clinic_id', 'patient_number', 'full_name', 'phone', 'date_of_birth', 'gender', 'allergies', 'archived_at', 'created_at', 'updated_at'],
      patientRows
    );

    // ---- Appointments, visits, treatment plans, visit_treatments, payments, reminders ----
    const appointmentRows = [];
    const visitRows = [];
    const treatmentPlanRows = [];
    const visitTreatmentRows = [];
    const paymentRows = [];
    const reminderRows = [];

    for (const patientId of patientIds) {
      const totalVisits = Math.round(CONFIG.years * CONFIG.visitsPerPatientPerYear * faker.number.float({ min: 0.4, max: 1.4 }));

      for (let v = 0; v < totalVisits; v++) {
        const occurredAt = faker.date.past({ years: CONFIG.years });
        const isPast = occurredAt < new Date();
        const status = isPast
          ? faker.helpers.arrayElement(APPT_STATUSES_PAST)
          : faker.helpers.arrayElement(APPT_STATUSES_FUTURE);

        const appointmentId = randomUUID();
        const practitionerId = faker.helpers.arrayElement(practitionerIds);
        const startsAt = occurredAt;
        const endsAt = new Date(startsAt.getTime() + faker.number.int({ min: 20, max: 60 }) * 60000);

        appointmentRows.push([
          appointmentId, clinicId, patientId, practitionerId, startsAt, endsAt, status,
          faker.helpers.arrayElement(['Checkup', 'Follow-up', 'Cleaning', 'Pain', 'Consultation']),
          null, null, new Date(), new Date(),
        ]);

        if (status === 'completed') {
          const visitId = randomUUID();
          visitRows.push([
            visitId, clinicId, patientId, appointmentId, practitionerId, occurredAt,
            faker.lorem.sentence({ min: 6, max: 16 }),
            faker.helpers.maybe(() => faker.date.soon({ days: 30, refDate: occurredAt }), { probability: 0.3 }),
            new Date(), new Date(),
          ]);

          const treatmentCount = faker.number.int({ min: 1, max: 2 });
          for (let t = 0; t < treatmentCount; t++) {
            const fee = faker.number.int({ min: 300, max: 15000 });
            visitTreatmentRows.push([
              randomUUID(), visitId, null, toothNumber(),
              faker.helpers.arrayElement(TREATMENT_NAMES), 'completed', fee, new Date(),
            ]);

            if (faker.datatype.boolean({ probability: 0.8 })) {
              paymentRows.push([
                randomUUID(), clinicId, patientId, visitId, fee,
                faker.helpers.arrayElement(PAYMENT_METHODS), occurredAt, practitionerId, null, new Date(),
              ]);
            }
          }

          if (faker.datatype.boolean({ probability: 0.1 })) {
            treatmentPlanRows.push([
              randomUUID(), clinicId, patientId, toothNumber(),
              faker.helpers.arrayElement(TREATMENT_NAMES),
              faker.lorem.words(4),
              faker.helpers.arrayElement(['planned', 'in_progress', 'completed']),
              faker.number.int({ min: 1000, max: 40000 }),
              occurredAt, new Date(),
            ]);
          }
        } else if (status === 'scheduled' || status === 'confirmed') {
          reminderRows.push([
            randomUUID(), clinicId, appointmentId, 'whatsapp',
            new Date(startsAt.getTime() - 24 * 3600000), 'pending', null, null, new Date(), new Date(),
          ]);
        }
      }
    }

    await bulkInsert(
      client, 'public.appointments',
      ['id', 'clinic_id', 'patient_id', 'practitioner_user_id', 'starts_at', 'ends_at', 'status', 'reason', 'google_event_id', 'reminder_status', 'created_at', 'updated_at'],
      appointmentRows
    );
    await bulkInsert(
      client, 'public.visits',
      ['id', 'clinic_id', 'patient_id', 'appointment_id', 'practitioner_user_id', 'occurred_at', 'clinical_note', 'follow_up_on', 'created_at', 'updated_at'],
      visitRows
    );
    await bulkInsert(
      client, 'public.treatment_plans',
      ['id', 'clinic_id', 'patient_id', 'tooth_number', 'treatment_name', 'diagnosis', 'status', 'quoted_amount', 'created_at', 'updated_at'],
      treatmentPlanRows
    );
    await bulkInsert(
      client, 'public.visit_treatments',
      ['id', 'visit_id', 'treatment_plan_id', 'tooth_number', 'treatment_name', 'status', 'fee', 'created_at'],
      visitTreatmentRows
    );
    await bulkInsert(
      client, 'public.payments',
      ['id', 'clinic_id', 'patient_id', 'visit_id', 'amount', 'method', 'received_at', 'recorded_by', 'note', 'created_at'],
      paymentRows
    );
    await bulkInsert(
      client, 'public.reminders',
      ['id', 'clinic_id', 'appointment_id', 'channel', 'scheduled_for', 'status', 'provider_message_id', 'error_message', 'created_at', 'updated_at'],
      reminderRows
    );

    await client.query('commit');
    return {
      patients: patientRows.length,
      appointments: appointmentRows.length,
      visits: visitRows.length,
      payments: paymentRows.length,
    };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log(`Seeding ${CONFIG.clinics} clinics (concurrency=${CONFIG.concurrency})...`);
  console.log('If auth.users insert fails below, your Supabase Postgres version likely');
  console.log('has different required columns -- see the comment in createStubAuthUsers().');

  let done = 0;
  const totals = { patients: 0, appointments: 0, visits: 0, payments: 0 };
  const queue = Array.from({ length: CONFIG.clinics }, (_, i) => i);

  async function worker() {
    while (queue.length) {
      const idx = queue.shift();
      const result = await seedClinic(idx);
      totals.patients += result.patients;
      totals.appointments += result.appointments;
      totals.visits += result.visits;
      totals.payments += result.payments;
      done++;
      if (done % 10 === 0 || done === CONFIG.clinics) {
        console.log(`  ${done}/${CONFIG.clinics} clinics done`);
      }
    }
  }

  const workers = Array.from({ length: CONFIG.concurrency }, () => worker());
  await Promise.all(workers);

  console.log('\nDone. Totals:');
  console.log(totals);
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
