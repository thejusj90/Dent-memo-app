import type { SignatureStroke, SignedConsentInput } from "./types";

function esc(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrap(text: string, width = 82) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textCommand(text: string, x: number, y: number, size = 10, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET\n`;
}

function signatureCommands(strokes: SignatureStroke[], x: number, y: number, width: number, height: number) {
  let out = "0.9 w 0.08 0.18 0.35 RG\n";
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    const first = stroke.points[0];
    out += `${(x + first.x * width).toFixed(2)} ${(y + (1 - first.y) * height).toFixed(2)} m\n`;
    for (const point of stroke.points.slice(1)) {
      out += `${(x + point.x * width).toFixed(2)} ${(y + (1 - point.y) * height).toFixed(2)} l\n`;
    }
    out += "S\n";
  }
  return out;
}

export function buildConsentPdf(input: SignedConsentInput, consentNumber: string, signedAt: Date) {
  let stream = "";
  let y = 790;
  stream += textCommand("DentMemo Consent", 48, y, 18, true);
  y -= 24;
  stream += textCommand(input.clinicName, 48, y, 11, true);
  y -= 32;
  stream += textCommand(input.template.display_title.toUpperCase(), 48, y, 14, true);
  y -= 28;

  const rows = [
    ["Patient", input.patientName],
    ["Mobile", input.patientMobile || "-"],
    ["Date of birth", input.patientDob || "-"],
    ["Treating doctor", input.doctor.doctor_name],
    ["Registration", input.doctor.registration_number || "-"],
    ["Procedure", input.template.display_title],
    ["Tooth / teeth", input.toothNumbers || "-"],
    ["Consent ID", consentNumber],
  ];

  for (const [label, value] of rows) {
    stream += textCommand(`${label}:`, 48, y, 9, true);
    stream += textCommand(value, 150, y, 9);
    y -= 17;
  }

  if (input.procedureNotes.trim()) {
    y -= 4;
    stream += textCommand("Procedure notes:", 48, y, 9, true);
    y -= 15;
    for (const line of wrap(input.procedureNotes, 90)) {
      stream += textCommand(line, 48, y, 9);
      y -= 13;
    }
  }

  y -= 10;
  stream += textCommand("Consent information", 48, y, 11, true);
  y -= 18;
  for (const line of wrap(input.template.consent_text, 94)) {
    if (y < 315) break;
    stream += textCommand(line, 48, y, 9);
    y -= 13;
  }

  y -= 4;
  stream += textCommand("Acknowledgements", 48, y, 10, true);
  y -= 16;
  for (const ack of input.acknowledgements) {
    stream += textCommand(`- ${ack}`, 54, y, 8.5);
    y -= 13;
  }

  const signatureTop = Math.max(150, y - 8);
  stream += "0.7 w 0.75 0.79 0.86 RG\n";
  stream += `48 ${signatureTop - 85} 250 82 re S\n`;
  stream += signatureCommands(input.signature, 56, signatureTop - 78, 234, 66);

  stream += textCommand(
    input.signerType === "guardian" ? "Parent / guardian signature" : "Patient signature",
    48,
    signatureTop - 102,
    8,
    true,
  );
  stream += textCommand(`Signer: ${input.signerName}`, 330, signatureTop - 20, 8.5);
  if (input.signerType === "guardian") {
    stream += textCommand(`Relationship: ${input.signerRelationship || "-"}`, 330, signatureTop - 36, 8.5);
  }
  stream += textCommand(`Signed: ${signedAt.toLocaleString("en-IN")}`, 330, signatureTop - 52, 8.5);
  stream += textCommand("Generated electronically using DentMemo Consent", 48, 38, 7.5);

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>");
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
